import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../src/engine/commands';
import { assertCoreInvariants } from '../../src/engine/invariants';
import { accepted, intent, mutable } from '../fixtures/core-match';
import { cardInHand, passWindow, priorityFor } from '../fixtures/timing-match';
import {
  gamblingActionState,
  startRound,
  finishRound,
} from '../fixtures/gambling-match';
import { drinkState, resolveResponses } from '../fixtures/drink-match';

function stateForCheck() {
  const state = drinkState([]);
  state.phase = 'ACTION';
  return state;
}
describe('safe-boundary elimination, simultaneous selection, distribution, and victory', () => {
  it.each([3, 4])(
    'checks pass-out at Alcohol %i against Fortitude 4',
    (alcohol) => {
      const state = stateForCheck();
      state.players[1]!.fortitude = 4;
      state.players[1]!.alcoholContent = alcohol;
      const result = accepted(state, 'SKIP_ACTION');
      expect(result.state.players[1]!.eliminated).toBe(alcohol === 4);
      expect(result.state.activePlayerId).toBe('player_0');
      expect(
        result.events.filter((event) => event.type === 'PLAYER_ELIMINATED'),
      ).toHaveLength(alcohol === 4 ? 1 : 0);
    },
  );
  it.each([0, 1, 5, 6, 7, 8, 9])(
    'redistributes %i Gold with half rounded up and per-recipient remainder sent to the Inn',
    (amount) => {
      const state = stateForCheck();
      state.players[1]!.fortitude = 0;
      state.players[1]!.gold = amount;
      const result = accepted(state, 'SKIP_ACTION');
      const share = Math.floor(Math.floor(amount / 2) / 3);
      expect(result.state.players.map((player) => player.gold)).toEqual([
        10 + share,
        0,
        10 + share,
        10 + share,
      ]);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: 'GOLD_REDISTRIBUTED',
          playerId: 'player_1',
          amount,
          innGold: amount - 3 * share,
          payments: [
            { playerId: 'player_0', amount: share },
            { playerId: 'player_2', amount: share },
            { playerId: 'player_3', amount: share },
          ],
        }),
      );
      expect(
        result.state.players.reduce((sum, player) => sum + player.gold, 0) +
          amount -
          3 * share,
      ).toBe(30 + amount);
    },
  );
  it('supports configured rounding down or all-to-Inn and honors recipient headroom', () => {
    const down = stateForCheck();
    down.players[1]!.fortitude = 0;
    down.players[1]!.gold = 11;
    down.rules.elimination.innShareRounding = 'DOWN';
    expect(accepted(down, 'SKIP_ACTION').state.players[0]!.gold).toBe(12);
    down.rules.elimination.passOutGold = 'ALL_TO_INN';
    expect(accepted(down, 'SKIP_ACTION').state.players[0]!.gold).toBe(10);
    const capped = stateForCheck();
    capped.players[1]!.fortitude = 0;
    capped.rules.statBounds.gold = { min: 0, max: 11 };
    capped.players[0]!.gold = 11;
    const result = accepted(capped, 'SKIP_ACTION');
    expect(result.state.players.map((player) => player.gold)).toEqual([
      11, 0, 11, 11,
    ]);
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'GOLD_REDISTRIBUTED', innGold: 8 }),
    );
  });
  it('keeps an explicit Gold floor while redistributing only spendable Gold', () => {
    const state = stateForCheck();
    state.rules.statBounds.gold = { min: 5, max: 100 };
    state.players[1]!.fortitude = 0;
    const result = accepted(state, 'SKIP_ACTION');
    expect(result.state.players[1]!.gold).toBe(5);
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: 'GOLD_REDISTRIBUTED',
        amount: 5,
        innGold: 5,
      }),
    );
    assertCoreInvariants(result.state);
  });
  it('freezes simultaneous pass-outs before redistribution, with deterministic seat ordering', () => {
    const state = stateForCheck();
    state.players[1]!.fortitude = 0;
    state.players[1]!.gold = 6;
    state.players[2]!.fortitude = 0;
    state.players[2]!.gold = 9;
    state.players.reverse();
    const result = accepted(state, 'SKIP_ACTION');
    expect(
      result.events
        .filter((event) => event.type === 'PLAYER_ELIMINATED')
        .map((event) => event.playerId),
    ).toEqual(['player_1', 'player_2']);
    expect(
      result.state.players
        .filter((player) => !player.eliminated)
        .map((player) => player.gold),
    ).toEqual([13, 13]);
    expect(
      result.state.players
        .filter((player) => player.eliminated)
        .every((player) => player.gold === 0),
    ).toBe(true);
    expect(result.state.control.eliminationCheckPending).toBe(false);
  });
  it('eliminates simultaneous zero-Gold players without rescuing them through another victim payout', () => {
    const state = stateForCheck();
    state.players[1]!.gold = 0;
    state.players[2]!.gold = 0;
    state.players[3]!.fortitude = 0;
    const result = accepted(state, 'SKIP_ACTION');
    expect(result.state.winners).toEqual(['player_0']);
    expect(result.state.players[0]!.gold).toBe(15);
    expect(
      result.events
        .filter((event) => event.type === 'PLAYER_ELIMINATED')
        .map((event) => event.reason),
    ).toEqual(['BROKE', 'BROKE', 'PASSED_OUT']);
    expect(result.state.lifecycle).toBe('FINISHED');
    expect(result.state.phase).toBeNull();
    expect(result.state.activePlayerId).toBeNull();
    assertCoreInvariants(result.state);
  });
  it('ends in a tie when every player passes out simultaneously and sends all remaining Gold to the Inn', () => {
    const state = stateForCheck();
    state.players.forEach((player) => {
      player.fortitude = 0;
    });
    const result = accepted(state, 'SKIP_ACTION');
    expect(result.state.winners).toEqual([]);
    expect(result.state.lifecycle).toBe('FINISHED');
    expect(
      result.events
        .filter((event) => event.type === 'GOLD_REDISTRIBUTED')
        .map((event) => event.innGold),
    ).toEqual([10, 10, 10, 10]);
    expect(result.events.at(-1)).toMatchObject({
      type: 'MATCH_FINISHED',
      winnerIds: [],
    });
  });
  it('ends simultaneous zero-Gold elimination in a tie without redistribution', () => {
    const state = stateForCheck();
    state.players.forEach((player) => {
      player.gold = 0;
    });
    const result = accepted(state, 'SKIP_ACTION');
    expect(result.state.lifecycle).toBe('FINISHED');
    expect(result.state.winners).toEqual([]);
    expect(
      result.events.some((event) => event.type === 'GOLD_REDISTRIBUTED'),
    ).toBe(false);
  });
  it('immediately hands off an eliminated active seat and skips departed seats on future turns', () => {
    const state = stateForCheck();
    state.players[0]!.gold = 0;
    state.players[1]!.fortitude = 0;
    const result = accepted(state, 'SKIP_ACTION');
    expect(result.state.activePlayerId).toBe('player_2');
    expect(result.state.phase).toBe('DISCARD_DRAW');
    expect(result.state.control.turnNumber).toBe(2);
    const next = mutable(result.state);
    next.phase = 'NEXT_TURN';
    const fourth = accepted(next, 'ADVANCE_PHASE').state;
    expect(fourth.activePlayerId).toBe('player_3');
    const wrap = mutable(fourth);
    wrap.phase = 'NEXT_TURN';
    expect(accepted(wrap, 'ADVANCE_PHASE').state.activePlayerId).toBe(
      'player_2',
    );
  });
  it('rejects turn overflow atomically during elimination handoff and refuses commands after finish', () => {
    const state = stateForCheck();
    state.players[0]!.gold = 0;
    state.control.turnNumber = Number.MAX_SAFE_INTEGER;
    const before = JSON.stringify(state);
    expect(
      applyCommand(state, intent(state, 'SKIP_ACTION'), {
        actorId: state.players[0]!.id,
      }),
    ).toMatchObject({ status: 'REJECTED', code: 'TURN_LIMIT', events: [] });
    expect(JSON.stringify(state)).toBe(before);
    state.control.turnNumber = 1;
    state.players.slice(1).forEach((player) => {
      player.gold = 0;
    });
    const finished = accepted(state, 'SKIP_ACTION').state;
    expect(
      applyCommand(finished, intent(finished, 'TAKE_DRINK'), {
        actorId: state.players[0]!.id,
      }),
    ).toMatchObject({ status: 'REJECTED', code: 'WRONG_LIFECYCLE' });
  });
  it('delays zero-Gold elimination through gambling settlement, so the pot can save its winner', () => {
    const state = mutable(gamblingActionState());
    state.players.forEach((player) => {
      player.gold = 1;
    });
    const round = startRound(state);
    expect(round.state.players.map((player) => player.gold)).toEqual([
      0, 0, 0, 0,
    ]);
    expect(round.state.players.every((player) => !player.eliminated)).toBe(
      true,
    );
    const result = finishRound(round.state);
    expect(result.state.winners).toEqual(['player_0']);
    expect(result.state.players[0]!.gold).toBe(4);
    const payoutIndex = result.events.findIndex(
      (event) => event.type === 'GAMBLING_FINISHED',
    );
    expect(
      result.events.findIndex((event) => event.type === 'PLAYER_ELIMINATED'),
    ).toBeGreaterThan(payoutIndex);
  });
  it('defers nested temporary pass-out until the parent heals, and evaluates the final effect batch', () => {
    const state = stateForCheck();
    state.definitions[
      state.cards[cardInHand(state, 0, 'shove')]!.definitionId
    ]!.effects = [
      { op: 'CHANGE_STAT', target: 'SELF', stat: 'FORTITUDE', delta: 20 },
      { op: 'PAY_INN', target: 'SELF', amount: 10 },
      { op: 'CHANGE_STAT', target: 'SELF', stat: 'GOLD', delta: 10 },
    ];
    const queued = accepted(state, 'PLAY_CARD', {
      cardId: cardInHand(state, 0, 'shove'),
    }).state;
    const configured = mutable(priorityFor(queued, 1));
    configured.definitions[
      configured.cards[cardInHand(configured, 1, 'breather')]!.definitionId
    ]!.effects = [
      {
        op: 'CHANGE_STAT',
        target: 'CHOSEN_PLAYER',
        stat: 'FORTITUDE',
        delta: -20,
      },
    ];
    const replied = accepted(
      configured,
      'PLAY_RESPONSE',
      {
        responseWindowId: configured.responseWindow!.id,
        cardId: cardInHand(configured, 1, 'breather'),
        targetPlayerId: 'player_0',
      },
      configured.players[1]!.id,
    ).state;
    const leaf = passWindow(replied).state;
    expect(leaf.players[0]).toMatchObject({ fortitude: 0, eliminated: false });
    expect(leaf.control.eliminationCheckPending).toBe(true);
    const result = resolveResponses(leaf);
    expect(result.state.players[0]).toMatchObject({
      fortitude: 20,
      gold: 10,
      eliminated: false,
    });
    expect(result.state.control.eliminationCheckPending).toBe(false);
    expect(
      result.events.some((event) => event.type === 'PLAYER_ELIMINATED'),
    ).toBe(false);
  });
  it('finishes after an out-of-turn source eliminates the last opponent', () => {
    const state = stateForCheck();
    state.players[2]!.eliminated = true;
    state.players[3]!.eliminated = true;
    state.definitions[
      state.cards[cardInHand(state, 1, 'breather')]!.definitionId
    ]!.effects = [
      {
        op: 'CHANGE_STAT',
        target: 'CHOSEN_PLAYER',
        stat: 'FORTITUDE',
        delta: -20,
      },
    ];
    const queued = accepted(
      state,
      'PLAY_CARD',
      { cardId: cardInHand(state, 1, 'breather'), targetPlayerId: 'player_0' },
      state.players[1]!.id,
    ).state;
    const result = resolveResponses(queued);
    expect(result.state.winners).toEqual(['player_1']);
    expect(result.state.players[1]!.gold).toBe(15);
    expect(result.state.lifecycle).toBe('FINISHED');
  });
});

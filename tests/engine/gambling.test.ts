import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../src/engine/commands';
import { assertCoreInvariants } from '../../src/engine/invariants';
import { cardDefinitionSchema } from '../../src/content/cards';
import { rulesConfigSchema } from '../../src/engine/rules';
import {
  projectPublicGame,
  projectPrivatePlayer,
} from '../../src/protocol/projections';
import { domainEventSchema } from '../../src/protocol/events';
import type { CoreGameState } from '../../src/engine/types';
import { accepted, mutable, intent } from '../fixtures/core-match';
import {
  cardInHand,
  pass,
  passWindow,
  response,
  priorityFor,
} from '../fixtures/timing-match';
import {
  startRound,
  gamblingActionState,
  gamblingPlay,
  gamblingPass,
  finishRound,
} from '../fixtures/gambling-match';

function reject(
  state: CoreGameState,
  type: string,
  fields: Record<string, unknown>,
  code: string,
  seat = 1,
) {
  if (
    type === 'PLAY_RESPONSE' &&
    ![
      'NOT_PRIORITY',
      'ALREADY_PASSED',
      'NOT_ELIGIBLE',
      'WRONG_WINDOW',
      'VERSION_CONFLICT',
    ].includes(code)
  )
    state = priorityFor(state, seat);
  const before = JSON.stringify(state);
  const result = applyCommand(state, intent(state, type, fields), {
    actorId: state.players[seat]!.id,
  });
  expect(result).toMatchObject({ status: 'REJECTED', code, events: [] });
  expect(result.state).toBe(state);
  expect(JSON.stringify(state)).toBe(before);
}
function metadata(
  state: CoreGameState,
  suffix: string,
  categories: ('GAMBLING' | 'CHEATING')[],
  immediateWin = false,
) {
  const copy = mutable(state);
  const definition = Object.values(copy.definitions).find(
    (definition) => definition.id === `carddef_sample_${suffix}`,
  )!;
  copy.definitions[definition.id] = cardDefinitionSchema.parse({
    ...definition,
    gambling: { allowedNextCategories: categories, immediateWin },
  });
  return copy;
}
function chooseReaction(state: CoreGameState, seat: number, effect: unknown) {
  const copy = mutable(state);
  const definition =
    copy.definitions[
      copy.cards[cardInHand(copy, seat, 'breather')]!.definitionId
    ]!;
  copy.definitions[definition.id] = cardDefinitionSchema.parse({
    ...definition,
    effects: [effect],
  });
  return copy;
}

describe('antes, controller, and clockwise priority', () => {
  it('antes each living participant once into the pot and starts with initiator control', () => {
    const round = startRound();
    expect(round.state.gambling).toMatchObject({
      stage: 'ROUND',
      initiatorPlayerId: 'player_0',
      controlPlayerId: 'player_0',
      priorityPlayerId: 'player_1',
      participants: ['player_0', 'player_1', 'player_2', 'player_3'],
      anteAmount: 1,
      pot: 4,
      passedPlayerIds: [],
      leftPlayerIds: [],
      excludedPlayerIds: [],
    });
    expect(round.state.gambling!.contributions).toEqual(
      round.state.players.map((player) => ({ playerId: player.id, amount: 1 })),
    );
    expect(round.state.players.map((player) => player.gold)).toEqual([
      9, 9, 9, 9,
    ]);
    expect(
      round.events.filter((event) => event.type === 'GAMBLING_ANTE_PAID'),
    ).toHaveLength(4);
    expect(round.state.phase).toBe('ACTION');
    expect(round.state.resolutionStack).toHaveLength(1);
    expect(round.state.resolutionStack[0]!.stage).toBe('OPERATIONS');
    assertCoreInvariants(round.state);
  });
  it('excludes eliminated players and players unable to pay the configured full ante', () => {
    const state = mutable(gamblingActionState());
    state.rules.gambling.anteAmount = 3;
    state.players[1]!.gold = 2;
    state.players[2]!.gold = 0;
    const round = startRound(state);
    expect(round.state.gambling).toMatchObject({
      participants: ['player_0', 'player_3'],
      excludedPlayerIds: ['player_1', 'player_2'],
      pot: 6,
      priorityPlayerId: 'player_3',
    });
    expect(round.state.players.map((player) => player.gold)).toEqual([
      7, 2, 0, 7,
    ]);
    expect(round.state.players.every((player) => !player.eliminated)).toBe(
      true,
    );
    const eliminated = mutable(gamblingActionState());
    eliminated.players[2]!.eliminated = true;
    expect(startRound(eliminated).state.gambling!.participants).toEqual([
      'player_0',
      'player_1',
      'player_3',
    ]);
  });
  it('can accept partial positive antes and defers zero-Gold elimination', () => {
    const state = mutable(gamblingActionState());
    state.rules.gambling = {
      ...state.rules.gambling,
      anteAmount: 3,
      insufficientGold: 'PAY_AVAILABLE',
    };
    state.players[1]!.gold = 2;
    state.players[2]!.gold = 0;
    const round = startRound(state);
    expect(round.state.gambling!.pot).toBe(8);
    expect(
      round.state.gambling!.contributions.map((entry) => entry.amount),
    ).toEqual([3, 2, 3]);
    expect(round.state.players[1]!.gold).toBe(0);
    expect(round.state.players[1]!.eliminated).toBe(false);
    expect(round.state.control.eliminationCheckPending).toBe(true);
    expect(round.events).toContainEqual(
      expect.objectContaining({
        type: 'ELIMINATION_CHECK_REQUESTED',
        playerId: 'player_1',
        reason: 'BROKE',
      }),
    );
  });
  it('rejects a broke initiator, respects the effective Gold floor, and returns a solo ante once', () => {
    const state = mutable(gamblingActionState());
    state.players[0]!.gold = 0;
    reject(
      state,
      'PLAY_CARD',
      { cardId: cardInHand(state, 0, 'gamble') },
      'NOT_ELIGIBLE',
      0,
    );
    state.players[0]!.gold = 10;
    state.players.slice(1).forEach((player) => {
      player.gold = 0;
    });
    const solo = startRound(state);
    expect(solo.state.gambling).toBeNull();
    expect(solo.state.players[0]!.gold).toBe(10);
    expect(solo.state.lifecycle).toBe('FINISHED');
    expect(solo.state.winners).toEqual(['player_0']);
    expect(
      solo.events.filter((event) => event.type === 'GAMBLING_FINISHED'),
    ).toHaveLength(1);
    const floor = mutable(gamblingActionState());
    floor.rules.statBounds.gold = { min: 9, max: 100 };
    floor.rules.gambling.anteAmount = 2;
    reject(
      floor,
      'PLAY_CARD',
      { cardId: cardInHand(floor, 0, 'gamble') },
      'NOT_ELIGIBLE',
      0,
    );
  });
  it('can start with the next participant controlling, based on configuration', () => {
    const state = mutable(gamblingActionState());
    state.rules.gambling.initiatorControls = false;
    expect(startRound(state).state.gambling).toMatchObject({
      controlPlayerId: 'player_1',
      priorityPlayerId: 'player_2',
    });
    state.activePlayerId = state.players[2]!.id;
    state.players.reverse();
    const played = accepted(state, 'PLAY_CARD', {
      cardId: state.players
        .find((player) => player.id === 'player_2')!
        .hand.find(
          (id) => state.cards[id]!.definitionId === 'carddef_sample_gamble',
        ),
    }).state;
    expect(passWindow(played).state.gambling).toMatchObject({
      controlPlayerId: 'player_3',
      priorityPlayerId: 'player_0',
      participants: ['player_0', 'player_1', 'player_2', 'player_3'],
    });
  });
  it('passes clockwise, skips controller, settles all-pass, and conserves Gold plus pot', () => {
    const round = startRound();
    const completed = finishRound(round.state);
    expect(
      completed.events
        .filter((event) => event.type === 'GAMBLING_PASSED')
        .map((event) => event.playerId),
    ).toEqual(['player_1', 'player_2', 'player_3']);
    for (const result of completed.results)
      expect(
        result.state.players.reduce(
          (sum, player) => sum + player.gold,
          result.state.gambling?.pot ?? 0,
        ),
      ).toBe(40);
    expect(completed.state.players.map((player) => player.gold)).toEqual([
      13, 9, 9, 9,
    ]);
    expect(completed.state.gambling).toBeNull();
    expect(completed.state.phase).toBe('ORDER_DRINK');
    expect(completed.state.activePlayerId).toBe('player_0');
    expect(completed.state.resolutionStack).toEqual([]);
    expect(
      completed.events.filter((event) => event.type === 'GAMBLING_FINISHED'),
    ).toHaveLength(1);
  });
});

describe('control cards, restrictions, reactions, and leaving', () => {
  it('saves and resumes a choice after control changes without invalid priority or early payout', () => {
    const state = metadata(startRound().state, 'cheat', ['CHEATING'], true);
    const definition =
      state.definitions[
        state.cards[cardInHand(state, 1, 'cheat')]!.definitionId
      ]!;
    definition.effects = [
      {
        op: 'OPEN_OPTION',
        target: 'SELF',
        options: [{ id: 'sample-win', label: 'Sample winning option' }],
      },
    ];
    const choosing = passWindow(gamblingPlay(state, 1, 'cheat').state).state;
    expect(choosing.gambling).toMatchObject({
      controlPlayerId: 'player_1',
      priorityPlayerId: 'player_2',
      pot: 4,
    });
    expect(choosing.players[1]!.gold).toBe(9);
    assertCoreInvariants(choosing);
    const restored = JSON.parse(JSON.stringify(choosing)) as CoreGameState;
    const choose = (input: CoreGameState) =>
      accepted(
        input,
        'CHOOSE_OPTION',
        {
          responseWindowId: input.responseWindow!.id,
          optionId: 'sample-win',
        },
        input.players[1]!.id,
      );
    expect(choose(restored)).toEqual(choose(choosing));
    const settled = passWindow(choose(restored).state).state;
    expect(settled.gambling).toBeNull();
    expect(settled.players[1]!.gold).toBe(13);
    expect(settled.phase).toBe('ORDER_DRINK');
  });
  it.each(['gamble', 'cheat'])(
    '%s transfers control after its response window, from the correct hand',
    (suffix) => {
      const round = startRound().state;
      const played = gamblingPlay(round, 1, suffix);
      const cardId = cardInHand(round, 1, suffix);
      expect(played.state.players[1]!.hand).not.toContain(cardId);
      expect(played.state.cards[cardId]!.location.zone).toBe('RESOLUTION');
      expect(played.state.gambling!.controlPlayerId).toBe('player_0');
      const controlled = passWindow(played.state);
      expect(controlled.state.gambling).toMatchObject({
        controlPlayerId: 'player_1',
        priorityPlayerId: 'player_2',
        controlSourceCardId: cardId,
      });
      expect(controlled.state.cards[cardId]!.location.zone).toBe(
        'CHARACTER_DISCARD',
      );
      expect(controlled.state.gambling!.pot).toBe(4);
      const completed = finishRound(controlled.state);
      expect(completed.state.players[1]!.gold).toBe(13);
      expect(
        completed.events
          .filter((event) => event.type === 'GAMBLING_PASSED')
          .map((event) => event.playerId),
      ).toEqual(['player_2', 'player_3', 'player_0']);
    },
  );
  it('expresses restricted control through category metadata and permits only that category', () => {
    const round = startRound().state;
    const restricted = metadata(round, 'gamble', ['CHEATING']);
    const controlled = passWindow(
      gamblingPlay(restricted, 1, 'gamble').state,
    ).state;
    expect(controlled.gambling!.allowedControlCategories).toEqual(['CHEATING']);
    reject(
      controlled,
      'GAMBLING_PLAY',
      { cardId: cardInHand(controlled, 2, 'gamble') },
      'CONTROL_RESTRICTED',
      2,
    );
    expect(
      passWindow(gamblingPlay(controlled, 2, 'cheat').state).state.gambling!
        .controlPlayerId,
    ).toBe('player_2');
    expect(
      startRound(metadata(gamblingActionState(), 'gamble', ['CHEATING'])).state
        .gambling!.allowedControlCategories,
    ).toEqual(['CHEATING']);
  });
  it('supports an immediate-win hook after reactions and pays the winner once', () => {
    const round = metadata(
      startRound().state,
      'cheat',
      ['GAMBLING', 'CHEATING'],
      true,
    );
    const played = gamblingPlay(round, 1, 'cheat');
    expect(played.state.gambling!.pot).toBe(4);
    const completed = passWindow(played.state);
    expect(completed.state.gambling).toBeNull();
    expect(completed.state.players[1]!.gold).toBe(13);
    expect(completed.events).toContainEqual(
      expect.objectContaining({
        type: 'GAMBLING_FINISHED',
        reason: 'IMMEDIATE_WIN',
        winnerPlayerId: 'player_1',
        pot: 4,
      }),
    );
    const sourceImmediate = startRound(
      metadata(gamblingActionState(), 'gamble', ['GAMBLING', 'CHEATING'], true),
    );
    expect(sourceImmediate.state.gambling).toBeNull();
    expect(sourceImmediate.state.players[0]!.gold).toBe(13);
  });
  it('Negate cancels control and an immediate win while preserving antes and prior controller', () => {
    const round = metadata(
      startRound().state,
      'cheat',
      ['GAMBLING', 'CHEATING'],
      true,
    );
    const played = gamblingPlay(round, 1, 'cheat');
    const negated = response(played.state, 2, 'negate');
    const completed = passWindow(negated.state);
    expect(completed.state.gambling).toMatchObject({
      controlPlayerId: 'player_0',
      priorityPlayerId: 'player_2',
      pot: 4,
    });
    expect(
      completed.events.some((event) => event.type === 'GAMBLING_WIN_REQUESTED'),
    ).toBe(false);
    expect(finishRound(completed.state).state.players[0]!.gold).toBe(13);
  });
  it('leaving preserves the ante, blocks further controls, and still permits a response', () => {
    const round = startRound().state;
    const leaving = accepted(
      round,
      'GAMBLING_LEAVE',
      {},
      round.players[1]!.id,
    ).state;
    const left = passWindow(leaving).state;
    expect(left.gambling).toMatchObject({
      leftPlayerIds: ['player_1'],
      pot: 4,
      priorityPlayerId: 'player_2',
    });
    for (const suffix of ['gamble', 'cheat'])
      reject(
        left,
        'GAMBLING_PLAY',
        { cardId: cardInHand(left, 1, suffix) },
        'NOT_ELIGIBLE',
      );
    let playing = gamblingPlay(left, 2, 'gamble').state;
    for (let i = 0; i < 2; i += 1) playing = pass(playing).state;
    expect(playing.responseWindow!.priorityPlayerId).toBe('player_0');
    const reaction = response(playing, 1, 'breather');
    const resumed = passWindow(reaction.state).state;
    expect(resumed.players[1]!.fortitude).toBe(21);
    const controlled = passWindow(resumed).state;
    expect(finishRound(controlled).state.players[2]!.gold).toBe(13);
  });
  it('passing preserves participation and control changes reset consensus so a passer can play later', () => {
    const passed = gamblingPass(startRound().state).state;
    reject(
      passed,
      'GAMBLING_PLAY',
      { cardId: cardInHand(passed, 1, 'cheat') },
      'NOT_PRIORITY',
    );
    const control = passWindow(gamblingPlay(passed, 2, 'cheat').state).state;
    expect(control.gambling!.passedPlayerIds).toEqual([]);
    expect(
      finishRound(control)
        .events.filter((event) => event.type === 'GAMBLING_PASSED')
        .map((event) => event.playerId),
    ).toEqual(['player_3', 'player_0', 'player_1']);
    const again = gamblingPass(gamblingPass(control).state).state;
    expect(again.gambling!.priorityPlayerId).toBe('player_1');
    expect(
      passWindow(gamblingPlay(again, 1, 'cheat').state).state.gambling,
    ).toMatchObject({
      controlPlayerId: 'player_1',
      passedPlayerIds: [],
      priorityPlayerId: 'player_2',
    });
  });
  it('a departing passer is removed from consensus during a response without refunding the ante', () => {
    const passed = gamblingPass(startRound().state).state;
    expect(passed.gambling!.passedPlayerIds).toEqual(['player_1']);
    const controlled = gamblingPlay(passed, 2, 'gamble').state;
    const waiting = pass(pass(controlled).state).state;
    const input = chooseReaction(waiting, 1, {
      op: 'LEAVE_GAMBLING',
      target: 'SELF',
    });
    const queued = response(input, 1, 'breather');
    const departed = passWindow(queued.state).state;
    expect(departed.gambling).toMatchObject({
      passedPlayerIds: [],
      leftPlayerIds: ['player_1'],
      controlPlayerId: 'player_0',
      priorityPlayerId: 'player_2',
      pot: 4,
    });
    expect(departed.players[1]!.gold).toBe(9);
    const finished = finishRound(passWindow(departed).state).state;
    expect(finished.players.map((player) => player.gold)).toEqual([
      9, 9, 13, 9,
    ]);
    assertCoreInvariants(finished);
  });
  it('can leave via a validated response effect and reassigns a departing controller', () => {
    const round = startRound().state;
    let playing = gamblingPlay(round, 1, 'gamble').state;
    playing = pass(pass(playing).state).state;
    const controller = chooseReaction(playing, 0, {
      op: 'LEAVE_GAMBLING',
      target: 'SELF',
    });
    const leaf = passWindow(response(controller, 0, 'breather').state).state;
    expect(leaf.gambling!.leftPlayerIds).toEqual(['player_0']);
    expect(leaf.gambling!.controlPlayerId).toBe('player_1');
    expect(passWindow(leaf).state.gambling!.controlPlayerId).toBe('player_1');
  });
  it('a pending control source is canceled when its actor leaves via a nested response', () => {
    const playing = gamblingPlay(startRound().state, 1, 'cheat').state;
    const configured = chooseReaction(playing, 1, {
      op: 'LEAVE_GAMBLING',
      target: 'SELF',
    });
    const completed = passWindow(response(configured, 1, 'breather').state);
    expect(completed.state.resolutionStack).toHaveLength(1);
    expect(completed.state.gambling).toMatchObject({
      controlPlayerId: 'player_0',
      leftPlayerIds: ['player_1'],
      pot: 4,
    });
  });
  it('nested departures preserve a final winner and skip a previously accepted last-player leave', () => {
    let state: CoreGameState = chooseReaction(
      gamblingPlay(startRound().state, 1, 'gamble').state,
      2,
      {
        op: 'LEAVE_GAMBLING',
        target: 'SELF',
      },
    );
    for (const seat of [2, 3, 0, 1])
      state = response(state, seat, 'breather').state;
    const events = [];
    while (state.responseWindow !== null) {
      const result = passWindow(state);
      events.push(...result.events);
      state = result.state;
    }
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'GAMBLING_LEAVE_SKIPPED',
        playerId: 'player_2',
      }),
    );
    expect(
      events.filter((event) => event.type === 'GAMBLING_FINISHED'),
    ).toHaveLength(1);
    expect(state.gambling).toBeNull();
    expect(state.players.map((player) => player.gold)).toEqual([9, 9, 13, 9]);
    expect(state.phase).toBe('ORDER_DRINK');
  });
  it('Ignore suppresses a SELF leave effect under the normal target rules', () => {
    let state: CoreGameState = chooseReaction(
      gamblingPlay(startRound().state, 1, 'gamble').state,
      2,
      {
        op: 'LEAVE_GAMBLING',
        target: 'SELF',
      },
    );
    state = response(state, 2, 'breather').state;
    state = passWindow(response(state, 2, 'ignore').state).state;
    const completed = passWindow(state);
    expect(completed.state.gambling!.leftPlayerIds).toEqual([]);
    expect(
      completed.events.some((event) => event.type === 'GAMBLING_PLAYER_LEFT'),
    ).toBe(false);
    expect(passWindow(completed.state).state.gambling!.controlPlayerId).toBe(
      'player_1',
    );
  });
});

describe('suspension, authority, idempotency, and Gold boundaries', () => {
  it('suspends normal commands, allows reaction windows, and resumes remaining initiating effects', () => {
    const state = mutable(gamblingActionState());
    const actionId = cardInHand(state, 0, 'shove');
    state.definitions[state.cards[actionId]!.definitionId]!.effects = [
      { op: 'START_GAMBLING' },
      { op: 'CHANGE_STAT', target: 'SELF', stat: 'FORTITUDE', delta: 2 },
    ];
    const round = passWindow(
      accepted(state, 'PLAY_CARD', { cardId: actionId }).state,
    ).state;
    expect(round.players[0]!.fortitude).toBe(20);
    reject(round, 'SKIP_ACTION', {}, 'RESOLUTION_PENDING', 0);
    reject(round, 'ADVANCE_PHASE', {}, 'RESOLUTION_PENDING', 0);
    expect(
      accepted(
        round,
        'PLAY_CARD',
        { cardId: cardInHand(round, 1, 'breather') },
        round.players[1]!.id,
      ).state.resolutionStack,
    ).toHaveLength(2);
    const completed = finishRound(round).state;
    expect(completed.players[0]!.fortitude).toBe(22);
    expect(completed.phase).toBe('ORDER_DRINK');
    expect(completed.control.turnNumber).toBe(1);
  });
  it('retries start/ante and payout commands without duplicating money and rejects stale commands', () => {
    const initial = gamblingActionState();
    const command = intent(initial, 'PLAY_CARD', {
      cardId: cardInHand(initial, 0, 'gamble'),
    });
    const queued = applyCommand(initial, command, {
      actorId: initial.players[0]!.id,
    });
    const round = passWindow(queued.state).state;
    expect(
      applyCommand(round, command, { actorId: initial.players[0]!.id }),
    ).toMatchObject({ status: 'DUPLICATE', events: [] });
    let state = gamblingPass(gamblingPass(round).state).state;
    const payoutCommand = intent(state, 'GAMBLING_PASS');
    const result = applyCommand(state, payoutCommand, {
      actorId: state.players[3]!.id,
    });
    expect(result.status).toBe('ACCEPTED');
    expect(
      applyCommand(result.state, payoutCommand, {
        actorId: state.players[3]!.id,
      }),
    ).toMatchObject({ status: 'DUPLICATE', events: [] });
    const settled = passWindow(result.state).state;
    expect(settled.players[0]!.gold).toBe(13);
    expect(
      applyCommand(settled, payoutCommand, { actorId: state.players[3]!.id }),
    ).toMatchObject({ status: 'DUPLICATE', events: [] });
    reject(settled, 'GAMBLING_PASS', {}, 'NO_GAMBLING', 3);
    reject(
      state,
      'GAMBLING_PASS',
      { expectedStateVersion: 0 },
      'VERSION_CONFLICT',
      3,
    );
    state = mutable(round);
    reject(state, 'GAMBLING_PASS', { gold: 999 }, 'INVALID_COMMAND');
  });
  it('rejects wrong priorities, unowned cards, unsupported categories, and plays during reactions', () => {
    const state = startRound().state;
    reject(state, 'GAMBLING_PASS', {}, 'NOT_PRIORITY', 2);
    reject(
      state,
      'GAMBLING_PLAY',
      { cardId: cardInHand(state, 2, 'cheat') },
      'CARD_NOT_IN_HAND',
    );
    reject(
      state,
      'GAMBLING_PLAY',
      { cardId: cardInHand(state, 1, 'shove') },
      'UNSUPPORTED_CARD',
    );
    const playing = gamblingPlay(state, 1, 'gamble').state;
    reject(playing, 'GAMBLING_PASS', {}, 'RESOLUTION_PENDING', 2);
    const disabled = mutable(state);
    disabled.rules.gambling.allowLeave = false;
    reject(disabled, 'GAMBLING_LEAVE', {}, 'LEAVE_NOT_ALLOWED');
    const reaction = chooseReaction(playing, 2, { op: 'START_GAMBLING' });
    reject(
      reaction,
      'PLAY_RESPONSE',
      {
        responseWindowId: reaction.responseWindow!.id,
        cardId: cardInHand(reaction, 2, 'breather'),
      },
      'ILLEGAL_TIMING',
      2,
    );
  });
  it('validates payout headroom before charging antes and aborts cleanly if reactions change eligibility', () => {
    const state = mutable(gamblingActionState());
    state.rules.statBounds.gold = { min: 0, max: 10 };
    reject(
      state,
      'PLAY_CARD',
      { cardId: cardInHand(state, 0, 'gamble') },
      'GOLD_CAPACITY',
      0,
    );
    let queued = accepted(gamblingActionState(), 'PLAY_CARD', {
      cardId: cardInHand(gamblingActionState(), 0, 'gamble'),
    }).state;
    queued = chooseReaction(queued, 0, {
      op: 'PAY_INN',
      target: 'SELF',
      amount: 10,
    });
    const replied = passWindow(response(queued, 0, 'breather').state).state;
    const completed = passWindow(replied);
    expect(completed.state.gambling).toBeNull();
    expect(completed.state.players.map((player) => player.gold)).toEqual([
      0, 10, 10, 10,
    ]);
    expect(completed.events).toContainEqual(
      expect.objectContaining({
        type: 'GAMBLING_START_CANCELED',
        reason: 'NOT_ELIGIBLE',
      }),
    );
  });
  it('reserves payout capacity during Gold reactions, so the whole pot can be credited', () => {
    const state = mutable(gamblingActionState());
    state.rules.statBounds.gold = { min: 0, max: 20 };
    const round = startRound(state).state;
    const playing = chooseReaction(gamblingPlay(round, 1, 'gamble').state, 2, {
      op: 'CHANGE_STAT',
      target: 'SELF',
      stat: 'GOLD',
      delta: 100,
    });
    const replied = passWindow(response(playing, 2, 'breather').state).state;
    expect(replied.players[2]!.gold).toBe(16);
    const controlled = passWindow(replied).state;
    const win = passWindow(gamblingPlay(controlled, 2, 'cheat').state).state;
    expect(finishRound(win).state.players[2]!.gold).toBe(20);
    let passed = gamblingPass(round).state;
    passed = gamblingPlay(passed, 2, 'gamble').state;
    passed = pass(pass(passed).state).state;
    passed = chooseReaction(passed, 1, {
      op: 'CHANGE_STAT',
      target: 'SELF',
      stat: 'GOLD',
      delta: 100,
    });
    const repliedPasser = passWindow(
      response(passed, 1, 'breather').state,
    ).state;
    expect(repliedPasser.players[1]!.gold).toBe(16);
    expect(repliedPasser.gambling!.passedPlayerIds).toEqual(['player_1']);
    const newControl = passWindow(repliedPasser).state;
    const nextPasser = gamblingPass(gamblingPass(newControl).state).state;
    const returnedControl = passWindow(
      gamblingPlay(nextPasser, 1, 'cheat').state,
    ).state;
    expect(finishRound(returnedControl).state.players[1]!.gold).toBe(20);
  });
  it('serializes mid-gambling and replays a complete round deterministically across seeds', () => {
    for (let seed = 0; seed < 6; seed += 1) {
      const round = startRound(gamblingActionState(seed));
      const run = (initial: CoreGameState) => {
        const played = gamblingPlay(initial, 1, 'gamble');
        const controlled = passWindow(played.state);
        const cheated = gamblingPlay(controlled.state, 2, 'cheat');
        const controller = passWindow(cheated.state);
        const completed = finishRound(controller.state);
        const events = [
          ...played.events,
          ...controlled.events,
          ...cheated.events,
          ...controller.events,
          ...completed.events,
        ];
        for (const event of events)
          expect(domainEventSchema.parse(event)).toEqual(event);
        assertCoreInvariants(completed.state);
        expect(
          completed.state.players.reduce((sum, player) => sum + player.gold, 0),
        ).toBe(40);
        return { state: completed.state, events };
      };
      expect(
        run(JSON.parse(JSON.stringify(round.state)) as CoreGameState),
      ).toEqual(run(round.state));
    }
  }, 20000);
  it('projects pot, controller, priority, and antes without leaking hands or suspended operations', () => {
    const state = startRound().state;
    const view = projectPublicGame(state);
    expect(view.gambling).toMatchObject({
      pot: 4,
      controlPlayerId: 'player_0',
      priorityPlayerId: 'player_1',
    });
    expect(view.gambling).not.toHaveProperty('suspended');
    const json = JSON.stringify(view);
    for (const player of state.players)
      for (const id of [
        ...player.hand,
        ...player.characterDeck.cardIds,
        ...player.drinkPile,
      ])
        expect(json).not.toContain(JSON.stringify(id));
    expect(
      projectPrivatePlayer(state, state.players[1]!.id).hand.map(
        (card) => card.id,
      ),
    ).toEqual(state.players[1]!.hand);
  });
  it('validates configuration and generic metadata without card-name checks', () => {
    const rules = gamblingActionState().rules;
    expect(
      rulesConfigSchema.safeParse({
        ...rules,
        gambling: { ...rules.gambling, anteAmount: 0 },
      }).success,
    ).toBe(false);
    expect(
      rulesConfigSchema.safeParse({
        ...rules,
        gambling: { ...rules.gambling, insufficientGold: 'FREE' },
      }).success,
    ).toBe(false);
    const renamed = metadata(startRound().state, 'cheat', ['CHEATING']);
    renamed.definitions[
      renamed.cards[cardInHand(renamed, 1, 'cheat')]!.definitionId
    ]!.name = 'Sample generic controller';
    expect(
      passWindow(gamblingPlay(renamed, 1, 'cheat').state).state.gambling!
        .allowedControlCategories,
    ).toEqual(['CHEATING']);
  });
});

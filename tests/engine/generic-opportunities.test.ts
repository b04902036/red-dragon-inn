import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../src/engine/commands';
import { intent, mutable } from '../fixtures/core-match';
import { cardInHand } from '../fixtures/timing-match';
import {
  genericState,
  putCard,
  play,
  send,
  until,
  legal,
  settle,
  systemTrigger,
  reconnectAndReplay,
} from '../fixtures/generic-match';

describe('generic system opportunities', () => {
  it('phase-scoped Sometimes uses its declared predicate for projection and forged commands', () => {
    const state = genericState();
    state.phase = 'ORDER_DRINK';
    const id = putCard(state, 0, [{ op: 'ORDER_EXTRA_DRINKS', count: 1 }], {
      phaseOpportunity: 'ORDER_DRINK',
      trigger: {
        event: 'SYSTEM',
        alternatives: [
          [{ kind: 'PLAYER_STAT', stat: 'GOLD', comparison: 'GTE', value: 11 }],
        ],
      },
    });
    expect(legal(state, 0, id)).toBeUndefined();
    expect(
      applyCommand(state, intent(state, 'PLAY_CARD', { cardId: id }), {
        actorId: state.players[0]!.id,
      }).status,
    ).toBe('REJECTED');
    const gain = putCard(
      state,
      1,
      [{ op: 'CHANGE_STAT', target: 'CHOSEN_PLAYER', stat: 'GOLD', delta: 1 }],
      { type: 'ANYTIME' },
    );
    let pending = play(state, 1, gain, state.players[0]!.id).state;
    pending = until(
      pending,
      (s) => s.resolutionStack.at(-1)?.task?.kind === 'PHASE',
    );
    expect(legal(pending, 0, id)).toBeDefined();
    expect(pending.control.timedPrompt!.deadlineAt).toBeNull();
  });
  it.each(['ANTE_REQUIRED', 'PAYMENT_REQUIRED'] as const)(
    'substitutes exactly one Gold before %s commits, with a replayable owner prompt',
    (event) => {
      const state = genericState();
      const substitute = putCard(
        state,
        0,
        [{ op: 'SUBSTITUTE_PAYMENT_FROM_INN', amount: 1 }],
        {
          trigger: systemTrigger(event, [
            {
              kind: 'PAYMENT_CONTEXT',
              payer: 'SELF',
              purpose: 'ANY',
              minAmount: 1,
            },
          ]),
        },
      );
      expect(legal(state, 0, substitute)).toBeUndefined();
      const source =
        event === 'ANTE_REQUIRED'
          ? cardInHand(state, 0, 'gamble')
          : putCard(
              state,
              1,
              [{ op: 'PAY_INN', target: 'CHOSEN_PLAYER', amount: 2 }],
              { type: 'ANYTIME' },
            );
      let pending = play(
        state,
        event === 'ANTE_REQUIRED' ? 0 : 1,
        source,
        event === 'ANTE_REQUIRED' ? undefined : state.players[0]!.id,
      ).state;
      pending = until(
        pending,
        (s) => s.resolutionStack.at(-1)?.task?.kind === 'PAYMENT',
      );
      expect(pending.players[0]!.gold).toBe(state.players[0]!.gold);
      expect(pending.control.timedPrompt!.deadlineAt).toBeNull();
      reconnectAndReplay(pending);
      const old = pending.control.timedPrompt!;
      const played = play(
        pending,
        0,
        substitute,
        undefined,
        old.openedAt + 100,
      ).state;
      const stale = applyCommand(
        played,
        intent(played, 'PASS_RESPONSE', {
          responseWindowId: pending.responseWindow!.id,
          promptId: old.promptId,
        }),
        {
          actorId: state.players[0]!.id,
          clock: { now: () => old.openedAt + 101 },
        },
      );
      expect(stale.status).toBe('REJECTED');
      const finished = settle(played);
      expect(finished.players[0]!.gold).toBe(
        state.players[0]!.gold - (event === 'ANTE_REQUIRED' ? 0 : 1),
      );
      expect(legal(finished, 0, substitute)).toBeUndefined();
      if (event === 'ANTE_REQUIRED') expect(finished.gambling!.pot).toBe(4);
    },
  );

  it('opens hit-back only after actual loss and retains original provenance after redirection', () => {
    const state = genericState();
    const redirect = putCard(
      state,
      1,
      [{ op: 'REDIRECT_FORTITUDE_LOSS', target: 'CHOSEN_PLAYER' }],
      {
        suffix: 'breather',
        trigger: {
          event: 'CARD',
          alternatives: [
            [
              {
                kind: 'PENDING_STAT',
                stat: 'FORTITUDE',
                direction: 'LOSS',
                relation: 'SELF',
              },
            ],
          ],
        },
      },
    );
    const retaliation = putCard(
      state,
      2,
      [
        {
          op: 'CHANGE_STAT',
          stat: 'FORTITUDE',
          target: 'ORIGINAL_SOURCE_PLAYER',
          delta: -2,
        },
      ],
      {
        trigger: systemTrigger('FORTITUDE_LOSS_RESOLVED', [
          {
            kind: 'ACTUAL_STAT_LOSS',
            stat: 'FORTITUDE',
            relation: 'SELF',
            minAmount: 1,
          },
        ]),
      },
    );
    const attack = cardInHand(state, 0, 'shove');
    let pending = play(state, 0, attack, state.players[1]!.id).state;
    expect(legal(pending, 2, retaliation)).toBeUndefined();
    pending = until(
      pending,
      (s) => s.responseWindow?.priorityPlayerId === s.players[1]!.id,
    );
    pending = play(pending, 1, redirect, state.players[2]!.id).state;
    pending = until(
      pending,
      (s) => s.resolutionStack.at(-1)?.task?.kind === 'POST_LOSS',
    );
    expect(pending.players[1]!.fortitude).toBe(state.players[1]!.fortitude);
    expect(pending.players[2]!.fortitude).toBeLessThan(
      state.players[2]!.fortitude,
    );
    expect(pending.resolutionStack.at(-1)!.task).toMatchObject({
      originalPlayer: state.players[0]!.id,
      originalCard: attack,
      affected: state.players[2]!.id,
    });
    reconnectAndReplay(pending);
    pending = until(pending, (s) => legal(s, 2, retaliation) !== undefined);
    pending = play(pending, 2, retaliation).state;
    expect(settle(pending).players[0]!.fortitude).toBe(
      state.players[0]!.fortitude - 2,
    );
  });

  it('a full Ignore prevents post-loss retaliation', () => {
    const state = genericState();
    const retaliation = putCard(
      state,
      1,
      [
        {
          op: 'CHANGE_STAT',
          stat: 'FORTITUDE',
          target: 'ORIGINAL_SOURCE_PLAYER',
          delta: -2,
        },
      ],
      { trigger: systemTrigger('FORTITUDE_LOSS_RESOLVED') },
    );
    let pending = play(
      state,
      0,
      cardInHand(state, 0, 'shove'),
      state.players[1]!.id,
    ).state;
    pending = until(
      pending,
      (s) => s.responseWindow?.priorityPlayerId === s.players[1]!.id,
    );
    pending = play(pending, 1, cardInHand(state, 1, 'ignore')).state;
    const finished = settle(pending);
    expect(finished.players[1]!.fortitude).toBe(state.players[1]!.fortitude);
    expect(legal(finished, 1, retaliation)).toBeUndefined();
  });

  it('protected counters admit only their own declared family', () => {
    const state = genericState();
    const protectedCounter = putCard(
      state,
      1,
      [{ op: 'NEGATE', scope: 'TOP_STACK' }],
      {
        counterFamily: 'core-counter',
        counterPolicy: 'SAME_FAMILY_ONLY',
        trigger: { event: 'CARD', alternatives: [[]] },
      },
    );
    const unrelated = putCard(
      state,
      2,
      [{ op: 'NEGATE', scope: 'TOP_STACK' }],
      {
        counterFamily: 'other-counter',
        trigger: { event: 'CARD', alternatives: [[]] },
      },
    );
    const matching = putCard(state, 3, [{ op: 'NEGATE', scope: 'TOP_STACK' }], {
      counterFamily: 'core-counter',
      trigger: { event: 'CARD', alternatives: [[]] },
    });
    let pending = play(
      state,
      0,
      cardInHand(state, 0, 'shove'),
      state.players[2]!.id,
    ).state;
    pending = until(
      pending,
      (s) => s.responseWindow?.priorityPlayerId === s.players[1]!.id,
    );
    pending = play(pending, 1, protectedCounter).state;
    expect(legal(pending, 2, unrelated)).toBeUndefined();
    expect(legal(pending, 3, matching)).toBeDefined();
    const forged = applyCommand(
      pending,
      intent(pending, 'PLAY_RESPONSE', {
        cardId: unrelated,
        responseWindowId: pending.responseWindow!.id,
      }),
      { actorId: state.players[2]!.id },
    );
    expect(forged.status).toBe('REJECTED');
    reconnectAndReplay(pending);
    pending = until(
      pending,
      (s) => s.responseWindow?.priorityPlayerId === s.players[3]!.id,
    );
    pending = play(pending, 3, matching).state;
    expect(settle(pending).players[2]!.fortitude).toBeLessThan(
      state.players[2]!.fortitude,
    );
  });

  it('offers phase-scoped Sometimes before and after normal ordering with owner-aware prompts', () => {
    const state = genericState();
    state.phase = 'ORDER_DRINK';
    const spare = state.players[0]!.drinkPile.pop()!;
    state.innDrinkDeck.cardIds.push(spare);
    state.cards[spare]!.location = {
      zone: 'INN_DRINK_DECK',
      deckId: state.innDrinkDeck.deckId,
    };
    const extra = putCard(state, 0, [{ op: 'ORDER_EXTRA_DRINKS', count: 2 }], {
      phaseOpportunity: 'ORDER_DRINK',
    });
    let pending = send(
      state,
      'ORDER_DRINK',
      { targetPlayerId: state.players[1]!.id },
      0,
    ).state;
    expect(pending.resolutionStack.at(-1)?.task).toMatchObject({
      kind: 'PHASE',
      normalOrderComplete: true,
    });
    expect(legal(pending, 0, extra)?.commandType).toBe('PLAY_CARD');
    reconnectAndReplay(pending);
    pending = play(pending, 0, extra).state;
    pending = until(pending, (s) => s.responseWindow?.pendingChoice !== null);
    for (const seat of [2, 3])
      pending = send(
        pending,
        'CHOOSE_TARGET',
        {
          responseWindowId: pending.responseWindow!.id,
          targetPlayerIds: [state.players[seat]!.id],
        },
        0,
      ).state;
    pending = settle(pending);
    expect(pending.players.map((p) => p.drinkPile.length)).toEqual(
      state.players.map((p, i) => p.drinkPile.length + (i === 0 ? 0 : 1)),
    );
    const before = mutable(state);
    expect(legal(before, 0, extra)).toBeDefined();
    expect(play(before, 0, extra).state.phase).toBe('ORDER_DRINK');
  });
});

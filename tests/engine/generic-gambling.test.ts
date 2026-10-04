import { describe, expect, it } from 'vitest';
import { cardInHand } from '../fixtures/timing-match';
import {
  genericState,
  putCard,
  play,
  send,
  until,
  settle,
  legal,
  systemTrigger,
  reconnectAndReplay,
} from '../fixtures/generic-match';
import type { CoreGameState } from '../../src/engine/types';

function round(state = genericState()) {
  return settle(play(state, 0, cardInHand(state, 0, 'gamble')).state);
}
function gamblingPass(state: CoreGameState) {
  if (state.responseWindow !== null)
    return send(state, 'PASS_RESPONSE', {
      responseWindowId: state.responseWindow.id,
    }).state;
  return send(
    state,
    'GAMBLING_PASS',
    {},
    state.players.findIndex((p) => p.id === state.gambling!.priorityPlayerId),
  ).state;
}
describe('generic gambling workflows', () => {
  it('Anytime during gambling preserves control and the Winning Hand restriction', () => {
    const state = round();
    const old = state.gambling!;
    const finished = settle(
      play(state, 2, cardInHand(state, 2, 'breather')).state,
    );
    expect(finished.players[2]!.fortitude).toBe(
      state.players[2]!.fortitude + 1,
    );
    expect(finished.gambling).toEqual(old);
  });

  it('anti-cheat negates an ejection before it completes and wins before payout', () => {
    const state = genericState();
    const anti = putCard(
      state,
      2,
      [{ op: 'NEGATE', scope: 'TOP_STACK' }, { op: 'WIN_GAMBLING' }],
      {
        trigger: {
          event: 'CARD',
          alternatives: [[{ kind: 'SOURCE_TYPE', types: ['CHEATING'] }]],
        },
      },
    );
    const ejection = putCard(
      state,
      1,
      [{ op: 'FORCE_LEAVE_GAMBLING', target: 'CHOSEN_PLAYER' }],
      { type: 'CHEATING', suffix: 'cheat' },
    );
    let pending = round(state);
    pending = play(pending, 1, ejection, state.players[2]!.id).state;
    pending = until(
      pending,
      (s) => s.responseWindow?.priorityPlayerId === s.players[2]!.id,
    );
    expect(pending.gambling!.leftPlayerIds).not.toContain(state.players[2]!.id);
    pending = play(pending, 2, anti).state;
    const finished = settle(pending);
    expect(finished.gambling).toBeNull();
    expect(finished.players[2]!.gold).toBe(state.players[2]!.gold + 3);
  });

  it('replaces the winner at a 30-second settlement opportunity before paying the pot', () => {
    const state = genericState();
    const replace = putCard(
      state,
      2,
      [{ op: 'REPLACE_GAMBLING_WINNER', target: 'SELF' }],
      { trigger: systemTrigger('GAMBLING_WIN_BEFORE_PAYOUT') },
    );
    expect(legal(state, 2, replace)).toBeUndefined();
    let pending = round(state);
    while (pending.resolutionStack.at(-1)?.task?.kind !== 'SETTLEMENT')
      pending = gamblingPass(pending);
    expect(pending.players[0]!.gold).toBe(state.players[0]!.gold - 1);
    const prompt = pending.control.timedPrompt!;
    expect(prompt.deadlineAt).toBe(
      prompt.priorityPlayerId === pending.activePlayerId
        ? null
        : prompt.openedAt + 30_000,
    );
    reconnectAndReplay(pending);
    pending = until(pending, (s) => legal(s, 2, replace) !== undefined);
    pending = play(pending, 2, replace).state;
    expect(settle(pending).players[2]!.gold).toBe(state.players[2]!.gold + 3);
  });

  it('antes every active player again; Inn substitution never reclaims committed Gold', () => {
    const state = genericState();
    const raise = putCard(state, 1, [{ op: 'ANTE_ALL_ACTIVE', amount: 2 }], {
      type: 'CHEATING',
      suffix: 'cheat',
    });
    const sub = putCard(
      state,
      1,
      [{ op: 'SUBSTITUTE_PAYMENT_FROM_INN', amount: 1 }],
      {
        trigger: systemTrigger('ANTE_REQUIRED', [
          {
            kind: 'PAYMENT_CONTEXT',
            payer: 'SELF',
            purpose: 'ANTE',
            minAmount: 1,
          },
        ]),
      },
    );
    let pending = play(state, 0, cardInHand(state, 0, 'gamble')).state;
    pending = until(pending, (s) => legal(s, 1, sub) !== undefined);
    pending = settle(pending); // Decline the initial substitute; committed Gold remains committed.
    expect(pending.players[1]!.gold).toBe(state.players[1]!.gold - 1);
    expect(legal(pending, 1, sub)).toBeUndefined();
    pending = play(pending, 1, raise).state;
    pending = until(pending, (s) => legal(s, 1, sub) !== undefined);
    pending = play(pending, 1, sub).state;
    const finished = settle(pending);
    expect(finished.gambling!.pot).toBe(12);
    expect(finished.players[1]!.gold).toBe(state.players[1]!.gold - 2);
  });

  it.each(['END_GAMBLING', 'TAKE_FROM_GAMBLING_POT'] as const)(
    '%s acts only at a valid checkpoint',
    (op) => {
      const state = genericState();
      const card = putCard(
        state,
        2,
        [
          op === 'END_GAMBLING'
            ? { op, potDestination: 'INN' }
            : { op, amount: 2 },
        ],
        { trigger: systemTrigger('GAMBLING_CHECKPOINT') },
      );
      expect(legal(state, 2, card)).toBeUndefined();
      let pending = play(state, 0, cardInHand(state, 0, 'gamble')).state;
      pending = until(
        pending,
        (s) => s.resolutionStack.at(-1)?.task?.kind === 'CHECKPOINT',
      );
      reconnectAndReplay(pending);
      pending = until(pending, (s) => legal(s, 2, card) !== undefined);
      const oldControl = pending.gambling!.controlPlayerId;
      pending = play(pending, 2, card).state;
      const finished = settle(pending);
      if (op === 'END_GAMBLING') {
        expect(finished.gambling).toBeNull();
        expect(finished.players.map((p) => p.gold)).toEqual(
          state.players.map((p) => p.gold - 1),
        );
      } else {
        expect(finished.gambling!.pot).toBe(2);
        expect(finished.gambling!.controlPlayerId).toBe(oldControl);
        expect(finished.players[2]!.gold).toBe(state.players[2]!.gold + 1);
      }
    },
  );
});

import { expect, it } from 'vitest';
import { applyCommand } from '../../src/engine/commands';
import { cardInHand } from '../fixtures/timing-match';
import { intent } from '../fixtures/core-match';
import {
  genericState,
  putCard,
  play,
  send,
  until,
  settle,
  legal,
  systemTrigger,
} from '../fixtures/generic-match';
import { verifyOpportunity, numericDrinks, finish } from '../fixtures/step24b';

const paymentTrigger = {
  event: 'SYSTEM' as const,
  alternatives: [
    [
      {
        kind: 'PAYMENT_CONTEXT' as const,
        payer: 'SELF' as const,
        purpose: 'ANY' as const,
        minAmount: 1,
      },
    ],
  ],
};
it.each(['INN', 'PLAYER'] as const)(
  'prevents the entire current %s loss, preserving other effects and future obligations',
  (destination) => {
    const state = genericState();
    const prevent = putCard(state, 1, [{ op: 'PREVENT_CURRENT_GOLD_LOSS' }], {
      trigger: paymentTrigger,
    });
    const source = putCard(
      state,
      0,
      [
        destination === 'INN'
          ? { op: 'PAY_INN', target: 'CHOSEN_PLAYER', amount: 3 }
          : { op: 'COLLECT_GOLD', target: 'CHOSEN_PLAYER', amount: 3 },
        {
          op: 'CHANGE_STAT',
          target: 'CHOSEN_PLAYER',
          stat: 'ALCOHOL',
          delta: 1,
        },
        { op: 'PAY_INN', target: 'CHOSEN_PLAYER', amount: 1 },
      ],
      { type: 'ACTION' },
    );
    expect(legal(state, 1, prevent)).toBeUndefined();
    const pending = until(
      play(state, 0, source, state.players[1]!.id).state,
      (s) => legal(s, 1, prevent) !== undefined,
    );
    verifyOpportunity(pending, 1, prevent);
    const final = settle(play(pending, 1, prevent).state);
    expect(final.players[1]!.gold).toBe(state.players[1]!.gold - 1);
    expect(final.players[0]!.gold).toBe(state.players[0]!.gold);
    expect(final.players[1]!.alcoholContent).toBe(1);
  },
);
it('a prevented ante is satisfied without Gold in the pot; remaining players ante and the round continues', () => {
  const state = genericState();
  const prevent = putCard(state, 1, [{ op: 'PREVENT_CURRENT_GOLD_LOSS' }], {
    trigger: paymentTrigger,
  });
  const pending = until(
    play(state, 0, cardInHand(state, 0, 'gamble')).state,
    (s) => legal(s, 1, prevent) !== undefined,
  );
  const final = settle(play(pending, 1, prevent).state);
  expect(final.gambling!.stage).toBe('ROUND');
  expect(final.gambling!.pot).toBe(3);
  expect(final.gambling!.participants).toContain(state.players[1]!.id);
  expect(final.players[1]!.gold).toBe(state.players[1]!.gold);
  expect(
    final.gambling!.contributions.find(
      (p) => p.playerId === state.players[1]!.id,
    )!.amount,
  ).toBe(0);
});
it('whole-obligation substitution moves three Inn Gold without charging the payer', () => {
  const state = genericState();
  const substitute = putCard(
    state,
    1,
    [
      {
        op: 'SUBSTITUTE_PAYMENT_FROM_INN',
        amount: 1,
        scope: 'CURRENT_OBLIGATION',
      },
    ],
    { trigger: paymentTrigger },
  );
  const source = putCard(
    state,
    0,
    [{ op: 'COLLECT_GOLD', target: 'CHOSEN_PLAYER', amount: 3 }],
    { type: 'ACTION' },
  );
  const pending = until(
    play(state, 0, source, state.players[1]!.id).state,
    (s) => legal(s, 1, substitute) !== undefined,
  );
  const final = settle(play(pending, 1, substitute).state);
  expect(final.players[0]!.gold).toBe(state.players[0]!.gold + 3);
  expect(final.players[1]!.gold).toBe(state.players[1]!.gold);
});
function settlement(state: ReturnType<typeof genericState>) {
  let pending = settle(play(state, 0, cardInHand(state, 0, 'gamble')).state);
  while (pending.resolutionStack.at(-1)?.task?.kind !== 'SETTLEMENT') {
    if (pending.responseWindow)
      pending = send(pending, 'PASS_RESPONSE', {
        responseWindowId: pending.responseWindow.id,
      }).state;
    else
      pending = send(
        pending,
        'GAMBLING_PASS',
        {},
        pending.players.findIndex(
          (p) => p.id === pending.gambling!.priorityPlayerId,
        ),
      ).state;
  }
  return pending;
}
it('restarts before payout, retains the pot, re-antes and continues to the new controller’s left', () => {
  const state = genericState();
  const restart = putCard(
    state,
    1,
    [{ op: 'RESTART_GAMBLING_ROUND', ante: 1 }],
    { trigger: systemTrigger('GAMBLING_WIN_BEFORE_PAYOUT') },
  );
  expect(legal(state, 1, restart)).toBeUndefined();
  const pending = until(
    settlement(state),
    (s) => legal(s, 1, restart) !== undefined,
  );
  verifyOpportunity(pending, 1, restart);
  const final = settle(play(pending, 1, restart).state);
  expect(final.gambling).toMatchObject({
    stage: 'ROUND',
    pot: 8,
    controlPlayerId: state.players[1]!.id,
    priorityPlayerId: state.players[2]!.id,
    winnerPlayerId: null,
  });
  expect(final.players.map((p) => p.gold)).toEqual(
    state.players.map((p) => p.gold - 2),
  );
});
it('the specific winner-replacement family blocks restart, while unrelated replacements can opt out', () => {
  const state = genericState();
  const restart = putCard(
    state,
    1,
    [{ op: 'RESTART_GAMBLING_ROUND', ante: 1 }],
    { trigger: systemTrigger('GAMBLING_WIN_BEFORE_PAYOUT') },
  );
  const replace = putCard(
    state,
    2,
    [{ op: 'REPLACE_GAMBLING_WINNER', target: 'SELF' }],
    { trigger: systemTrigger('GAMBLING_WIN_BEFORE_PAYOUT') },
  );
  let pending = until(
    settlement(state),
    (s) => legal(s, 2, replace) !== undefined,
  );
  pending = until(
    play(pending, 2, replace).state,
    (s) => s.resolutionStack.at(-1)?.task?.kind === 'SETTLEMENT',
  );
  expect(pending.gambling!.restartBlocked).toBe(true);
  expect(legal(pending, 1, restart)).toBeUndefined();
});
it('free orders use normal other-player choices; refill waiver prevents only the owner’s fee', () => {
  const { state, ids } = numericDrinks();
  state.phase = 'ORDER_DRINK';
  const card = putCard(
    state,
    1,
    [{ op: 'ORDER_EXTRA_OR_WAIVE_REFILL', count: 2 }],
    { trigger: systemTrigger('DRINK_DECK_REFILL_PAYMENT') },
  );
  state.innDrinkDeck.cardIds = [];
  state.innDrinkDiscard = ids;
  ids.forEach((id) => {
    state.cards[id]!.location = {
      zone: 'INN_DRINK_DISCARD',
      deckId: state.innDrinkDeck.deckId,
    };
  });
  const pending = until(
    send(state, 'ORDER_DRINK', { targetPlayerId: state.players[2]!.id }, 0)
      .state,
    (s) => legal(s, 1, card) !== undefined,
  );
  verifyOpportunity(pending, 1, card);
  const final = finish(play(pending, 1, card).state);
  expect(final.players.map((p) => p.gold)).toEqual(
    state.players.map((p, i) => p.gold - (i === 1 ? 0 : 1)),
  );
  expect(final.players[2]!.drinkPile).toHaveLength(1);
});
it('illegal timing is rejected at the authoritative boundary', () => {
  const state = genericState();
  const card = putCard(state, 1, [{ op: 'RESTART_GAMBLING_ROUND', ante: 1 }], {
    type: 'ANYTIME',
  });
  expect(
    applyCommand(state, intent(state, 'PLAY_CARD', { cardId: card }), {
      actorId: state.players[1]!.id,
    }),
  ).toMatchObject({ status: 'REJECTED', events: [], state });
});

it('an unrelated winner replacement does not block restart when its data opts out', () => {
  const state = genericState();
  const restart = putCard(
    state,
    1,
    [{ op: 'RESTART_GAMBLING_ROUND', ante: 1 }],
    { trigger: systemTrigger('GAMBLING_WIN_BEFORE_PAYOUT') },
  );
  const replace = putCard(
    state,
    2,
    [{ op: 'REPLACE_GAMBLING_WINNER', target: 'SELF', blocksRestart: false }],
    { trigger: systemTrigger('GAMBLING_WIN_BEFORE_PAYOUT') },
  );
  let pending = until(
    settlement(state),
    (s) => legal(s, 2, replace) !== undefined,
  );
  pending = until(
    play(pending, 2, replace).state,
    (s) =>
      s.resolutionStack.at(-1)?.task?.kind === 'SETTLEMENT' &&
      legal(s, 1, restart) !== undefined,
  );
  expect(pending.gambling!.restartBlocked).not.toBe(true);
  expect(settle(play(pending, 1, restart).state).gambling!.pot).toBe(8);
});
it('a restart retains departed players’ earlier Gold but does not re-ante or re-enter them', () => {
  const state = genericState();
  const restart = putCard(
    state,
    2,
    [{ op: 'RESTART_GAMBLING_ROUND', ante: 1 }],
    { trigger: systemTrigger('GAMBLING_WIN_BEFORE_PAYOUT') },
  );
  const departedRestart = putCard(
    state,
    1,
    [{ op: 'RESTART_GAMBLING_ROUND', ante: 1 }],
    { trigger: systemTrigger('GAMBLING_WIN_BEFORE_PAYOUT') },
  );
  let pending = settle(play(state, 0, cardInHand(state, 0, 'gamble')).state);
  pending = settle(send(pending, 'GAMBLING_LEAVE', {}, 1).state);
  while (pending.resolutionStack.at(-1)?.task?.kind !== 'SETTLEMENT') {
    if (pending.responseWindow)
      pending = send(pending, 'PASS_RESPONSE', {
        responseWindowId: pending.responseWindow.id,
      }).state;
    else
      pending = send(
        pending,
        'GAMBLING_PASS',
        {},
        pending.players.findIndex(
          (p) => p.id === pending.gambling!.priorityPlayerId,
        ),
      ).state;
  }
  expect(legal(pending, 1, departedRestart)).toBeUndefined();
  pending = until(pending, (s) => legal(s, 2, restart) !== undefined);
  const final = settle(play(pending, 2, restart).state);
  expect(final.gambling!.pot).toBe(7);
  expect(final.gambling!.leftPlayerIds).toEqual([state.players[1]!.id]);
  expect(final.players.map((p) => p.gold)).toEqual([8, 9, 8, 8]);
});

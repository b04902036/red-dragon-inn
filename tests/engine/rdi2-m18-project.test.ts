import { expect, it } from 'vitest';
import { applyCommand } from '../../src/engine/commands';
import { projectPrivatePlayer } from '../../src/protocol/projections';
import { intent } from '../fixtures/core-match';
import {
  genericState,
  putCard,
  play,
  send,
  until,
  legal,
  settle,
  reconnectAndReplay,
} from '../fixtures/generic-match';
import { m18Effects, m18Metadata } from '../fixtures/rdi2-m18-project';
function fixture() {
  const state = genericState();
  state.phase = 'ORDER_DRINK';
  for (const seat of [0, 2, 3]) {
    const spare = state.players[seat]!.drinkPile.pop()!;
    state.innDrinkDeck.cardIds.push(spare);
    state.cards[spare]!.location = {
      zone: 'INN_DRINK_DECK',
      deckId: state.innDrinkDeck.deckId,
    };
  }
  const card = putCard(state, 0, m18Effects, m18Metadata);
  return { state, card };
}
it.each([
  [1, 1],
  [1, 2],
])(
  'pays one Gold and orders exactly two face-down extra Drinks to recipients %j',
  (first, second) => {
    const { state, card } = fixture();
    let pending = until(
      play(state, 0, card).state,
      (s) => s.responseWindow?.pendingChoice != null,
    );
    expect(pending.players[0]!.gold).toBe(state.players[0]!.gold - 1);
    expect(pending.resolutionStack.at(-1)!.effects[0]).toMatchObject({
      op: 'PAY_INN',
      target: 'SELF',
      amount: 1,
      requireFullPayment: true,
    });
    for (const seat of [first, second]) {
      expect(
        pending.responseWindow!.pendingChoice!.options.map((o) => o.id),
      ).not.toContain(state.players[0]!.id);
      const invalid = applyCommand(
        pending,
        intent(pending, 'CHOOSE_TARGET', {
          responseWindowId: pending.responseWindow!.id,
          targetPlayerIds: [state.players[0]!.id],
        }),
        { actorId: state.players[0]!.id },
      );
      expect(invalid.status).toBe('REJECTED');
      expect(invalid.state).toBe(pending);
      expect(invalid.events).toEqual([]);
      pending = send(
        pending,
        'CHOOSE_TARGET',
        {
          responseWindowId: pending.responseWindow!.id,
          targetPlayerIds: [state.players[seat]!.id],
        },
        0,
      ).state;
    }
    pending = settle(pending);
    expect(pending.players.map((p) => p.drinkPile.length)).toEqual(
      state.players.map(
        (p, i) =>
          p.drinkPile.length + Number(i === first) + Number(i === second),
      ),
    );
    expect(pending.phase).toBe('ORDER_DRINK');
    const final = settle(
      send(pending, 'ORDER_DRINK', { targetPlayerId: state.players[3]!.id }, 0)
        .state,
    );
    expect(final.players[3]!.drinkPile).toHaveLength(
      pending.players[3]!.drinkPile.length + 1,
    );
    expect(final.players[0]!.gold).toBe(state.players[0]!.gold - 1);
    const projection = JSON.stringify(
      projectPrivatePlayer(final, state.players[2]!.id),
    );
    for (const id of final.players[first]!.drinkPile)
      expect(projection).not.toContain(id);
  },
);
it('retains own-phase opportunity after normal ordering, untimed owner choice, reconnect and deterministic replay', () => {
  const { state, card } = fixture();
  const ordered = send(
    state,
    'ORDER_DRINK',
    { targetPlayerId: state.players[1]!.id },
    0,
  ).state;
  expect(legal(ordered, 0, card)).toBeDefined();
  expect(ordered.control.timedPrompt!.deadlineAt).toBeNull();
  reconnectAndReplay(ordered);
  let pending = until(
    play(ordered, 0, card).state,
    (s) => s.responseWindow?.pendingChoice != null,
  );
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
  expect(settle(pending).players[0]!.gold).toBe(state.players[0]!.gold - 1);
});
it('rejects another player and the wrong phase using shared legality and server validation', () => {
  const { state, card } = fixture(),
    other = putCard(state, 1, m18Effects, m18Metadata);
  expect(legal(state, 1, other)).toBeUndefined();
  expect(
    applyCommand(state, intent(state, 'PLAY_CARD', { cardId: other }), {
      actorId: state.players[1]!.id,
    }).status,
  ).toBe('REJECTED');
  state.phase = 'ACTION';
  expect(legal(state, 0, card)).toBeUndefined();
  expect(
    applyCommand(state, intent(state, 'PLAY_CARD', { cardId: card }), {
      actorId: state.players[0]!.id,
    }).status,
  ).toBe('REJECTED');
});
it('a legal Negate prevents the payment and both additional orders', () => {
  const { state, card } = fixture();
  const counter = putCard(state, 1, [{ op: 'NEGATE', scope: 'TOP_STACK' }], {
    trigger: {
      event: 'CARD',
      alternatives: [
        [
          { kind: 'SOURCE_TYPE', types: ['SOMETIMES'] },
          { kind: 'NEGATABLE', value: true },
        ],
      ],
    },
  });
  const opportunity = until(
    play(state, 0, card).state,
    (s) => legal(s, 1, counter) !== undefined,
  );
  const done = settle(play(opportunity, 1, counter).state);
  expect(done.players.map((p) => [p.gold, p.drinkPile.length])).toEqual(
    state.players.map((p) => [p.gold, p.drinkPile.length]),
  );
});

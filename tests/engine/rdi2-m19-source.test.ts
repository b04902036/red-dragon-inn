import { expect, it } from 'vitest';
import {
  genericState,
  putCard,
  play,
  send,
  until,
  settle,
  legal,
  reconnectAndReplay,
} from '../fixtures/generic-match';
import { m19OrderEffects, m19OrderMetadata } from '../fixtures/rdi2-m19-source';
it.each([
  [1, 1],
  [1, 2],
])(
  'shared M19 free-order branch orders two extra Drinks to %j without a card fee',
  (first, second) => {
    const state = genericState();
    state.phase = 'ORDER_DRINK';
    for (const seat of [0, 2, 3]) {
      const id = state.players[seat]!.drinkPile.pop()!;
      state.innDrinkDeck.cardIds.push(id);
      state.cards[id]!.location = {
        zone: 'INN_DRINK_DECK',
        deckId: state.innDrinkDeck.deckId,
      };
    }
    const card = putCard(state, 0, m19OrderEffects, m19OrderMetadata);
    let pending = until(
      play(state, 0, card).state,
      (s) => s.responseWindow?.pendingChoice != null,
    );
    for (const seat of [first, second])
      pending = send(
        pending,
        'CHOOSE_TARGET',
        {
          responseWindowId: pending.responseWindow!.id,
          targetPlayerIds: [state.players[seat]!.id],
        },
        0,
      ).state;
    const ordered = settle(pending);
    expect(ordered.players.map((p) => p.gold)).toEqual(
      state.players.map((p) => p.gold),
    );
    expect(ordered.players.map((p) => p.drinkPile.length)).toEqual(
      state.players.map(
        (p, i) =>
          p.drinkPile.length + Number(i === first) + Number(i === second),
      ),
    );
    expect(ordered.phase).toBe('ORDER_DRINK');
    const normal = settle(
      send(ordered, 'ORDER_DRINK', { targetPlayerId: state.players[3]!.id }, 0)
        .state,
    );
    expect(normal.players[3]!.drinkPile).toHaveLength(
      ordered.players[3]!.drinkPile.length + 1,
    );
    expect(normal.players.map((p) => p.gold)).toEqual(
      state.players.map((p) => p.gold),
    );
  },
);
it('allows the free-order branch after ordinary ordering, preserves untimed owner opportunity, reconnect and replay', () => {
  const state = genericState();
  state.phase = 'ORDER_DRINK';
  const card = putCard(state, 0, m19OrderEffects, m19OrderMetadata);
  const other = putCard(state, 1, m19OrderEffects, m19OrderMetadata);
  const ordered = send(
    state,
    'ORDER_DRINK',
    { targetPlayerId: state.players[1]!.id },
    0,
  ).state;
  expect(legal(ordered, 0, card)).toBeDefined();
  expect(ordered.control.timedPrompt!.deadlineAt).toBeNull();
  reconnectAndReplay(ordered);
  expect(legal(ordered, 1, other)).toBeUndefined();
});
it('a Negated free-order branch orders no extra Drinks and charges no card fee', () => {
  const state = genericState();
  state.phase = 'ORDER_DRINK';
  const card = putCard(state, 0, m19OrderEffects, m19OrderMetadata);
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
  const window = until(
    play(state, 0, card).state,
    (s) => legal(s, 1, counter) !== undefined,
  );
  const final = settle(play(window, 1, counter).state);
  expect(final.players.map((p) => [p.gold, p.drinkPile.length])).toEqual(
    state.players.map((p) => [p.gold, p.drinkPile.length]),
  );
});

import { expect, it } from 'vitest';
import { cardDefinitionSchema } from '../../src/content/cards';
import {
  projectPublicGame,
  projectPrivatePlayer,
} from '../../src/protocol/projections';
import {
  genericState,
  putCard,
  play,
  until,
  settle,
  legal,
  reconnectAndReplay,
} from '../fixtures/generic-match';
import { m20SupportedEffects } from '../fixtures/rdi2-m20-source';
function fixture(chaser = false) {
  const state = genericState();
  const cards = Object.values(state.cards)
    .filter((c) => c.ownerId === null)
    .map((c) => c.id)
    .sort();
  state.players.forEach((p) => {
    p.drinkPile = [];
  });
  state.innDrinkDeck.cardIds = cards;
  state.innDrinkDiscard = [];
  for (const [i, id] of cards.entries()) {
    const definition = cardDefinitionSchema.parse({
      id: `carddef_test_m20_drink_${i}`,
      name: 'Original synthetic Drink',
      rulesText: 'Original mechanical test fixture.',
      source: 'TEST_FIXTURE',
      type: 'DRINK',
      effects: [],
      alcoholContent: chaser ? (i === 1 ? 2 : 1) : i + 1,
      fortitudeChange: 0,
      chaser: chaser && i === 0,
    });
    state.definitions[definition.id] = definition;
    state.cards[id]!.definitionId = definition.id;
    state.cards[id]!.location = {
      zone: 'INN_DRINK_DECK',
      deckId: state.innDrinkDeck.deckId,
    };
  }
  const card = putCard(state, 0, m20SupportedEffects, { type: 'ACTION' });
  return { state, card, cards };
}
it('existing Inn batch reveals a distinct Drink for every player including actor, without Drink-pile draws or premature effects', () => {
  const { state, card, cards } = fixture();
  const prepared = until(
    play(state, 0, card).state,
    (s) => s.resolutionStack.at(-1)?.kind === 'DRINK',
  );
  const frame = prepared.resolutionStack.find(
    (f) => f.task?.kind === 'DRINK_BATCH',
  )!;
  expect(frame.task).toMatchObject({
    mode: 'SIMULTANEOUS',
    source: 'INN',
    participants: state.players.map((p) => p.id),
    deferDrinkConsumption: true,
  });
  const revealed = [
    ...frame.pendingDrinks!.flatMap((d) => d.sourceCardIds),
    ...prepared.resolutionStack.at(-1)!.sourceCardIds!,
  ];
  expect(new Set(revealed).size).toBe(4);
  expect(revealed).toEqual(expect.arrayContaining(cards.slice(0, 4)));
  expect(prepared.players.map((p) => p.alcoholContent)).toEqual(
    state.players.map((p) => p.alcoholContent),
  );
  const hidden = cards[4]!;
  expect(JSON.stringify(projectPublicGame(prepared))).not.toContain(hidden);
  expect(
    JSON.stringify(projectPrivatePlayer(prepared, state.players[1]!.id)),
  ).not.toContain(hidden);
  reconnectAndReplay(prepared);
  const final = settle(prepared);
  expect(
    final.players.map(
      (p, i) => p.alcoholContent - state.players[i]!.alcoholContent,
    ),
  ).toEqual([1, 2, 3, 4]);
  expect(final.players.map((p) => p.drinkPile.length)).toEqual([0, 0, 0, 0]);
});
it('existing Inn batch combines all Chasers before responses and keeps self Ignore independent of other Drinks', () => {
  const { state, card } = fixture(true);
  const ignore = putCard(
    state,
    0,
    [{ op: 'IGNORE', scope: 'CURRENT_EFFECT' }],
    {
      suffix: 'ignore',
      trigger: {
        event: 'DRINK',
        alternatives: [[{ kind: 'AFFECTS', relation: 'SELF' }]],
      },
    },
  );
  const prepared = until(
    play(state, 0, card).state,
    (s) => legal(s, 0, ignore) !== undefined,
  );
  expect(prepared.resolutionStack.at(-1)!.sourceCardIds).toHaveLength(2);
  expect(prepared.players.map((p) => p.alcoholContent)).toEqual(
    state.players.map((p) => p.alcoholContent),
  );
  const final = settle(play(prepared, 0, ignore).state);
  expect(
    final.players.map(
      (p, i) => p.alcoholContent - state.players[i]!.alcoholContent,
    ),
  ).toEqual([0, 1, 1, 1]);
});
it('a legal general Action Negate prevents the supported batch before any Drink is revealed', () => {
  const { state, card } = fixture();
  const counter = putCard(state, 1, [{ op: 'NEGATE', scope: 'TOP_STACK' }], {
    trigger: {
      event: 'CARD',
      alternatives: [
        [
          { kind: 'SOURCE_TYPE', types: ['ACTION'] },
          { kind: 'NEGATABLE', value: true },
        ],
      ],
    },
  });
  const pending = until(
    play(state, 0, card).state,
    (s) => legal(s, 1, counter) !== undefined,
  );
  const final = settle(play(pending, 1, counter).state);
  expect(final.innDrinkDeck.cardIds).toEqual(state.innDrinkDeck.cardIds);
  expect(final.players.map((p) => [p.alcoholContent, p.gold])).toEqual(
    state.players.map((p) => [p.alcoholContent, p.gold]),
  );
});

import { expect, it } from 'vitest';
import { contentPackSchema } from '../../src/content/pack';
import { createMatch } from '../../src/engine/setup';
import { setupInput, accepted, mutable } from '../fixtures/core-match';
import { drawInnDrinks } from '../../src/engine/inn-deck';
import { mulberry32 } from '../../src/engine/rng';
import { assertCoreInvariants } from '../../src/engine/invariants';
import {
  projectPublicGame,
  projectPrivatePlayer,
} from '../../src/protocol/projections';
import { replayFromBeginning, coreStateSchema } from '../../src/engine/replay';
import type { EmitEvent } from '../../src/engine/event-writer';
import { finish } from '../fixtures/step24b';
import { DEFAULT_RULES } from '../../src/engine/rules';

function setup() {
  const input = setupInput();
  const inn = input.content.decks.find((d) => d.type === 'INN_DRINK')!;
  const drink = input.content.cards.find((c) => c.type === 'DRINK')!;
  input.content = contentPackSchema.parse({
    ...input.content,
    decks: [
      ...input.content.decks,
      { ...inn, id: 'deck_test_bar_second', slug: 'test-bar-second' },
    ],
    deckCards: [
      ...input.content.deckCards.filter((r) => r.deckId !== inn.id),
      { deckId: inn.id, cardId: drink.id, quantity: 30 },
      { deckId: 'deck_test_bar_second', cardId: drink.id, quantity: 30 },
    ],
  });
  return {
    ...input,
    innDrinkDeckIds: input.content.decks
      .filter((d) => d.type === 'INN_DRINK')
      .map((d) => d.id),
    rules: {
      ...DEFAULT_RULES,
      ...input.rules,
      initialDrinkCount: 0,
      drinks: { ...DEFAULT_RULES.drinks, refillPayment: true },
    },
  };
}
it('starts with 30 active and 30 reserved, preserves ownership, hides both orders and deterministically replays setup', () => {
  const input = setup();
  const initial = createMatch(input);
  const result = accepted(initial, 'START_MATCH');
  expect(result.state.innDrinkDeck.cardIds).toHaveLength(30);
  expect(result.state.barDrinkDeck).toHaveLength(30);
  const publicView = projectPublicGame(result.state);
  expect(publicView).toMatchObject({
    innDrinkDeckCount: 30,
    barDrinkDeckCount: 30,
  });
  for (const card of [
    ...result.state.innDrinkDeck.cardIds,
    ...result.state.barDrinkDeck!,
  ]) {
    expect(JSON.stringify(publicView)).not.toContain(card);
    expect(
      JSON.stringify(
        projectPrivatePlayer(result.state, result.state.players[0]!.id),
      ),
    ).not.toContain(card);
  }
  expect(coreStateSchema.parse(result.state)).toEqual(result.state);
  const command = {
    type: 'START_MATCH',
    roomId: initial.roomId,
    commandId: 'command_1',
    expectedStateVersion: initial.version,
  };
  expect(
    replayFromBeginning({ schemaVersion: 1, setup: input }, [
      {
        actorId: initial.players[0]!.id,
        command,
        firstSequence: 1,
        lastSequence: result.events.length,
        events: result.events,
        acceptedAt: '2026-10-07T00:00:00.000Z',
        clockTime: 0,
      },
    ]).state,
  ).toEqual(result.state);
});
it('refills the next 30 without mixing earlier discards, charges once per active deck, then rebuilds only after reserve exhaustion', () => {
  const state = mutable(accepted(createMatch(setup()), 'START_MATCH').state);
  const originalReserve = [...state.barDrinkDeck!];
  const events: unknown[] = [];
  const emit: EmitEvent = (event) => {
    events.push(event);
  };
  // The draw helper emits event bodies; assertions below exercise ownership after each complete move.
  const first = drawInnDrinks(state, 30, emit, mulberry32, true);
  expect(state.innDrinkDeck.cardIds).toEqual(originalReserve);
  expect(state.barDrinkDeck).toEqual([]);
  expect(state.control.pendingRefillPayers).toHaveLength(4);
  state.innDrinkDiscard.push(...first);
  for (const id of first)
    state.cards[id]!.location = {
      zone: 'INN_DRINK_DISCARD',
      deckId: state.innDrinkDeck.deckId,
    };
  const second = drawInnDrinks(state, 30, emit, mulberry32, true);
  expect(second).toEqual(originalReserve);
  expect(state.innDrinkDeck.cardIds).toHaveLength(30);
  expect([...state.innDrinkDeck.cardIds].sort()).toEqual([...first].sort());
  expect(state.control.pendingRefillPayers).toHaveLength(8);
  state.innDrinkDiscard.push(...second);
  for (const id of second)
    state.cards[id]!.location = {
      zone: 'INN_DRINK_DISCARD',
      deckId: state.innDrinkDeck.deckId,
    };
  assertCoreInvariants(state);
  expect(
    events.filter(
      (e) => (e as { type: string }).type === 'DRINK_DECK_REFILLED',
    ),
  ).toHaveLength(2);
});
it('fills a partial reserve from shuffled discards and does not recycle cards still in play', () => {
  const state = mutable(accepted(createMatch(setup()), 'START_MATCH').state);
  const held = state.innDrinkDeck.cardIds.splice(0);
  const discard = state.barDrinkDeck!.splice(10);
  state.players[0]!.drinkPile = held;
  for (const id of held)
    state.cards[id]!.location = {
      zone: 'DRINK_PILE',
      playerId: state.players[0]!.id,
    };
  state.innDrinkDiscard = discard;
  for (const id of discard)
    state.cards[id]!.location = {
      zone: 'INN_DRINK_DISCARD',
      deckId: state.innDrinkDeck.deckId,
    };
  const next = drawInnDrinks(state, 1, () => {}, mulberry32, true);
  expect(state.innDrinkDeck.cardIds).toHaveLength(29);
  expect(
    [...next, ...state.innDrinkDeck.cardIds].some((id) => held.includes(id)),
  ).toBe(false);
  state.players[1]!.drinkPile.push(...next);
  for (const id of next)
    state.cards[id]!.location = {
      zone: 'DRINK_PILE',
      playerId: state.players[1]!.id,
    };
  assertCoreInvariants(state);
});
it('rejects duplicate and unselected deck IDs, a forged active 60-card snapshot, and duplicate reserve ownership', () => {
  const input = setup();
  expect(() =>
    createMatch({
      ...input,
      innDrinkDeckIds: [input.innDrinkDeckIds[0]!, input.innDrinkDeckIds[0]!],
    }),
  ).toThrow();
  expect(() =>
    createMatch({ ...input, innDrinkDeckIds: ['deck_missing'] }),
  ).toThrow();
  const state = mutable(accepted(createMatch(input), 'START_MATCH').state);
  const invalid = mutable(state);
  invalid.innDrinkDeck.cardIds.push(...invalid.barDrinkDeck!);
  invalid.barDrinkDeck = [];
  expect(coreStateSchema.safeParse(invalid).success).toBe(false);
  state.barDrinkDeck!.push(state.innDrinkDeck.cardIds[0]!);
  expect(coreStateSchema.safeParse(state).success).toBe(false);
});
it('an empty reserve/discard does not fabricate cards or charge repeated fees', () => {
  const state = mutable(accepted(createMatch(setup()), 'START_MATCH').state);
  const ids = [...state.innDrinkDeck.cardIds, ...state.barDrinkDeck!];
  state.innDrinkDeck.cardIds = [];
  state.barDrinkDeck = [];
  state.players[0]!.drinkPile = ids;
  for (const id of ids)
    state.cards[id]!.location = {
      zone: 'DRINK_PILE',
      playerId: state.players[0]!.id,
    };
  expect(drawInnDrinks(state, 1, () => {}, mulberry32, true)).toEqual([]);
  expect(state.control.pendingRefillPayers).toBeUndefined();
  assertCoreInvariants(state);
});
it('the final active order opens normal refill payments and charges every living player exactly once', () => {
  const state = mutable(accepted(createMatch(setup()), 'START_MATCH').state);
  state.phase = 'ORDER_DRINK';
  const held = state.innDrinkDeck.cardIds.splice(1);
  state.players[2]!.drinkPile = held;
  for (const id of held)
    state.cards[id]!.location = {
      zone: 'DRINK_PILE',
      playerId: state.players[2]!.id,
    };
  const next = accepted(state, 'ORDER_DRINK', {
    targetPlayerId: state.players[1]!.id,
  });
  const final = finish(next.state);
  expect(final.players.map((p) => p.gold)).toEqual([9, 9, 9, 9]);
  expect(final.innDrinkDeck.cardIds).toHaveLength(30);
  expect(final.barDrinkDeck).toEqual([]);
  expect(next.events.some((e) => e.type === 'DRINK_DECK_REFILLED')).toBe(true);
  assertCoreInvariants(final);
});
it('bounded Bar Deck draws can span batches, tolerate available-card shortage and suppress fees when explicitly configured', () => {
  const state = mutable(accepted(createMatch(setup()), 'START_MATCH').state);
  state.rules.drinks.refillPayment = false;
  expect(() => drawInnDrinks(state, 65, () => {}, mulberry32, false)).toThrow();
  expect(drawInnDrinks(state, 0, () => {}, mulberry32, false)).toEqual([]);
  const drawn = drawInnDrinks(state, 64, () => {}, mulberry32, false);
  expect(drawn).toHaveLength(60);
  expect(state.control.pendingRefillPayers).toBeUndefined();
  state.players[0]!.drinkPile = drawn;
  for (const id of drawn)
    state.cards[id]!.location = {
      zone: 'DRINK_PILE',
      playerId: state.players[0]!.id,
    };
  assertCoreInvariants(state);
});
it('Bar Deck forced-Drink and Chaser draws retain the normal refill fee even without a caller-specific fee flag', () => {
  const state = mutable(accepted(createMatch(setup()), 'START_MATCH').state);
  const drawn = drawInnDrinks(state, 30, () => {}, mulberry32, false);
  expect(state.control.pendingRefillPayers).toEqual(
    state.players.map((p) => p.id),
  );
  expect(state.innDrinkDeck.cardIds).toHaveLength(30);
  state.players[0]!.drinkPile = drawn;
  for (const id of drawn)
    state.cards[id]!.location = {
      zone: 'DRINK_PILE',
      playerId: state.players[0]!.id,
    };
  assertCoreInvariants(state);
});

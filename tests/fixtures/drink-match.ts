import type { CoreGameState } from '../../src/engine/types';
import { accepted, mutable, started } from './core-match';
import { pass } from './timing-match';

/** Arrange server-owned sample Inn instances; every card keeps exactly one zone. */
export function drinkState(suffixes: string[] = ['fizz']) {
  const state = mutable(
    accepted(
      accepted(started(1, 7), 'DISCARD', { cardIds: [] }).state,
      'SKIP_ACTION',
    ).state,
  );
  const cards = Object.values(state.cards)
    .filter((card) => card.ownerId === null)
    .map((card) => card.id)
    .sort();
  state.players.forEach((player) => {
    player.drinkPile = [];
  });
  state.innDrinkDiscard = [];
  state.innDrinkDeck.cardIds = [...cards];
  for (const id of cards)
    state.cards[id]!.location = {
      zone: 'INN_DRINK_DECK',
      deckId: state.innDrinkDeck.deckId,
    };
  for (const suffix of suffixes) {
    const id = state.innDrinkDeck.cardIds.find(
      (id) => state.cards[id]!.definitionId === `carddef_sample_${suffix}`,
    )!;
    state.innDrinkDeck.cardIds.splice(
      state.innDrinkDeck.cardIds.indexOf(id),
      1,
    );
    state.players[0]!.drinkPile.push(id);
    state.cards[id]!.location = {
      zone: 'DRINK_PILE',
      playerId: state.players[0]!.id,
    };
  }
  state.phase = 'DRINK';
  return state;
}
export function resolveResponses(input: CoreGameState) {
  let state = input;
  const events = [];
  while (state.responseWindow !== null) {
    const result = pass(state);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}
export function takeDrink(input: CoreGameState = drinkState()) {
  const queued = accepted(input, 'TAKE_DRINK');
  const complete = resolveResponses(queued.state);
  return {
    state: complete.state,
    events: [...queued.events, ...complete.events],
    queued,
  };
}

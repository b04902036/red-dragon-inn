import { drawFromPiles } from './decks';
import { shuffle } from './rng';
import type { RandomSource } from './rng';
import type { EmitEvent } from './event-writer';
import type { MutableGameState } from './types';
import type { CardInstanceId } from '../shared/ids';
import { queueRefillPayments } from './refill-payments';
import { z } from 'zod';

/** Official Bar Deck: refill in batches of 30; recycle discard only after the reserve is exhausted. */
function refillBarDrinkDeck(
  state: MutableGameState,
  emit: EmitEvent,
  rng: RandomSource,
  pay: boolean,
) {
  const reserve = state.barDrinkDeck!;
  if (reserve.length + state.innDrinkDiscard.length === 0) return false;
  const replacement: CardInstanceId[] = [];
  while (replacement.length < 30) {
    if (reserve.length === 0) {
      if (state.innDrinkDiscard.length === 0) break;
      const shuffled = shuffle(state.innDrinkDiscard, state.rng, rng);
      state.rng = shuffled.state;
      state.innDrinkDiscard = [];
      reserve.push(...shuffled.cards);
      for (const id of reserve)
        state.cards[id]!.location = {
          zone: 'INN_BAR_DECK',
          deckId: state.innDrinkDeck.deckId,
        };
      emit({
        type: 'DECK_SHUFFLED',
        deckId: state.innDrinkDeck.deckId,
        playerId: null,
        reason: 'EXHAUSTED',
        cardIds: [...reserve],
      });
    }
    replacement.push(...reserve.splice(0, 30 - replacement.length));
  }
  state.innDrinkDeck.cardIds = replacement;
  for (const id of replacement)
    state.cards[id]!.location = {
      zone: 'INN_DRINK_DECK',
      deckId: state.innDrinkDeck.deckId,
    };
  if (pay && state.lifecycle === 'PLAYING') queueRefillPayments(state);
  emit({
    type: 'DRINK_DECK_REFILLED',
    deckId: state.innDrinkDeck.deckId,
    cardIds: replacement,
    barRemaining: reserve.length,
  });
  return true;
}

/** Shared server-owned draw path for orders, Chasers, forced Drinks and Events. */
export function drawInnDrinks(
  state: MutableGameState,
  count: number,
  emit: EmitEvent,
  rng: RandomSource,
  pay: boolean,
) {
  z.number().int().min(0).max(64).parse(count);
  if (state.barDrinkDeck === undefined) {
    const draw = drawFromPiles(
      state.innDrinkDeck.cardIds,
      state.innDrinkDiscard,
      count,
      state.rng,
      rng,
    );
    state.innDrinkDeck.cardIds = draw.deck;
    state.innDrinkDiscard = draw.discard;
    state.rng = draw.rng;
    for (const step of draw.steps)
      if (step.kind === 'RESHUFFLE') {
        if (pay && state.lifecycle === 'PLAYING') queueRefillPayments(state);
        for (const id of step.cardIds)
          state.cards[id]!.location = {
            zone: 'INN_DRINK_DECK',
            deckId: state.innDrinkDeck.deckId,
          };
        emit({
          type: 'DECK_SHUFFLED',
          deckId: state.innDrinkDeck.deckId,
          playerId: null,
          reason: 'EXHAUSTED',
          cardIds: step.cardIds,
        });
      }
    return draw.drawn;
  }
  const drawn: CardInstanceId[] = [];
  // Every Bar Deck draw uses the normal refill rule, including forced Drinks and Chasers.
  const barPayment = pay || state.rules.drinks.refillPayment === true;
  while (drawn.length < count) {
    if (
      state.innDrinkDeck.cardIds.length === 0 &&
      !refillBarDrinkDeck(state, emit, rng, barPayment)
    )
      break;
    drawn.push(...state.innDrinkDeck.cardIds.splice(0, count - drawn.length));
    // Charge/refill when the last active card is taken, rather than keeping a permanent 60-card deck.
    if (state.innDrinkDeck.cardIds.length === 0)
      refillBarDrinkDeck(state, emit, rng, barPayment);
  }
  return drawn;
}

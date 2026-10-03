import { drawFromPiles } from './decks';
import type { RandomSource } from './rng';
import type { EmitEvent } from './event-writer';
import type { MutableGameState } from './types';
export function drawHand(
  state: MutableGameState,
  player: MutableGameState['players'][number],
  emit: EmitEvent,
  rng: RandomSource,
  count = state.rules.handSize - player.hand.length,
) {
  const requested = Math.min(count, state.rules.handSize - player.hand.length);
  const draw = drawFromPiles(
    player.characterDeck.cardIds,
    player.characterDiscard,
    requested,
    state.rng,
    rng,
  );
  player.characterDeck.cardIds = draw.deck;
  player.characterDiscard = draw.discard;
  state.rng = draw.rng;
  for (const step of draw.steps) {
    if (step.kind === 'RESHUFFLE') {
      for (const id of step.cardIds)
        state.cards[id]!.location = {
          zone: 'CHARACTER_DECK',
          playerId: player.id,
          deckId: player.characterDeck.deckId,
        };
      emit({
        type: 'DECK_SHUFFLED',
        deckId: player.characterDeck.deckId,
        playerId: player.id,
        reason: 'EXHAUSTED',
        cardIds: step.cardIds,
      });
    } else {
      for (const id of step.cardIds)
        state.cards[id]!.location = { zone: 'HAND', playerId: player.id };
      player.hand.push(...step.cardIds);
      emit({ type: 'CARDS_DRAWN', playerId: player.id, cardIds: step.cardIds });
    }
  }
  if (draw.drawn.length < requested)
    emit({
      type: 'DRAW_SHORTFALL',
      playerId: player.id,
      requested,
      drawn: draw.drawn.length,
    });
}

import type { CardDefinitionId, CardInstanceId } from '../shared/ids';
import type { MutableGameState } from './types';
import type { EmitEvent } from './event-writer';
import { requireCommand } from './errors';

/** Select existing physical copies; never create cards or accept client deck order. */
function takeCopy(
  state: MutableGameState,
  piles: CardInstanceId[][],
  definitionId: CardDefinitionId,
) {
  for (const pile of piles) {
    const index = pile.findIndex(
      (id) => state.cards[id]!.definitionId === definitionId,
    );
    if (index >= 0) return pile.splice(index, 1)[0]!;
  }
  requireCommand(false, 'INVALID_CHOICE');
}
export function chooseHand(
  state: MutableGameState,
  player: MutableGameState['players'][number],
  definitionIds: CardDefinitionId[],
  emit: EmitEvent,
) {
  const piles = [player.characterDeck.cardIds, player.characterDiscard];
  const needed = Math.min(
    state.rules.handSize - player.hand.length,
    piles.reduce((n, pile) => n + pile.length, 0),
  );
  requireCommand(definitionIds.length === needed, 'INVALID_CHOICE');
  const cardIds = definitionIds.map((definitionId) =>
    takeCopy(state, piles, definitionId),
  );
  for (const id of cardIds) {
    state.cards[id]!.location = { zone: 'HAND', playerId: player.id };
    player.hand.push(id);
  }
  if (cardIds.length)
    emit({ type: 'CARDS_DRAWN', playerId: player.id, cardIds });
}
export function chooseDrink(
  state: MutableGameState,
  target: MutableGameState['players'][number],
  definitionId: CardDefinitionId,
) {
  const id = takeCopy(
    state,
    [state.innDrinkDeck.cardIds, state.innDrinkDiscard],
    definitionId,
  );
  state.cards[id]!.location = { zone: 'DRINK_PILE', playerId: target.id };
  target.drinkPile.unshift(id);
  return id;
}

import type { Effect } from '../../src/content/effects';
import { cardDefinitionSchema } from '../../src/content/cards';
import type { CoreGameState } from '../../src/engine/types';
import type { PlayerId } from '../../src/shared/ids';
import { accepted, mutable, started } from './core-match';

export function cardInHand(state: CoreGameState, seat: number, suffix: string) {
  return state.players[seat]!.hand.find(
    (id) => state.cards[id]!.definitionId === `carddef_sample_${suffix}`,
  )!;
}
export function actionState(effects?: Effect[]) {
  const state = mutable(
    accepted(started(1, 7), 'DISCARD', { cardIds: [] }).state,
  );
  if (effects !== undefined)
    state.definitions[
      state.cards[cardInHand(state, 0, 'shove')]!.definitionId
    ]!.effects = effects;
  return state;
}
export function playAction(
  state: CoreGameState = actionState(),
  targetPlayerId: string | null = 'player_1',
) {
  return accepted(state, 'PLAY_CARD', {
    cardId: cardInHand(state, 0, 'shove'),
    ...(targetPlayerId === null ? {} : { targetPlayerId }),
  });
}
export function response(state: CoreGameState, seat: number, suffix: string) {
  while (state.responseWindow!.priorityPlayerId !== state.players[seat]!.id) {
    const result = pass(state);
    state = result.state;
  }
  const result = accepted(
    state,
    'PLAY_RESPONSE',
    {
      responseWindowId: state.responseWindow!.id,
      cardId: cardInHand(state, seat, suffix),
    },
    state.players[seat]!.id,
  );
  return result;
}
export function priorityFor(state: CoreGameState, seat: number) {
  while (state.responseWindow!.priorityPlayerId !== state.players[seat]!.id)
    state = pass(state).state;
  return state;
}
export function pass(
  state: CoreGameState,
  actorId: PlayerId = state.responseWindow!.priorityPlayerId!,
) {
  return accepted(
    state,
    'PASS_RESPONSE',
    { responseWindowId: state.responseWindow!.id },
    actorId,
  );
}
export function passWindow(state: CoreGameState) {
  const id = state.responseWindow!.id;
  const results = [];
  while (state.responseWindow?.id === id) {
    const result = pass(state);
    results.push(result);
    state = result.state;
  }
  return { state, events: results.flatMap((result) => result.events), results };
}
export function responseEffects(state: CoreGameState, effects: Effect[]) {
  const copy = mutable(state);
  const id = copy.cards[cardInHand(copy, 1, 'breather')]!.definitionId;
  copy.definitions[id] = cardDefinitionSchema.parse({
    ...copy.definitions[id],
    type: 'SOMETIMES',
    responseKind: 'SOMETIMES',
    responseTrigger: { event: 'ANY', alternatives: [[]] },
    effects,
  });
  return copy;
}

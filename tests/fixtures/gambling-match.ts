import type { CoreGameState } from '../../src/engine/types';
import { accepted, started } from './core-match';
import { cardInHand, passWindow } from './timing-match';
export function gamblingActionState(seed = 1) {
  return accepted(started(seed, 7), 'DISCARD', { cardIds: [] }).state;
}
export function startRound(input: CoreGameState = gamblingActionState()) {
  const queued = accepted(input, 'PLAY_CARD', {
    cardId: cardInHand(input, 0, 'gamble'),
  });
  const passed = passWindow(queued.state);
  return {
    state: passed.state,
    events: [...queued.events, ...passed.events],
    queued,
  };
}
export function gamblingPlay(
  state: CoreGameState,
  seat: number,
  suffix: string,
) {
  return accepted(
    state,
    'GAMBLING_PLAY',
    { cardId: cardInHand(state, seat, suffix) },
    state.players[seat]!.id,
  );
}
export function gamblingPass(state: CoreGameState) {
  const result = accepted(
    state,
    'GAMBLING_PASS',
    {},
    state.gambling!.priorityPlayerId!,
  );
  if (result.state.responseWindow !== null) {
    const passed = passWindow(result.state);
    return {
      ...result,
      state: passed.state,
      events: [...result.events, ...passed.events],
    };
  }
  return result;
}
export function finishRound(state: CoreGameState) {
  const results = [];
  while (state.gambling !== null) {
    const result = gamblingPass(state);
    results.push(result);
    state = result.state;
  }
  return { state, events: results.flatMap((result) => result.events), results };
}

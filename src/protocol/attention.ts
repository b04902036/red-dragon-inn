import type { PublicGameView } from './views';
/** Derived only from authoritative, public prompt identity. State versions are deliberately excluded. */
export function actionAttention(
  view: PublicGameView,
  turnNumber: number,
  choiceIndex = 0,
) {
  if (view.lifecycle !== 'PLAYING' || view.matchId === null) return null;
  const window = view.responseWindow;
  if (window?.choicePlayerId)
    return {
      key: `${view.matchId}/choice/${window.id}/${choiceIndex}`,
      playerId: window.choicePlayerId,
      kind: 'CHOICE' as const,
    };
  if (window?.priorityPlayerId)
    return {
      key: `${view.matchId}/response/${window.id}/${window.submittedResponses.join(',')}/${window.passedPlayerIds.join(',')}/${window.priorityPlayerId}`,
      playerId: window.priorityPlayerId,
      kind: 'RESPONSE' as const,
    };
  if (window) return null;
  const round = view.gambling;
  if (round?.priorityPlayerId)
    return {
      key: `${view.matchId}/gambling/${view.resolutionStack.at(-1)?.id}/${round.controlSourceCardId}/${round.passedPlayerIds.join(',')}/${round.leftPlayerIds.join(',')}/${round.priorityPlayerId}`,
      playerId: round.priorityPlayerId,
      kind: 'GAMBLING' as const,
    };
  if (
    round ||
    view.resolutionStack.length > 0 ||
    !view.activePlayerId ||
    !view.phase
  )
    return null;
  if (
    view.players.find((player) => player.id === view.activePlayerId)?.eliminated
  )
    return null;
  return {
    key: `${view.matchId}/turn/${turnNumber}/${view.phase}/${view.activePlayerId}`,
    playerId: view.activePlayerId,
    kind: 'TURN' as const,
  };
}

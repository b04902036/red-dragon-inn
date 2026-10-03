import type { PublicGameView, PrivatePlayerView } from '../protocol/views';
import type { StateChangingCommand } from '../protocol/commands';

export function contextualActions(
  view: PublicGameView,
  playerId: string,
): StateChangingCommand['type'][] {
  const player = view.players.find((player) => player.id === playerId);
  if (view.lifecycle !== 'PLAYING' || player === undefined || player.eliminated)
    return [];
  if (view.responseWindow !== null)
    return view.responseWindow.priorityPlayerId === playerId
      ? ['PASS_RESPONSE']
      : [];
  if (view.gambling !== null)
    return view.gambling.priorityPlayerId === playerId
      ? [
          'GAMBLING_PASS',
          ...(view.gambling.participants.filter(
            (id) => !view.gambling!.leftPlayerIds.includes(id),
          ).length > 1
            ? ['GAMBLING_LEAVE' as const]
            : []),
        ]
      : [];
  if (view.resolutionStack.length > 0) return [];
  if (view.phaseEnd)
    return view.phaseEnd.priorityPlayerId === playerId ? ['PASS_ANYTIME'] : [];
  if (view.activePlayerId !== playerId) return [];
  switch (view.phase) {
    case 'DISCARD_DRAW':
      return ['DISCARD'];
    case 'ACTION':
      return ['SKIP_ACTION'];
    case 'ORDER_DRINK':
      return ['ORDER_DRINK'];
    case 'DRINK':
      return ['TAKE_DRINK'];
    case 'ELIMINATION_CHECK':
    case 'NEXT_TURN':
      return ['ADVANCE_PHASE'];
    default:
      return [];
  }
}
/** Presentation consumes server authority; card types/text never infer legality here. */
export function currentLegalPlays(
  view: PublicGameView,
  privateView: PrivatePlayerView | null,
  playerId: string,
) {
  if (
    view.lifecycle !== 'PLAYING' ||
    privateView?.playerId !== playerId ||
    privateView.matchId !== view.matchId ||
    privateView.legalPlayVersion !== view.version ||
    view.players.find((p) => p.id === playerId)?.eliminated !== false ||
    (view.responseWindow !== null &&
      view.responseWindow.priorityPlayerId !== playerId) ||
    (view.phaseEnd &&
      view.resolutionStack.length === 0 &&
      view.phaseEnd.priorityPlayerId !== playerId)
  )
    return [];
  return privateView.legalPlays.filter(
    (play) =>
      play.promptId === undefined ||
      play.promptId === view.timedPrompt?.promptId,
  );
}
export function cardAction(
  plays: PrivatePlayerView['legalPlays'],
  cardId: string,
) {
  return plays.find((play) => play.cardId === cardId)?.commandType ?? null;
}

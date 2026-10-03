import type { PublicGameView } from '../protocol/views';
import type { Presentation } from '../protocol/presentation';
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
export function cardAction(
  view: PublicGameView,
  playerId: string,
  card: Presentation['cards'][number],
  definitions: Presentation['cards'] = [],
): 'PLAY_CARD' | 'PLAY_RESPONSE' | 'GAMBLING_PLAY' | null {
  const player = view.players.find((player) => player.id === playerId);
  if (view.lifecycle !== 'PLAYING' || player === undefined || player.eliminated)
    return null;
  if (view.responseWindow !== null) {
    if (
      view.responseWindow.priorityPlayerId !== playerId ||
      !['SOMETIMES', 'ANYTIME'].includes(card.type)
    )
      return null;
    const frame = view.resolutionStack.at(-1)!;
    if (
      card.responseKind === 'IGNORE' &&
      !frame.targetPlayerIds.includes(player.id) &&
      !(
        frame.actorId === player.id &&
        (frame.kind === 'DRINK' ||
          definitions.some(
            (definition) =>
              definition.id === frame.sourceCard?.definitionId &&
              definition.affectsSelf,
          ))
      )
    )
      return null;
    return 'PLAY_RESPONSE';
  }
  if (view.gambling !== null)
    return card.type === 'ANYTIME'
      ? 'PLAY_CARD'
      : view.gambling.priorityPlayerId === playerId &&
          view.gambling.allowedControlCategories.some(
            (type) => type === card.type,
          )
        ? 'GAMBLING_PLAY'
        : null;
  if (view.resolutionStack.length > 0) return null;
  if (card.type === 'ANYTIME') return 'PLAY_CARD';
  return view.phase === 'ACTION' &&
    view.activePlayerId === playerId &&
    ['ACTION', 'GAMBLING'].includes(card.type)
    ? 'PLAY_CARD'
    : null;
}

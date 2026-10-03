import type { PublicGameView, PrivatePlayerView } from '../protocol/views';
import type { ServerMessage } from '../protocol/messages';
import type { Presence } from '../protocol/presentation';

export type ConnectionStatus =
  'connecting' | 'synced' | 'reconnecting' | 'resyncing' | 'offline';
export interface RoomClientState {
  status: ConnectionStatus;
  publicView: PublicGameView | null;
  privateView: PrivatePlayerView | null;
  hostPlayerId: string | null;
  presence: Presence;
  pendingCommandId: string | null;
  error: string | null;
  log: string[];
}
export const initialRoomState: RoomClientState = {
  status: 'connecting',
  publicView: null,
  privateView: null,
  hostPlayerId: null,
  presence: [],
  pendingCommandId: null,
  error: null,
  log: [],
};
export function phaseName(phase: PublicGameView['phase']) {
  return phase === null
    ? 'Waiting'
    : (
        {
          DISCARD_DRAW: 'Discard and draw',
          ACTION: 'Action',
          ORDER_DRINK: 'Order a Drink',
          DRINK: 'Take a Drink',
          ELIMINATION_CHECK: 'Elimination check',
          NEXT_TURN: 'Next turn',
        } as const
      )[phase];
}
export function rejectionText(code: string, reason?: string) {
  if (code === 'RATE_LIMITED')
    return 'Too many requests. Wait a moment before reconnecting.';
  if (code === 'PERSISTENCE_UNAVAILABLE')
    return 'Match history is temporarily unavailable. Reconnecting will recover the table.';
  if (code === 'VERSION_CONFLICT')
    return 'The table changed. Your view has been refreshed; try your action again.';
  if (code === 'INVALID_SESSION' || code === 'AUTH_REQUIRED')
    return 'Your seat could not be resumed. Rejoin the room or reconnect.';
  if (code === 'NOT_ENOUGH_PLAYERS')
    return 'At least two players must join before starting.';
  if (reason === 'NOT_ACTIVE_PLAYER') return 'Wait for your turn.';
  if (reason === 'WRONG_PHASE' || reason === 'RESOLUTION_PENDING')
    return 'That action is unavailable while the table is waiting for another step.';
  return 'That action was not accepted. Choose an available action and try again.';
}
export function receiveRoomMessage(
  state: RoomClientState,
  message: ServerMessage,
  roomId: string,
  playerId: string,
): RoomClientState {
  switch (message.type) {
    case 'SESSION_ACCEPTED':
      return message.roomId === roomId && message.playerId === playerId
        ? {
            ...state,
            hostPlayerId: message.hostPlayerId,
            error: null,
            pendingCommandId: null,
          }
        : state;
    case 'ROOM_PRESENCE':
      return message.roomId === roomId
        ? { ...state, presence: message.players }
        : state;
    case 'PONG':
      return state;
    case 'PUBLIC_STATE': {
      const view = message.view;
      if (
        view.roomId !== roomId ||
        view.version < (state.publicView?.version ?? 0)
      )
        return state;
      const lines: string[] = [];
      if (view.version !== (state.publicView?.version ?? -1)) {
        for (const player of view.players) {
          const previous = state.publicView?.players.find(
            (before) => before.id === player.id,
          );
          if (previous && previous.fortitude !== player.fortitude)
            lines.push(
              `${player.displayName}: Fortitude ${previous.fortitude} → ${player.fortitude}.`,
            );
          if (previous && previous.alcoholContent !== player.alcoholContent)
            lines.push(
              `${player.displayName}: Alcohol ${previous.alcoholContent} → ${player.alcoholContent}.`,
            );
          if (previous && previous.gold !== player.gold)
            lines.push(
              `${player.displayName}: Gold ${previous.gold} → ${player.gold}.`,
            );
          if (player.eliminated && !previous?.eliminated)
            lines.push(`${player.displayName} is eliminated.`);
        }
        if (view.lifecycle === 'FINISHED')
          lines.push(
            view.winners.length === 0
              ? 'The match ends in a tie.'
              : `${view.players.find((player) => view.winners.includes(player.id))!.displayName} wins!`,
          );
        else if (view.gambling !== null && state.publicView?.gambling === null)
          lines.push('A gambling round has begun.');
        else if (state.publicView?.gambling && view.gambling === null)
          lines.push('The gambling pot has been paid.');
        else if (view.phase !== state.publicView?.phase)
          lines.push(
            `${phaseName(view.phase)}${view.activePlayerId ? ` · ${view.players.find((player) => player.id === view.activePlayerId)!.displayName}` : ''}.`,
          );
      }
      return {
        ...state,
        publicView: view,
        status: 'synced',
        privateView:
          state.privateView?.matchId === view.matchId
            ? state.privateView
            : null,
        log: [...state.log, ...lines].slice(-10),
      };
    }
    case 'PRIVATE_STATE':
      if (
        message.view.roomId !== roomId ||
        message.view.playerId !== playerId ||
        message.view.matchId !== state.publicView?.matchId ||
        message.view.version < (state.privateView?.version ?? 0)
      )
        return state;
      return { ...state, privateView: message.view };
    case 'COMMAND_ACCEPTED':
      return message.commandId === state.pendingCommandId
        ? { ...state, pendingCommandId: null, status: 'resyncing', error: null }
        : state;
    case 'COMMAND_REJECTED':
      return {
        ...state,
        pendingCommandId: null,
        error: rejectionText(message.code, message.reason),
        status:
          message.code === 'VERSION_CONFLICT' ? 'resyncing' : state.status,
      };
  }
}

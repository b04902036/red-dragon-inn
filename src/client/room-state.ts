import type { PublicGameView, PrivatePlayerView } from '../protocol/views';
import type { ServerMessage } from '../protocol/messages';
import type { Presence } from '../protocol/presentation';
import { uiMessage, formatMessage } from '../shared/ui-messages';
import type { UiMessage, MessageKey } from '../shared/ui-messages';
import type { Locale } from '../shared/locales';

export type ConnectionStatus =
  'connecting' | 'synced' | 'reconnecting' | 'resyncing' | 'offline';
export interface RoomClientState {
  status: ConnectionStatus;
  publicView: PublicGameView | null;
  privateView: PrivatePlayerView | null;
  hostPlayerId: string | null;
  presence: Presence;
  pendingCommandId: string | null;
  error: UiMessage | null;
  log: UiMessage[];
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
export function phaseKey(phase: PublicGameView['phase']): MessageKey {
  return phase === null ? 'phase.waiting' : `phase.${phase}`;
}
export function phaseName(
  phase: PublicGameView['phase'],
  locale: Locale = 'en-US',
) {
  return formatMessage(locale, phaseKey(phase));
}
export function rejectionKey(code: string, reason?: string): MessageKey {
  if (code === 'RATE_LIMITED') return 'reject.rate';
  if (code === 'PERSISTENCE_UNAVAILABLE') return 'reject.history';
  if (code === 'VERSION_CONFLICT') return 'reject.version';
  if (code === 'INVALID_SESSION' || code === 'AUTH_REQUIRED')
    return 'reject.session';
  if (code === 'NOT_ENOUGH_PLAYERS') return 'reject.players';
  if (reason === 'NOT_ACTIVE_PLAYER') return 'reject.turn';
  if (reason === 'WRONG_PHASE' || reason === 'RESOLUTION_PENDING')
    return 'reject.phase';
  return 'reject.other';
}
export function rejectionText(
  code: string,
  reason?: string,
  locale: Locale = 'en-US',
) {
  return formatMessage(locale, rejectionKey(code, reason));
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
      const lines: UiMessage[] = [];
      if (view.version !== (state.publicView?.version ?? -1)) {
        for (const player of view.players) {
          const previous = state.publicView?.players.find(
            (before) => before.id === player.id,
          );
          if (previous && previous.fortitude !== player.fortitude)
            lines.push(
              uiMessage('log.stat', {
                name: player.displayName,
                stat: 'player.fortitude',
                before: previous.fortitude,
                after: player.fortitude,
              }),
            );
          if (previous && previous.alcoholContent !== player.alcoholContent)
            lines.push(
              uiMessage('log.stat', {
                name: player.displayName,
                stat: 'player.alcohol',
                before: previous.alcoholContent,
                after: player.alcoholContent,
              }),
            );
          if (previous && previous.gold !== player.gold)
            lines.push(
              uiMessage('log.stat', {
                name: player.displayName,
                stat: 'player.gold',
                before: previous.gold,
                after: player.gold,
              }),
            );
          if (player.eliminated && !previous?.eliminated)
            lines.push(
              uiMessage('log.eliminated', { name: player.displayName }),
            );
        }
        if (view.lifecycle === 'FINISHED')
          lines.push(
            view.winners.length === 0
              ? uiMessage('log.tie')
              : uiMessage('table.winner', {
                  name: view.players.find((player) =>
                    view.winners.includes(player.id),
                  )!.displayName,
                }),
          );
        else if (view.gambling !== null && state.publicView?.gambling === null)
          lines.push(uiMessage('log.gamblingStarted'));
        else if (state.publicView?.gambling && view.gambling === null)
          lines.push(uiMessage('log.gamblingPaid'));
        else if (view.phase !== state.publicView?.phase)
          lines.push(
            view.activePlayerId
              ? uiMessage('log.phasePlayer', {
                  phase: phaseKey(view.phase),
                  name: view.players.find(
                    (player) => player.id === view.activePlayerId,
                  )!.displayName,
                })
              : uiMessage('log.phase', {
                  phase: phaseKey(view.phase),
                  player: '',
                }),
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
        error: uiMessage(rejectionKey(message.code, message.reason)),
        status:
          message.code === 'VERSION_CONFLICT' ? 'resyncing' : state.status,
      };
  }
}

import type { PublicGameView, PrivatePlayerView } from '../protocol/views';
import type { ServerMessage } from '../protocol/messages';
import type { Presence } from '../protocol/presentation';
import type { PublicNarrationEvent } from '../protocol/public-narration';
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
  log: PublicNarrationEvent[];
  timelineMatchId: string | null;
  liveEventIds: string[];
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
  timelineMatchId: null,
  liveEventIds: [],
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
    case 'PUBLIC_TIMELINE': {
      if (
        state.publicView?.matchId &&
        state.publicView.matchId !== message.matchId
      )
        return state;
      const sameMatch = state.timelineMatchId === message.matchId;
      const existing = sameMatch ? state.log : [];
      const seen = new Set(existing.map((event) => event.sequence));
      const fresh = message.events.filter((event) => !seen.has(event.sequence));
      if (sameMatch && fresh.length === 0) return state;
      return {
        ...state,
        timelineMatchId: message.matchId,
        log: [...existing, ...fresh].sort((a, b) => a.sequence - b.sequence),
        liveEventIds: [
          ...(sameMatch ? state.liveEventIds : []),
          ...(message.mode === 'LIVE' ? fresh.map((event) => event.id) : []),
        ],
      };
    }
    case 'PUBLIC_STATE': {
      const view = message.view;
      if (
        view.roomId !== roomId ||
        view.version < (state.publicView?.version ?? 0)
      )
        return state;
      return {
        ...state,
        publicView: view,
        status: 'synced',
        privateView:
          state.privateView?.matchId === view.matchId
            ? state.privateView
            : null,
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

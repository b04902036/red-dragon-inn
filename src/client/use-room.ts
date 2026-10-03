import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { roomCredentialsSchema } from '../protocol/rooms';
import {
  decodeServerMessage,
  encodeClientRoomMessage,
} from '../protocol/codec';
import type { StateChangingCommand } from '../protocol/commands';
import {
  presentationSchema,
  type Presentation,
} from '../protocol/presentation';
import { initialRoomState, receiveRoomMessage } from './room-state';

export type RoomCredentials = z.infer<typeof roomCredentialsSchema>;
export function useRoom(credentials: RoomCredentials) {
  const [state, setState] = useState(initialRoomState);
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<() => void>(() => {});
  const pendingRef = useRef(false);
  useEffect(() => {
    let disposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const controller = new AbortController();
    const loadPresentation = () => {
      void fetch('/api/content/sample', { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error('Unavailable');
          const content = presentationSchema.parse(await response.json());
          if (!disposed) setPresentation(content);
        })
        .catch(() => {
          if (!disposed)
            setState((previous) => ({
              ...previous,
              error:
                'Card information could not be loaded. Reconnect to try again.',
            }));
        });
    };
    loadPresentation();
    const connect = () => {
      if (disposed) return;
      clearTimeout(reconnectTimer);
      const socket = new WebSocket(
        `${location.origin.replace(/^http/, 'ws')}/api/rooms/${credentials.roomId}/ws`,
      );
      socketRef.current = socket;
      socket.onopen = () => {
        if (disposed || socket !== socketRef.current) return;
        socket.send(encodeClientRoomMessage({ type: 'HELLO', ...credentials }));
      };
      socket.onmessage = (event) => {
        if (disposed || socket !== socketRef.current) return;
        try {
          const message = decodeServerMessage(event.data as string);
          if (message.type === 'SESSION_ACCEPTED') {
            attempts = 0;
            pendingRef.current = false;
          }
          if (
            message.type === 'COMMAND_ACCEPTED' ||
            message.type === 'COMMAND_REJECTED'
          )
            pendingRef.current = false;
          setState((previous) =>
            receiveRoomMessage(
              previous,
              message,
              credentials.roomId,
              credentials.playerId,
            ),
          );
        } catch {
          setState((previous) => ({
            ...previous,
            error:
              'An update could not be read. Reconnect to refresh the table.',
          }));
        }
      };
      socket.onclose = (event) => {
        if (disposed || socket !== socketRef.current) return;
        pendingRef.current = false;
        if (event.code === 1008) {
          setState((previous) => ({
            ...previous,
            status: 'offline',
            pendingCommandId: null,
            error:
              'This seat was opened in another tab. Reconnect here to resume.',
          }));
          return;
        }
        setState((previous) => ({
          ...previous,
          status: 'reconnecting',
          pendingCommandId: null,
        }));
        attempts += 1;
        reconnectTimer = setTimeout(connect, Math.min(attempts * 1000, 5000));
      };
      socket.onerror = () => {
        if (!disposed && socket === socketRef.current)
          setState((previous) => ({ ...previous, status: 'reconnecting' }));
      };
    };
    reconnectRef.current = () => {
      socketRef.current?.close(1000, 'Reconnect');
      setState((previous) => ({
        ...previous,
        status: 'reconnecting',
        error: null,
      }));
      pendingRef.current = false;
      loadPresentation();
      connect();
    };
    connect();
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(reconnectTimer);
      socketRef.current?.close(1000, 'Leaving table');
    };
  }, [credentials]);
  const send = useCallback(
    (
      type: StateChangingCommand['type'],
      fields: Record<string, unknown> = {},
    ) => {
      if (
        state.status !== 'synced' ||
        state.publicView === null ||
        pendingRef.current ||
        socketRef.current?.readyState !== WebSocket.OPEN
      )
        return;
      const commandId = `command_${crypto.randomUUID().replaceAll('-', '')}`;
      try {
        const command = {
          ...fields,
          type,
          roomId: credentials.roomId,
          commandId,
          expectedStateVersion: state.publicView.version,
        } as StateChangingCommand;
        const frame = encodeClientRoomMessage({ type: 'COMMAND', command });
        pendingRef.current = true;
        setState((previous) => ({
          ...previous,
          pendingCommandId: commandId,
          error: null,
        }));
        socketRef.current.send(frame);
      } catch {
        pendingRef.current = false;
        setState((previous) => ({
          ...previous,
          pendingCommandId: null,
          error: 'The action could not be sent. Reconnect and try again.',
        }));
      }
    },
    [credentials.roomId, state.status, state.publicView],
  );
  return { state, presentation, send, reconnect: () => reconnectRef.current() };
}

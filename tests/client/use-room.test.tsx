import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRoom } from '../../src/client/use-room';
import { roomCredentialsSchema } from '../../src/protocol/rooms';
import {
  projectPublicGame,
  projectPrivatePlayer,
} from '../../src/protocol/projections';
import { started } from '../fixtures/core-match';
import { playerIdSchema } from '../../src/shared/ids';
import { formatMessage } from '../../src/shared/ui-messages';
import { LocaleProvider } from '../../src/client/i18n/LocaleProvider';
import { useLocale } from '../../src/client/i18n/context';

class Socket {
  static OPEN = 1;
  static instances: Socket[] = [];
  readyState = 1;
  sent: string[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly url: string) {
    Socket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.closed = true;
  }
  message(value: unknown) {
    this.onmessage?.({ data: JSON.stringify(value) });
  }
}
const game = started(1, 7);
const playerId = playerIdSchema.parse('player_0');
const credentials = roomCredentialsSchema.parse({
  roomId: game.roomId,
  playerId,
  resumeToken: 'a'.repeat(64),
});
const content = { schemaVersion: 1, characters: [], cards: [] };
function ready(socket: Socket) {
  socket.onopen?.();
  socket.message({
    type: 'SESSION_ACCEPTED',
    roomId: game.roomId,
    playerId,
    hostPlayerId: playerId,
    sessionId: `session_${'b'.repeat(32)}`,
    stateVersion: game.version,
  });
  socket.message({ type: 'PUBLIC_STATE', view: projectPublicGame(game) });
  socket.message({
    type: 'PRIVATE_STATE',
    view: projectPrivatePlayer(game, playerId),
  });
}
beforeEach(() => {
  Socket.instances = [];
  vi.stubGlobal('WebSocket', Socket);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(content)));
});
afterEach(() => vi.useRealTimers());
describe('room transport', () => {
  it('changes presentation locale without reconnecting, sending commands, or changing authoritative state', async () => {
    const { result } = renderHook(
      () => ({ room: useRoom(credentials), language: useLocale() }),
      { wrapper: LocaleProvider },
    );
    await waitFor(() =>
      expect(result.current.room.presentation).toEqual(content),
    );
    const socket = Socket.instances[0]!;
    act(() => ready(socket));
    const before = result.current.room.state;
    const sent = [...socket.sent];
    act(() => result.current.language.setLocale('zh-TW'));
    await waitFor(() =>
      expect(fetch).toHaveBeenLastCalledWith(
        `/api/rooms/${credentials.roomId}/presentation?locale=zh-TW`,
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    expect(Socket.instances).toHaveLength(1);
    expect(socket.closed).toBe(false);
    expect(socket.sent).toEqual(sent);
    expect(result.current.room.state).toBe(before);
  });
  it('reports history failure and reconnects with the same seat and private hand', async () => {
    const { result } = renderHook(() => useRoom(credentials));
    await waitFor(() => expect(result.current.presentation).toEqual(content));
    expect(fetch).toHaveBeenCalledWith(
      `/api/rooms/${credentials.roomId}/presentation?locale=en-US`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    vi.useFakeTimers();
    const old = Socket.instances[0]!;
    act(() => ready(old));
    const hand = result.current.state.privateView?.hand;
    act(() =>
      old.message({
        type: 'COMMAND_REJECTED',
        code: 'PERSISTENCE_UNAVAILABLE',
        commandId: null,
        stateVersion: game.version,
      }),
    );
    expect(formatMessage('en-US', result.current.state.error!.key)).toContain(
      'Match history',
    );
    act(() => old.onclose?.({ code: 1013 }));
    expect(result.current.state.status).toBe('reconnecting');
    act(() => vi.advanceTimersByTime(1000));
    const resumed = Socket.instances[1]!;
    act(() => ready(resumed));
    expect(JSON.parse(resumed.sent[0]!)).toEqual({
      type: 'HELLO',
      ...credentials,
    });
    expect(result.current.state.privateView?.hand).toEqual(hand);
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.status).toBe('synced');
  });
  it('authenticates, projects state, sends intents with server version and prevents duplicate pending actions', async () => {
    const { result, unmount } = renderHook(() => useRoom(credentials));
    const socket = Socket.instances[0]!;
    act(() => ready(socket));
    await waitFor(() => expect(result.current.presentation).toEqual(content));
    expect(JSON.parse(socket.sent[0]!)).toEqual({
      type: 'HELLO',
      ...credentials,
    });
    const before = result.current.state.publicView;
    act(() => {
      result.current.send('DISCARD', { cardIds: [] });
      result.current.send('DISCARD', { cardIds: [] });
    });
    expect(socket.sent).toHaveLength(2);
    expect(result.current.state.publicView).toBe(before);
    expect(result.current.state.privateView?.hand).toHaveLength(7);
    const envelope = JSON.parse(socket.sent[1]!) as {
      command: { commandId: string; expectedStateVersion: number };
    };
    expect(envelope.command.expectedStateVersion).toBe(game.version);
    expect(socket.sent[1]).not.toMatch(/fortitude|seed|actorId|deckOrder/);
    act(() =>
      socket.message({
        type: 'COMMAND_ACCEPTED',
        commandId: envelope.command.commandId,
        stateVersion: game.version,
      }),
    );
    expect(result.current.state.status).toBe('resyncing');
    expect(result.current.state.publicView).toBe(before);
    act(() =>
      socket.message({ type: 'PUBLIC_STATE', view: projectPublicGame(game) }),
    );
    expect(result.current.state.status).toBe('synced');
    unmount();
    expect(socket.closed).toBe(true);
  });
  it('automatically reconnects after a network close, ignores obsolete sockets, and resumes the same credentials', async () => {
    const { result } = renderHook(() => useRoom(credentials));
    await waitFor(() => expect(result.current.presentation).toEqual(content));
    vi.useFakeTimers();
    const old = Socket.instances[0]!;
    act(() => ready(old));
    act(() => old.onclose?.({ code: 1006 }));
    expect(result.current.state.status).toBe('reconnecting');
    act(() => vi.advanceTimersByTime(1000));
    const resumed = Socket.instances[1]!;
    act(() => ready(resumed));
    expect(JSON.parse(resumed.sent[0]!)).toEqual({
      type: 'HELLO',
      ...credentials,
    });
    act(() => {
      old.onerror?.();
      old.message({
        type: 'COMMAND_REJECTED',
        code: 'NOT_ALLOWED',
        commandId: null,
        stateVersion: game.version,
      });
    });
    expect(result.current.state.status).toBe('synced');
    expect(result.current.state.error).toBeNull();
  });
  it('stops retrying replaced sessions until explicit reconnect', async () => {
    const { result } = renderHook(() => useRoom(credentials));
    await waitFor(() => expect(result.current.presentation).toEqual(content));
    const socket = Socket.instances[0]!;
    act(() => ready(socket));
    act(() => socket.onclose?.({ code: 1008 }));
    expect(result.current.state.status).toBe('offline');
    expect(formatMessage('en-US', result.current.state.error!.key)).toContain(
      'another tab',
    );
    act(() => result.current.reconnect());
    expect(Socket.instances).toHaveLength(2);
    expect(socket.closed).toBe(true);
    act(() => ready(Socket.instances[1]!));
    expect(result.current.state.status).toBe('synced');
  });
  it('rejects malformed frames and retries a failed content request on explicit reconnect', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValueOnce(Response.json(content));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useRoom(credentials));
    await waitFor(() =>
      expect(formatMessage('en-US', result.current.state.error!.key)).toContain(
        'Card information',
      ),
    );
    act(() =>
      Socket.instances[0]!.message({ type: 'PUBLIC_STATE', view: { seed: 1 } }),
    );
    expect(formatMessage('en-US', result.current.state.error!.key)).toContain(
      'could not be read',
    );
    act(() => result.current.reconnect());
    await waitFor(() => expect(result.current.presentation).toEqual(content));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('keeps disconnected and malformed commands off the wire', async () => {
    const { result } = renderHook(() => useRoom(credentials));
    await waitFor(() => expect(result.current.presentation).toEqual(content));
    const socket = Socket.instances[0]!;
    act(() => result.current.send('DISCARD', { cardIds: [] }));
    expect(socket.sent).toHaveLength(0);
    act(() => ready(socket));
    act(() => result.current.send('DISCARD', { cardIds: [], gold: 999 }));
    expect(socket.sent).toHaveLength(1);
    expect(result.current.state.pendingCommandId).toBeNull();
    expect(formatMessage('en-US', result.current.state.error!.key)).toContain(
      'could not be sent',
    );
  });
});

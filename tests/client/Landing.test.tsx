import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/client/App';
import { projectPublicGame } from '../../src/protocol/projections';
import { started } from '../fixtures/core-match';

vi.mock('../../src/client/RoomScreen', () => ({
  RoomScreen: ({
    credentials,
    leave,
  }: {
    credentials: { playerId: string };
    leave: () => void;
  }) => (
    <div>
      <p>Resumed {credentials.playerId}</p>
      <button onClick={leave}>Leave table</button>
    </div>
  ),
}));
const game = started();
const view = {
  ...projectPublicGame(game),
  lifecycle: 'LOBBY',
  matchId: null,
  phase: null,
  activePlayerId: null,
};
const credentials = {
  roomId: game.roomId,
  playerId: game.players[0]!.id,
  resumeToken: 'a'.repeat(64),
};
const joined = {
  roomId: game.roomId,
  hostPlayerId: credentials.playerId,
  maxPlayers: 4,
  view,
  credentials,
};
const fetchRooms = (response: () => Promise<Response>) => {
  const mock = vi
    .fn()
    .mockImplementation((url: string) =>
      url === '/api/health'
        ? Promise.resolve(
            Response.json({ ok: true, service: 'red-dragon-inn' }),
          )
        : response(),
    );
  vi.stubGlobal('fetch', mock);
  return mock;
};
afterEach(() => {
  sessionStorage.clear();
  history.replaceState(null, '', '/');
});
describe('room entry and refresh credentials', () => {
  it('creates a room with only a display name, stores tab credentials and exposes a token-free URL', async () => {
    const fetchMock = fetchRooms(() => Promise.resolve(Response.json(joined)));
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText('Your name'), '  Visitor  ');
    await user.click(screen.getByRole('button', { name: 'Create room' }));
    await screen.findByText(`Resumed ${credentials.playerId}`);
    expect(fetchMock).toHaveBeenCalledWith('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Visitor' }),
    });
    expect(
      JSON.parse(sessionStorage.getItem(`rdi-room:${game.roomId}`)!),
    ).toEqual(credentials);
    expect(location.search).toBe(`?room=${game.roomId}`);
    expect(location.href).not.toContain(credentials.resumeToken);
    await user.click(screen.getByRole('button', { name: 'Leave table' }));
    expect(
      screen.getByRole('heading', { name: 'Red Dragon Inn' }),
    ).toBeVisible();
    expect(location.search).toBe('');
  });
  it('joins using a pasted invite link', async () => {
    const fetchMock = fetchRooms(() => Promise.resolve(Response.json(joined)));
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText('Your name'), 'Guest');
    await user.type(
      screen.getByLabelText('Room code or invite link'),
      `https://example.com/?room=${game.roomId}`,
    );
    await user.click(screen.getByRole('button', { name: 'Join room' }));
    await screen.findByText(`Resumed ${credentials.playerId}`);
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(
      `/api/rooms/${game.roomId}/join`,
    );
  });
  it('restores only matching validated credentials for the requested room', () => {
    sessionStorage.setItem(
      `rdi-room:${game.roomId}`,
      JSON.stringify(credentials),
    );
    history.replaceState(null, '', `/?room=${game.roomId}`);
    render(<App />);
    expect(screen.getByText(`Resumed ${credentials.playerId}`)).toBeVisible();
  });
  it('ignores corrupt saved credentials and prefills the invite room', () => {
    fetchRooms(() => Promise.resolve(Response.json(joined)));
    sessionStorage.setItem(`rdi-room:${game.roomId}`, 'bad JSON');
    history.replaceState(null, '', `/?room=${game.roomId}`);
    render(<App />);
    expect(screen.getByLabelText('Room code or invite link')).toHaveValue(
      game.roomId,
    );
  });
  it.each([404, 409, 503])(
    'shows actionable server errors for HTTP %s without storing a seat',
    async (status) => {
      fetchRooms(() => Promise.resolve(new Response(null, { status })));
      const user = userEvent.setup();
      render(<App />);
      await user.type(screen.getByLabelText('Your name'), 'Guest');
      await user.click(screen.getByRole('button', { name: 'Create room' }));
      await waitFor(() => expect(screen.getByRole('alert')).toBeVisible());
      if (status === 503)
        expect(screen.getByRole('alert')).toHaveTextContent(
          'configure a published content version',
        );
      expect(sessionStorage.length).toBe(0);
      expect(screen.getByRole('button', { name: 'Create room' })).toBeEnabled();
    },
  );
  it('rejects malformed room codes before issuing a join request', async () => {
    const fetchMock = fetchRooms(() => Promise.resolve(Response.json(joined)));
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText('Your name'), 'Guest');
    await user.type(
      screen.getByLabelText('Room code or invite link'),
      'bad code',
    );
    await user.click(screen.getByRole('button', { name: 'Join room' }));
    expect(screen.getByRole('alert')).toHaveTextContent('valid room code');
    expect(
      fetchMock.mock.calls.filter((call) => call[0] !== '/api/health'),
    ).toHaveLength(0);
  });
});

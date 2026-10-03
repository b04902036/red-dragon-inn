import { useState } from 'react';
import type { RoomCredentials } from './use-room';
import { useRoom } from './use-room';
import { GameTable } from './GameTable';
import { characterSelectionSchema } from '../protocol/presentation';
import { roomMetadataSchema } from '../protocol/rooms';

export function RoomScreen({
  credentials,
  leave,
}: {
  credentials: RoomCredentials;
  leave: () => void;
}) {
  const { state, presentation, send, reconnect } = useRoom(credentials);
  const [notice, setNotice] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const view = state.publicView;
  const invite = `${location.origin}/?room=${credentials.roomId}`;
  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(invite);
      setNotice('Invite link copied.');
    } catch {
      setNotice('Select and copy the invite link above.');
    }
  };
  const selectCharacter = async (characterId: string) => {
    if (view === null) return;
    setSelecting(true);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/rooms/${credentials.roomId}/character`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${credentials.resumeToken}`,
          },
          body: JSON.stringify(
            characterSelectionSchema.parse({
              characterId,
              expectedStateVersion: view.version,
            }),
          ),
        },
      );
      if (!response.ok) throw new Error('Unavailable');
      roomMetadataSchema.parse(await response.json());
    } catch {
      setNotice(
        'That character could not be selected. The seat or table may have changed.',
      );
    } finally {
      setSelecting(false);
    }
  };
  return (
    <>
      <nav className="room-nav" aria-label="Room">
        <span>
          Room <code>{credentials.roomId}</code>
        </span>
        <button className="secondary" onClick={leave}>
          Leave table
        </button>
      </nav>
      {view !== null && presentation !== null && view.lifecycle !== 'LOBBY' ? (
        <GameTable
          state={state}
          presentation={presentation}
          playerId={credentials.playerId}
          send={send}
          reconnect={reconnect}
        />
      ) : (
        <main className="lobby-page">
          <p className="eyebrow">Gather your party</p>
          <h1>Your table at the inn</h1>
          <p role="status">
            {state.status === 'synced'
              ? 'Synced'
              : state.status === 'offline'
                ? 'Disconnected'
                : state.status === 'reconnecting'
                  ? 'Reconnecting…'
                  : 'Connecting…'}
          </p>
          {(state.error || notice) && (
            <p role="alert" className="notice">
              {notice ?? state.error}
            </p>
          )}
          <section className="invite-panel">
            <h2>Invite your friends</h2>
            <label>
              Invite link
              <input
                readOnly
                value={invite}
                onFocus={(event) => event.currentTarget.select()}
              />
            </label>
            <button
              onClick={() => {
                void copyInvite();
              }}
            >
              Copy invite link
            </button>
          </section>
          <section>
            <h2>Seats at the table</h2>
            <ol className="lobby-seats">
              {view?.players.map((player) => (
                <li key={player.id}>
                  <strong>
                    {player.displayName}
                    {player.id === credentials.playerId ? ' · You' : ''}
                  </strong>
                  <span>
                    Seat {player.seat + 1} ·{' '}
                    {state.presence.some(
                      (presence) =>
                        presence.playerId === player.id && presence.connected,
                    )
                      ? 'Connected'
                      : 'Disconnected'}
                    {player.id === state.hostPlayerId ? ' · Host' : ''}
                  </span>
                  <span>
                    {presentation?.characters.find(
                      (character) => character.id === player.characterId,
                    )?.name ?? 'Loading character…'}
                  </span>
                </li>
              ))}
            </ol>
          </section>
          {view && presentation && (
            <label className="character-select">
              Your character
              <select
                value={
                  view.players.find(
                    (player) => player.id === credentials.playerId,
                  )!.characterId!
                }
                disabled={state.status !== 'synced' || selecting}
                onChange={(event) => {
                  void selectCharacter(event.target.value);
                }}
              >
                {presentation.characters.map((character) => (
                  <option
                    key={character.id}
                    value={character.id}
                    disabled={view.players.some(
                      (player) =>
                        player.id !== credentials.playerId &&
                        player.characterId === character.id,
                    )}
                  >
                    {character.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="lobby-actions">
            {state.hostPlayerId === credentials.playerId ? (
              <button
                disabled={
                  state.status !== 'synced' ||
                  state.pendingCommandId !== null ||
                  (view?.players.length ?? 0) < 2 ||
                  selecting ||
                  presentation === null
                }
                onClick={() => send('START_MATCH')}
              >
                Start sample match
              </button>
            ) : (
              <p>Waiting for the host to start.</p>
            )}
            <button className="secondary" onClick={reconnect}>
              Reconnect
            </button>
          </div>
          <p className="footnote">
            Original sample cards · 2–4 players · Each tab keeps its own seat
            for refreshes.
          </p>
        </main>
      )}
    </>
  );
}

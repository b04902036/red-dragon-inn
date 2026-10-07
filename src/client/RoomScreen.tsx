import { useState } from 'react';
import type { RoomCredentials } from './use-room';
import { useRoom } from './use-room';
import { GameTable } from './GameTable';
import { characterSelectionSchema } from '../protocol/presentation';
import { roomMetadataSchema } from '../protocol/rooms';
import { useLocale } from './i18n/context';
import { uiMessage } from '../shared/ui-messages';
import type { UiMessage } from '../shared/ui-messages';

export function RoomScreen({
  credentials,
  leave,
}: {
  credentials: RoomCredentials;
  leave: () => void;
}) {
  const { state, presentation, send, reconnect } = useRoom(credentials);
  const { t, message } = useLocale();
  const [notice, setNotice] = useState<UiMessage | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [drinkSetup, setDrinkSetup] = useState('');
  const view = state.publicView;
  const invite = `${location.origin}/?room=${credentials.roomId}`;
  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(invite);
      setNotice(uiMessage('room.copied'));
    } catch {
      setNotice(uiMessage('room.copyFailed'));
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
      setNotice(uiMessage('room.characterFailed'));
    } finally {
      setSelecting(false);
    }
  };
  return (
    <>
      <nav className="room-nav" aria-label={t('room.nav')}>
        <span>
          {t('room.nav')} <code>{credentials.roomId}</code>
        </span>
        <button className="secondary" onClick={leave}>
          {t('room.leave')}
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
          <p className="eyebrow">{t('room.gather')}</p>
          <h1>{t('room.title')}</h1>
          <p role="status">{t(`status.${state.status}`)}</p>
          {(state.error || notice) && (
            <p role="alert" className="notice">
              {message((notice ?? state.error)!)}
            </p>
          )}
          <section className="invite-panel">
            <h2>{t('room.inviteTitle')}</h2>
            <label>
              {t('room.inviteLink')}
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
              {t('room.copy')}
            </button>
          </section>
          <section>
            <h2>{t('room.seats')}</h2>
            <ol className="lobby-seats">
              {view?.players.map((player) => (
                <li key={player.id}>
                  <strong>
                    {player.displayName}
                    {player.id === credentials.playerId ? t('room.you') : ''}
                  </strong>
                  <span>
                    {t('room.seat', { seat: player.seat + 1 })} ·{' '}
                    {state.presence.some(
                      (presence) =>
                        presence.playerId === player.id && presence.connected,
                    )
                      ? t('status.connected')
                      : t('status.offline')}
                    {player.id === state.hostPlayerId ? t('room.host') : ''}
                  </span>
                  <span>
                    {presentation?.characters.find(
                      (character) => character.id === player.characterId,
                    )?.name ?? t('room.loadingCharacter')}
                  </span>
                </li>
              ))}
            </ol>
          </section>
          {view && presentation && (
            <label className="character-select">
              {t('room.character')}
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
            {state.hostPlayerId === credentials.playerId &&
              (presentation?.innDrinkDecks?.length ?? 0) > 1 && (
                <label>
                  {t('room.drinkDeck')}
                  <select
                    value={drinkSetup || presentation!.innDrinkDecks![0]!.id}
                    disabled={
                      state.status !== 'synced' ||
                      state.pendingCommandId !== null
                    }
                    onChange={(event) => setDrinkSetup(event.target.value)}
                  >
                    {presentation!.innDrinkDecks!.map((deck) => (
                      <option key={deck.id} value={deck.id}>
                        {deck.name}
                      </option>
                    ))}
                    <option value="BAR">{t('room.barDeck')}</option>
                  </select>
                </label>
              )}
            {state.hostPlayerId === credentials.playerId ? (
              <button
                disabled={
                  state.status !== 'synced' ||
                  state.pendingCommandId !== null ||
                  (view?.players.length ?? 0) < 2 ||
                  selecting ||
                  presentation === null
                }
                onClick={() =>
                  send(
                    'START_MATCH',
                    (presentation?.innDrinkDecks?.length ?? 0) > 1
                      ? {
                          drinkDeckIds:
                            drinkSetup === 'BAR'
                              ? presentation!.innDrinkDecks!.map(
                                  (deck) => deck.id,
                                )
                              : [
                                  drinkSetup ||
                                    presentation!.innDrinkDecks![0]!.id,
                                ],
                        }
                      : {},
                  )
                }
              >
                {t('room.start')}
              </button>
            ) : (
              <p>{t('room.waitHost')}</p>
            )}
            <button className="secondary" onClick={reconnect}>
              {t('status.reconnect')}
            </button>
          </div>
          <p className="footnote">{t('room.footnote')}</p>
        </main>
      )}
    </>
  );
}

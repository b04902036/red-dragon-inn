import { useState } from 'react';
import type {
  PublicGameView,
  PrivatePlayerView,
  CardReference,
} from '../protocol/views';
import type { Presentation } from '../protocol/presentation';
import type { StateChangingCommand } from '../protocol/commands';
import type { RoomClientState } from './room-state';
import { phaseName } from './room-state';
import { contextualActions, cardAction } from './game-actions';
import { Modal } from './Modal';

type Send = (
  type: StateChangingCommand['type'],
  fields?: Record<string, unknown>,
) => void;
const labels: Partial<Record<StateChangingCommand['type'], string>> = {
  DISCARD: 'Discard and draw',
  SKIP_ACTION: 'Skip action',
  ORDER_DRINK: 'Order a Drink',
  TAKE_DRINK: 'Take a Drink',
  ADVANCE_PHASE: 'Continue turn',
  PASS_RESPONSE: 'Pass response',
  GAMBLING_PASS: 'Pass gambling',
  GAMBLING_LEAVE: 'Leave gambling',
};

export function PlayerPanel({
  player,
  characterName,
  own,
  active,
  connected,
}: {
  player: PublicGameView['players'][number];
  characterName: string;
  own: boolean;
  active: boolean;
  connected: boolean;
}) {
  return (
    <article
      className={`player-panel${own ? ' own-player' : ''}${active ? ' active-player' : ''}${player.eliminated ? ' eliminated' : ''}`}
      aria-label={`${player.displayName}${own ? ' (you)' : ''}`}
    >
      <div className="player-heading">
        <span className="portrait" aria-hidden="true">
          {characterName.replace('Sample ', '').slice(0, 1)}
        </span>
        <div>
          <h3>
            {player.displayName}
            {own ? ' · You' : ''}
          </h3>
          <p>{characterName}</p>
        </div>
      </div>
      <p className="seat-state">
        Seat {player.seat + 1} ·{' '}
        {player.eliminated
          ? 'Eliminated'
          : active
            ? 'Active turn'
            : connected
              ? 'Connected'
              : 'Disconnected'}
      </p>
      <dl className="stats">
        <div>
          <dt>Fortitude</dt>
          <dd>{player.fortitude}</dd>
        </div>
        <div>
          <dt>Alcohol</dt>
          <dd>{player.alcoholContent}</dd>
        </div>
        <div>
          <dt>Gold</dt>
          <dd>{player.gold}</dd>
        </div>
      </dl>
      <p className="pile-counts">
        <span aria-label={`Hand count ${player.handCount}`}>
          Hand: {player.handCount}
        </span>
        <span>Drink Me!: {player.drinkPileCount}</span>
      </p>
      {Object.entries(player.resources).map(([name, value]) => (
        <p key={name}>
          Resource {name}: {value}
        </p>
      ))}
      {Object.entries(player.sideDecks).map(([name, pile]) => (
        <p key={name}>
          Side deck {name}: {pile.deckCount} cards · {pile.discardCount}{' '}
          discarded
        </p>
      ))}
    </article>
  );
}
function ChoicePicker({
  choice,
  send,
  disabled,
}: {
  choice: NonNullable<PrivatePlayerView['pendingChoice']>;
  send: Send;
  disabled: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const type =
    choice.kind === 'TARGET'
      ? 'CHOOSE_TARGET'
      : choice.kind === 'CARD'
        ? 'CHOOSE_CARDS'
        : 'CHOOSE_OPTION';
  return (
    <Modal
      title="Choose how to resolve this effect"
      mandatory
      onClose={() => {}}
    >
      <p>
        Select{' '}
        {choice.min === choice.max ? choice.min : `${choice.min}–${choice.max}`}{' '}
        {choice.kind.toLowerCase()} choice(s).
      </p>
      <fieldset>
        <legend>Available choices</legend>
        {choice.options.map((option) => (
          <label className="choice-option" key={option.id}>
            <input
              type="checkbox"
              checked={selected.includes(option.id)}
              disabled={
                disabled ||
                (!selected.includes(option.id) && selected.length >= choice.max)
              }
              onChange={() =>
                setSelected((previous) =>
                  previous.includes(option.id)
                    ? previous.filter((id) => id !== option.id)
                    : [...previous, option.id],
                )
              }
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      <button
        disabled={
          disabled ||
          selected.length < choice.min ||
          selected.length > choice.max
        }
        onClick={() =>
          send(type, {
            responseWindowId: choice.responseWindowId,
            ...(type === 'CHOOSE_TARGET'
              ? { targetPlayerIds: selected }
              : type === 'CHOOSE_CARDS'
                ? { cardIds: selected }
                : { optionId: selected[0] }),
          })
        }
      >
        Confirm choice
      </button>
    </Modal>
  );
}

export function GameTable({
  state,
  presentation,
  playerId,
  send,
  reconnect,
}: {
  state: RoomClientState;
  presentation: Presentation;
  playerId: string;
  send: Send;
  reconnect: () => void;
}) {
  const view = state.publicView!;
  const own = view.players.find((player) => player.id === playerId)!;
  const [selected, setSelected] = useState<string[]>([]);
  const [inspect, setInspect] = useState<Presentation['cards'][number] | null>(
    null,
  );
  const [target, setTarget] = useState<{
    type: 'ORDER_DRINK' | 'PLAY_CARD' | 'PLAY_RESPONSE' | 'GAMBLING_PLAY';
    cardId?: string;
  } | null>(null);
  const busy =
    state.status !== 'synced' ||
    state.pendingCommandId !== null ||
    state.privateView === null;
  const cards = new Map(presentation.cards.map((card) => [card.id, card]));
  const character = (id: string | null) =>
    presentation.characters.find((character) => character.id === id)?.name ??
    'Sample adventurer';
  const actions = contextualActions(view, playerId);
  const hand = state.privateView?.hand ?? [];
  const perform = (type: StateChangingCommand['type']) => {
    if (type === 'ORDER_DRINK') {
      setTarget({ type });
      return;
    }
    if (type === 'DISCARD') {
      send(type, {
        cardIds: selected.filter((id) => hand.some((card) => card.id === id)),
      });
      setSelected([]);
      return;
    }
    send(
      type,
      type === 'PASS_RESPONSE'
        ? { responseWindowId: view.responseWindow!.id }
        : {},
    );
  };
  const play = (
    reference: CardReference,
    definition: Presentation['cards'][number],
  ) => {
    const type = cardAction(view, playerId, definition, presentation.cards);
    if (type === null) return;
    if (definition.requiresTarget) {
      setTarget({ type, cardId: reference.id });
      return;
    }
    send(type, {
      cardId: reference.id,
      ...(type === 'PLAY_RESPONSE'
        ? { responseWindowId: view.responseWindow!.id }
        : {}),
    });
  };
  const waiting =
    view.responseWindow?.choicePlayerId ??
    view.responseWindow?.priorityPlayerId ??
    view.gambling?.priorityPlayerId ??
    view.activePlayerId;
  const waitingName = view.players.find(
    (player) => player.id === waiting,
  )?.displayName;
  return (
    <main className="game-page">
      <header className="table-header">
        <div>
          <p className="eyebrow">Red Dragon Inn · Sample table</p>
          <h1>
            {view.lifecycle === 'FINISHED'
              ? 'The night is over'
              : 'An evening at the inn'}
          </h1>
        </div>
        <div className="connection">
          <p role="status">
            {state.status === 'synced'
              ? 'Synced'
              : state.status === 'resyncing'
                ? 'Refreshing table…'
                : state.status === 'connecting'
                  ? 'Connecting…'
                  : state.status === 'reconnecting'
                    ? 'Reconnecting…'
                    : 'Disconnected'}
          </p>
          {state.status !== 'synced' && (
            <button onClick={reconnect}>Reconnect</button>
          )}
        </div>
      </header>
      {state.error && (
        <p role="alert" className="notice">
          {state.error}
        </p>
      )}
      {view.lifecycle === 'FINISHED' && (
        <section className="winner-banner">
          <h2>
            {view.winners.length === 0
              ? 'The match is a tie'
              : `${view.players.find((player) => view.winners.includes(player.id))!.displayName} wins!`}
          </h2>
          <p>Thanks for sharing the table.</p>
        </section>
      )}
      <div className="table-layout">
        <section className="play-space" aria-label="Game table">
          <div className="opponents" aria-label="Other players">
            {view.players
              .filter((player) => player.id !== playerId)
              .map((player) => (
                <PlayerPanel
                  key={player.id}
                  player={player}
                  characterName={character(player.characterId)}
                  own={false}
                  active={player.id === view.activePlayerId}
                  connected={state.presence.some(
                    (presence) =>
                      presence.playerId === player.id && presence.connected,
                  )}
                />
              ))}
          </div>
          <section className="inn-center" aria-label="The Inn">
            <div className="inn-piles">
              <div className="deck-back">
                <span>Inn Drink deck</span>
                <strong>{view.innDrinkDeckCount}</strong>
                <small>Face down</small>
              </div>
              <div className="discard-pile">
                <span>Drink discard</span>
                <strong>{view.innDrinkDiscardCount}</strong>
                <small>Resolved Drinks</small>
              </div>
              <div className="pot">
                <span>Gambling pot</span>
                <strong>{view.gambling?.pot ?? 0}</strong>
                <small>Gold</small>
              </div>
            </div>
            <h2>
              {view.resolutionStack.length > 0
                ? 'Resolving at the table'
                : 'The table is clear'}
            </h2>
            <ol className="stack">
              {view.resolutionStack.map((frame) => (
                <li key={frame.id}>
                  {(
                    frame.sourceCards ??
                    (frame.sourceCard ? [frame.sourceCard] : [])
                  )
                    .map(
                      (source) =>
                        cards.get(source.definitionId)?.name ?? 'Revealed card',
                    )
                    .join(' → ') || 'Empty Drink pile'}
                  <span>
                    {frame.kind === 'DRINK_EVENT'
                      ? 'Drink Event'
                      : frame.kind === 'DRINK'
                        ? 'Drink chain'
                        : 'Card'}{' '}
                    · awaiting resolution
                  </span>
                </li>
              ))}
            </ol>
          </section>
          <PlayerPanel
            player={{
              ...own,
              resources: { ...own.resources, ...state.privateView?.resources },
              sideDecks: { ...own.sideDecks, ...state.privateView?.sideDecks },
            }}
            characterName={character(own.characterId)}
            own
            active={own.id === view.activePlayerId}
            connected={state.status === 'synced'}
          />
        </section>
        <aside className="table-rail">
          <section className="turn-panel">
            <p className="eyebrow">Current phase</p>
            <h2>{phaseName(view.phase)}</h2>
            <p>
              Active player:{' '}
              <strong>
                {view.players.find(
                  (player) => player.id === view.activePlayerId,
                )?.displayName ?? 'None'}
              </strong>
            </p>
            {view.responseWindow && (
              <div className="response-panel">
                <h3>Response window</h3>
                <p>
                  {view.responseWindow.choicePlayerId
                    ? 'An effect needs a choice.'
                    : waiting === playerId
                      ? 'Your response priority. Play a response or pass.'
                      : `Waiting for ${waitingName}'s response.`}
                </p>
                <p>
                  {view.responseWindow.passedPlayerIds.length} /{' '}
                  {view.responseWindow.eligiblePlayerIds.length} players passed
                </p>
              </div>
            )}
            {view.gambling && (
              <div className="gambling-panel">
                <h3>Gambling round</h3>
                <p>
                  Controller:{' '}
                  {
                    view.players.find(
                      (player) => player.id === view.gambling!.controlPlayerId,
                    )!.displayName
                  }
                </p>
                <p>
                  {waiting === playerId
                    ? 'Your gambling priority.'
                    : 'Waiting for ' + waitingName + '.'}
                </p>
                <p>Pot: {view.gambling.pot} Gold</p>
              </div>
            )}
            {!view.responseWindow &&
              !view.gambling &&
              view.lifecycle === 'PLAYING' &&
              waiting !== playerId && <p>Waiting for {waitingName}'s turn.</p>}
          </section>
          <section className="event-log" aria-label="Table log">
            <h2>At the table</h2>
            <ol>
              {state.log.map((line, index) => (
                <li key={`${index}_${line}`}>{line}</li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
      <footer className="hand-dock">
        <div className="action-bar">
          <p>
            {own.eliminated
              ? 'You are eliminated. Watch the rest of the match.'
              : busy
                ? 'Waiting for the table…'
                : actions.length === 0
                  ? 'Cards marked playable can be used now.'
                  : 'Choose your next move.'}
          </p>
          <div>
            {actions.map((type) => (
              <button key={type} disabled={busy} onClick={() => perform(type)}>
                {labels[type]}
              </button>
            ))}
          </div>
        </div>
        <section aria-label="Your hand">
          <div className="hand-heading">
            <h2>
              Your hand <span>({hand.length})</span>
            </h2>
            <p>
              {view.phase === 'DISCARD_DRAW' && view.activePlayerId === playerId
                ? 'Select cards to discard, then draw. Zero discards is allowed.'
                : 'Tap a card to read it.'}
            </p>
          </div>
          <div className="hand-row">
            {hand.map((reference) => {
              const definition = cards.get(reference.definitionId);
              if (!definition) return null;
              const playable = cardAction(
                view,
                playerId,
                definition,
                presentation.cards,
              );
              return (
                <article
                  className={`hand-card${selected.includes(reference.id) ? ' selected-card' : ''}`}
                  key={reference.id}
                  data-card-id={reference.id}
                >
                  <p className="card-kind">
                    {definition.type.replace('_', ' ')}
                  </p>
                  <h3>{definition.name}</h3>
                  <button
                    className="card-read"
                    onClick={() => setInspect(definition)}
                  >
                    Read {definition.name}
                  </button>
                  {actions.includes('DISCARD') && (
                    <label>
                      <input
                        type="checkbox"
                        checked={selected.includes(reference.id)}
                        disabled={busy}
                        onChange={() =>
                          setSelected((previous) =>
                            previous.includes(reference.id)
                              ? previous.filter((id) => id !== reference.id)
                              : [...previous, reference.id],
                          )
                        }
                      />
                      Discard {definition.name}
                    </label>
                  )}
                  {playable && (
                    <button
                      disabled={busy}
                      onClick={() => play(reference, definition)}
                    >
                      {playable === 'PLAY_RESPONSE'
                        ? 'Respond with '
                        : playable === 'GAMBLING_PLAY'
                          ? 'Control with '
                          : 'Play '}
                      {definition.name}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </footer>
      {inspect && (
        <Modal title={inspect.name} onClose={() => setInspect(null)}>
          <p className="card-kind">{inspect.type.replace('_', ' ')}</p>
          <p>{inspect.rulesText}</p>
        </Modal>
      )}
      {target && (
        <Modal
          title={
            target.type === 'ORDER_DRINK'
              ? 'Who gets a Drink?'
              : 'Choose a target'
          }
          onClose={() => setTarget(null)}
        >
          <div className="target-options">
            {view.players
              .filter((player) => !player.eliminated && player.id !== playerId)
              .map((player) => (
                <button
                  key={player.id}
                  disabled={busy}
                  onClick={() => {
                    send(target.type, {
                      targetPlayerId: player.id,
                      ...(target.cardId ? { cardId: target.cardId } : {}),
                      ...(target.type === 'PLAY_RESPONSE'
                        ? { responseWindowId: view.responseWindow!.id }
                        : {}),
                    });
                    setTarget(null);
                  }}
                >
                  {player.displayName}
                </button>
              ))}
          </div>
        </Modal>
      )}
      {state.privateView?.pendingChoice && (
        <ChoicePicker
          key={state.privateView.pendingChoice.responseWindowId}
          choice={state.privateView.pendingChoice}
          send={send}
          disabled={busy}
        />
      )}
    </main>
  );
}

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
import { contextualActions, currentLegalPlays } from './game-actions';
import { Modal } from './Modal';
import { useLocale } from './i18n/context';
import type { MessageKey } from '../shared/ui-messages';
import { useAttentionChime } from './audio/use-attention-chime';
import { useResponseVoice } from './audio/use-response-voice';
import { PromptCountdown } from './PromptCountdown';
import { DevCardPicker } from './DevCardPicker';
import { HandCard } from './cards/HandCard';
import { CardPreview } from './cards/CardPreview';
import { useCardSelection } from './cards/useCardSelection';
import { useCardPreview } from './cards/useCardPreview';

type Send = (
  type: StateChangingCommand['type'],
  fields?: Record<string, unknown>,
) => void;
const labels: Partial<Record<StateChangingCommand['type'], MessageKey>> = {
  DISCARD: 'action.DISCARD',
  SKIP_ACTION: 'action.SKIP_ACTION',
  ORDER_DRINK: 'action.ORDER_DRINK',
  TAKE_DRINK: 'action.TAKE_DRINK',
  ADVANCE_PHASE: 'action.ADVANCE_PHASE',
  PASS_RESPONSE: 'action.PASS_RESPONSE',
  PASS_ANYTIME: 'action.PASS_ANYTIME',
  GAMBLING_PASS: 'action.GAMBLING_PASS',
  GAMBLING_LEAVE: 'action.GAMBLING_LEAVE',
};

export function PlayerPanel({
  player,
  characterName,
  own,
  active,
  connected,
  mechanicName = (name) => name,
}: {
  player: PublicGameView['players'][number];
  characterName: string;
  own: boolean;
  active: boolean;
  connected: boolean;
  mechanicName?: (name: string) => string;
}) {
  const { t } = useLocale();
  return (
    <article
      className={`player-panel${own ? ' own-player' : ''}${active ? ' active-player' : ''}${player.eliminated ? ' eliminated' : ''}`}
      aria-label={
        own
          ? t('room.youAria', { name: player.displayName })
          : player.displayName
      }
    >
      <div className="player-heading">
        <span className="portrait" aria-hidden="true">
          {characterName.slice(0, 1)}
        </span>
        <div>
          <h3>
            {player.displayName}
            {own ? t('room.you') : ''}
          </h3>
          <p>{characterName}</p>
        </div>
      </div>
      <p className="seat-state">
        {t('room.seat', { seat: player.seat + 1 })} ·{' '}
        {player.eliminated
          ? t('player.eliminated')
          : active
            ? t('player.active')
            : connected
              ? t('status.connected')
              : t('status.offline')}
      </p>
      <dl className="stats">
        <div>
          <dt>{t('player.fortitude')}</dt>
          <dd>{player.fortitude}</dd>
        </div>
        <div>
          <dt>{t('player.alcohol')}</dt>
          <dd>{player.alcoholContent}</dd>
        </div>
        <div>
          <dt>{t('player.gold')}</dt>
          <dd>{player.gold}</dd>
        </div>
      </dl>
      <p className="pile-counts">
        <span aria-label={t('player.handCount', { count: player.handCount })}>
          {t('player.hand', { count: player.handCount })}
        </span>
        <span>{t('player.drinkPile', { count: player.drinkPileCount })}</span>
      </p>
      {Object.entries(player.resources).map(([name, value]) => (
        <p key={name}>
          {t('player.resource', { name: mechanicName(name), value })}
        </p>
      ))}
      {Object.entries(player.sideDecks).map(([name, pile]) => (
        <p key={name}>
          {t('player.sideDeck', {
            name: mechanicName(name),
            deck: pile.deckCount,
            discard: pile.discardCount,
          })}
        </p>
      ))}
    </article>
  );
}
function ChoicePicker({
  choice,
  send,
  disabled,
  optionLabel,
  definitionFor,
}: {
  choice: NonNullable<PrivatePlayerView['pendingChoice']>;
  send: Send;
  disabled: boolean;
  optionLabel: (
    option: NonNullable<PrivatePlayerView['pendingChoice']>['options'][number],
  ) => string;
  definitionFor: (id: string) => Presentation['cards'][number] | undefined;
}) {
  const { t } = useLocale();
  const selection = useCardSelection(
    choice.options.map((option) => option.id),
    choice.max,
  );
  const { selected } = selection;
  const preview = useCardPreview();
  const type =
    choice.kind === 'TARGET'
      ? 'CHOOSE_TARGET'
      : choice.kind === 'CARD'
        ? 'CHOOSE_CARDS'
        : 'CHOOSE_OPTION';
  return (
    <Modal title={t('choice.title')} mandatory onClose={() => {}}>
      <p>
        {t('choice.count', {
          count:
            choice.min === choice.max
              ? choice.min
              : `${choice.min}–${choice.max}`,
          kind: t(`choice.${choice.kind}`),
        })}
      </p>
      <fieldset>
        <legend>{t('choice.available')}</legend>
        {choice.options.map((option) => {
          const card =
            choice.kind === 'CARD' ? definitionFor(option.id) : undefined;
          if (card)
            return (
              <HandCard
                key={option.id}
                id={option.id}
                definition={card}
                selectable
                selected={selected.includes(option.id)}
                disabled={
                  disabled ||
                  (!selected.includes(option.id) &&
                    selected.length >= choice.max)
                }
                onToggle={selection.toggle}
                onPreview={preview.show}
                onLeave={preview.hide}
                onInspect={preview.pin}
                onClosePreview={preview.close}
              />
            );
          return (
            <label className="choice-option" key={option.id}>
              <input
                type="checkbox"
                checked={selected.includes(option.id)}
                disabled={
                  disabled ||
                  (!selected.includes(option.id) &&
                    selected.length >= choice.max)
                }
                onChange={() => selection.toggle(option.id)}
              />
              {optionLabel(option)}
            </label>
          );
        })}
      </fieldset>
      <CardPreview
        card={choice.options
          .map((option) => definitionFor(option.id))
          .find((card) => card?.id === preview.id)}
        onClose={preview.close}
        onEngage={() => preview.pin(preview.id!)}
        embedded
      />
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
        {t('choice.confirm')}
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
  const { locale, t, message } = useLocale();
  const view = state.publicView!;
  useAttentionChime(view, playerId);
  useResponseVoice(state.privateView, playerId);
  const own = view.players.find((player) => player.id === playerId)!;
  const selection = useCardSelection(
    state.privateView?.hand.map((card) => card.id) ?? [],
  );
  const { selected } = selection;
  const preview = useCardPreview();
  const [target, setTarget] = useState<{
    type: 'ORDER_DRINK' | 'PLAY_CARD' | 'PLAY_RESPONSE' | 'GAMBLING_PLAY';
    cardId?: string;
    version: number;
  } | null>(null);
  const busy =
    state.status !== 'synced' ||
    state.pendingCommandId !== null ||
    state.privateView === null ||
    state.privateView.legalPlayVersion !== view.version;
  const cards = new Map<string, Presentation['cards'][number]>(
    presentation.cards.map((card) => [card.id, card]),
  );
  const character = (id: string | null) =>
    presentation.characters.find((character) => character.id === id)?.name ??
    t('player.adventurer');
  const mechanicName = (key: string) =>
    presentation.mechanics?.find((mechanic) => mechanic.id === key)?.name ??
    key;
  const optionLabel = (
    option: NonNullable<PrivatePlayerView['pendingChoice']>['options'][number],
  ) => {
    if (state.privateView?.pendingChoice?.kind === 'CARD') {
      const reference = hand.find((card) => card.id === option.id);
      if (reference)
        return cards.get(reference.definitionId)?.name ?? option.label;
    }
    if (state.privateView?.pendingChoice?.kind === 'OPTION') {
      const source = view.resolutionStack.at(-1)?.sourceCard?.definitionId;
      return (
        presentation.choiceOptions?.find(
          (item) =>
            item.cardDefinitionId === source && item.optionId === option.id,
        )?.label ?? option.label
      );
    }
    return option.label;
  };
  const actions = contextualActions(view, playerId);
  const hand = state.privateView?.hand ?? [];
  const legalPlays = busy
    ? []
    : currentLegalPlays(view, state.privateView, playerId);
  const legalFor = (cardId: string) =>
    legalPlays.find((play) => play.cardId === cardId);
  const playFields = (legal: PrivatePlayerView['legalPlays'][number]) => ({
    cardId: legal.cardId,
    ...(legal.promptId === undefined ? {} : { promptId: legal.promptId }),
    ...(legal.commandType === 'PLAY_RESPONSE'
      ? { responseWindowId: view.responseWindow!.id }
      : {}),
  });
  const perform = (type: StateChangingCommand['type']) => {
    if (type === 'ORDER_DRINK') {
      setTarget({ type, version: view.version });
      return;
    }
    if (type === 'DISCARD') {
      send(type, {
        cardIds: selected.filter((id) => hand.some((card) => card.id === id)),
      });
      selection.clear();
      return;
    }
    send(
      type,
      type === 'PASS_RESPONSE'
        ? {
            responseWindowId: view.responseWindow!.id,
            ...(view.timedPrompt
              ? { promptId: view.timedPrompt.promptId }
              : {}),
          }
        : type === 'PASS_ANYTIME'
          ? {
              responseWindowId: view.phaseEnd!.id,
              promptId: view.timedPrompt!.promptId,
            }
          : {},
    );
  };
  const play = (reference: CardReference) => {
    const legal = legalFor(reference.id);
    if (legal === undefined) return;
    if (legal.requiresTarget) {
      setTarget({
        type: legal.commandType,
        cardId: reference.id,
        version: view.version,
      });
      return;
    }
    send(legal.commandType, playFields(legal));
  };
  const waiting =
    view.responseWindow?.choicePlayerId ??
    view.responseWindow?.priorityPlayerId ??
    view.gambling?.priorityPlayerId ??
    view.phaseEnd?.priorityPlayerId ??
    view.activePlayerId;
  const waitingName = view.players.find(
    (player) => player.id === waiting,
  )?.displayName;
  return (
    <main className="game-page">
      <PromptCountdown prompt={view.timedPrompt} />
      <header className="table-header">
        <div>
          <p className="eyebrow">{t('app.title')}</p>
          <h1>
            {view.lifecycle === 'FINISHED'
              ? t('table.over')
              : t('table.evening')}
          </h1>
        </div>
        <div className="connection">
          <p role="status">{t(`status.${state.status}`)}</p>
          {state.status !== 'synced' && (
            <button onClick={reconnect}>{t('status.reconnect')}</button>
          )}
        </div>
      </header>
      {state.error && (
        <p role="alert" className="notice">
          {message(state.error)}
        </p>
      )}
      {view.lifecycle === 'FINISHED' && (
        <section className="winner-banner">
          <h2>
            {view.winners.length === 0
              ? t('table.tie')
              : t('table.winner', {
                  name: view.players.find((player) =>
                    view.winners.includes(player.id),
                  )!.displayName,
                })}
          </h2>
          <p>{t('table.thanks')}</p>
        </section>
      )}
      <div className="table-layout">
        <section className="play-space" aria-label={t('table.label')}>
          <div className="opponents" aria-label={t('table.opponents')}>
            {view.players
              .filter((player) => player.id !== playerId)
              .map((player) => (
                <PlayerPanel
                  key={player.id}
                  player={player}
                  characterName={character(player.characterId)}
                  mechanicName={mechanicName}
                  own={false}
                  active={player.id === view.activePlayerId}
                  connected={state.presence.some(
                    (presence) =>
                      presence.playerId === player.id && presence.connected,
                  )}
                />
              ))}
          </div>
          <section className="inn-center" aria-label={t('table.inn')}>
            <div className="inn-piles">
              <div className="deck-back">
                <span>{t('table.deck')}</span>
                <strong>{view.innDrinkDeckCount}</strong>
                <small>{t('table.faceDown')}</small>
              </div>
              <div className="discard-pile">
                <span>{t('table.discard')}</span>
                <strong>{view.innDrinkDiscardCount}</strong>
                <small>{t('table.resolvedDrinks')}</small>
              </div>
              <div className="pot">
                <span>{t('table.pot')}</span>
                <strong>{view.gambling?.pot ?? 0}</strong>
                <small>{t('player.gold')}</small>
              </div>
            </div>
            <h2>
              {view.resolutionStack.length > 0
                ? t('table.resolving')
                : t('table.clear')}
            </h2>
            <ol className="stack">
              {view.resolutionStack.map((frame) => (
                <li key={frame.id}>
                  {frame.opportunity
                    ? t(`table.opportunity.${frame.opportunity}`)
                    : (
                        frame.sourceCards ??
                        (frame.sourceCard ? [frame.sourceCard] : [])
                      )
                        .map(
                          (source) =>
                            cards.get(source.definitionId)?.name ??
                            t('table.revealed'),
                        )
                        .join(' → ') || t('table.emptyDrink')}
                  {frame.revealedDrinks?.map((drink, index) => (
                    <span key={index}>
                      {
                        view.players.find(
                          (player) => player.id === drink.playerId,
                        )?.displayName
                      }
                      :{' '}
                      {drink.cards
                        .map(
                          (card) =>
                            cards.get(card.definitionId)?.name ??
                            t('table.revealed'),
                        )
                        .join(' → ')}
                    </span>
                  ))}
                  <span>
                    {t('table.awaiting', {
                      kind:
                        frame.kind === 'DRINK_EVENT'
                          ? t('term.drinkEvent')
                          : frame.kind === 'DRINK'
                            ? t('table.drinkChain')
                            : t('table.card'),
                    })}
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
            mechanicName={mechanicName}
            own
            active={own.id === view.activePlayerId}
            connected={state.status === 'synced'}
          />
        </section>
        <aside className="table-rail">
          <section className="turn-panel">
            <p className="eyebrow">{t('table.phase')}</p>
            <h2>{phaseName(view.phase, locale)}</h2>
            <p>
              {t('table.active', {
                name:
                  view.players.find(
                    (player) => player.id === view.activePlayerId,
                  )?.displayName ?? t('table.none'),
              })}
            </p>
            {view.responseWindow && (
              <div className="response-panel">
                <h3>{t('table.response')}</h3>
                <p>
                  {view.responseWindow.choicePlayerId
                    ? t('table.choiceNeeded')
                    : waiting === playerId
                      ? t('table.yourResponse')
                      : t('table.waitResponse', {
                          name: waitingName ?? t('table.none'),
                        })}
                </p>
                <p>
                  {t('table.passed', {
                    passed: view.responseWindow.passedPlayerIds.length,
                    eligible: view.responseWindow.eligiblePlayerIds.length,
                  })}
                </p>
              </div>
            )}
            {view.gambling && (
              <div className="gambling-panel">
                <h3>{t('table.gambling')}</h3>
                <p>
                  {t('table.controller', {
                    name: view.players.find(
                      (player) => player.id === view.gambling!.controlPlayerId,
                    )!.displayName,
                  })}
                </p>
                <p>
                  {waiting === playerId
                    ? t('table.yourGambling')
                    : t('table.waitGambling', {
                        name: waitingName ?? t('table.none'),
                      })}
                </p>
                <p>{t('table.potValue', { gold: view.gambling.pot })}</p>
              </div>
            )}
            {!view.responseWindow &&
              !view.gambling &&
              view.lifecycle === 'PLAYING' &&
              waiting !== playerId && (
                <p>
                  {t('table.waitTurn', {
                    name: waitingName ?? t('table.none'),
                  })}
                </p>
              )}
          </section>
          <section className="event-log" aria-label={t('table.logAria')}>
            <h2>{t('table.logTitle')}</h2>
            <ol>
              {state.log.map((line, index) => (
                <li key={`${index}_${line.key}`}>{message(line)}</li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
      {state.privateView?.devChoices &&
        (actions.includes('DISCARD') || actions.includes('ORDER_DRINK')) && (
          <DevCardPicker
            key={`${view.version}:${selected.join(',')}`}
            choices={state.privateView.devChoices}
            hand={hand}
            discards={selected.filter((id) =>
              hand.some((card) => card.id === id),
            )}
            players={view.players}
            playerId={playerId}
            phase={actions.includes('DISCARD') ? 'DISCARD_DRAW' : 'ORDER_DRINK'}
            busy={busy}
            presentation={presentation}
            send={(type, fields) => {
              send(type, fields);
              selection.clear();
            }}
          />
        )}
      <footer className="hand-dock">
        <div className="action-bar">
          <p>
            {own.eliminated
              ? t('table.eliminatedHelp')
              : busy
                ? t('table.waiting')
                : actions.length === 0
                  ? t('table.playableHelp')
                  : t('table.nextMove')}
          </p>
          <div>
            {actions.map((type) => (
              <button key={type} disabled={busy} onClick={() => perform(type)}>
                {t(labels[type]!)}
              </button>
            ))}
          </div>
        </div>
        <section aria-label={t('table.yourHand')}>
          <div className="hand-heading">
            <h2>
              {t('table.yourHand')} <span>({hand.length})</span>
            </h2>
            <p>
              {view.phase === 'DISCARD_DRAW' && view.activePlayerId === playerId
                ? t('table.discardHelp')
                : t('table.inspectHelp')}
            </p>
          </div>
          <div className="hand-row">
            {hand.map((reference) => {
              const definition = cards.get(reference.definitionId);
              if (!definition) return null;
              const playable = legalFor(reference.id)?.commandType;
              return (
                <HandCard
                  key={reference.id}
                  id={reference.id}
                  definition={definition}
                  selectable={actions.includes('DISCARD')}
                  selected={selected.includes(reference.id)}
                  disabled={busy}
                  playable={playable !== undefined}
                  onToggle={selection.toggle}
                  onPreview={preview.show}
                  onLeave={preview.hide}
                  onInspect={preview.pin}
                  onClosePreview={preview.close}
                >
                  {playable && (
                    <button disabled={busy} onClick={() => play(reference)}>
                      {t(
                        playable === 'PLAY_RESPONSE'
                          ? 'card.respond'
                          : playable === 'GAMBLING_PLAY'
                            ? 'card.control'
                            : 'card.play',
                        { name: definition.name },
                      )}
                    </button>
                  )}
                </HandCard>
              );
            })}
          </div>
        </section>
      </footer>
      <CardPreview
        card={cards.get(preview.id ?? '')}
        onClose={preview.close}
        onEngage={() => preview.pin(preview.id!)}
      />
      {target &&
        !busy &&
        target.version === view.version &&
        (target.type === 'ORDER_DRINK'
          ? actions.includes('ORDER_DRINK')
          : legalFor(target.cardId!)?.commandType === target.type) && (
          <Modal
            title={
              target.type === 'ORDER_DRINK'
                ? t('target.drink')
                : t('target.title')
            }
            onClose={() => setTarget(null)}
          >
            <div className="target-options">
              {view.players
                .filter((player) =>
                  target.type === 'ORDER_DRINK'
                    ? !player.eliminated && player.id !== playerId
                    : legalFor(target.cardId!)!.legalTargetPlayerIds.includes(
                        player.id,
                      ),
                )
                .map((player) => (
                  <button
                    key={player.id}
                    disabled={busy}
                    onClick={() => {
                      if (target.type === 'ORDER_DRINK')
                        send(target.type, { targetPlayerId: player.id });
                      else {
                        const legal = legalFor(target.cardId!);
                        if (legal?.legalTargetPlayerIds.includes(player.id))
                          send(legal.commandType, {
                            ...playFields(legal),
                            targetPlayerId: player.id,
                          });
                      }
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
          key={
            view.attention?.key ??
            state.privateView.pendingChoice.responseWindowId
          }
          choice={state.privateView.pendingChoice}
          send={send}
          disabled={busy}
          optionLabel={optionLabel}
          definitionFor={(id) => {
            const reference = hand.find((card) => card.id === id);
            return reference ? cards.get(reference.definitionId) : undefined;
          }}
        />
      )}
    </main>
  );
}

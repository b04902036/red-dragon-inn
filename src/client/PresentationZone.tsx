import { useLayoutEffect, useRef } from 'react';
import type { PublicNarrationEvent } from '../protocol/public-narration';
import type { Presentation } from '../protocol/presentation';
import type { PublicGameView } from '../protocol/views';
import type { PresentationSnapshot } from './PresentationDirector';
import { timelineText } from './timeline-text';
import { useLocale } from './i18n/context';

type SourceEvent = Extract<
  PublicNarrationEvent,
  { type: 'CARD_PLAYED' | 'DRINK_REVEALED' }
>;
export function PresentationZone({
  snapshot,
  history,
  view,
  presentation,
  skip,
  toggleFast,
}: {
  snapshot: PresentationSnapshot;
  history: readonly PublicNarrationEvent[];
  view: PublicGameView;
  presentation: Presentation;
  skip: () => void;
  toggleFast: () => void;
}) {
  const { t, locale } = useLocale();
  const current = snapshot.event;
  const zone = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (current?.type !== 'CARD_PLAYED' || !zone.current) return;
    const source = Array.from(
      document.querySelectorAll<HTMLElement>('[data-player-id]'),
    ).find((element) => element.dataset.playerId === current.playerId);
    if (!source) return;
    const from = source.getBoundingClientRect();
    const to = zone.current.getBoundingClientRect();
    zone.current.style.setProperty(
      '--source-x',
      `${from.left + from.width / 2 - to.left - to.width / 2}px`,
    );
    zone.current.style.setProperty(
      '--source-y',
      `${from.top + from.height / 2 - to.top - to.height / 2}px`,
    );
  }, [current]);
  const visible = current
    ? history.filter((event) => event.sequence <= current.sequence)
    : [];
  const sources = visible.filter(
    (event): event is SourceEvent =>
      event.type === 'CARD_PLAYED' || event.type === 'DRINK_REVEALED',
  );
  const resolutionId =
    current && 'resolutionId' in current
      ? current.resolutionId
      : current?.type === 'RELATION_RESOLVED'
        ? current.targetResolutionId
        : null;
  const path: SourceEvent[] = [];
  const seen = new Set<string>();
  let id: string | null = resolutionId;
  while (id && !seen.has(id)) {
    seen.add(id);
    const source = sources.find((event) => event.resolutionId === id);
    if (!source) break;
    path.unshift(source);
    id = source.parentId;
  }
  const cardName = (event: SourceEvent) =>
    presentation.cards.find((card) => card.id === event.cardDefinitionId)
      ?.name ?? event.cardDefinitionId;
  const renderPath = (index: number): React.ReactNode => {
    const source = path[index];
    if (!source) return null;
    const completed = visible.find(
      (event) =>
        event.type === 'RESOLUTION_COMPLETED' &&
        event.resolutionId === source.resolutionId,
    );
    const canceled =
      completed?.type === 'RESOLUTION_COMPLETED' && completed.canceled;
    return (
      <ol className="presentation-chain">
        <li
          data-resolution-id={source.resolutionId}
          data-canceled={canceled ? 'true' : undefined}
        >
          {source.type === 'CARD_PLAYED' && source.responseRelation && (
            <span className="causal-connector">
              ↳ {t(`timeline.${source.responseRelation}`)}
            </span>
          )}
          <strong>{cardName(source)}</strong>
          <small>
            {
              view.players.find((player) => player.id === source.playerId)
                ?.displayName
            }
            {source.type === 'CARD_PLAYED' && source.targetPlayerIds.length > 0
              ? t('timeline.target', {
                  names: source.targetPlayerIds
                    .map(
                      (id) =>
                        view.players.find((player) => player.id === id)
                          ?.displayName ?? id,
                    )
                    .join(', '),
                })
              : ''}
          </small>
          {completed && (
            <span className="resolution-status">
              {t(canceled ? 'timeline.negated' : 'timeline.resolved')}
            </span>
          )}
          {renderPath(index + 1)}
        </li>
      </ol>
    );
  };
  return (
    <section
      ref={zone}
      className={`presentation-zone${snapshot.reducedMotion ? ' reduced-motion' : ''}`}
      aria-label={t('timeline.center')}
      data-presentation-active={current ? 'true' : 'false'}
      data-event-id={current?.id}
      data-queued={snapshot.queued}
    >
      <div className="presentation-controls">
        <button onClick={skip} disabled={!current}>
          {t('timeline.skip')}
        </button>
        <button onClick={toggleFast} aria-pressed={snapshot.fast}>
          {t(snapshot.fast ? 'timeline.speed' : 'timeline.fast')}
        </button>
        {snapshot.reducedMotion && <span>{t('timeline.motion')}</span>}
      </div>
      {current ? (
        <div
          key={current.id}
          className={`presentation-beat presentation-${current.type.toLowerCase()}`}
        >
          {renderPath(0)}
          {current.type === 'DRINK_REVEALED' && (
            <div className="drink-presentation-chain">
              {sources
                .filter(
                  (source) =>
                    source.type === 'DRINK_REVEALED' &&
                    source.resolutionId === current.resolutionId,
                )
                .map((source) => (
                  <span key={source.id}>
                    {cardName(source)} ·{' '}
                    {source.type === 'DRINK_REVEALED'
                      ? t(`timeline.${source.chainRole}`)
                      : ''}
                  </span>
                ))}
            </div>
          )}
          {['CHARACTER_CARDS_DRAWN', 'DRINK_ORDERED', 'DRINK_DEALT'].includes(
            current.type,
          ) && (
            <div className="presentation-card-backs" aria-hidden="true">
              <span className="deck-back">
                {'count' in current ? current.count : ''}
              </span>
            </div>
          )}
          <p aria-live="polite" aria-atomic="true">
            {timelineText(current, history, view, presentation, locale)}
          </p>
        </div>
      ) : (
        <p>{t('timeline.empty')}</p>
      )}
    </section>
  );
}

import { useEffect, useRef, useState } from 'react';
import type { RoomClientState } from './room-state';
import type { Presentation } from '../protocol/presentation';
import { useLocale } from './i18n/context';
import { timelineDepth, timelineText } from './timeline-text';

export function PublicTimelineLog({
  state,
  presentation,
}: {
  state: RoomClientState;
  presentation: Presentation;
}) {
  const { t, locale } = useLocale();
  const scroll = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const lastLive = useRef<string | null>(null);
  const [unread, setUnread] = useState(false);
  const latestLive = state.liveEventIds.at(-1) ?? null;
  useEffect(() => {
    if (latestLive === lastLive.current) return;
    lastLive.current = latestLive;
    if (nearBottom.current && scroll.current)
      scroll.current.scrollTop = scroll.current.scrollHeight;
    else setUnread(true);
  }, [latestLive]);
  return (
    <section className="event-log">
      <h2>{t('table.logTitle')}</h2>
      {unread && (
        <button
          onClick={() => {
            if (scroll.current)
              scroll.current.scrollTop = scroll.current.scrollHeight;
            nearBottom.current = true;
            setUnread(false);
          }}
        >
          {t('timeline.new')}
        </button>
      )}
      <div
        className="timeline-scroll"
        ref={scroll}
        tabIndex={0}
        role="region"
        aria-label={t('table.logAria')}
        onScroll={(event) => {
          const el = event.currentTarget;
          nearBottom.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 64;
          if (nearBottom.current) setUnread(false);
        }}
      >
        <ol>
          {state.publicView &&
            state.log.map((event) => (
              <li
                key={event.id}
                data-sequence={event.sequence}
                data-event-type={event.type}
                style={{
                  paddingInlineStart: `${timelineDepth(event, state.log) * 12}px`,
                }}
              >
                {timelineText(
                  event,
                  state.log,
                  state.publicView!,
                  presentation,
                  locale,
                )}
              </li>
            ))}
        </ol>
      </div>
    </section>
  );
}

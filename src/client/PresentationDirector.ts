import type { PublicNarrationEvent } from '../protocol/public-narration';

export interface PresentationSnapshot {
  event: PublicNarrationEvent | null;
  queued: number;
  fast: boolean;
  reducedMotion: boolean;
}
const visual = (event: PublicNarrationEvent) =>
  ![
    'PRIORITY_PASSED',
    'RESOLUTION_STARTED',
    'PHASE_CHANGED',
    'TURN_STARTED',
    'MATCH_STARTED',
  ].includes(event.type);

/** Owns only visual pacing. It has no game state, socket, command or prompt access. */
export class PresentationDirector {
  private seen = new Set<string>();
  private queue: PublicNarrationEvent[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<() => void>();
  private matchId: string | null = null;
  private running = false;
  private snapshot: PresentationSnapshot = {
    event: null,
    queued: 0,
    fast: false,
    reducedMotion: false,
  };
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(patch: Partial<PresentationSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch, queued: this.queue.length };
    for (const listener of this.listeners) listener();
  }
  ingest(events: readonly PublicNarrationEvent[], liveIds: readonly string[]) {
    const matchId = events[0]?.matchId ?? null;
    if (matchId !== null && matchId !== this.matchId) {
      this.clearTimer();
      this.seen.clear();
      this.queue = [];
      this.matchId = matchId;
      this.publish({ event: null });
    }
    const live = new Set(liveIds);
    for (const event of events) {
      if (this.seen.has(event.id)) continue;
      this.seen.add(event.id);
      if (live.has(event.id) && visual(event)) this.queue.push(event);
    }
    if (this.snapshot.event === null && this.running) this.advance();
    else this.publish({});
  }
  start() {
    this.running = true;
    if (this.snapshot.event) this.schedule();
    else this.advance();
  }
  pause() {
    this.running = false;
    this.clearTimer();
  }
  setReducedMotion(reducedMotion: boolean) {
    if (this.snapshot.reducedMotion !== reducedMotion) {
      this.publish({ reducedMotion });
      this.schedule();
    }
  }
  toggleFast = () => {
    this.publish({ fast: !this.snapshot.fast });
    this.schedule();
  };
  skip = () => this.advance();
  private clearTimer() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
  private schedule() {
    this.clearTimer();
    if (!this.running || this.snapshot.event === null) return;
    this.timer = setTimeout(
      () => this.advance(),
      this.snapshot.fast ? 100 : this.snapshot.reducedMotion ? 250 : 850,
    );
  }
  private advance() {
    this.clearTimer();
    this.publish({ event: this.queue.shift() ?? null });
    this.schedule();
  }
}

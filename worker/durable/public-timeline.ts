import type { CoreGameState } from '../../src/engine/types';
import {
  emptyNarrationContext,
  projectPublicNarration,
} from '../../src/protocol/public-narration-projector';
import type {
  PublicNarrationEvent,
  PublicTimelineBatch,
} from '../../src/protocol/public-narration';
import { D1ReplayRepository } from '../repositories/replay';

/** Disposable projection cache. D1 replay commands remain the only history authority. */
export class PublicTimeline {
  private matchId: CoreGameState['matchId'] | null = null;
  private context = emptyNarrationContext();
  private events: PublicNarrationEvent[] = [];
  async refresh(db: D1Database, game: CoreGameState) {
    if (this.matchId !== game.matchId) {
      this.matchId = game.matchId;
      this.context = emptyNarrationContext();
      this.events = [];
    }
    const resources = new Map(
      game.players.map((player) => [
        player.id,
        new Set(
          Object.entries(player.special.resources)
            .filter(([, resource]) => resource.visibility === 'PUBLIC')
            .map(([key]) => key),
        ),
      ]),
    );
    for (const entry of await new D1ReplayRepository(db).commands(
      game.matchId,
      this.context.lastSequence,
    )) {
      const projected = projectPublicNarration(
        entry.events.map((event, index) => ({
          sequence: entry.firstSequence + index,
          event,
        })),
        this.context,
        resources,
      );
      this.context = projected.context;
      this.events.push(...projected.events);
    }
  }
  batches(
    after: number,
    mode: PublicTimelineBatch['mode'],
    through = this.context.lastSequence,
  ): PublicTimelineBatch[] {
    if (this.matchId === null || after >= through) return [];
    const events = this.events.filter(
      (event) => event.sequence > after && event.sequence <= through,
    );
    const batches: PublicTimelineBatch[] = [];
    for (let index = 0; index < events.length; index += 50) {
      const slice = events.slice(index, index + 50);
      const lastSequence =
        index + 50 >= events.length ? through : slice.at(-1)!.sequence;
      batches.push({
        type: 'PUBLIC_TIMELINE',
        matchId: this.matchId,
        firstSequence: after + 1,
        lastSequence,
        mode,
        events: slice,
      });
      after = lastSequence;
    }
    if (events.length === 0)
      batches.push({
        type: 'PUBLIC_TIMELINE',
        matchId: this.matchId,
        firstSequence: after + 1,
        lastSequence: through,
        mode,
        events: [],
      });
    return batches;
  }
}

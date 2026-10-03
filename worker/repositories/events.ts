import { z } from 'zod';
import { matchIdSchema } from '../../src/shared/ids';
import type { MatchId } from '../../src/shared/ids';
import type { EventRepository, SnapshotInput, StoredEvent } from './contracts';
import {
  parseJsonColumn,
  sequenceSchema,
  snapshotInputSchema,
  storedEventSchema,
  storedSnapshotSchema,
} from './schemas';

export class D1EventRepository implements EventRepository {
  constructor(private readonly db: D1Database) {}

  async append(id: MatchId, input: readonly StoredEvent[]): Promise<void> {
    const matchId = matchIdSchema.parse(id);
    const events = z.array(storedEventSchema).min(1).max(100).parse(input);
    if (events.some(({ event }) => event.matchId !== matchId))
      throw new RangeError('Event match mismatch');
    await this.db.batch(
      events.map(({ sequence, event }) =>
        this.db
          .prepare(
            'INSERT INTO match_events (match_id, sequence, event_id, command_id, state_version, event_index, event_type, event_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          )
          .bind(
            matchId,
            sequence,
            event.eventId,
            event.commandId,
            event.stateVersion,
            event.eventIndex,
            event.type,
            JSON.stringify(event),
          ),
      ),
    );
  }

  async list(id: MatchId, afterSequence = 0, limit = 100) {
    const matchId = matchIdSchema.parse(id);
    const after = sequenceSchema.parse(afterSequence);
    const count = z.number().int().min(1).max(1000).parse(limit);
    const rows = await this.db
      .prepare(
        'SELECT sequence, event_json FROM match_events WHERE match_id = ? AND sequence > ? ORDER BY sequence LIMIT ?',
      )
      .bind(matchId, after, count)
      .all<Record<string, unknown>>();
    return rows.results.map((row) =>
      storedEventSchema.parse({
        sequence: row.sequence,
        event: parseJsonColumn(row.event_json),
      }),
    );
  }

  async saveSnapshot(id: MatchId, input: SnapshotInput): Promise<void> {
    const matchId = matchIdSchema.parse(id);
    const snapshot = snapshotInputSchema.parse(input);
    if (snapshot.snapshot.matchId !== matchId)
      throw new RangeError('Snapshot match mismatch');
    await this.db
      .prepare(
        'INSERT INTO match_snapshots (match_id, sequence, state_version, snapshot_json) VALUES (?, ?, ?, ?)',
      )
      .bind(
        matchId,
        snapshot.sequence,
        snapshot.stateVersion,
        JSON.stringify(snapshot.snapshot),
      )
      .run();
  }

  async getLatestSnapshot(id: MatchId) {
    const matchId = matchIdSchema.parse(id);
    const row = await this.db
      .prepare(
        'SELECT * FROM match_snapshots WHERE match_id = ? ORDER BY sequence DESC LIMIT 1',
      )
      .bind(matchId)
      .first<Record<string, unknown>>();
    return row === null
      ? null
      : storedSnapshotSchema.parse({
          matchId: row.match_id,
          sequence: row.sequence,
          stateVersion: row.state_version,
          snapshot: parseJsonColumn(row.snapshot_json),
          createdAt: row.created_at,
        });
  }
}

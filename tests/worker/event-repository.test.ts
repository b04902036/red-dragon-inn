import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { matchIdSchema } from '../../src/shared/ids';
import type {
  SnapshotInput,
  StoredEvent,
} from '../../worker/repositories/contracts';
import { D1EventRepository } from '../../worker/repositories/events';
import { D1MatchRepository } from '../../worker/repositories/matches';
import {
  freshDatabase,
  matchInput,
  seedDatabase,
  snapshot,
  sql,
  storedEvent,
} from './database-helpers';

describe('D1 append-only events and snapshots', () => {
  const events = new D1EventRepository(env.DB);
  const matches = new D1MatchRepository(env.DB);
  const id = matchInput().id;
  beforeEach(async () => {
    await freshDatabase();
    await seedDatabase();
    await matches.create(matchInput());
  });
  it('round-trips hidden event JSON, orders events, and paginates without exposing an endpoint', async () => {
    expect(await events.list(id)).toEqual([]);
    const batch = [
      storedEvent(2, {
        commandId: 'command_1',
        stateVersion: 1,
        eventIndex: 1,
      }),
      storedEvent(1),
    ];
    await events.append(id, batch);
    expect(await events.list(id)).toEqual([...batch].reverse());
    expect(await events.list(id, 1, 1)).toEqual([batch[0]]);
    expect(await events.list(id, 2)).toEqual([]);
    expect(await events.list(matchIdSchema.parse('match_missing'))).toEqual([]);
    for (const query of [
      'UPDATE match_events SET event_type = event_type',
      'DELETE FROM match_events',
    ])
      await expect(sql(query)).rejects.toThrow('append-only');
  });
  it('rejects duplicate match sequences and rolls back the entire append batch', async () => {
    await events.append(id, [storedEvent()]);
    await expect(
      events.append(id, [
        storedEvent(2),
        storedEvent(1, { eventId: 'event_collision', stateVersion: 3 }),
      ]),
    ).rejects.toThrow('already exists');
    expect(await events.list(id)).toEqual([storedEvent()]);
    await expect(
      events.append(id, [storedEvent(2, { stateVersion: 1 })]),
    ).rejects.toThrow('already exists');
    await expect(
      events.append(id, [storedEvent(2, { eventId: 'event_1' })]),
    ).rejects.toThrow('already exists');
    await matches.create(matchInput('match_second'));
    await events.append(matchIdSchema.parse('match_second'), [
      storedEvent(1, { eventId: 'event_other_match', matchId: 'match_second' }),
    ]);
    expect(await events.list(matchIdSchema.parse('match_second'))).toHaveLength(
      1,
    );
  });
  it('checks event match and room identity before accepting history', async () => {
    await expect(
      events.append(id, [storedEvent(1, { matchId: 'match_other' })]),
    ).rejects.toThrow('match mismatch');
    await expect(
      events.append(id, [storedEvent(1, { matchId: null })]),
    ).rejects.toThrow('match mismatch');
    await expect(
      events.append(id, [storedEvent(1, { roomId: 'room_other' })]),
    ).rejects.toThrow('another room');
    await expect(
      events.append(matchIdSchema.parse('match_missing'), [
        storedEvent(1, { matchId: 'match_missing' }),
      ]),
    ).rejects.toThrow();
    expect(await events.list(id)).toEqual([]);
    const event = storedEvent().event;
    await expect(
      sql(
        'INSERT INTO match_events (match_id, sequence, event_id, command_id, state_version, event_index, event_type, event_json) VALUES (?, 1, ?, ?, 1, 0, ?, ?)',
        id,
        event.eventId,
        event.commandId,
        event.type,
        JSON.stringify({ ...event, eventId: 'event_different' }),
      ),
    ).rejects.toThrow('CHECK');
  });
  it('rejects invalid append and pagination input without modifying history', async () => {
    await expect(events.append(id, [])).rejects.toThrow();
    await expect(
      events.append(id, [
        { ...storedEvent(), sequence: 0 },
      ] as unknown as StoredEvent[]),
    ).rejects.toThrow();
    await expect(
      events.append(id, [
        { ...storedEvent(), event: { ...storedEvent().event, injected: true } },
      ] as unknown as StoredEvent[]),
    ).rejects.toThrow();
    await expect(events.list(id, -1)).rejects.toThrow();
    await expect(events.list(id, 0, 0)).rejects.toThrow();
    await expect(events.list(id, 0, 1001)).rejects.toThrow();
    expect(await events.list(id)).toEqual([]);
  });
  it('protects append-only history from SQLite replacement inserts', async () => {
    await events.append(id, [storedEvent()]);
    await expect(
      sql(
        "INSERT OR REPLACE INTO match_events SELECT match_id, sequence, event_id, command_id, state_version, event_index, event_type, json_set(event_json, '$.cardIds', json('[\"card_replaced\"]')), created_at FROM match_events",
      ),
    ).rejects.toThrow();
    expect(await events.list(id)).toEqual([storedEvent()]);
  });
  it('round-trips nested internal snapshot JSON and chooses the greatest sequence', async () => {
    expect(await events.getLatestSnapshot(id)).toBeNull();
    await events.saveSnapshot(id, snapshot(3));
    await events.saveSnapshot(id, snapshot(0));
    expect(await events.getLatestSnapshot(id)).toMatchObject({
      ...snapshot(3),
      matchId: id,
    });
    expect((await events.getLatestSnapshot(id))?.createdAt).toMatch(
      /^\d{4}-\d\d-\d\dT/,
    );
    await expect(events.saveSnapshot(id, snapshot(3))).rejects.toThrow(
      'UNIQUE',
    );
    expect(
      await events.getLatestSnapshot(matchIdSchema.parse('match_missing')),
    ).toBeNull();
  });
  it('rejects snapshot identity/version/schema mismatches and non-JSON state', async () => {
    await expect(
      events.saveSnapshot(id, snapshot(0, { matchId: 'match_other' })),
    ).rejects.toThrow('match mismatch');
    await expect(
      events.saveSnapshot(id, {
        ...snapshot(),
        stateVersion: 1,
      } as SnapshotInput),
    ).rejects.toThrow('version mismatch');
    await expect(
      events.saveSnapshot(id, {
        ...snapshot(),
        snapshot: { ...snapshot().snapshot, schemaVersion: 2 },
      } as unknown as SnapshotInput),
    ).rejects.toThrow();
    await expect(
      events.saveSnapshot(id, {
        ...snapshot(),
        snapshot: { ...snapshot().snapshot, bad: () => 1 },
      } as unknown as SnapshotInput),
    ).rejects.toThrow();
    await expect(
      events.saveSnapshot(
        matchIdSchema.parse('match_missing'),
        snapshot(0, { matchId: 'match_missing' }),
      ),
    ).rejects.toThrow();
    expect(await events.getLatestSnapshot(id)).toBeNull();
  });
  it('rejects snapshots from another room on both insert and update', async () => {
    await expect(
      events.saveSnapshot(id, snapshot(0, { roomId: 'room_other' })),
    ).rejects.toThrow('another room');
    await events.saveSnapshot(id, snapshot());
    await expect(
      sql(
        "UPDATE match_snapshots SET snapshot_json = json_set(snapshot_json, '$.roomId', 'room_other')",
      ),
    ).rejects.toThrow('another room');
  });
});

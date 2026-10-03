import { z } from 'zod';
import {
  coreStateSchema,
  replayEntrySchema,
  replayManifestSchema,
  replaySequenceSchema,
  replayFromBeginning,
  replayFromSnapshot,
} from '../../src/engine/replay';
import { createMatch } from '../../src/engine/setup';
import { matchIdSchema, playerIdSchema } from '../../src/shared/ids';
import type { MatchId } from '../../src/shared/ids';
import { stateVersionSchema } from '../../src/shared/version';
import { D1EventRepository } from './events';
import { parseJsonColumn } from './schemas';

export const persistenceBatchSchema = z
  .strictObject({
    manifest: replayManifestSchema.nullable(),
    entry: replayEntrySchema,
    state: coreStateSchema,
    saveSnapshot: z.boolean(),
  })
  .superRefine(({ entry, state, manifest }, ctx) => {
    const receipt = state.control.acceptedCommands[entry.command.commandId];
    if (
      entry.command.roomId !== state.roomId ||
      entry.command.expectedStateVersion + 1 !== state.version ||
      receipt?.actorId !== entry.actorId ||
      receipt.acceptedVersion !== state.version ||
      receipt.fingerprint !== JSON.stringify(entry.command) ||
      entry.events.some(
        (event, index) =>
          event.matchId !== state.matchId ||
          event.roomId !== state.roomId ||
          event.commandId !== entry.command.commandId ||
          event.stateVersion !== state.version ||
          event.eventIndex !== index,
      ) ||
      (manifest !== null &&
        (manifest.setup.matchId !== state.matchId ||
          manifest.setup.content.version.id !== state.contentVersionId ||
          manifest.setup.seed !== state.rng.seed))
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid persistence batch identity or causation',
      });
  });
export type PersistenceBatch = z.infer<typeof persistenceBatchSchema>;
const resultSchema = z.strictObject({
  matchId: matchIdSchema,
  finalSequence: replaySequenceSchema.min(1),
  stateVersion: stateVersionSchema,
  winners: z.array(playerIdSchema).max(1),
  players: z
    .array(
      z.strictObject({
        playerId: playerIdSchema,
        seat: z.number().int().min(0).max(3),
        fortitude: z.number().int(),
        alcoholContent: z.number().int(),
        gold: z.number().int().nonnegative(),
        eliminated: z.boolean(),
        winner: z.boolean(),
      }),
    )
    .min(2)
    .max(4),
  endedAt: z.iso.datetime(),
});

/** Atomic D1 mirror of a Durable Object outbox. Exact retries verify bytes and do no writes. */
export class D1ReplayRepository {
  constructor(private readonly db: D1Database) {}
  async commit(input: PersistenceBatch) {
    const batch = persistenceBatchSchema.parse(input);
    const { manifest, entry, state } = batch;
    const encoded = JSON.stringify(entry);
    const prior = await this.db
      .prepare(
        'SELECT entry_json FROM match_commands WHERE match_id=? AND command_id=?',
      )
      .bind(state.matchId, entry.command.commandId)
      .first<{ entry_json: string }>();
    if (prior !== null) {
      if (prior.entry_json !== encoded)
        throw new RangeError('Conflicting persisted command retry');
      return;
    }
    const statements: D1PreparedStatement[] = [];
    const add = (query: string, ...values: unknown[]) =>
      statements.push(this.db.prepare(query).bind(...values));
    const snapshot = (sequence: number, value: unknown, version: number) =>
      add(
        'INSERT INTO match_snapshots (match_id,sequence,state_version,snapshot_json) VALUES (?,?,?,?)',
        state.matchId,
        sequence,
        version,
        JSON.stringify(value),
      );
    if (manifest !== null) {
      const setup = manifest.setup;
      const initial = createMatch(setup);
      add(
        'INSERT INTO matches (id,room_id,content_version_id,rng_seed,lifecycle,state_version,created_at) VALUES (?,?,?,?,?,?,?)',
        state.matchId,
        state.roomId,
        state.contentVersionId,
        setup.seed,
        'SETUP',
        initial.version,
        entry.acceptedAt,
      );
      for (const player of setup.players)
        add(
          'INSERT INTO match_players (match_id,content_version_id,player_id,character_id,seat,display_name) VALUES (?,?,?,?,?,?)',
          state.matchId,
          state.contentVersionId,
          player.id,
          player.characterId,
          player.seat,
          player.displayName,
        );
      add(
        'INSERT INTO match_manifests (match_id,manifest_json) VALUES (?,?)',
        state.matchId,
        JSON.stringify(manifest),
      );
      snapshot(0, initial, initial.version);
    }
    for (const [index, event] of entry.events.entries())
      add(
        'INSERT INTO match_events (match_id,sequence,event_id,command_id,state_version,event_index,event_type,event_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
        state.matchId,
        entry.firstSequence + index,
        event.eventId,
        event.commandId,
        event.stateVersion,
        event.eventIndex,
        event.type,
        JSON.stringify(event),
        entry.acceptedAt,
      );
    add(
      'INSERT INTO match_commands (match_id,command_id,actor_id,state_version,first_sequence,last_sequence,entry_json,accepted_at) VALUES (?,?,?,?,?,?,?,?)',
      state.matchId,
      entry.command.commandId,
      entry.actorId,
      state.version,
      entry.firstSequence,
      entry.lastSequence,
      encoded,
      entry.acceptedAt,
    );
    if (batch.saveSnapshot) snapshot(entry.lastSequence, state, state.version);
    add(
      'UPDATE matches SET lifecycle=?,state_version=?,finished_at=? WHERE id=?',
      state.lifecycle,
      state.version,
      state.lifecycle === 'FINISHED' ? entry.acceptedAt : null,
      state.matchId,
    );
    if (state.lifecycle === 'FINISHED') {
      const result = resultSchema.parse({
        matchId: state.matchId,
        finalSequence: entry.lastSequence,
        stateVersion: state.version,
        winners: state.winners,
        players: state.players.map((player) => ({
          playerId: player.id,
          seat: player.seat,
          fortitude: player.fortitude,
          alcoholContent: player.alcoholContent,
          gold: player.gold,
          eliminated: player.eliminated,
          winner: state.winners.includes(player.id),
        })),
        endedAt: entry.acceptedAt,
      });
      add(
        'INSERT INTO match_results (match_id,final_sequence,state_version,winners_json,players_json,ended_at) VALUES (?,?,?,?,?,?)',
        state.matchId,
        result.finalSequence,
        result.stateVersion,
        JSON.stringify(result.winners),
        JSON.stringify(result.players),
        result.endedAt,
      );
    }
    await this.db.batch(statements);
  }
  async manifest(id: MatchId) {
    const row = await this.db
      .prepare('SELECT manifest_json FROM match_manifests WHERE match_id=?')
      .bind(matchIdSchema.parse(id))
      .first<{ manifest_json: string }>();
    if (row === null) throw new RangeError('Match replay manifest not found');
    return replayManifestSchema.parse(parseJsonColumn(row.manifest_json));
  }
  async commands(id: MatchId, afterSequence = 0) {
    const matchId = matchIdSchema.parse(id);
    let after = replaySequenceSchema.parse(afterSequence);
    const entries: z.infer<typeof replayEntrySchema>[] = [];
    for (;;) {
      const page = await this.db
        .prepare(
          'SELECT entry_json FROM match_commands WHERE match_id=? AND first_sequence>? ORDER BY first_sequence LIMIT 100',
        )
        .bind(matchId, after)
        .all<{ entry_json: string }>();
      const parsed = page.results.map((row) =>
        replayEntrySchema.parse(parseJsonColumn(row.entry_json)),
      );
      entries.push(...parsed);
      if (parsed.length < 100) return entries;
      after = parsed.at(-1)!.lastSequence;
    }
  }
  async restore(id: MatchId, fromBeginning = false) {
    const manifest = await this.manifest(id);
    if (fromBeginning)
      return replayFromBeginning(manifest, await this.commands(id));
    const stored = await new D1EventRepository(this.db).getLatestSnapshot(id);
    if (stored === null) throw new RangeError('Match snapshot not found');
    const state = coreStateSchema.parse(stored.snapshot);
    if (
      state.contentVersionId !== manifest.setup.content.version.id ||
      state.rng.seed !== manifest.setup.seed
    )
      throw new RangeError('Snapshot content or seed mismatch');
    return replayFromSnapshot(
      state,
      stored.sequence,
      await this.commands(id, stored.sequence),
    );
  }
  async result(id: MatchId) {
    const row = await this.db
      .prepare('SELECT * FROM match_results WHERE match_id=?')
      .bind(matchIdSchema.parse(id))
      .first<Record<string, unknown>>();
    return row === null
      ? null
      : resultSchema.parse({
          matchId: row.match_id,
          finalSequence: row.final_sequence,
          stateVersion: row.state_version,
          winners: parseJsonColumn(row.winners_json),
          players: parseJsonColumn(row.players_json),
          endedAt: row.ended_at,
        });
  }
}

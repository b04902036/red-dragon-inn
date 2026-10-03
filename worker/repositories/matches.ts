import { matchIdSchema } from '../../src/shared/ids';
import type { MatchId } from '../../src/shared/ids';
import type { MatchCreate, MatchRepository } from './contracts';
import { matchCreateSchema, matchRecordSchema } from './schemas';

export class D1MatchRepository implements MatchRepository {
  constructor(private readonly db: D1Database) {}

  async create(input: MatchCreate): Promise<void> {
    const match = matchCreateSchema.parse(input);
    const statements = [
      this.db
        .prepare(
          "INSERT INTO matches (id, room_id, content_version_id, rng_seed, lifecycle, state_version) VALUES (?, ?, ?, ?, 'SETUP', 0)",
        )
        .bind(match.id, match.roomId, match.contentVersionId, match.rngSeed),
    ];
    for (const p of match.players)
      statements.push(
        this.db
          .prepare(
            'INSERT INTO match_players (match_id, content_version_id, player_id, character_id, seat, display_name) VALUES (?, ?, ?, ?, ?, ?)',
          )
          .bind(
            match.id,
            match.contentVersionId,
            p.playerId,
            p.characterId,
            p.seat,
            p.displayName,
          ),
      );
    await this.db.batch(statements);
  }

  async get(id: MatchId) {
    const matchId = matchIdSchema.parse(id);
    const row = await this.db
      .prepare('SELECT * FROM matches WHERE id = ?')
      .bind(matchId)
      .first<Record<string, unknown>>();
    if (row === null) return null;
    const rows = await this.db
      .prepare('SELECT * FROM match_players WHERE match_id = ? ORDER BY seat')
      .bind(matchId)
      .all<Record<string, unknown>>();
    return matchRecordSchema.parse({
      id: row.id,
      roomId: row.room_id,
      contentVersionId: row.content_version_id,
      rngSeed: row.rng_seed,
      lifecycle: row.lifecycle,
      version: row.state_version,
      createdAt: row.created_at,
      finishedAt: row.finished_at,
      players: rows.results.map((p) => ({
        playerId: p.player_id,
        characterId: p.character_id,
        seat: p.seat,
        displayName: p.display_name,
      })),
    });
  }
}

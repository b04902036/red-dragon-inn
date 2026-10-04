import { env, exports } from 'cloudflare:workers';
import { reset, applyD1Migrations } from 'cloudflare:test';
import { beforeEach, it, expect } from 'vitest';
import {
  freshDatabase,
  seedDatabase,
  draftPack,
  sql,
} from './database-helpers';
import {
  newRoom,
  joinRoom,
  connect,
  sendCommand,
  storedRoom,
} from './room-helpers';
import { D1ContentRepository } from '../../worker/repositories/content';
import { localizedFixturePack } from '../../src/content/fixture-localized';
import { presentationSchema } from '../../src/protocol/presentation';
import { D1ReplayRepository } from '../../worker/repositories/replay';

beforeEach(async () => {
  await freshDatabase();
  await seedDatabase();
});
it('migrates existing published metadata translations without changing source/status', async () => {
  await reset();
  // This scenario specifically predates translation backfill, even as later migrations are added.
  await applyD1Migrations(
    env.DB,
    env.TEST_MIGRATIONS.filter(
      (migration) => migration.name < '0007_content_translations.sql',
    ),
  );
  const row = localizedFixturePack.translations![0]!;
  await sql(
    "INSERT INTO content_versions(id,name,created_at) VALUES ('content_legacy_translation','Legacy','2026-10-03T00:00:00.000Z')",
  );
  await sql(
    "INSERT INTO content_metadata VALUES ('content_legacy_translation',?)",
    JSON.stringify({ translations: [row] }),
  );
  await sql(
    "UPDATE content_versions SET published_at=created_at WHERE id='content_legacy_translation'",
  );
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  expect(
    await env.DB.prepare(
      "SELECT text,source_kind,source_ref,status FROM content_translations WHERE content_version_id='content_legacy_translation'",
    ).first(),
  ).toEqual({
    text: row.text,
    source_kind: row.sourceKind,
    source_ref: row.sourceRef,
    status: row.status,
  });
});
it('serves room-pinned Chinese while preserving protocol, stored match, accepted history and replay', async () => {
  const host = await newRoom();
  await joinRoom(host.roomId);
  const socket = await connect(host.roomId);
  await socket.hello(host.credentials);
  await socket.ping();
  expect((await sendCommand(socket, 'START_MATCH')).result.type).toBe(
    'COMMAND_ACCEPTED',
  );
  const before = await storedRoom(host.roomId);
  const repository = new D1ReplayRepository(env.DB);
  const replayBefore = await repository.restore(before.game!.matchId, true);
  expect(replayBefore.state).toEqual(before.game);
  const events = await env.DB.prepare(
    'SELECT * FROM match_events ORDER BY sequence',
  ).all();
  const endpoint = `https://example.com/api/rooms/${host.roomId}/presentation`;
  const en = presentationSchema.parse(
    await (await exports.default.fetch(endpoint)).json(),
  );
  const zh = presentationSchema.parse(
    await (await exports.default.fetch(endpoint + '?locale=zh-TW')).json(),
  );
  expect(zh.locale).toBe('zh-TW');
  expect(zh.cards[0]!.name).toBe('示範友善推擠');
  expect(
    zh.cards.map((card) => [card.id, card.type, card.responseKind]),
  ).toEqual(en.cards.map((card) => [card.id, card.type, card.responseKind]));
  expect(await storedRoom(host.roomId)).toEqual(before);
  expect(
    (await env.DB.prepare('SELECT * FROM match_events ORDER BY sequence').all())
      .results,
  ).toEqual(events.results);
  expect(await repository.restore(before.game!.matchId)).toEqual(replayBefore);
  socket.socket.close();
});
it('round-trips translation source/status, rejects duplicate rows and makes published translations immutable', async () => {
  const repository = new D1ContentRepository(env.DB);
  expect(await repository.loadPack(localizedFixturePack.version.id)).toEqual(
    localizedFixturePack,
  );
  const pack = draftPack('content_translation_roundtrip');
  pack.translations = structuredClone(localizedFixturePack.translations);
  await repository.saveDraft(pack);
  const row = pack.translations![0]!;
  await expect(
    sql(
      'INSERT INTO content_translations SELECT * FROM content_translations WHERE content_version_id=?',
      pack.version.id,
    ),
  ).rejects.toThrow();
  await repository.publishVersion(pack.version.id);
  expect(await repository.loadPack(pack.version.id)).toEqual(pack);
  for (const query of [
    "UPDATE content_translations SET text='新的翻譯' WHERE content_version_id=?",
    'DELETE FROM content_translations WHERE content_version_id=?',
    `INSERT INTO content_translations VALUES (?,'PRODUCT','new','name','zh-TW','新增','MANUAL',NULL,'MANUAL_REVIEWED')`,
  ])
    await expect(sql(query, pack.version.id)).rejects.toThrow(
      'Published translations',
    );
  expect(
    await env.DB.prepare(
      'SELECT source_kind,status,source_ref FROM content_translations WHERE content_version_id=? AND entity_id=? AND field=?',
    )
      .bind(pack.version.id, row.entityId, row.field)
      .first(),
  ).toEqual({
    source_kind: row.sourceKind,
    status: row.status,
    source_ref: row.sourceRef,
  });
});

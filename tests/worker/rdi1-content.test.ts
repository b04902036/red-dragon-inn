import { env, exports } from 'cloudflare:workers';
import { evictDurableObject } from 'cloudflare:test';
import { beforeEach, expect, it } from 'vitest';
import { contentPackSchema } from '../../src/content/pack';
import { importContent } from '../../src/content/import';
import { D1ContentRepository } from '../../worker/repositories/content';
import { assertRuntimePack } from '../../worker/runtime-content';
import { freshDatabase, seedDatabase, sql } from './database-helpers';
import {
  newRoom,
  joinRoom,
  storedRoom,
  stubFor,
  connect,
  sendCommand,
} from './room-helpers';

beforeEach(freshDatabase);
const pack = () =>
  contentPackSchema.parse(JSON.parse(env.TEST_RDI1_PACK_JSON) as unknown);
const repo = () => new D1ContentRepository(env.DB);
async function publish() {
  const content = pack();
  expect(
    (await importContent(JSON.stringify(content), repo(), { dryRun: false }))
      .written,
  ).toBe(true);
  await repo().publishVersion(content.version.id);
  await repo().setProductionVersion(content.version.id);
  return content;
}

it('imports and publishes the complete RDI1 graph with truthful provenance in real D1', async () => {
  expect(env.CONTENT_MODE).toBe('production');
  const content = await publish();
  const loaded = (await repo().loadPack(content.version.id))!;
  expect(loaded.cards).toHaveLength(110);
  expect(loaded.deckCards.reduce((sum, row) => sum + row.quantity, 0)).toBe(
    190,
  );
  expect(loaded.translations).toEqual(content.translations);
  expect(
    loaded.characters.every(
      (c) => !c.rules.traits?.some((trait) => ['ORC', 'TROLL'].includes(trait)),
    ),
  ).toBe(true);
  expect(
    loaded.cards.every((c) => c.source === 'PUBLIC_RULES_PARAPHRASE'),
  ).toBe(true);
  expect(assertRuntimePack(loaded, false)).toHaveLength(4);
  await expect(
    sql(
      'UPDATE cards SET name = ? WHERE content_version_id = ?',
      'Changed',
      content.version.id,
    ),
  ).rejects.toThrow();
  expect(await repo().productionVersion()).toBe(content.version.id);
});

it('offers exactly four RDI1 characters, starts a pinned match and reconnects without sample fallback', async () => {
  await seedDatabase();
  const content = await publish();
  const host = await newRoom();
  const response = await exports.default.fetch(
    `https://example.com/api/rooms/${host.roomId}/presentation?locale=en-US`,
  );
  expect(response.status).toBe(200);
  const presentation = (await response.json()) as {
    contentVersionId: string;
    characters: { id: string; name: string }[];
  };
  expect(presentation.contentVersionId).toBe(content.version.id);
  expect(presentation.characters.map((c) => c.id).sort()).toEqual(
    content.characters.map((c) => c.id).sort(),
  );
  expect(presentation.characters).toHaveLength(4);
  expect(JSON.stringify(presentation)).not.toMatch(
    /sample|fixture|"(?:deckCards|effects|seed|hand|rng)":/i,
  );
  expect(
    (
      await exports.default.fetch(
        `https://example.com/api/rooms/${host.roomId}/presentation?locale=zh-TW`,
      )
    ).status,
  ).toBe(200);
  await joinRoom(host.roomId);
  const socket = await connect(host.roomId);
  try {
    await socket.hello(host.credentials);
    expect((await sendCommand(socket, 'START_MATCH')).result.type).toBe(
      'COMMAND_ACCEPTED',
    );
    expect((await storedRoom(host.roomId)).game!.contentVersionId).toBe(
      content.version.id,
    );
    await evictDurableObject(stubFor(host.roomId));
    const resumed = await connect(host.roomId);
    try {
      await resumed.hello(host.credentials);
      expect((await storedRoom(host.roomId)).contentVersionId).toBe(
        content.version.id,
      );
    } finally {
      resumed.socket.close();
    }
  } finally {
    socket.socket.close();
  }
});

it('SQL channel guards accept paraphrases on insert and update, and still reject samples directly', async () => {
  const content = await publish();
  await seedDatabase();
  await expect(
    sql(
      "UPDATE content_channels SET content_version_id = 'content_sample_v1' WHERE name = 'production'",
    ),
  ).rejects.toThrow('owned or licensed');
  await sql("DELETE FROM content_channels WHERE name = 'production'");
  await expect(
    sql(
      "INSERT INTO content_channels VALUES ('production', 'content_sample_v1')",
    ),
  ).rejects.toThrow('owned or licensed');
  await sql(
    "INSERT INTO content_channels VALUES ('production', ?)",
    content.version.id,
  );
  await sql(
    "UPDATE content_channels SET content_version_id = ? WHERE name = 'production'",
    content.version.id,
  );
  expect(await repo().productionVersion()).toBe(content.version.id);
});

import { env, exports } from 'cloudflare:workers';
import { evictDurableObject } from 'cloudflare:test';
import { beforeEach, expect, it } from 'vitest';
import { contentPackSchema } from '../../src/content/pack';
import { importContent } from '../../src/content/import';
import { verifyRdi2Pack } from '../../src/content/rdi2-pack';
import { D1ContentRepository } from '../../worker/repositories/content';
import { D1ReplayRepository } from '../../worker/repositories/replay';
import { assertRuntimePack } from '../../worker/runtime-content';
import { replayFromBeginning } from '../../src/engine/replay';
import { freshDatabase, seedDatabase } from './database-helpers';
import {
  newRoom,
  joinRoom,
  storedRoom,
  stubFor,
  connect,
  sendCommand,
} from './room-helpers';

const pack = () =>
  contentPackSchema.parse(JSON.parse(env.TEST_RDI1_RDI2_PACK_JSON) as unknown);
const original = () =>
  contentPackSchema.parse(JSON.parse(env.TEST_RDI1_PACK_JSON) as unknown);
const repo = () => new D1ContentRepository(env.DB);
beforeEach(freshDatabase);
async function publishOriginal() {
  await seedDatabase();
  const old = original();
  await repo().saveDraft(old);
  await repo().publishVersion(old.version.id);
  await repo().setProductionVersion(old.version.id);
  return old;
}
async function publishCombined() {
  const content = pack();
  await repo().saveDraft(content);
  await repo().publishVersion(content.version.id);
  await repo().setProductionVersion(content.version.id);
  return content;
}
it('dry-run writes nothing; local import/publication is immutable, complete and has no sample fallback', async () => {
  await publishOriginal();
  const content = pack();
  const dry = await importContent(JSON.stringify(content), repo(), {
    dryRun: true,
  });
  expect(dry).toMatchObject({ written: false, valid: true });
  expect(await repo().getVersion(content.version.id)).toBeNull();
  expect(
    (await importContent(JSON.stringify(content), repo(), { dryRun: false }))
      .written,
  ).toBe(true);
  await repo().publishVersion(content.version.id);
  const loaded = (await repo().loadPack(content.version.id))!;
  expect(verifyRdi2Pack(loaded, content).valid).toBe(true);
  expect(assertRuntimePack(loaded, false)).toHaveLength(8);
  expect(
    loaded.cards.every((c) => c.source === 'PUBLIC_RULES_PARAPHRASE'),
  ).toBe(true);
  await expect(repo().saveDraft(content)).rejects.toThrow();
  await expect(repo().publishVersion(content.version.id)).rejects.toThrow();
  expect(await repo().loadPack(original().version.id)).toEqual(original());
});
it('old RDI1 rooms retain their pin, while new production lobby offers exactly eight characters and bilingual Drink choices', async () => {
  const oldPack = await publishOriginal();
  const old = await newRoom('Old pinned room');
  const content = await publishCombined();
  const fresh = await newRoom('Combined room');
  expect((await storedRoom(old.roomId)).contentVersionId).toBe(
    oldPack.version.id,
  );
  expect((await storedRoom(fresh.roomId)).contentVersionId).toBe(
    content.version.id,
  );
  for (const locale of ['en-US', 'zh-TW']) {
    const response = await exports.default.fetch(
      `https://example.com/api/rooms/${fresh.roomId}/presentation?locale=${locale}`,
    );
    expect(response.status).toBe(200);
    const view = (await response.json()) as {
      characters: unknown[];
      innDrinkDecks: unknown[];
    };
    expect(view.characters).toHaveLength(8);
    expect(view.innDrinkDecks).toHaveLength(2);
  }
  await joinRoom(old.roomId, 'Old guest');
  const client = await connect(old.roomId);
  try {
    await client.hello(old.credentials);
    expect((await sendCommand(client, 'START_MATCH')).result.type).toBe(
      'COMMAND_ACCEPTED',
    );
    expect((await storedRoom(old.roomId)).game!.contentVersionId).toBe(
      oldPack.version.id,
    );
    await evictDurableObject(stubFor(old.roomId));
    expect((await storedRoom(old.roomId)).game!.contentVersionId).toBe(
      oldPack.version.id,
    );
  } finally {
    client.socket.close();
  }
});
it.each([
  ['deck_rdi1_inn'],
  ['deck_rdi2_inn'],
  ['deck_rdi1_inn', 'deck_rdi2_inn'],
])(
  'explicit setup %j persists in the server replay manifest and survives eviction/reconnect',
  async (...drinkDeckIds) => {
    await publishOriginal();
    await publishCombined();
    const host = await newRoom();
    await joinRoom(host.roomId);
    const client = await connect(host.roomId);
    try {
      await client.hello(host.credentials);
      const rejected = await sendCommand(client, 'START_MATCH', {
        drinkDeckIds: ['deck_missing'],
      });
      expect(rejected.result.type).toBe('COMMAND_REJECTED');
      expect((await storedRoom(host.roomId)).game).toBeNull();
      expect(
        (await sendCommand(client, 'START_MATCH', { drinkDeckIds })).result
          .type,
      ).toBe('COMMAND_ACCEPTED');
      const room = await storedRoom(host.roomId),
        game = room.game!;
      expect(game.innDrinkDeck.cardIds).toHaveLength(28);
      expect(game.barDrinkDeck?.length ?? 0).toBe(
        drinkDeckIds.length === 2 ? 30 : 0,
      );
      const replay = new D1ReplayRepository(env.DB);
      const manifest = await replay.manifest(game.matchId);
      expect(manifest.setup.innDrinkDeckIds).toEqual(drinkDeckIds);
      expect(
        replayFromBeginning(manifest, await replay.commands(game.matchId))
          .state,
      ).toEqual(game);
      await evictDurableObject(stubFor(host.roomId));
      const resumed = await connect(host.roomId);
      try {
        await resumed.hello(host.credentials);
        expect((await storedRoom(host.roomId)).game).toEqual(game);
      } finally {
        resumed.socket.close();
      }
    } finally {
      client.socket.close();
    }
  },
);
it('a missing setup selection in a combined edition fails without mutating the room', async () => {
  await publishOriginal();
  await publishCombined();
  const host = await newRoom();
  await joinRoom(host.roomId);
  const client = await connect(host.roomId);
  try {
    await client.hello(host.credentials);
    expect((await sendCommand(client, 'START_MATCH')).result.type).toBe(
      'COMMAND_REJECTED',
    );
    expect((await storedRoom(host.roomId)).game).toBeNull();
  } finally {
    client.socket.close();
  }
});

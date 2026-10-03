import { env, exports } from 'cloudflare:workers';
import { evictDurableObject } from 'cloudflare:test';
import { beforeEach, expect, it } from 'vitest';
import { D1ContentRepository } from '../../worker/repositories/content';
import { contentVersionIdSchema } from '../../src/shared/ids';
import { contentPackSchema } from '../../src/content/pack';
import {
  assertRuntimePack,
  loadRuntimePack,
  ContentUnavailable,
} from '../../worker/runtime-content';
import { sampleContentPack } from '../../src/content/sample';
import { productionFixture } from '../fixtures/production-pack';
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
const repository = () => new D1ContentRepository(env.DB);
async function edition(id: string) {
  const pack = productionFixture(id);
  await repository().saveDraft(pack);
  await repository().publishVersion(pack.version.id);
  return pack;
}

it('production is the default and empty/fixture-only D1 fails clearly without fallback', async () => {
  expect(env.CONTENT_MODE).toBe('production');
  await seedDatabase();
  const response = await exports.default.fetch(
    'https://example.com/api/rooms',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Host' }),
    },
  );
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({
    ok: false,
    error: { code: 'CONTENT_UNAVAILABLE' },
  });
  await expect(
    repository().setProductionVersion(
      contentVersionIdSchema.parse('content_sample_v1'),
    ),
  ).rejects.toThrow('owned or licensed');
  expect(
    (await exports.default.fetch('https://example.com/api/content/sample'))
      .status,
  ).toBe(404);
});

it('pins publication across channel updates, eviction, selection, match start and definition-only presentation', async () => {
  const first = await edition('content_owned_first');
  await repository().setProductionVersion(first.version.id);
  const host = await newRoom();
  expect((await storedRoom(host.roomId)).contentVersionId).toBe(
    first.version.id,
  );
  const secondInput = productionFixture('content_owned_second');
  const secondCharacters = secondInput.characters.map((character, index) => ({
    ...character,
    id: `character_other_${index}`,
    name: `Other original character ${index}`,
  }));
  const second = contentPackSchema.parse({
    ...secondInput,
    characters: secondCharacters,
    decks: secondInput.decks.map((deck) => ({
      ...deck,
      characterId:
        deck.characterId === null
          ? null
          : secondCharacters[
              secondInput.characters.findIndex(
                (character) => character.id === deck.characterId,
              )
            ]!.id,
    })),
    translations: [],
  });
  await repository().saveDraft(second);
  await repository().publishVersion(second.version.id);
  await repository().setProductionVersion(second.version.id);
  await evictDurableObject(stubFor(host.roomId));
  const later = await newRoom('Later host');
  expect((await storedRoom(later.roomId)).contentVersionId).toBe(
    second.version.id,
  );
  const wrongEdition = await exports.default.fetch(
    `https://example.com/api/rooms/${host.roomId}/character`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${host.credentials.resumeToken}`,
      },
      body: JSON.stringify({
        characterId: second.characters[1]!.id,
        expectedStateVersion: 0,
      }),
    },
  );
  expect(wrongEdition.status).toBe(400);
  expect(await wrongEdition.json()).toEqual({
    ok: false,
    error: { code: 'INVALID_CHARACTER' },
  });
  const response = await exports.default.fetch(
    `https://example.com/api/rooms/${host.roomId}/presentation?locale=en-US`,
  );
  const presentation = (await response.json()) as {
    contentVersionId: string;
    characters: { name: string }[];
  };
  expect(presentation.contentVersionId).toBe(first.version.id);
  expect(presentation.characters[0]!.name).toBe(first.characters[0]!.name);
  expect(JSON.stringify(presentation)).not.toMatch(
    /"(?:deckCards|effects|ownerId|seed|hand|rng|cardIds)":/,
  );
  const select = await exports.default.fetch(
    `https://example.com/api/rooms/${host.roomId}/character`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${host.credentials.resumeToken}`,
      },
      body: JSON.stringify({
        characterId: first.characters[1]!.id,
        expectedStateVersion: 0,
      }),
    },
  );
  expect(select.status).toBe(200);
  await select.json();
  await joinRoom(host.roomId);
  const socket = await connect(host.roomId);
  try {
    await socket.hello(host.credentials);
    expect((await sendCommand(socket, 'START_MATCH')).result.type).toBe(
      'COMMAND_ACCEPTED',
    );
    const record = await storedRoom(host.roomId);
    expect(record.game!.contentVersionId).toBe(first.version.id);
    expect(record.game!.players[0]!.characterId).toBe(first.characters[1]!.id);
    const manifest = await env.DB.prepare(
      'SELECT manifest_json FROM match_manifests WHERE match_id = ?',
    )
      .bind(record.game!.matchId)
      .first<{ manifest_json: string }>();
    expect(JSON.parse(manifest!.manifest_json).setup.content.version.id).toBe(
      first.version.id,
    );
  } finally {
    socket.socket.close();
  }
});

it('rejects missing/unpublished or fixture channel targets at repository and SQL boundaries', async () => {
  const draft = productionFixture('content_draft_production');
  await repository().saveDraft(draft);
  await expect(
    repository().setProductionVersion(draft.version.id),
  ).rejects.toThrow('published');
  await expect(
    sql(
      "INSERT INTO content_channels VALUES ('production', ?)",
      draft.version.id,
    ),
  ).rejects.toThrow();
  await expect(
    sql("INSERT INTO content_channels VALUES ('production', 'content_absent')"),
  ).rejects.toThrow();
  await seedDatabase();
  await expect(
    sql(
      "INSERT INTO content_channels VALUES ('production', 'content_sample_v1')",
    ),
  ).rejects.toThrow();
  const valid = await edition('content_valid_production');
  await repository().setProductionVersion(valid.version.id);
  await expect(
    sql('UPDATE content_channels SET content_version_id = ?', draft.version.id),
  ).rejects.toThrow();
  expect(await repository().productionVersion()).toBe(valid.version.id);
});

it('round-trips translations/requirements and keeps published metadata immutable, including replacement writes', async () => {
  const pack = productionFixture('content_metadata_test');
  pack.requirements = [
    {
      characterId: pack.characters[0]!.id,
      primaryDeckCount: 7,
      sideDecks: [],
      components: [],
    },
  ];
  await repository().saveDraft(pack);
  await repository().publishVersion(pack.version.id);
  expect(await repository().loadPack(pack.version.id)).toEqual(pack);
  for (const query of [
    'DELETE FROM content_metadata WHERE content_version_id = ?',
    "UPDATE content_metadata SET metadata_json = '{}' WHERE content_version_id = ?",
    "INSERT OR REPLACE INTO content_metadata VALUES (?, '{}')",
  ])
    await expect(sql(query, pack.version.id)).rejects.toThrow();
  expect((await repository().loadPack(pack.version.id))!.translations).toEqual(
    pack.translations,
  );
  expect(
    await repository().loadPack(
      contentVersionIdSchema.parse('content_missing'),
    ),
  ).toBeNull();
});

it('fails closed for absent pinned content, no-op cards, unavailable Inn supply and unplayable characters', async () => {
  await expect(loadRuntimePack(env, 'content_absent')).rejects.toThrow(
    ContentUnavailable,
  );
  const original = productionFixture();
  const invalids = [
    {
      ...original,
      cards: original.cards.map((card) => ({
        ...card,
        source: 'TEST_FIXTURE' as const,
      })),
    },
    {
      ...original,
      cards: original.cards.map((card) => ({ ...card, effects: [] })),
    },
    {
      ...original,
      decks: original.decks.filter((deck) => deck.type !== 'INN_DRINK'),
    },
    {
      ...original,
      deckCards: original.deckCards.filter(
        (row) => row.deckId !== 'deck_sample_inn',
      ),
    },
    {
      ...original,
      decks: [
        ...original.decks,
        original.decks.find((deck) => deck.type === 'INN_DRINK')!,
      ],
    },
    { ...original, characters: original.characters.slice(0, 1) },
    {
      ...original,
      decks: original.decks.filter((deck) => deck.type !== 'CHARACTER'),
    },
    {
      ...original,
      deckCards: original.deckCards.filter(
        (row) => row.deckId === 'deck_sample_inn',
      ),
    },
    {
      ...original,
      characters: original.characters.map((character) => ({
        ...character,
        rules: { ...character.rules, sideDeckKeys: ['unsupported'] },
      })),
    },
    {
      ...original,
      requirements: original.characters.map((character) => ({
        characterId: character.id,
        primaryDeckCount: 7,
        sideDecks: [{ deckId: original.decks[0]!.id, quantity: 12 }],
        components: [],
      })),
    },
  ];
  for (const pack of invalids)
    expect(() => assertRuntimePack(pack, false)).toThrow(ContentUnavailable);
  expect(assertRuntimePack(sampleContentPack, true)).toHaveLength(4);
  expect(
    assertRuntimePack(
      {
        ...original,
        cards: original.cards.map((card) => ({
          ...card,
          source: 'LICENSED' as const,
        })),
      },
      false,
    ),
  ).toHaveLength(2);
});

it('handles room-pinned presentation locale/method/missing-room boundaries and catalog exhaustion', async () => {
  const pack = await edition('content_two_seats');
  await repository().setProductionVersion(pack.version.id);
  const host = await newRoom();
  const endpoint = `https://example.com/api/rooms/${host.roomId}/presentation`;
  expect(
    (await exports.default.fetch(endpoint + '?locale=unsupported')).status,
  ).toBe(400);
  const fallback = await exports.default.fetch(endpoint + '?locale=zh-TW');
  expect(fallback.status).toBe(503);
  expect(await fallback.json()).toMatchObject({
    error: { code: 'CONTENT_UNAVAILABLE' },
  });
  expect(
    (await exports.default.fetch(endpoint, { method: 'POST' })).status,
  ).toBe(405);
  expect(
    (
      await exports.default.fetch(
        'https://example.com/api/rooms/room_missing/presentation',
      )
    ).status,
  ).toBe(404);
  await joinRoom(host.roomId);
  const full = await exports.default.fetch(
    `https://example.com/api/rooms/${host.roomId}/join`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Third' }),
    },
  );
  expect(full.status).toBe(409);
  expect(await full.json()).toEqual({
    ok: false,
    error: { code: 'NO_AVAILABLE_CHARACTER' },
  });
});

it('fails safely when pinned content storage becomes unavailable, without creating or starting alternative state', async () => {
  const pack = await edition('content_unavailable_after_pin');
  await repository().setProductionVersion(pack.version.id);
  const host = await newRoom();
  await joinRoom(host.roomId);
  const socket = await connect(host.roomId);
  try {
    await socket.hello(host.credentials);
    await sql('DROP TABLE content_metadata');
    expect(
      (
        await exports.default.fetch(
          `https://example.com/api/rooms/${host.roomId}/presentation`,
        )
      ).status,
    ).toBe(503);
    const selected = await exports.default.fetch(
      `https://example.com/api/rooms/${host.roomId}/character`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${host.credentials.resumeToken}`,
        },
        body: JSON.stringify({
          characterId: pack.characters[0]!.id,
          expectedStateVersion: 1,
        }),
      },
    );
    expect(selected.status).toBe(503);
    expect(
      (
        await exports.default.fetch(
          `https://example.com/api/rooms/${host.roomId}/join`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ displayName: 'Another' }),
          },
        )
      ).status,
    ).toBe(503);
    expect((await sendCommand(socket, 'START_MATCH')).result.type).toBe(
      'COMMAND_REJECTED',
    );
    expect((await storedRoom(host.roomId)).game).toBeNull();
    const create = await exports.default.fetch(
      'https://example.com/api/rooms',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: 'New' }),
      },
    );
    expect(create.status).toBe(503);
    expect(await create.json()).toEqual({
      ok: false,
      error: { code: 'CONTENT_INVALID' },
    });
  } finally {
    socket.socket.close();
  }
});

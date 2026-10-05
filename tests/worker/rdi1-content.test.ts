import { env, exports } from 'cloudflare:workers';
import { evictDurableObject, runInDurableObject } from 'cloudflare:test';
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
  latestPrivate,
  latestPublic,
} from './room-helpers';
import { rdi1Match, rdi1Play } from '../fixtures/rdi1-match';
import { projectPrivatePlayer } from '../../src/protocol/projections';
import { D1ReplayRepository } from '../../worker/repositories/replay';
import type { GameRoom } from '../../worker/durable/game-room';
import type { RoomClient } from './room-helpers';

beforeEach(freshDatabase);

it('keeps published v1 and its old room loadable after publishing and selecting corrected v2', async () => {
  await seedDatabase();
  const original = contentPackSchema.parse(
    JSON.parse(env.TEST_RDI1_V1_PACK_JSON) as unknown,
  );
  await repo().saveDraft(original);
  await repo().publishVersion(original.version.id);
  await repo().setProductionVersion(original.version.id);
  const old = await newRoom('Original v1 host');
  expect((await storedRoom(old.roomId)).contentVersionId).toBe(
    original.version.id,
  );
  const corrected = await publish();
  expect(corrected.version.id).toBe('content_rdi1_mechanics_v2');
  const fresh = await newRoom('Corrected v2 host');
  expect((await storedRoom(fresh.roomId)).contentVersionId).toBe(
    corrected.version.id,
  );
  expect(await repo().loadPack(original.version.id)).toEqual(original);
  const loaded = (await repo().loadPack(corrected.version.id))!;
  expect(loaded.cards).toEqual(corrected.cards);
  expect(loaded.deckCards).toEqual(corrected.deckCards);
  expect(loaded.translations).toEqual(corrected.translations);
  await joinRoom(old.roomId, 'Original v1 guest');
  const client = await connect(old.roomId);
  try {
    await client.hello(old.credentials);
    expect((await sendCommand(client, 'START_MATCH')).result.type).toBe(
      'COMMAND_ACCEPTED',
    );
    expect((await storedRoom(old.roomId)).game!.contentVersionId).toBe(
      original.version.id,
    );
    await evictDurableObject(stubFor(old.roomId));
    const resumed = await connect(old.roomId);
    try {
      await resumed.hello(old.credentials);
      expect((await storedRoom(old.roomId)).game!.contentVersionId).toBe(
        original.version.id,
      );
    } finally {
      resumed.socket.close();
    }
  } finally {
    client.socket.close();
  }
}, 20_000);
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
    const bounds = {
      fortitude: { min: 0, max: 20 },
      alcoholContent: { min: 0, max: 20 },
      gold: null,
    };
    expect((await storedRoom(host.roomId)).game!.rules.statBounds).toEqual(
      bounds,
    );
    await evictDurableObject(stubFor(host.roomId));
    const resumed = await connect(host.roomId);
    try {
      await resumed.hello(host.credentials);
      expect((await storedRoom(host.roomId)).contentVersionId).toBe(
        content.version.id,
      );
      expect((await storedRoom(host.roomId)).game!.rules.statBounds).toEqual(
        bounds,
      );
    } finally {
      resumed.socket.close();
    }
  } finally {
    socket.socket.close();
  }
}, 20_000);

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

it('four production seats receive exact decks and play a real timed Sometimes through WebSockets, hibernation and D1 replay from the beginning', async () => {
  const content = await publish();
  let chosen:
    | { seed: number; attack: string; targetSeat: number; response: string }
    | undefined;
  for (let seed = 0; seed < 100 && !chosen; seed++) {
    const state = rdi1Match(content, 7, seed);
    const attack = state.players[0]!.hand.find(
      (id) =>
        state.definitions[state.cards[id]!.definitionId]!.type === 'ACTION' &&
        state.definitions[state.cards[id]!.definitionId]!.effects.some(
          (e) =>
            e.op === 'CHANGE_STAT' &&
            e.stat === 'FORTITUDE' &&
            e.delta < 0 &&
            e.target === 'CHOSEN_PLAYER',
        ),
    );
    if (!attack) continue;
    for (let seat = 1; seat < 4 && !chosen; seat++) {
      const pending = rdi1Play(state, attack, state.players[seat]!.id).state;
      const definition = state.players[seat]!.hand.find(
        (id) =>
          state.definitions[state.cards[id]!.definitionId]!.type ===
            'SOMETIMES' &&
          state.definitions[state.cards[id]!.definitionId]!.effects[0]?.op ===
            'IGNORE',
      );
      if (!definition) continue;
      // Inspect trigger legality independently of whichever seat initially has priority.
      const p = structuredClone(pending);
      if (!p.responseWindow?.eligiblePlayerIds.includes(p.players[seat]!.id))
        continue;
      (p.responseWindow as { priorityPlayerId: string }).priorityPlayerId =
        p.players[seat]!.id;
      if (
        projectPrivatePlayer(p, p.players[seat]!.id).legalPlays.some(
          (c) => c.cardId === definition,
        )
      )
        chosen = {
          seed,
          attack: state.cards[attack]!.definitionId,
          targetSeat: seat,
          response: state.cards[definition]!.definitionId,
        };
    }
  }
  expect(chosen).toBeDefined();
  const host = await newRoom('Deirdre');
  const members = [
    host,
    await joinRoom(host.roomId, 'Fiona'),
    await joinRoom(host.roomId, 'Gerki'),
    await joinRoom(host.roomId, 'Zot'),
  ];
  const stub = stubFor(host.roomId);
  const clockStart = Date.now();
  await runInDurableObject(stub, async (instance: GameRoom, ctx) => {
    const room =
      (await ctx.storage.get<Awaited<ReturnType<typeof storedRoom>>>('room'))!;
    await ctx.storage.put('room', { ...room, seed: chosen!.seed });
    (instance as unknown as { clock: { now(): number } }).clock = {
      now: () => clockStart,
    };
  });
  const clients: RoomClient[] = [];
  try {
    for (const member of members) {
      const client = await connect(host.roomId);
      await client.hello(member.credentials);
      clients.push(client);
    }
    expect((await sendCommand(clients[0]!, 'START_MATCH')).result.type).toBe(
      'COMMAND_ACCEPTED',
    );
    for (const client of clients) await client.ping();
    const initial = (await storedRoom(host.roomId)).game!;
    expect(
      initial.players.map(
        (p) => p.hand.length + p.characterDeck.cardIds.length,
      ),
    ).toEqual([40, 40, 40, 40]);
    for (let seat = 0; seat < 4; seat++) {
      expect(latestPrivate(clients[seat]!).hand).toHaveLength(7);
      for (const other of clients.filter((c) => c !== clients[seat]))
        for (const card of initial.players[seat]!.hand)
          expect(JSON.stringify(other.messages)).not.toContain(
            JSON.stringify(card),
          );
    }
    await sendCommand(clients[0]!, 'DISCARD', { cardIds: [] });
    async function passTo(stop: (s: typeof initial) => boolean) {
      for (let i = 0; i < 64; i++) {
        const state = (await storedRoom(host.roomId)).game!;
        if (stop(state)) return;
        const window = state.responseWindow ?? state.control.phaseEnd!;
        const seat = state.players.findIndex(
          (p) => p.id === window.priorityPlayerId,
        );
        for (const client of clients) await client.ping();
        expect(
          (
            await sendCommand(
              clients[seat]!,
              state.responseWindow ? 'PASS_RESPONSE' : 'PASS_ANYTIME',
              { responseWindowId: window.id },
            )
          ).result.type,
        ).toBe('COMMAND_ACCEPTED');
      }
      throw new Error('Worker checkpoint not reached');
    }
    await passTo(
      (s) => s.phase === 'ACTION' && !s.responseWindow && !s.control.phaseEnd,
    );
    const action = (await storedRoom(host.roomId)).game!;
    const attack = action.players[0]!.hand.find(
      (id) => action.cards[id]!.definitionId === chosen!.attack,
    )!;
    expect(
      (
        await sendCommand(clients[0]!, 'PLAY_CARD', {
          cardId: attack,
          targetPlayerId: action.players[chosen!.targetSeat]!.id,
        })
      ).result.type,
    ).toBe('COMMAND_ACCEPTED');
    await passTo(
      (s) =>
        s.responseWindow?.priorityPlayerId ===
        s.players[chosen!.targetSeat]!.id,
    );
    for (const client of clients) await client.ping();
    const response = latestPrivate(clients[chosen!.targetSeat]!);
    expect(response.responsePrompt?.hasLegalSometimes).toBe(true);
    const prompt = latestPublic(clients[0]!).timedPrompt!;
    expect(prompt.deadlineAt).toBe(
      prompt.priorityPlayerId === action.activePlayerId
        ? null
        : prompt.openedAt + 30_000,
    );
    await evictDurableObject(stub);
    await runInDurableObject(stub, (instance: GameRoom) => {
      (instance as unknown as { clock: { now(): number } }).clock = {
        now: () => clockStart + 1000,
      };
    });
    const resumed = await connect(host.roomId);
    await resumed.hello(members[chosen!.targetSeat]!.credentials);
    clients[chosen!.targetSeat]!.socket.close();
    clients[chosen!.targetSeat] = resumed;
    expect(latestPrivate(resumed).responsePrompt).toEqual(
      response.responsePrompt,
    );
    const card = response.hand.find(
      (c) => c.definitionId === chosen!.response,
    )!;
    expect(
      (
        await sendCommand(resumed, 'PLAY_RESPONSE', {
          cardId: card.id,
          responseWindowId: prompt.windowId,
          promptId: prompt.promptId,
        })
      ).result.type,
    ).toBe('COMMAND_ACCEPTED');
    await passTo((s) => !s.responseWindow && !s.control.phaseEnd);
    const final = (await storedRoom(host.roomId)).game!;
    expect(final.players[chosen!.targetSeat]!.fortitude).toBe(20);
    expect(
      (await new D1ReplayRepository(env.DB).restore(final.matchId, true)).state,
    ).toEqual(final);
    expect(
      (
        await exports.default.fetch(
          `https://example.com/api/rooms/${host.roomId}/__test/stage`,
        )
      ).status,
    ).not.toBe(200);
  } finally {
    for (const client of clients) client.socket.close();
  }
}, 20_000);

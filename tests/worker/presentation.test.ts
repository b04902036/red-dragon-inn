import { exports } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { freshDatabase, seedDatabase } from './database-helpers';
import { presentationSchema } from '../../src/protocol/presentation';
import { roomMetadataSchema } from '../../src/protocol/rooms';
import {
  connect,
  newRoom,
  joinRoom,
  latestPublic,
  sendCommand,
  storedRoom,
} from './room-helpers';

const choose = (
  roomId: string,
  token: string | null,
  body: unknown,
  method = 'PATCH',
) =>
  exports.default.fetch(`https://example.com/api/rooms/${roomId}/character`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
    },
    body: method === 'GET' ? undefined : JSON.stringify(body),
  });
describe('safe table presentation and lobby choices', () => {
  beforeEach(async () => {
    await freshDatabase();
    await seedDatabase();
  });
  it('publishes original card text and target hints without deck lists or effects', async () => {
    const host = await newRoom();
    const response = await exports.default.fetch(
      `https://example.com/api/rooms/${host.roomId}/presentation?locale=en-US`,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const raw = await response.json();
    const content = presentationSchema.parse(raw);
    expect(content.characters).toHaveLength(4);
    expect(content.cards).toHaveLength(10);
    for (const card of content.cards) {
      expect(card.rulesText).toContain(
        'Original fictional test content; not an official game card.',
      );
      expect(card.rulesText).not.toContain('undefined');
    }
    expect(content.cards.find((card) => card.type === 'ACTION')).toMatchObject({
      requiresTarget: true,
    });
    expect(
      content.cards.find((card) => card.type === 'SOMETIMES'),
    ).toHaveProperty('responseKind');
    expect(JSON.stringify(raw)).not.toMatch(
      /"(?:deckCards|effects|effectKey|ownerId|seed)":/,
    );
    expect(
      (
        await exports.default.fetch(
          `https://example.com/api/rooms/${host.roomId}/presentation`,
          {
            method: 'POST',
          },
        )
      ).status,
    ).toBe(405);
  });
  it('selects only the authenticated seat, broadcasts, assigns unused characters to later joins, and starts that character', async () => {
    const host = await newRoom();
    const socket = await connect(host.roomId);
    await socket.hello(host.credentials);
    await socket.ping();
    const response = await choose(host.roomId, host.credentials.resumeToken, {
      characterId: 'character_sample_1',
      expectedStateVersion: 0,
    });
    expect(response.status).toBe(200);
    const selected = roomMetadataSchema.parse(await response.json());
    await socket.ping();
    expect(latestPublic(socket)).toEqual(selected.view);
    expect(selected.view.players[0]?.characterId).toBe('character_sample_1');
    const guest = await joinRoom(host.roomId);
    expect(guest.view.players[1]?.characterId).toBe('character_sample_0');
    await socket.ping();
    expect((await sendCommand(socket, 'START_MATCH')).result.type).toBe(
      'COMMAND_ACCEPTED',
    );
    expect(
      (await storedRoom(host.roomId)).game?.players[0]?.special.resources
        .tokens,
    ).toEqual({ value: 0, visibility: 'PUBLIC' });
    expect(
      (
        await choose(host.roomId, host.credentials.resumeToken, {
          characterId: 'character_sample_2',
          expectedStateVersion: 3,
        })
      ).status,
    ).toBe(409);
    socket.socket.close();
  });
  it('rejects unauthenticated, stale, malformed, unknown, and occupied selections without mutations', async () => {
    const host = await newRoom();
    await joinRoom(host.roomId);
    const before = await storedRoom(host.roomId);
    const valid = {
      characterId: 'character_sample_2',
      expectedStateVersion: 1,
    };
    expect((await choose(host.roomId, null, valid)).status).toBe(401);
    expect((await choose(host.roomId, 'bad', valid)).status).toBe(403);
    expect(
      (
        await choose(host.roomId, host.credentials.resumeToken, {
          ...valid,
          actorId: host.credentials.playerId,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await choose(host.roomId, host.credentials.resumeToken, {
          ...valid,
          expectedStateVersion: 0,
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await choose(host.roomId, host.credentials.resumeToken, {
          ...valid,
          characterId: 'character_missing',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await choose(host.roomId, host.credentials.resumeToken, {
          ...valid,
          characterId: 'character_sample_1',
        })
      ).status,
    ).toBe(409);
    expect((await choose(host.roomId, null, valid, 'GET')).status).toBe(405);
    expect(await storedRoom(host.roomId)).toEqual(before);
  });
  it('broadcasts authenticated presence after joining and disconnecting without sending credentials', async () => {
    const host = await newRoom();
    const a = await connect(host.roomId);
    await a.hello(host.credentials);
    await a.ping();
    const guest = await joinRoom(host.roomId);
    await a.ping();
    expect(
      [...a.messages]
        .reverse()
        .find((message) => message.type === 'ROOM_PRESENCE'),
    ).toMatchObject({
      players: [
        { playerId: host.credentials.playerId, connected: true },
        { playerId: guest.credentials.playerId, connected: false },
      ],
    });
    const b = await connect(host.roomId);
    await b.hello(guest.credentials);
    await b.ping();
    await a.ping();
    expect(
      [...a.messages]
        .reverse()
        .find((message) => message.type === 'ROOM_PRESENCE'),
    ).toMatchObject({ players: [{ connected: true }, { connected: true }] });
    const disconnected = a.next(
      (message) =>
        message.type === 'ROOM_PRESENCE' &&
        message.players.some(
          (player) =>
            player.playerId === guest.credentials.playerId && !player.connected,
        ),
    );
    b.socket.close(1000, 'Leave');
    await disconnected;
    expect(
      JSON.stringify(
        a.messages.filter((message) => message.type === 'ROOM_PRESENCE'),
      ),
    ).not.toContain('resumeToken');
    a.socket.close();
  });
});

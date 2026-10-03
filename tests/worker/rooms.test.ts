import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { freshDatabase, seedDatabase } from './database-helpers';
import { exports } from 'cloudflare:workers';
import { evictDurableObject, runInDurableObject } from 'cloudflare:test';
import { GameRoom } from '../../worker/durable/game-room';
import { roomMetadataSchema } from '../../src/protocol/rooms';
import {
  newRoom,
  joinRoom,
  roomApi,
  connect,
  storedRoom,
  stubFor,
  latestPublic,
  latestPrivate,
  sendCommand,
} from './room-helpers';
import type { RoomClient } from './room-helpers';

const clients: RoomClient[] = [];
beforeEach(async () => {
  await freshDatabase();
  await seedDatabase();
});
async function client(roomId: string) {
  const peer = await connect(roomId);
  clients.push(peer);
  return peer;
}
afterEach(async () => {
  const peers = clients.splice(0);
  await Promise.all(
    peers.map(
      (peer) =>
        new Promise<void>((resolve) => {
          if (peer.socket.readyState === WebSocket.CLOSED) {
            resolve();
            return;
          }
          peer.socket.addEventListener('close', () => resolve(), {
            once: true,
          });
          peer.socket.close(1000, 'Test finished');
        }),
    ),
  );
});
async function twoPlayers() {
  const host = await newRoom();
  const guest = await joinRoom(host.roomId);
  const a = await client(host.roomId),
    b = await client(host.roomId);
  await a.hello(host.credentials);
  await b.hello(guest.credentials);
  return { host, guest, a, b };
}
async function playing() {
  const setup = await twoPlayers();
  expect((await sendCommand(setup.a, 'START_MATCH')).result.type).toBe(
    'COMMAND_ACCEPTED',
  );
  await setup.b.ping();
  return setup;
}
describe('authoritative room HTTP and storage', () => {
  it('creates an opaque room with only its host and stores hashed credentials', async () => {
    const room = await newRoom('  Host  ');
    expect(room.roomId).toMatch(/^room_[a-f0-9]{32}$/);
    expect(room.view).toMatchObject({
      lifecycle: 'LOBBY',
      matchId: null,
      version: 0,
    });
    expect(room.view.players).toHaveLength(1);
    expect(room.view.players[0]).toMatchObject({
      seat: 0,
      displayName: 'Host',
      handCount: 0,
    });
    const stored = await storedRoom(room.roomId);
    expect(stored.players[0]!.tokenHash).not.toBe(room.credentials.resumeToken);
    expect(JSON.stringify(stored)).not.toContain(room.credentials.resumeToken);
  });
  it('joins two players to the same room and isolates a different room', async () => {
    const room = await newRoom();
    const joined = await joinRoom(room.roomId);
    const other = await newRoom();
    const metadata = roomMetadataSchema.parse(
      await (await roomApi(`/${room.roomId}`)).json(),
    );
    expect(metadata.view.players).toHaveLength(2);
    expect(joined.credentials.playerId).not.toBe(room.credentials.playerId);
    expect(joined.view.players[1]!.seat).toBe(1);
    expect((await storedRoom(other.roomId)).players).toHaveLength(1);
    expect(other.roomId).not.toBe(room.roomId);
  });
  it('assigns all four seats server-side and rejects a fifth player or a client-assigned seat', async () => {
    const room = await newRoom();
    for (let i = 1; i < 4; i++) await joinRoom(room.roomId, `Player ${i}`);
    expect(
      (await roomApi(`/${room.roomId}/join`, { displayName: 'Fifth' })).status,
    ).toBe(409);
    const second = await newRoom();
    expect(
      (
        await roomApi(`/${second.roomId}/join`, {
          displayName: 'Intruder',
          seat: 0,
        })
      ).status,
    ).toBe(400);
    expect((await storedRoom(second.roomId)).players).toHaveLength(1);
  });
  it.each(['', ' ', 'x'.repeat(81)])(
    'rejects malformed room names %s',
    async (displayName) => {
      expect((await roomApi('', { displayName })).status).toBe(400);
    },
  );
  it('rejects invalid JSON, content type, large requests, cross-origin requests, methods, and unknown rooms', async () => {
    for (const init of [
      { method: 'POST', body: '{}' },
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      },
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: 'x'.repeat(65_537) }),
      },
    ])
      expect(
        (await exports.default.fetch('https://example.com/api/rooms', init))
          .status,
      ).toBe(400);
    expect(
      (
        await exports.default.fetch('https://example.com/api/rooms', {
          headers: { Origin: 'https://evil.example' },
        })
      ).status,
    ).toBe(403);
    expect((await roomApi('')).headers.get('allow')).toBe('POST');
    expect((await roomApi('/room_missing')).status).toBe(404);
    expect((await roomApi('/bad-room')).status).toBe(404);
    expect((await roomApi('/room_missing/nothing')).status).toBe(404);
    const room = await newRoom();
    expect((await roomApi(`/${room.roomId}/join`)).headers.get('allow')).toBe(
      'POST',
    );
    expect((await roomApi(`/${room.roomId}/ws`)).status).toBe(426);
    expect(
      (await roomApi(`/${room.roomId}`, {}, 'POST')).headers.get('allow'),
    ).toBe('GET');
  });
  it('rejects direct object recreation or mismatched public room identity', async () => {
    const room = await newRoom();
    const stub = stubFor(room.roomId);
    expect(
      (
        await stub.fetch('https://room/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: room.roomId,
            displayName: 'Replacement',
          }),
        })
      ).status,
    ).toBe(409);
    const absent = stubFor('room_uninitialized');
    for (const body of [
      '{',
      JSON.stringify({ roomId: 'room_different', displayName: 'Host' }),
    ])
      expect(
        (
          await absent.fetch('https://room/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
          })
        ).status,
      ).toBe(400);
    expect((await stub.fetch('https://room/unknown')).status).toBe(404);
  });
});
describe('real hibernatable WebSocket authentication and engine dispatch', () => {
  it('bounds pending connections without changing seat ownership or room state', async () => {
    const room = await newRoom();
    for (let i = 0; i < 16; i += 1) await client(room.roomId);
    const response = await exports.default.fetch(
      `https://example.com/api/rooms/${room.roomId}/ws`,
      { headers: { Upgrade: 'websocket' } },
    );
    expect(response.status).toBe(429);
    expect((await storedRoom(room.roomId)).players).toHaveLength(1);
  });
  it('requires HELLO before commands or heartbeat and rejects malformed text/binary frames safely', async () => {
    const room = await newRoom();
    const peer = await client(room.roomId);
    for (const frame of [
      '{',
      'null',
      JSON.stringify({ type: 'PING', nonce: 'x', actorId: 'player_fake' }),
      'x'.repeat(65_537),
      '中'.repeat(30_000),
      new ArrayBuffer(1),
    ]) {
      const rejected = peer.next(
        (message) => message.type === 'COMMAND_REJECTED',
      );
      peer.socket.send(frame);
      expect(await rejected).toMatchObject({
        code: 'INVALID_COMMAND',
        stateVersion: 0,
      });
    }
    for (const message of [
      { type: 'PING', nonce: 'x' },
      {
        type: 'COMMAND',
        command: {
          type: 'START_MATCH',
          roomId: room.roomId,
          commandId: 'command_before',
          expectedStateVersion: 0,
        },
      },
    ]) {
      const rejected = peer.next(
        (message) => message.type === 'COMMAND_REJECTED',
      );
      peer.send(message);
      expect(await rejected).toMatchObject({ code: 'AUTH_REQUIRED' });
    }
    expect((await storedRoom(room.roomId)).version).toBe(0);
  });
  it('binds tokens to exactly one room and seat and rejects identity switching on an authenticated socket', async () => {
    const { host, guest, a, b } = await twoPlayers();
    const other = await newRoom();
    const stranger = await client(host.roomId);
    for (const credentials of [
      { ...guest.credentials, resumeToken: host.credentials.resumeToken },
      { ...host.credentials, resumeToken: '0'.repeat(64) },
      { ...host.credentials, playerId: 'player_missing' },
      { ...host.credentials, roomId: other.roomId },
    ]) {
      const rejected = stranger.next(
        (message) => message.type === 'COMMAND_REJECTED',
      );
      stranger.send({ type: 'HELLO', ...credentials });
      expect(await rejected).toMatchObject({ code: 'INVALID_SESSION' });
    }
    const rejected = a.next((message) => message.type === 'COMMAND_REJECTED');
    a.send({ type: 'HELLO', ...guest.credentials });
    expect(await rejected).toMatchObject({ code: 'INVALID_SESSION' });
    await b.ping();
    expect((await storedRoom(host.roomId)).players).toHaveLength(2);
  });
  it('requires at least two players, a host, and the current version to start', async () => {
    const host = await newRoom();
    const a = await client(host.roomId);
    await a.hello(host.credentials);
    expect((await sendCommand(a, 'START_MATCH')).result).toMatchObject({
      code: 'NOT_ENOUGH_PLAYERS',
    });
    const guest = await joinRoom(host.roomId);
    await a.ping();
    const b = await client(host.roomId);
    await b.hello(guest.credentials);
    expect((await sendCommand(b, 'START_MATCH')).result).toMatchObject({
      code: 'NOT_ALLOWED',
    });
    expect(
      (await sendCommand(a, 'START_MATCH', { expectedStateVersion: 0 })).result,
    ).toMatchObject({ code: 'VERSION_CONFLICT' });
    expect((await storedRoom(host.roomId)).game).toBeNull();
    expect((await sendCommand(a, 'SKIP_ACTION')).result).toMatchObject({
      code: 'NOT_ALLOWED',
    });
  });
  it('starts the engine, broadcasts equal public views, and unicasts each player only their own hand', async () => {
    const { host, a, b } = await playing();
    const record = await storedRoom(host.roomId);
    expect(latestPublic(a)).toEqual(latestPublic(b));
    expect(latestPublic(a)).toMatchObject({
      version: 2,
      lifecycle: 'PLAYING',
      phase: 'DISCARD_DRAW',
    });
    expect(latestPrivate(a).hand).toHaveLength(7);
    expect(latestPrivate(b).hand).toHaveLength(7);
    for (const card of record.game!.players[0]!.hand)
      expect(JSON.stringify(b.messages)).not.toContain(JSON.stringify(card));
    for (const card of record.game!.players[1]!.hand)
      expect(JSON.stringify(a.messages)).not.toContain(JSON.stringify(card));
    for (const peer of [a, b]) {
      expect(JSON.stringify(peer.messages)).not.toContain('cardIds');
      expect(JSON.stringify(peer.messages)).not.toContain('rng');
      expect(JSON.stringify(peer.messages)).not.toContain('tokenHash');
      expect(JSON.stringify(peer.messages)).not.toContain('acceptedCommands');
    }
    expect(
      (await roomApi(`/${host.roomId}/join`, { displayName: 'Late' })).status,
    ).toBe(409);
  });
  it('changes only the affected private view while all connected players receive the accepted public state', async () => {
    const { a, b } = await playing();
    const aCount = a.messages.filter(
      (message) => message.type === 'PRIVATE_STATE',
    ).length;
    const bCount = b.messages.filter(
      (message) => message.type === 'PRIVATE_STATE',
    ).length;
    const cardId = latestPrivate(a).hand[0]!.id;
    expect(
      (await sendCommand(a, 'DISCARD', { cardIds: [cardId] })).result.type,
    ).toBe('COMMAND_ACCEPTED');
    await b.ping();
    expect(latestPublic(a)).toEqual(latestPublic(b));
    expect(latestPublic(a).phase).toBe('ACTION');
    expect(
      a.messages.filter((message) => message.type === 'PRIVATE_STATE'),
    ).toHaveLength(aCount + 1);
    expect(
      b.messages.filter((message) => message.type === 'PRIVATE_STATE'),
    ).toHaveLength(bCount);
  });
  it('rejects invalid command context, hidden-stat input, foreign room, reserved joins, and foreign card ownership without mutation', async () => {
    const { host, a, b } = await playing();
    const before = await storedRoom(host.roomId);
    for (const [peer, type, fields, code] of [
      [a, 'SKIP_ACTION', {}, 'NOT_ALLOWED'],
      [a, 'DISCARD', { cardIds: [], gold: 999 }, 'INVALID_COMMAND'],
      [a, 'DISCARD', { cardIds: [], roomId: 'room_elsewhere' }, 'NOT_ALLOWED'],
      [
        a,
        'JOIN_ROOM',
        { displayName: 'Other', expectedStateVersion: undefined },
        'NOT_ALLOWED',
      ],
      [
        b,
        'DISCARD',
        { cardIds: [latestPrivate(a).hand[0]!.id] },
        'NOT_ALLOWED',
      ],
    ] as const)
      expect((await sendCommand(peer, type, fields)).result).toMatchObject({
        code,
      });
    expect(await storedRoom(host.roomId)).toEqual(before);
  });
  it('rejects stale versions with fresh public and private snapshots', async () => {
    const { a } = await playing();
    const count = a.messages.filter(
      (message) => message.type === 'PRIVATE_STATE',
    ).length;
    expect(
      (
        await sendCommand(a, 'DISCARD', {
          cardIds: [],
          expectedStateVersion: 1,
        })
      ).result,
    ).toMatchObject({ code: 'VERSION_CONFLICT', stateVersion: 2 });
    expect(latestPrivate(a).version).toBe(2);
    expect(
      a.messages.filter((message) => message.type === 'PRIVATE_STATE'),
    ).toHaveLength(count + 1);
    expect(latestPublic(a).phase).toBe('DISCARD_DRAW');
  });
  it('serializes concurrent-looking duplicate submissions and persists a single event batch', async () => {
    const { host, a } = await playing();
    const command = {
      type: 'DISCARD',
      roomId: host.roomId,
      commandId: 'command_duplicate',
      expectedStateVersion: 2,
      cardIds: [],
    };
    const accepted = a.next((message) => message.type === 'COMMAND_ACCEPTED');
    a.send({ type: 'COMMAND', command });
    a.send({ type: 'COMMAND', command });
    await accepted;
    await a.ping();
    expect(
      a.messages.filter(
        (message) =>
          message.type === 'COMMAND_ACCEPTED' &&
          message.commandId === 'command_duplicate',
      ),
    ).toHaveLength(2);
    expect((await storedRoom(host.roomId)).version).toBe(3);
    await runInDurableObject(stubFor(host.roomId), async (_instance, ctx) => {
      expect((await ctx.storage.list({ prefix: 'events:' })).size).toBe(2);
    });
    expect(
      (
        await sendCommand(a, 'DISCARD', {
          commandId: 'command_duplicate',
          cardIds: [latestPrivate(a).hand[0]!.id],
          expectedStateVersion: 2,
        })
      ).result,
    ).toMatchObject({ code: 'NOT_ALLOWED', reason: 'COMMAND_ID_CONFLICT' });
  });
  it('restores state and socket attachments after actual eviction and accepts reconnect retries idempotently', async () => {
    const { host, a, b } = await playing();
    const accepted = await sendCommand(a, 'DISCARD', { cardIds: [] });
    const before = await storedRoom(host.roomId);
    await evictDurableObject(stubFor(host.roomId));
    await a.ping();
    await b.ping();
    expect(await storedRoom(host.roomId)).toEqual(before);
    const resumed = await client(host.roomId);
    await resumed.hello(host.credentials);
    expect(latestPublic(resumed)).toEqual(latestPublic(a));
    expect(latestPrivate(resumed)).toEqual({ ...latestPrivate(a), version: 3 });
    const ack = resumed.next((message) => message.type === 'COMMAND_ACCEPTED');
    resumed.send({ type: 'COMMAND', command: accepted.command });
    expect(await ack).toMatchObject({ stateVersion: 3 });
    await resumed.ping();
    expect((await storedRoom(host.roomId)).version).toBe(3);
  });
  it('cleans closed session metadata while retaining the seat and its reconnect credential', async () => {
    const { host, a } = await twoPlayers();
    const close = new Promise<void>((resolve) =>
      a.socket.addEventListener('close', () => resolve(), { once: true }),
    );
    a.socket.close(1000, 'Leaving');
    await close;
    const record = await storedRoom(host.roomId);
    expect(record.players[0]!.activeSessionId).toBeNull();
    expect(record.players).toHaveLength(2);
    const reconnect = await client(host.roomId);
    await reconnect.hello(host.credentials);
    expect(latestPublic(reconnect).players).toHaveLength(2);
  });
  it('cleans an errored connection through the hibernation error handler', async () => {
    const { host, a } = await twoPlayers();
    await runInDurableObject(
      stubFor(host.roomId),
      async (instance: GameRoom, ctx) => {
        const ws = ctx
          .getWebSockets()
          .find(
            (ws) =>
              ws.deserializeAttachment()?.playerId ===
              host.credentials.playerId,
          )!;
        await instance.webSocketError(ws);
      },
    );
    expect(
      (await storedRoom(host.roomId)).players[0]!.activeSessionId,
    ).toBeNull();
    expect(
      a.messages.some((message) => message.type === 'SESSION_ACCEPTED'),
    ).toBe(true);
  });
});

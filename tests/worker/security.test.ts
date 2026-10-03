import { env, exports } from 'cloudflare:workers';
import { runInDurableObject, evictDurableObject } from 'cloudflare:test';
import { beforeEach, expect, it } from 'vitest';
import { freshDatabase, seedDatabase } from './database-helpers';
import {
  connect,
  newRoom,
  joinRoom,
  stubFor,
  storedRoom,
} from './room-helpers';
import { commandBudget, socketBudget } from '../../worker/durable/abuse';
import { requestJson } from '../../worker/http';
import { securityHeaders } from '../../worker/security';

beforeEach(async () => {
  await freshDatabase();
  await seedDatabase();
});
const close = (peer: Awaited<ReturnType<typeof connect>>) =>
  peer.socket.close(1000, 'Done');
async function stableNativeRateLimitWindow() {
  // Miniflare's actual binding uses epoch-aligned minute buckets, outside Vitest's clock.
  // Leave enough real time for exact-quota assertions under coverage instrumentation.
  const remaining = 60_000 - (Date.now() % 60_000);
  if (remaining < 10_000)
    await new Promise((resolve) => setTimeout(resolve, remaining + 20));
}
it('serves safe headers on success, errors and disables every debug/admin history route', async () => {
  for (const path of [
    '/api/health',
    '/api/debug',
    '/api/admin',
    '/api/replay',
    '/api/rooms/room_private/replay',
  ]) {
    const response = await exports.default.fetch(`https://example.com${path}`);
    for (const [name, value] of Object.entries(securityHeaders))
      expect(response.headers.get(name)).toBe(value);
    if (path !== '/api/health') expect(response.status).toBe(404);
    expect(await response.text()).not.toMatch(
      /tokenHash|resumeToken|deckOrder|manifest|snapshot/,
    );
  }
});
it(
  'throttles create spam using the actual Cloudflare binding and isolates another address',
  { timeout: 20_000 },
  async () => {
    await stableNativeRateLimitWindow();
    const ip = crypto.randomUUID();
    for (let i = 0; i < 20; i++) {
      const response = await exports.default.fetch(
        'https://example.com/api/rooms',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'CF-Connecting-IP': ip,
          },
          body: '{}',
        },
      );
      expect(response.status).toBe(400);
    }
    const denied = await exports.default.fetch(
      'https://example.com/api/rooms',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'CF-Connecting-IP': ip },
        body: '{}',
      },
    );
    expect(denied.status).toBe(429);
    expect(denied.headers.get('retry-after')).toBe('60');
    expect(await denied.json()).toEqual({
      ok: false,
      error: { code: 'RATE_LIMITED' },
    });
    const other = await env.CREATE_LIMIT.limit({ key: 'CREATE:other-address' });
    expect(other.success).toBe(true);
  },
);
it.each(['join', 'ws', 'character'])(
  'throttles %s attempts before dispatch, including unknown rooms',
  { timeout: 20_000 },
  async (action) => {
    await stableNativeRateLimitWindow();
    const ip = crypto.randomUUID();
    const method =
      action === 'join' ? 'POST' : action === 'character' ? 'PATCH' : 'GET';
    for (let i = 0; i < 60; i++)
      expect(
        (
          await exports.default.fetch(
            `https://example.com/api/rooms/room_missing/${action}`,
            { method, headers: { 'CF-Connecting-IP': ip } },
          )
        ).status,
      ).toBe(404);
    expect(
      (
        await exports.default.fetch(
          `https://example.com/api/rooms/room_missing/${action}`,
          { method, headers: { 'CF-Connecting-IP': ip } },
        )
      ).status,
    ).toBe(429);
  },
);
it('enforces exact same-origin requests and upgrades without trusting forwarded origins', async () => {
  const room = await newRoom();
  for (const origin of [
    'null',
    'https://evil.example',
    'https://example.com.evil.example',
  ]) {
    const response = await exports.default.fetch(
      `https://example.com/api/rooms/${room.roomId}/ws`,
      {
        headers: {
          Upgrade: 'websocket',
          Origin: origin,
          'X-Forwarded-Host': 'example.com',
        },
      },
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      ok: false,
      error: { code: 'ORIGIN_NOT_ALLOWED' },
    });
  }
});
it('closes repeated malformed and oversized socket messages without changing game state', async () => {
  const room = await newRoom();
  const peer = await connect(room.roomId);
  const before = await storedRoom(room.roomId);
  const closed = new Promise<number>((resolve) =>
    peer.socket.addEventListener('close', (event) => resolve(event.code), {
      once: true,
    }),
  );
  for (let i = 0; i < 8; i++) {
    const rejected = peer.next(
      (message) => message.type === 'COMMAND_REJECTED',
    );
    peer.socket.send(i === 0 ? 'x'.repeat(65_537) : '{');
    expect(await rejected).toMatchObject({ code: 'INVALID_COMMAND' });
  }
  expect(await closed).toBe(1008);
  expect(await storedRoom(room.roomId)).toEqual(before);
});
it('persists the seat command throttle across reconnect and eviction', async () => {
  const room = await newRoom();
  await joinRoom(room.roomId);
  const peer = await connect(room.roomId);
  await peer.hello(room.credentials);
  await runInDurableObject(stubFor(room.roomId), async (_instance, ctx) => {
    await ctx.storage.put(`abuse:command:${room.credentials.playerId}`, {
      since: Date.now(),
      count: 60,
    });
  });
  await evictDurableObject(stubFor(room.roomId));
  const before = await storedRoom(room.roomId);
  const first = peer.next((message) => message.type === 'COMMAND_REJECTED');
  peer.send({
    type: 'COMMAND',
    command: {
      type: 'START_MATCH',
      roomId: room.roomId,
      commandId: 'command_flood_first',
      expectedStateVersion: before.version,
    },
  });
  expect(await first).toMatchObject({
    code: 'RATE_LIMITED',
  });
  const resumed = await connect(room.roomId);
  await resumed.hello(room.credentials);
  const second = resumed.next((message) => message.type === 'COMMAND_REJECTED');
  resumed.send({
    type: 'COMMAND',
    command: {
      type: 'START_MATCH',
      roomId: room.roomId,
      commandId: 'command_flood_second',
      expectedStateVersion: before.version,
    },
  });
  expect(await second).toMatchObject({
    code: 'RATE_LIMITED',
  });
  expect((await storedRoom(room.roomId)).game).toBe(before.game);
  close(peer);
  close(resumed);
});
it('limits socket message floods while preserving the authenticated seat and state', async () => {
  const room = await newRoom();
  const peer = await connect(room.roomId);
  await peer.hello(room.credentials);
  await runInDurableObject(stubFor(room.roomId), async (_instance, ctx) => {
    const socket = ctx.getWebSockets()[0]!;
    socket.serializeAttachment({
      ...(socket.deserializeAttachment() as object),
      abuse: { since: Date.now(), frames: 240, malformed: 0 },
    });
  });
  const rejected = peer.next((message) => message.type === 'COMMAND_REJECTED');
  peer.send({ type: 'PING', nonce: 'flood' });
  expect(await rejected).toMatchObject({ code: 'RATE_LIMITED' });
  expect((await storedRoom(room.roomId)).version).toBe(0);
  close(peer);
});
it('resets bounded transport budgets only after the interval and tolerates an older attachment', () => {
  expect(commandBudget(undefined, 100)).toEqual({ since: 100, count: 1 });
  expect(commandBudget({ since: 100, count: 60 }, 101)).toEqual({
    since: 100,
    count: 61,
  });
  expect(commandBudget({ since: 100, count: 60 }, 10100)).toEqual({
    since: 10100,
    count: 1,
  });
  expect(commandBudget({ since: 100, count: 60 }, 50)).toEqual({
    since: 50,
    count: 1,
  });
  expect(socketBudget(null, 100)).toEqual({
    since: 100,
    frames: 1,
    malformed: 0,
  });
  expect(
    socketBudget({ since: 100, frames: 1, malformed: 1 }, 101, true),
  ).toEqual({ since: 100, frames: 1, malformed: 2 });
  expect(
    socketBudget({ since: 100, frames: 240, malformed: 7 }, 10100),
  ).toEqual({ since: 10100, frames: 1, malformed: 0 });
  expect(socketBudget({ since: 100, frames: 240, malformed: 7 }, 50)).toEqual({
    since: 50,
    frames: 1,
    malformed: 0,
  });
});
it('bounds streamed HTTP bytes before parsing and rejects false content types and missing bodies', async () => {
  const json = new Request('https://example.com', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: '{"displayName":"A"}',
  });
  expect(await requestJson(json)).toEqual({ displayName: 'A' });
  for (const request of [
    new Request('https://example.com', {
      method: 'POST',
      headers: { 'content-type': 'application/jsonp' },
      body: '{}',
    }),
    new Request('https://example.com', {
      headers: { 'content-type': 'application/json' },
    }),
    new Request('https://example.com', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': '65537',
      },
      body: '{}',
    }),
    new Request('https://example.com', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'x'.repeat(65537),
    }),
    new Request('https://example.com', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: new Uint8Array([255]),
    }),
  ])
    await expect(requestJson(request)).rejects.toThrow();
});

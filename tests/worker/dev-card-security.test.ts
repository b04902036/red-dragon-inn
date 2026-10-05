import { env, exports } from 'cloudflare:workers';
import { runInDurableObject } from 'cloudflare:test';
import { beforeEach, expect, it } from 'vitest';
import { freshDatabase, seedDatabase } from './database-helpers';
import { roomJoinResponseSchema } from '../../src/protocol/rooms';
import {
  newRoom,
  joinRoom,
  connect,
  sendCommand,
  latestPrivate,
  storedRoom,
  stubFor,
} from './room-helpers';
import { ROOM_STORAGE_KEY } from '../../worker/durable/room-record';

beforeEach(async () => {
  await freshDatabase();
  await seedDatabase();
});
it('disabled runtime ignores localhost and refuses dev commands even on a previously saved development match', async () => {
  expect(env.DEV_CARD_SELECTION).toBe('false');
  const response = await exports.default.fetch('http://127.0.0.1/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName: 'Host' }),
  });
  const local = roomJoinResponseSchema.parse(await response.json());
  expect((await storedRoom(local.roomId)).devCardSelection).toBeUndefined();
  const host = await newRoom();
  await joinRoom(host.roomId);
  const a = await connect(host.roomId);
  try {
    await a.hello(host.credentials);
    await sendCommand(a, 'START_MATCH');
    const record = await storedRoom(host.roomId);
    await runInDurableObject(stubFor(host.roomId), async (_instance, ctx) => {
      await ctx.storage.put(ROOM_STORAGE_KEY, {
        ...record,
        game: {
          ...record.game!,
          rules: { ...record.game!.rules, devCardSelection: true },
        },
      });
    });
    const reconnect = await connect(host.roomId);
    try {
      await reconnect.hello(host.credentials);
      expect(latestPrivate(reconnect).devChoices).toBeUndefined();
      const before = (await storedRoom(host.roomId)).game;
      expect(
        (
          await sendCommand(reconnect, 'DEV_DISCARD_DRAW', {
            cardIds: [],
            definitionIds: [],
          })
        ).result.type,
      ).toBe('COMMAND_REJECTED');
      expect((await storedRoom(host.roomId)).game).toEqual(before);
    } finally {
      reconnect.socket.close();
    }
  } finally {
    a.socket.close();
  }
});

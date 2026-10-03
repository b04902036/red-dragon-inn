import { beforeEach, it, expect } from 'vitest';
import { evictDurableObject } from 'cloudflare:test';
import { freshDatabase, seedDatabase } from './database-helpers';
import {
  newRoom,
  joinRoom,
  connect,
  sendCommand,
  latestPublic,
  stubFor,
} from './room-helpers';
beforeEach(async () => {
  await freshDatabase();
  await seedDatabase();
});
it('preserves authoritative attention on stale resync and evicted-room reconnect, and changes it for a new phase', async () => {
  const host = await newRoom();
  await joinRoom(host.roomId);
  const client = await connect(host.roomId);
  await client.hello(host.credentials);
  await client.ping();
  await sendCommand(client, 'START_MATCH');
  const first = latestPublic(client).attention!;
  expect(first).toMatchObject({
    kind: 'TURN',
    playerId: host.credentials.playerId,
  });
  await sendCommand(client, 'DISCARD', { cardIds: [] });
  const next = latestPublic(client).attention!;
  expect(next.key).not.toBe(first.key);
  const rejected = client.next(
    (message) => message.type === 'COMMAND_REJECTED',
  );
  client.send({
    type: 'COMMAND',
    command: {
      type: 'SKIP_ACTION',
      commandId: 'command_attention_stale',
      roomId: host.roomId,
      expectedStateVersion: 0,
    },
  });
  await rejected;
  await client.ping();
  expect(latestPublic(client).attention).toEqual(next);
  client.socket.close();
  await evictDurableObject(stubFor(host.roomId));
  const resumed = await connect(host.roomId);
  await resumed.hello(host.credentials);
  await resumed.ping();
  expect(latestPublic(resumed).attention).toEqual(next);
  resumed.socket.close();
});

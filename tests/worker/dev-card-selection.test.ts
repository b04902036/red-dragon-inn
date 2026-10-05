import { env, exports } from 'cloudflare:workers';
import { beforeEach, expect, it } from 'vitest';
import { evictDurableObject, runInDurableObject } from 'cloudflare:test';
import { freshDatabase, seedDatabase } from './database-helpers';
import { roomJoinResponseSchema } from '../../src/protocol/rooms';
import { D1ReplayRepository } from '../../worker/repositories/replay';
import {
  newRoom,
  joinRoom,
  connect,
  sendCommand,
  latestPrivate,
  latestPublic,
  storedRoom,
  stubFor,
} from './room-helpers';
import { ROOM_STORAGE_KEY } from '../../worker/durable/room-record';

beforeEach(async () => {
  await freshDatabase();
  await seedDatabase();
});
async function localRoom() {
  const response = await exports.default.fetch('http://127.0.0.1/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName: 'Host' }),
  });
  expect(response.status).toBe(201);
  return roomJoinResponseSchema.parse(await response.json());
}
it('explicit development runtime enables local rooms, while remote URLs and client flags cannot enable it', async () => {
  expect(env.DEV_CARD_SELECTION).toBe('true');
  const remote = await newRoom();
  expect((await storedRoom(remote.roomId)).devCardSelection).toBeUndefined();
  const local = await localRoom();
  expect((await storedRoom(local.roomId)).devCardSelection).toBe(true);
  const forged = await exports.default.fetch('http://127.0.0.1/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName: 'Host', devCardSelection: true }),
  });
  expect(forged.status).toBe(400);
});
it('real socket chosen draws and orders persist, survive eviction and replay; invalid supply/actors cannot change state', async () => {
  const host = await localRoom();
  const guest = await joinRoom(host.roomId);
  const record = await storedRoom(host.roomId);
  await runInDurableObject(stubFor(host.roomId), async (_instance, ctx) => {
    await ctx.storage.put(ROOM_STORAGE_KEY, { ...record, seed: 1 });
  });
  const a = await connect(host.roomId),
    b = await connect(host.roomId);
  try {
    await a.hello(host.credentials);
    await b.hello(guest.credentials);
    await sendCommand(a, 'START_MATCH');
    await b.ping();
    expect(latestPrivate(a).devChoices).toBeDefined();
    const game = (await storedRoom(host.roomId)).game!;
    const discard = game.players[0]!.hand[0]!;
    const desired = game.cards[discard]!.definitionId;
    expect(
      (
        await sendCommand(b, 'DEV_DISCARD_DRAW', {
          cardIds: [],
          definitionIds: [],
        })
      ).result.type,
    ).toBe('COMMAND_REJECTED');
    expect(
      (
        await sendCommand(a, 'DEV_DISCARD_DRAW', {
          cardIds: [discard],
          definitionIds: ['carddef_missing'],
        })
      ).result.type,
    ).toBe('COMMAND_REJECTED');
    expect((await storedRoom(host.roomId)).game).toEqual(game);
    expect(
      (
        await sendCommand(a, 'DEV_DISCARD_DRAW', {
          cardIds: [discard],
          definitionIds: [desired],
        })
      ).result.type,
    ).toBe('COMMAND_ACCEPTED');
    expect(latestPrivate(a).hand.at(-1)!.definitionId).toBe(desired);
    const passGrace = async () => {
      for (let i = 0; i < 8; i++) {
        await a.ping();
        await b.ping();
        const view = latestPublic(a);
        if (!view.phaseEnd) return;
        await sendCommand(
          view.phaseEnd.priorityPlayerId === host.credentials.playerId ? a : b,
          'PASS_ANYTIME',
          { responseWindowId: view.phaseEnd.id },
        );
      }
      throw new Error('Grace did not close');
    };
    await passGrace();
    await sendCommand(a, 'SKIP_ACTION');
    await passGrace();
    const beforeOrder = (await storedRoom(host.roomId)).game!;
    const event = latestPrivate(a).devChoices!.innCards.find(
      (choice) =>
        beforeOrder.definitions[choice.definitionId]!.type === 'DRINK_EVENT',
    )!;
    expect(
      (
        await sendCommand(a, 'DEV_ORDER_DRINK', {
          definitionId: event.definitionId,
          targetPlayerId: guest.credentials.playerId,
        })
      ).result.type,
    ).toBe('COMMAND_ACCEPTED');
    const afterOrder = (await storedRoom(host.roomId)).game!;
    const ordered = afterOrder.players[1]!.drinkPile[0]!;
    expect(afterOrder.cards[ordered]!.definitionId).toBe(event.definitionId);
    expect(afterOrder.rng).toEqual(beforeOrder.rng);
    expect(JSON.stringify(latestPublic(a))).not.toContain(ordered);
    await evictDurableObject(stubFor(host.roomId));
    const resumed = await connect(host.roomId);
    try {
      await resumed.hello(host.credentials);
      expect(latestPrivate(resumed).devChoices).toEqual(
        latestPrivate(a).devChoices,
      );
      expect(
        (await new D1ReplayRepository(env.DB).restore(afterOrder.matchId, true))
          .state,
      ).toEqual(afterOrder);
    } finally {
      resumed.socket.close();
    }
  } finally {
    a.socket.close();
    b.socket.close();
  }
});

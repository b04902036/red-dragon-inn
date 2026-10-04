import { beforeEach, expect, it } from 'vitest';
import {
  runInDurableObject,
  runDurableObjectAlarm,
  evictDurableObject,
} from 'cloudflare:test';
import { freshDatabase, seedDatabase } from './database-helpers';
import {
  newRoom,
  joinRoom,
  connect,
  sendCommand,
  latestPrivate,
  latestPublic,
  stubFor,
  storedRoom,
} from './room-helpers';
import type { GameRoom } from '../../worker/durable/game-room';
beforeEach(async () => {
  await freshDatabase();
  await seedDatabase();
});
async function playing() {
  const host = await newRoom(),
    guest = await joinRoom(host.roomId),
    stub = stubFor(host.roomId);
  await clock(stub, Date.now() + 3600000);
  const a = await connect(host.roomId),
    b = await connect(host.roomId);
  await a.hello(host.credentials);
  await b.hello(guest.credentials);
  await sendCommand(a, 'START_MATCH');
  await b.ping();
  return { host, guest, a, b, stub };
}
async function clock(stub: ReturnType<typeof stubFor>, now: number) {
  await runInDurableObject(stub, (instance: GameRoom) => {
    (instance as unknown as { clock: { now(): number } }).clock = {
      now: () => now,
    };
  });
}
it('real WebSocket projections refresh private legality through phases, nested play, hibernation and reconnect without leakage', async () => {
  const { host, a, b, stub } = await playing();
  try {
    const before = latestPrivate(b);
    await sendCommand(a, 'DISCARD', { cardIds: [] });
    await b.ping();
    expect(latestPrivate(a).legalPlays).toHaveLength(1);
    expect(latestPrivate(b).legalPlays).toEqual([]);
    expect(latestPrivate(b).legalPlayVersion).toBe(latestPublic(b).version);
    expect(latestPrivate(b).hand).toEqual(before.hand);
    for (const peer of [a, b]) {
      await sendCommand(peer, 'PASS_ANYTIME', {
        responseWindowId: latestPublic(peer).phaseEnd!.id,
      });
      await a.ping();
      await b.ping();
    }
    const action = latestPrivate(a).legalPlays.find((p) => p.requiresTarget)!;
    expect(action.commandType).toBe('PLAY_CARD');
    expect(
      latestPrivate(b).legalPlays.every(
        (p) => p.commandType === 'PLAY_CARD' && !p.requiresTarget,
      ),
    ).toBe(true);
    await sendCommand(a, 'PLAY_CARD', {
      cardId: action.cardId,
      targetPlayerId: latestPublic(a).players[1]!.id,
    });
    await b.ping();
    const sourceWindow = latestPublic(a).responseWindow!.id;
    await sendCommand(a, 'PASS_RESPONSE', { responseWindowId: sourceWindow });
    await b.ping();
    expect(latestPrivate(a).legalPlays).toEqual([]);
    const ignore = latestPrivate(b).hand.find(
      (c) => c.definitionId === 'carddef_sample_ignore',
    )!;
    expect(
      latestPrivate(b).legalPlays.some((p) => p.cardId === ignore.id),
    ).toBe(true);
    await sendCommand(b, 'PLAY_RESPONSE', {
      cardId: ignore.id,
      responseWindowId: sourceWindow,
      promptId: latestPublic(b).timedPrompt!.promptId,
    });
    await a.ping();
    expect(latestPublic(a).responseWindow!.id).not.toBe(sourceWindow);
    expect(
      latestPrivate(b).legalPlays.some((p) => p.cardId === ignore.id),
    ).toBe(false);
    expect(
      latestPrivate(b).legalPlays.every(
        (p) => p.promptId === latestPublic(b).timedPrompt!.promptId,
      ),
    ).toBe(true);
    await evictDurableObject(stub);
    await a.ping();
    await b.ping();
    const resumed = await connect(host.roomId);
    try {
      await resumed.hello(host.credentials);
      expect(latestPrivate(resumed).legalPlays).toEqual(
        latestPrivate(a).legalPlays,
      );
      expect(latestPrivate(resumed).legalPlayVersion).toBe(
        latestPublic(resumed).version,
      );
    } finally {
      resumed.socket.close();
    }
    const record = (await storedRoom(host.roomId)).game!;
    for (const peer of [a, b]) {
      const owner = latestPrivate(peer).playerId;
      for (const play of latestPrivate(peer).legalPlays)
        expect(record.players.find((p) => p.id === owner)!.hand).toContain(
          play.cardId,
        );
      for (const other of record.players.filter((p) => p.id !== owner))
        for (const id of other.hand)
          expect(JSON.stringify(latestPrivate(peer))).not.toContain(
            JSON.stringify(id),
          );
      for (const message of peer.messages.filter(
        (m) => m.type === 'PUBLIC_STATE',
      ))
        expect(JSON.stringify(message)).not.toMatch(
          /legalPlays|legalPlayVersion|legalTargetPlayerIds/,
        );
    }
    expect(
      (
        await sendCommand(b, 'PLAY_CARD', {
          cardId: action.cardId,
          legalPlays: [action],
        })
      ).result,
    ).toMatchObject({ type: 'COMMAND_REJECTED', code: 'INVALID_COMMAND' });
  } finally {
    a.socket.close();
    b.socket.close();
  }
});
it('a real Durable Object timeout removes the old private highlights and refreshes both seats', async () => {
  const { host, a, b, stub } = await playing();
  try {
    await sendCommand(a, 'DISCARD', { cardIds: [] });
    await sendCommand(a, 'PASS_ANYTIME', {
      responseWindowId: latestPublic(a).phaseEnd!.id,
    });
    await b.ping();
    const prompt = latestPublic(b).timedPrompt!,
      old = latestPrivate(b).legalPlays;
    expect(old).toHaveLength(1);
    if (prompt.deadlineAt === null) throw new Error('Guest deadline missing');
    await clock(stub, prompt.deadlineAt);
    await runDurableObjectAlarm(stub);
    await a.ping();
    await b.ping();
    expect(latestPublic(a).phase).toBe('ACTION');
    expect(latestPrivate(b).responsePrompt).toBeNull();
    expect(
      latestPrivate(b).legalPlays.every(
        (play) => play.promptId !== prompt.promptId,
      ),
    ).toBe(true);
    for (const peer of [a, b])
      expect(latestPrivate(peer).legalPlayVersion).toBe(
        latestPublic(peer).version,
      );
    expect((await storedRoom(host.roomId)).game!.version).toBe(
      latestPublic(a).version,
    );
  } finally {
    a.socket.close();
    b.socket.close();
  }
});

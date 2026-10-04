import { beforeEach, expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import {
  runInDurableObject,
  runDurableObjectAlarm,
  evictDurableObject,
} from 'cloudflare:test';
import { freshDatabase, seedDatabase, sql } from './database-helpers';
import {
  newRoom,
  joinRoom,
  connect,
  sendCommand,
  latestPublic,
  latestPrivate,
  storedRoom,
  stubFor,
} from './room-helpers';
import { D1ReplayRepository } from '../../worker/repositories/replay';
import type { GameRoom } from '../../worker/durable/game-room';
beforeEach(async () => {
  await freshDatabase();
  await seedDatabase();
});
it('a failed timeout mirror retries the durable outbox without passing twice', async () => {
  const { host, a, b, stub } = await playing();
  try {
    const first = await guestGrace(a, b);
    if (first.deadlineAt === null) throw new Error('Guest deadline missing');
    await sql(
      "CREATE TRIGGER test_fail_timed_history BEFORE INSERT ON match_commands WHEN NEW.command_id LIKE 'command_system_%' BEGIN SELECT RAISE(FAIL,'temporary timeout mirror failure'); END",
    );
    await clock(stub, first.deadlineAt);
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    const committed = (await storedRoom(host.roomId)).game!;
    expect(committed.control.timedPrompt?.promptId).not.toBe(first.promptId);
    expect(
      await runInDurableObject(stub, (_instance, ctx) =>
        ctx.storage.get('history:outbox'),
      ),
    ).toBeDefined();
    expect(
      await runInDurableObject(stub, (_instance, ctx) =>
        ctx.storage.getAlarm(),
      ),
    ).toBe(first.deadlineAt + 1000);
    await sql('DROP TRIGGER test_fail_timed_history');
    await clock(stub, first.deadlineAt + 1000);
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    await a.ping();
    await b.ping();
    expect((await storedRoom(host.roomId)).game).toEqual(committed);
    expect(
      await runInDurableObject(stub, (_instance, ctx) =>
        ctx.storage.get('history:outbox'),
      ),
    ).toBeUndefined();
    const repository = new D1ReplayRepository(env.DB);
    expect(
      (await repository.commands(committed.matchId)).filter(
        (e) => e.command.type === 'EXPIRE_PROMPT',
      ),
    ).toHaveLength(1);
    expect((await repository.restore(committed.matchId, true)).state).toEqual(
      committed,
    );
  } finally {
    a.socket.close();
    b.socket.close();
  }
});
async function playing() {
  const host = await newRoom();
  const guest = await joinRoom(host.roomId);
  const a = await connect(host.roomId);
  const b = await connect(host.roomId);
  await a.hello(host.credentials);
  await b.hello(guest.credentials);
  await sendCommand(a, 'START_MATCH');
  await b.ping();
  return { host, guest, a, b, stub: stubFor(host.roomId) };
}
async function clock(stub: ReturnType<typeof stubFor>, now: number) {
  await runInDurableObject(stub, (instance: GameRoom) => {
    (instance as unknown as { clock: { now(): number } }).clock = {
      now: () => now,
    };
  });
}
async function guestGrace(
  a: Awaited<ReturnType<typeof connect>>,
  b: Awaited<ReturnType<typeof connect>>,
) {
  await sendCommand(a, 'DISCARD', { cardIds: [] });
  expect(latestPublic(a).timedPrompt?.deadlineAt).toBeNull();
  await sendCommand(a, 'PASS_ANYTIME', {
    responseWindowId: latestPublic(a).phaseEnd!.id,
  });
  await b.ping();
  return latestPublic(b).timedPrompt!;
}
it('untimed owner grace survives elapsed time, stale alarms, hibernation and reconnect until an explicit pass', async () => {
  const { host, a, b, stub } = await playing();
  try {
    await sendCommand(a, 'DISCARD', { cardIds: [] });
    const first = latestPublic(a).timedPrompt!;
    expect(first.deadlineAt).toBeNull();
    expect(latestPrivate(a).legalPlays).toHaveLength(1);
    expect(
      await runInDurableObject(stub, (_instance, ctx) =>
        ctx.storage.getAlarm(),
      ),
    ).toBeNull();
    await clock(stub, first.openedAt + 60000);
    await runInDurableObject(stub, (_instance, ctx) =>
      ctx.storage.setAlarm(first.openedAt + 60000),
    );
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    expect((await storedRoom(host.roomId)).game!.control.timedPrompt).toEqual(
      first,
    );
    await evictDurableObject(stub);
    await clock(stub, first.openedAt + 60000);
    const resumed = await connect(host.roomId);
    await resumed.hello(host.credentials);
    expect(latestPrivate(resumed).responsePrompt).toMatchObject({
      promptId: first.promptId,
      deadlineAt: null,
    });
    expect(latestPrivate(resumed).legalPlays).toHaveLength(1);
    await sendCommand(resumed, 'PASS_ANYTIME', {
      responseWindowId: first.windowId,
      promptId: first.promptId,
    });
    await b.ping();
    const next = latestPublic(b).timedPrompt!;
    expect(next.priorityPlayerId).not.toBe(host.credentials.playerId);
    expect(next.deadlineAt).toBe(next.openedAt + 15000);
    const game = (await storedRoom(host.roomId)).game!;
    expect(
      (await new D1ReplayRepository(env.DB).restore(game.matchId, true)).state,
    ).toEqual(game);
    resumed.socket.close();
  } finally {
    a.socket.close();
    b.socket.close();
  }
});

it('the owner retains legal source responses after 30 seconds and passing starts a guest deadline', async () => {
  const { host, a, b, stub } = await playing();
  try {
    await guestGrace(a, b);
    await sendCommand(b, 'PASS_ANYTIME', {
      responseWindowId: latestPublic(b).phaseEnd!.id,
    });
    await a.ping();
    const attack = latestPrivate(a).hand.find(
      (card) => card.definitionId === 'carddef_sample_shove',
    )!;
    const target = latestPublic(a).players.find(
      (p) => p.id !== host.credentials.playerId,
    )!;
    await sendCommand(a, 'PLAY_CARD', {
      cardId: attack.id,
      targetPlayerId: target.id,
    });
    const first = latestPublic(a).timedPrompt!;
    expect(first.kind).toBe('RESPONSE_DECISION');
    expect(first.deadlineAt).toBeNull();
    await clock(stub, first.openedAt + 60000);
    await a.ping();
    expect(latestPublic(a).timedPrompt).toEqual(first);
    expect(latestPrivate(a).legalPlays.length).toBeGreaterThan(0);
    await sendCommand(a, 'PASS_RESPONSE', {
      responseWindowId: first.windowId,
      promptId: first.promptId,
    });
    await b.ping();
    const next = latestPublic(b).timedPrompt!;
    expect(next.deadlineAt).toBe(next.openedAt + 30000);
    expect(
      await runInDurableObject(stub, (_instance, ctx) =>
        ctx.storage.getAlarm(),
      ),
    ).toBe(next.deadlineAt);
  } finally {
    a.socket.close();
    b.socket.close();
  }
});
it('persists alarm/deadline and prompt identity across hibernation and reconnect without extension', async () => {
  const { host, guest, a, b, stub } = await playing();
  try {
    const first = await guestGrace(a, b);
    if (first.deadlineAt === null) throw new Error('Guest deadline missing');
    expect(first.kind).toBe('PHASE_END_ANYTIME');
    expect(first.deadlineAt - first.openedAt).toBe(15000);
    expect(
      await runInDurableObject(stub, (_instance, ctx) =>
        ctx.storage.getAlarm(),
      ),
    ).toBe(first.deadlineAt);
    await evictDurableObject(stub);
    await a.ping();
    await b.ping();
    expect((await storedRoom(host.roomId)).game!.control.timedPrompt).toEqual(
      first,
    );
    const resumed = await connect(host.roomId);
    await resumed.hello(guest.credentials);
    expect(latestPublic(resumed).timedPrompt).toEqual(first);
    expect(latestPrivate(resumed).responsePrompt?.promptId).toBe(
      first.promptId,
    );
    resumed.socket.close();
  } finally {
    a.socket.close();
    b.socket.close();
  }
});
it('alarm auto-passes once, stale/early alarms preserve newer prompts, and timeout history replays through real D1', async () => {
  const { host, a, b, stub } = await playing();
  try {
    const first = await guestGrace(a, b);
    if (first.deadlineAt === null) throw new Error('Guest deadline missing');
    await clock(stub, first.deadlineAt - 1);
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    expect((await storedRoom(host.roomId)).game!.control.timedPrompt).toEqual(
      first,
    );
    await clock(stub, first.deadlineAt);
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    await a.ping();
    await b.ping();
    expect(latestPublic(a)).toEqual(latestPublic(b));
    const current = latestPublic(a).timedPrompt;
    expect(current).toBeNull();
    expect(latestPublic(a).phase).toBe('ACTION');
    expect(await runDurableObjectAlarm(stub)).toBe(false);
    expect((await storedRoom(host.roomId)).game!.control.timedPrompt).toEqual(
      current,
    );
    const game = (await storedRoom(host.roomId)).game!;
    const repository = new D1ReplayRepository(env.DB);
    const history = await repository.commands(game.matchId);
    expect(
      history.filter((e) => e.command.type === 'EXPIRE_PROMPT'),
    ).toHaveLength(1);
    expect((await repository.restore(game.matchId, true)).state).toEqual(game);
    expect((await repository.restore(game.matchId)).state).toEqual(game);
  } finally {
    a.socket.close();
    b.socket.close();
  }
});
it('expired reconnect advances first and rejects the old priority command before it can win', async () => {
  const { host, guest, a, b, stub } = await playing();
  try {
    const first = await guestGrace(a, b);
    if (first.deadlineAt === null) throw new Error('Guest deadline missing');
    await clock(stub, first.deadlineAt + 1);
    const resumed = await connect(host.roomId);
    await resumed.hello(guest.credentials);
    expect(latestPublic(resumed).timedPrompt?.promptId).not.toBe(
      first.promptId,
    );
    expect(
      (
        await sendCommand(resumed, 'PASS_ANYTIME', {
          responseWindowId: first.windowId,
        })
      ).result.type,
    ).toBe('COMMAND_REJECTED');
    const game = (await storedRoom(host.roomId)).game!;
    expect(game.phase).toBe('ACTION');
    expect(game.control.phaseEnd).toBeNull();
    resumed.socket.close();
  } finally {
    a.socket.close();
    b.socket.close();
  }
});

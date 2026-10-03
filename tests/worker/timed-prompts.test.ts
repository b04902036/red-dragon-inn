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
    await sendCommand(a, 'DISCARD', { cardIds: [] });
    await b.ping();
    const first = latestPublic(a).timedPrompt!;
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
it('persists alarm/deadline and prompt identity across hibernation and reconnect without extension', async () => {
  const { host, a, b, stub } = await playing();
  try {
    await sendCommand(a, 'DISCARD', { cardIds: [] });
    await b.ping();
    const first = latestPublic(a).timedPrompt!;
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
    await resumed.hello(host.credentials);
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
    await sendCommand(a, 'DISCARD', { cardIds: [] });
    await b.ping();
    const first = latestPublic(a).timedPrompt!;
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
    const current = latestPublic(a).timedPrompt!;
    expect(current.promptId).not.toBe(first.promptId);
    expect(current.priorityPlayerId).not.toBe(first.priorityPlayerId);
    expect(current.deadlineAt).toBe(first.deadlineAt + 15000);
    expect(await runDurableObjectAlarm(stub)).toBe(true);
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
  const { host, a, b, stub } = await playing();
  try {
    await sendCommand(a, 'DISCARD', { cardIds: [] });
    await b.ping();
    const first = latestPublic(a).timedPrompt!;
    await clock(stub, first.deadlineAt + 1);
    const resumed = await connect(host.roomId);
    await resumed.hello(host.credentials);
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
    expect(game.control.phaseEnd!.passedPlayerIds).toContain(
      first.priorityPlayerId,
    );
    resumed.socket.close();
  } finally {
    a.socket.close();
    b.socket.close();
  }
});

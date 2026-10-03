import { env, exports } from 'cloudflare:workers';
import { evictDurableObject, runInDurableObject } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  D1ReplayRepository,
  persistenceBatchSchema,
} from '../../worker/repositories/replay';
import { D1EventRepository } from '../../worker/repositories/events';
import { D1MatchRepository } from '../../worker/repositories/matches';
import { D1ContentRepository } from '../../worker/repositories/content';
import { createMatch } from '../../src/engine/setup';
import { applyCommand } from '../../src/engine/commands';
import {
  replayManifestSchema,
  replayEntrySchema,
  replayFromBeginning,
} from '../../src/engine/replay';
import { matchIdSchema } from '../../src/shared/ids';
import {
  freshDatabase,
  seedDatabase,
  draftPack,
  sql,
} from './database-helpers';
import { setupInput } from '../fixtures/core-match';
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
import type { PlayerId } from '../../src/shared/ids';
import type { RoomClient } from './room-helpers';

beforeEach(async () => {
  await freshDatabase();
  await seedDatabase();
});
function firstBatch() {
  const manifest = replayManifestSchema.parse({
    schemaVersion: 1,
    setup: setupInput(1, 7),
  });
  const before = createMatch(manifest.setup);
  const command = {
    type: 'START_MATCH',
    roomId: before.roomId,
    commandId: 'command_start',
    expectedStateVersion: before.version,
  };
  const result = applyCommand(before, command, {
    actorId: before.control.hostPlayerId,
  });
  expect(result.status).toBe('ACCEPTED');
  const entry = replayEntrySchema.parse({
    actorId: before.control.hostPlayerId,
    command,
    firstSequence: 1,
    lastSequence: result.events.length,
    events: result.events,
    acceptedAt: '2026-10-03T00:00:00.000Z',
  });
  return persistenceBatchSchema.parse({
    manifest,
    entry,
    state: result.state,
    saveSnapshot: true,
  });
}
describe('atomic D1 history and verified recovery', () => {
  it('stores ordered unique events, snapshots, actor, timestamps and manifest; exact retries perform no duplicate writes', async () => {
    const repository = new D1ReplayRepository(env.DB);
    const batch = firstBatch();
    await repository.commit(batch);
    await repository.commit(batch);
    const events = await new D1EventRepository(env.DB).list(
      batch.state.matchId,
    );
    expect(events.map((event) => event.sequence)).toEqual(
      batch.entry.events.map((_, index) => index + 1),
    );
    expect(events.map((event) => event.event)).toEqual(batch.entry.events);
    expect(new Set(events.map((event) => event.sequence)).size).toBe(
      events.length,
    );
    expect(await repository.commands(batch.state.matchId)).toEqual([
      batch.entry,
    ]);
    expect(await repository.manifest(batch.state.matchId)).toEqual(
      batch.manifest,
    );
    expect(await repository.restore(batch.state.matchId)).toEqual({
      state: batch.state,
      sequence: batch.entry.lastSequence,
    });
    expect(await repository.restore(batch.state.matchId, true)).toEqual({
      state: batch.state,
      sequence: batch.entry.lastSequence,
    });
    expect(await repository.result(batch.state.matchId)).toBeNull();
    await expect(
      repository.commit({
        ...batch,
        entry: { ...batch.entry, acceptedAt: '2026-10-03T00:00:01.000Z' },
      }),
    ).rejects.toThrow('Conflicting');
    const newer = draftPack('content_newer');
    newer.cards[0]!.name = 'Changed later edition';
    const content = new D1ContentRepository(env.DB);
    await content.saveDraft(newer);
    await content.publishVersion(newer.version.id);
    expect(
      (await repository.restore(batch.state.matchId, true)).state
        .contentVersionId,
    ).toBe(batch.state.contentVersionId);
    expect(
      (await repository.restore(batch.state.matchId)).state.definitions,
    ).toEqual(batch.state.definitions);
  });
  it('rejects invalid causation, identities, actor and ranges before changing D1', async () => {
    const batch = firstBatch();
    const repo = new D1ReplayRepository(env.DB);
    await expect(
      repo.commit({
        ...batch,
        entry: { ...batch.entry, actorId: batch.state.players[1]!.id },
      }),
    ).rejects.toThrow('causation');
    await expect(
      repo.commit({
        ...batch,
        state: { ...batch.state, matchId: matchIdSchema.parse('match_other') },
      }),
    ).rejects.toThrow('causation');
    await expect(
      repo.commit({
        ...batch,
        entry: { ...batch.entry, lastSequence: batch.entry.lastSequence + 1 },
      }),
    ).rejects.toThrow('sequence range');
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM matches').first(
        'count',
      ),
    ).toBe(0);
  });
  it('rolls back all rows after a sequence violation and guards commands, results and manifests against rewriting', async () => {
    const repo = new D1ReplayRepository(env.DB);
    const first = firstBatch();
    await repo.commit(first);
    const result = applyCommand(
      first.state,
      {
        type: 'DISCARD',
        commandId: 'command_next',
        roomId: first.state.roomId,
        expectedStateVersion: first.state.version,
        cardIds: [],
      },
      { actorId: first.state.control.hostPlayerId },
    );
    expect(result.status).toBe('ACCEPTED');
    const entry = replayEntrySchema.parse({
      actorId: first.entry.actorId,
      command: {
        type: 'DISCARD',
        commandId: 'command_next',
        roomId: first.state.roomId,
        expectedStateVersion: first.state.version,
        cardIds: [],
      },
      events: result.events,
      firstSequence: first.entry.lastSequence + 2,
      lastSequence: first.entry.lastSequence + 1 + result.events.length,
      acceptedAt: first.entry.acceptedAt,
    });
    await expect(
      repo.commit({
        manifest: null,
        state: result.state,
        entry,
        saveSnapshot: true,
      }),
    ).rejects.toThrow('sequence');
    expect(await repo.commands(first.state.matchId)).toEqual([first.entry]);
    expect(
      (await new D1MatchRepository(env.DB).get(first.state.matchId))?.version,
    ).toBe(first.state.version);
    for (const table of ['match_commands', 'match_manifests']) {
      await expect(sql(`DELETE FROM ${table}`)).rejects.toThrow();
      await expect(
        sql(`UPDATE ${table} SET match_id=match_id`),
      ).rejects.toThrow();
      await expect(
        sql(`INSERT OR REPLACE INTO ${table} SELECT * FROM ${table}`),
      ).rejects.toThrow();
    }
  });
  it('fails closed on missing snapshots, missing manifests and tampered pinned seeds', async () => {
    const repo = new D1ReplayRepository(env.DB);
    await expect(
      repo.restore(matchIdSchema.parse('match_missing')),
    ).rejects.toThrow('manifest');
    const batch = firstBatch();
    await repo.commit(batch);
    await sql(
      'DELETE FROM match_snapshots WHERE match_id=?',
      batch.state.matchId,
    );
    await expect(repo.restore(batch.state.matchId)).rejects.toThrow('snapshot');
    await new D1EventRepository(env.DB).saveSnapshot(batch.state.matchId, {
      sequence: batch.entry.lastSequence,
      stateVersion: batch.state.version,
      snapshot: JSON.parse(
        JSON.stringify({
          ...batch.state,
          rng: { ...batch.state.rng, seed: 2 },
        }),
      ),
    });
    await expect(repo.restore(batch.state.matchId)).rejects.toThrow(
      'seed mismatch',
    );
  });
});

describe('real room persistence, reconnect and revocation', () => {
  it('keeps a failed D1 transaction in a durable outbox and recovers it exactly once on reconnect', async () => {
    const host = await newRoom();
    const guest = await joinRoom(host.roomId);
    const a = await connect(host.roomId);
    const b = await connect(host.roomId);
    await a.hello(host.credentials);
    await b.hello(guest.credentials);
    await sql(
      "CREATE TRIGGER test_fail_history BEFORE INSERT ON match_commands BEGIN SELECT RAISE(ABORT,'Simulated D1 failure'); END",
    );
    const command = {
      type: 'START_MATCH',
      roomId: host.roomId,
      commandId: 'command_interrupted',
      expectedStateVersion: 1,
    };
    const rejected = a.next((message) => message.type === 'COMMAND_REJECTED');
    const closed = new Promise<void>((resolve) =>
      a.socket.addEventListener('close', () => resolve(), { once: true }),
    );
    a.send({ type: 'COMMAND', command });
    expect(await rejected).toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE' });
    await closed;
    const pending = await runInDurableObject(
      stubFor(host.roomId),
      async (_instance, ctx) => ctx.storage.get('history:outbox'),
    );
    expect(pending).toBeDefined();
    expect(
      await env.DB.prepare(
        'SELECT COUNT(*) AS count FROM match_commands',
      ).first('count'),
    ).toBe(0);
    expect(
      (await stubFor(host.roomId).fetch('https://room/metadata')).status,
    ).toBe(503);
    expect(
      await stubFor(host.roomId).renewResumeToken(
        guest.credentials.resumeToken,
      ),
    ).toBeNull();
    const rejection = b.next((message) => message.type === 'COMMAND_REJECTED');
    const bClosed = new Promise<void>((resolve) =>
      b.socket.addEventListener('close', () => resolve(), { once: true }),
    );
    b.send({ type: 'PING', nonce: 'while-unavailable' });
    expect(await rejection).toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE' });
    await bClosed;
    await sql('DROP TRIGGER test_fail_history');
    const resumed = await connect(host.roomId);
    await resumed.hello(host.credentials);
    expect(latestPrivate(resumed).hand).toHaveLength(7);
    const room = await storedRoom(host.roomId);
    const repo = new D1ReplayRepository(env.DB);
    expect(await repo.commands(room.game!.matchId)).toHaveLength(1);
    expect((await repo.restore(room.game!.matchId)).state).toEqual(room.game);
    const ack = resumed.next((message) => message.type === 'COMMAND_ACCEPTED');
    resumed.send({ type: 'COMMAND', command });
    await ack;
    await resumed.ping();
    expect(await repo.commands(room.game!.matchId)).toHaveLength(1);
    expect(
      await runInDurableObject(stubFor(host.roomId), async (_instance, ctx) =>
        ctx.storage.get('history:outbox'),
      ),
    ).toBeUndefined();
    resumed.socket.close(1000, 'Done');
  });
  it('replays commands after the latest D1 snapshot without changing its pinned edition', async () => {
    const repo = new D1ReplayRepository(env.DB);
    const first = firstBatch();
    await repo.commit(first);
    const command = {
      type: 'DISCARD',
      roomId: first.state.roomId,
      commandId: 'command_tail',
      expectedStateVersion: first.state.version,
      cardIds: [],
    };
    const result = applyCommand(first.state, command, {
      actorId: first.entry.actorId,
    });
    expect(result.status).toBe('ACCEPTED');
    const entry = replayEntrySchema.parse({
      actorId: first.entry.actorId,
      command,
      events: result.events,
      firstSequence: first.entry.lastSequence + 1,
      lastSequence: first.entry.lastSequence + result.events.length,
      acceptedAt: first.entry.acceptedAt,
    });
    await repo.commit({
      manifest: null,
      entry,
      state: result.state,
      saveSnapshot: false,
    });
    expect((await repo.restore(first.state.matchId)).state).toEqual(
      result.state,
    );
    expect((await repo.restore(first.state.matchId, true)).state).toEqual(
      result.state,
    );
  });
  it('runs a long live match through nested responses, gambling, chasers, disconnect/reconnect, eviction, elimination, finish and replay equality', async () => {
    // Model normal human pacing while executing the complete match without wall-clock sleeps.
    const testEpoch = Date.now() + 3600000;
    vi.useFakeTimers({ toFake: ['Date'] });
    // Keep native alarms in the future while advancing logical time without wall-clock sleeps.
    vi.setSystemTime(testEpoch);
    const repository = new D1ReplayRepository(env.DB);
    const host = await newRoom();
    const members = [host];
    members.push(await joinRoom(host.roomId, 'Guest 1'));
    for (const [seat, characterId] of [
      [0, 'character_sample_2'],
      [1, 'character_sample_3'],
    ] as const) {
      const member = members[seat]!;
      const current = await storedRoom(host.roomId);
      const selected = await exports.default.fetch(
        `https://example.com/api/rooms/${host.roomId}/character`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${member.credentials.resumeToken}`,
          },
          body: JSON.stringify({
            characterId,
            expectedStateVersion: current.version,
          }),
        },
      );
      expect(selected.status).toBe(200);
      await selected.json();
      expect((await storedRoom(host.roomId)).players[seat]!.characterId).toBe(
        characterId,
      );
    }
    for (let seat = 2; seat < 4; seat++)
      members.push(await joinRoom(host.roomId, `Guest ${seat}`));
    const lobby = await storedRoom(host.roomId);
    await runInDurableObject(stubFor(host.roomId), async (_instance, ctx) => {
      await ctx.storage.put('room', { ...lobby, seed: 1 });
    });
    const clients: RoomClient[] = [];
    const byId = new Map<PlayerId, RoomClient>();
    const close = async (client: RoomClient) => {
      if (client.socket.readyState === WebSocket.CLOSED) return;
      const done = new Promise<void>((resolve) =>
        client.socket.addEventListener('close', () => resolve(), {
          once: true,
        }),
      );
      client.socket.close(1000, 'Test leaving');
      await done;
    };
    try {
      for (const member of members) {
        const client = await connect(host.roomId);
        clients.push(client);
        await client.hello(member.credentials);
        byId.set(member.credentials.playerId, client);
      }
      const accept = async (
        actorId: PlayerId,
        type: string,
        fields: Record<string, unknown> = {},
      ) => {
        vi.setSystemTime(Date.now() + 500);
        const actor = byId.get(actorId)!;
        const result = await sendCommand(actor, type, fields);
        expect(result.result.type).toBe('COMMAND_ACCEPTED');
        await Promise.all(
          [...byId.values()]
            .filter((client) => client !== actor)
            .map((client) => client.ping()),
        );
        return result;
      };
      const hostId = host.credentials.playerId;
      const firstGuest = members[1]!.credentials.playerId;
      const secondGuest = members[2]!.credentials.playerId;
      const card = (playerId: PlayerId, suffix: string) =>
        latestPrivate(byId.get(playerId)!).hand.find(
          (card) => card.definitionId === `carddef_sample_${suffix}`,
        )!.id;
      await accept(hostId, 'START_MATCH');
      const initialized = (await storedRoom(host.roomId)).game!;
      for (const player of initialized.players)
        expect(player).toMatchObject({
          fortitude: 20,
          alcoholContent: 0,
          gold: 10,
          drinkPile: expect.any(Array),
        });
      expect(
        initialized.players.every(
          (player) => player.hand.length === 7 && player.drinkPile.length === 1,
        ),
      ).toBe(true);
      await accept(hostId, 'DISCARD', { cardIds: [] });
      while (latestPublic(byId.get(hostId)!).phaseEnd) {
        const grace = latestPublic(byId.get(hostId)!).phaseEnd!;
        await accept(grace.priorityPlayerId!, 'PASS_ANYTIME', {
          responseWindowId: grace.id,
        });
      }
      await accept(hostId, 'PLAY_CARD', {
        cardId: card(hostId, 'shove'),
        targetPlayerId: firstGuest,
      });
      await accept(hostId, 'PASS_RESPONSE', {
        responseWindowId: latestPublic(byId.get(hostId)!).responseWindow!.id,
      });
      await accept(firstGuest, 'PLAY_RESPONSE', {
        cardId: card(firstGuest, 'ignore'),
        responseWindowId: latestPublic(byId.get(firstGuest)!).responseWindow!
          .id,
      });
      await accept(firstGuest, 'PASS_RESPONSE', {
        responseWindowId: latestPublic(byId.get(firstGuest)!).responseWindow!
          .id,
      });
      await accept(secondGuest, 'PLAY_RESPONSE', {
        cardId: card(secondGuest, 'negate'),
        responseWindowId: latestPublic(byId.get(secondGuest)!).responseWindow!
          .id,
      });
      expect(latestPublic(byId.get(hostId)!).resolutionStack).toHaveLength(3);
      const ownHand = latestPrivate(byId.get(firstGuest)!).hand;
      await close(byId.get(firstGuest)!);
      const resumed = await connect(host.roomId);
      clients.push(resumed);
      await resumed.hello(members[1]!.credentials);
      byId.set(firstGuest, resumed);
      expect(latestPrivate(resumed).hand).toEqual(ownHand);
      await evictDurableObject(stubFor(host.roomId));
      await Promise.all([...byId.values()].map((client) => client.ping()));
      const checkpoint = (await storedRoom(host.roomId)).game!;
      expect((await repository.restore(checkpoint.matchId)).state).toEqual(
        checkpoint,
      );
      let gambled = false;
      let commands = 5;
      while (latestPublic(byId.get(hostId)!).lifecycle !== 'FINISHED') {
        expect(commands++).toBeLessThan(3000);
        const view = latestPublic(byId.get(hostId)!);
        if (view.responseWindow) {
          await accept(view.responseWindow.priorityPlayerId!, 'PASS_RESPONSE', {
            responseWindowId: view.responseWindow.id,
          });
          continue;
        }
        if (view.gambling) {
          await accept(view.gambling.priorityPlayerId!, 'GAMBLING_PASS');
          continue;
        }
        if (view.phaseEnd) {
          await accept(view.phaseEnd.priorityPlayerId!, 'PASS_ANYTIME', {
            responseWindowId: view.phaseEnd.id,
          });
          continue;
        }
        const actorId = view.activePlayerId!;
        if (view.phase === 'DISCARD_DRAW')
          await accept(actorId, 'DISCARD', { cardIds: [] });
        else if (view.phase === 'ACTION') {
          if (!gambled) {
            gambled = true;
            await accept(actorId, 'PLAY_CARD', {
              cardId: card(actorId, 'gamble'),
            });
          } else await accept(actorId, 'SKIP_ACTION');
        } else if (view.phase === 'ORDER_DRINK') {
          const living = view.players.filter((player) => !player.eliminated);
          const target =
            living[
              (living.findIndex((player) => player.id === actorId) + 1) %
                living.length
            ]!;
          await accept(actorId, 'ORDER_DRINK', { targetPlayerId: target.id });
        } else if (view.phase === 'DRINK') await accept(actorId, 'TAKE_DRINK');
        else await accept(actorId, 'ADVANCE_PHASE');
      }
      const room = await storedRoom(host.roomId);
      const final = room.game!;
      const history = await repository.commands(final.matchId);
      const events = history.flatMap((entry) => entry.events);
      const manifest = await repository.manifest(final.matchId);
      const drinkEvents = events.filter(
        (event) =>
          event.type === 'DRINK_QUEUED' && event.kind === 'DRINK_EVENT',
      );
      expect(drinkEvents.length).toBeGreaterThan(0);
      for (const queued of drinkEvents) {
        if (queued.type !== 'DRINK_QUEUED')
          throw new Error('Fixture event type');
        expect(events).toContainEqual(
          expect.objectContaining({
            type: 'RESOLUTION_COMPLETED',
            resolutionId: queued.resolutionId,
            canceled: false,
          }),
        );
      }
      expect(history.length).toBeGreaterThan(100);
      expect(events.some((event) => event.type === 'GAMBLING_FINISHED')).toBe(
        true,
      );
      expect(
        history.some(
          (entry) =>
            entry.events.filter((event) => event.type === 'DRINK_REVEALED')
              .length > 1,
        ),
      ).toBe(true);
      expect(events.some((event) => event.type === 'PLAYER_ELIMINATED')).toBe(
        true,
      );
      expect((await repository.restore(final.matchId, true)).state).toEqual(
        final,
      );
      expect((await repository.restore(final.matchId)).state).toEqual(final);
      expect(replayFromBeginning(manifest, history).state).toEqual(final);
      const checkpointEntry = history.find(
        (entry) =>
          entry.command.expectedStateVersion === checkpoint.version - 1,
      )!;
      const snapshotTail = history.filter(
        (entry) => entry.firstSequence > checkpointEntry.lastSequence,
      );
      const { replayFromSnapshot } = await import('../../src/engine/replay');
      expect(
        replayFromSnapshot(
          checkpoint,
          checkpointEntry.lastSequence,
          snapshotTail,
        ).state,
      ).toEqual(final);
      const saved = await repository.result(final.matchId);
      expect(saved).toMatchObject({
        winners: final.winners,
        stateVersion: final.version,
        finalSequence: history.at(-1)!.lastSequence,
      });
      expect(saved!.players.filter((player) => player.winner)).toHaveLength(1);
      expect(
        (await new D1MatchRepository(env.DB).get(final.matchId))?.finishedAt,
      ).toBe(saved!.endedAt);
      const last = history.at(-1)!;
      const retryClient = byId.get(last.actorId)!;
      const ack = retryClient.next(
        (message) => message.type === 'COMMAND_ACCEPTED',
      );
      retryClient.send({ type: 'COMMAND', command: last.command });
      await ack;
      await retryClient.ping();
      expect(await repository.result(final.matchId)).toEqual(saved);
      expect(await repository.commands(final.matchId)).toHaveLength(
        history.length,
      );
      expect(
        (await sendCommand(byId.get(final.winners[0]!)!, 'ADVANCE_PHASE'))
          .result,
      ).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'WRONG_LIFECYCLE' });
      for (const query of [
        'UPDATE match_results SET ended_at=ended_at',
        'DELETE FROM match_results',
        'INSERT OR REPLACE INTO match_results SELECT * FROM match_results',
        "UPDATE matches SET state_version=state_version WHERE lifecycle='FINISHED'",
      ])
        await expect(sql(query)).rejects.toThrow();
    } finally {
      await Promise.all(clients.map(close));
      vi.useRealTimers();
    }
  }, 600000);
  it('recovers a committed outbox after eviction and deduplicates the interrupted command', async () => {
    const host = await newRoom();
    await joinRoom(host.roomId);
    const a = await connect(host.roomId);
    await a.hello(host.credentials);
    const accepted = await sendCommand(a, 'START_MATCH');
    const room = await storedRoom(host.roomId);
    const repository = new D1ReplayRepository(env.DB);
    const entry = (await repository.commands(room.game!.matchId))[0]!;
    const manifest = await repository.manifest(room.game!.matchId);
    await runInDurableObject(stubFor(host.roomId), async (_instance, ctx) => {
      await ctx.storage.put('history:outbox', {
        manifest,
        entry,
        state: room.game,
        saveSnapshot: true,
      });
    });
    await evictDurableObject(stubFor(host.roomId));
    await a.ping();
    expect(
      await runInDurableObject(stubFor(host.roomId), async (_instance, ctx) =>
        ctx.storage.get('history:outbox'),
      ),
    ).toBeUndefined();
    const ack = a.next((message) => message.type === 'COMMAND_ACCEPTED');
    a.send({ type: 'COMMAND', command: accepted.command });
    await ack;
    await a.ping();
    expect(await repository.commands(room.game!.matchId)).toHaveLength(1);
    expect((await repository.restore(room.game!.matchId)).state).toEqual(
      room.game,
    );
    a.socket.close(1000, 'Done');
  });
  it('renews credentials only for their own seat and rejects the formerly valid token and replaced connection', async () => {
    const host = await newRoom();
    const guest = await joinRoom(host.roomId);
    const a = await connect(host.roomId);
    await a.hello(host.credentials);
    const renewed = (await stubFor(host.roomId).renewResumeToken(
      host.credentials.resumeToken,
    ))!;
    expect(renewed).not.toBeNull();
    expect(renewed.playerId).toBe(host.credentials.playerId);
    expect(renewed.resumeToken).not.toBe(host.credentials.resumeToken);
    const stale = await connect(host.roomId);
    const rejected = stale.next(
      (message) => message.type === 'COMMAND_REJECTED',
    );
    stale.send({ type: 'HELLO', ...host.credentials });
    expect(await rejected).toMatchObject({ code: 'INVALID_SESSION' });
    const b = await connect(host.roomId);
    await b.hello(renewed);
    expect(latestPrivate(b).playerId).toBe(host.credentials.playerId);
    const impersonation = b.next(
      (message) => message.type === 'COMMAND_REJECTED',
    );
    b.send({ type: 'HELLO', ...renewed, playerId: guest.credentials.playerId });
    expect(await impersonation).toMatchObject({ code: 'INVALID_SESSION' });
    expect(
      await stubFor(host.roomId).renewResumeToken(host.credentials.resumeToken),
    ).toBeNull();
    expect(await stubFor(host.roomId).renewResumeToken('invalid')).toBeNull();
    expect(
      await stubFor('room_missing').renewResumeToken(renewed.resumeToken),
    ).toBeNull();
    await b.ping();
    stale.socket.close(1000, 'Done');
    b.socket.close(1000, 'Done');
  });
});

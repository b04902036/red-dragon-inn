import { env } from 'cloudflare:workers';
import { evictDurableObject } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { freshDatabase, seedDatabase } from './database-helpers';
import {
  newRoom,
  joinRoom,
  connect,
  sendCommand,
  latestPublic,
  storedRoom,
  stubFor,
} from './room-helpers';
import { D1ReplayRepository } from '../../worker/repositories/replay';
import { projectPublicNarration } from '../../src/protocol/public-narration-projector';
import type { RoomClient } from './room-helpers';

beforeEach(async () => {
  await freshDatabase();
  await seedDatabase();
});
const batches = (client: RoomClient) =>
  client.messages.filter((message) => message.type === 'PUBLIC_TIMELINE');
describe('persisted privacy-safe public timeline in workerd', () => {
  it('a narration read failure does not change acceptance or prevent authoritative snapshots and later HISTORY repairs delivery', async () => {
    const host = await newRoom();
    await joinRoom(host.roomId);
    const client = await connect(host.roomId);
    await client.hello(host.credentials);
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const read = vi
      .spyOn(D1ReplayRepository.prototype, 'commands')
      .mockRejectedValueOnce(new Error('test projection failure'));
    try {
      const result = await sendCommand(client, 'START_MATCH');
      expect(result.result.type).toBe('COMMAND_ACCEPTED');
      const game = (await storedRoom(host.roomId)).game!;
      expect(latestPublic(client).version).toBe(game.version);
      expect(batches(client)).toHaveLength(0);
      expect(warning).toHaveBeenCalledOnce();
      read.mockRestore();
      expect(
        await new D1ReplayRepository(env.DB).commands(game.matchId),
      ).toHaveLength(1);
      const rejected = client.next(
        (message) => message.type === 'COMMAND_REJECTED',
      );
      client.send({
        type: 'COMMAND',
        command: {
          ...result.command,
          commandId: 'command_projection_resync',
          type: 'SKIP_ACTION',
          expectedStateVersion: 0,
        },
      });
      await rejected;
      await client.ping();
      expect(batches(client).every((batch) => batch.mode === 'HISTORY')).toBe(
        true,
      );
      expect(
        batches(client).flatMap((batch) => batch.events).length,
      ).toBeGreaterThan(0);
      expect(latestPublic(client).version).toBe(game.version);
    } finally {
      read.mockRestore();
      warning.mockRestore();
      client.socket.close();
    }
  });
  it('delivers LIVE after D1 commit, rebuilds full HISTORY after eviction and does not resend accepted duplicates', async () => {
    const host = await newRoom();
    await joinRoom(host.roomId);
    await joinRoom(host.roomId, 'Third');
    await joinRoom(host.roomId, 'Fourth');
    const client = await connect(host.roomId);
    await client.hello(host.credentials);
    const { command } = await sendCommand(client, 'START_MATCH');
    const game = (await storedRoom(host.roomId)).game!;
    expect(game.publicNarrationVersion).toBe(1);
    const entries = await new D1ReplayRepository(env.DB).commands(game.matchId);
    const expected = projectPublicNarration(
      entries.flatMap((entry) =>
        entry.events.map((event, index) => ({
          sequence: entry.firstSequence + index,
          event,
        })),
      ),
    ).events;
    expect(batches(client).flatMap((batch) => batch.events)).toEqual(expected);
    expect(batches(client).every((batch) => batch.mode === 'LIVE')).toBe(true);
    const encoded = JSON.stringify(batches(client));
    for (const cardId of Object.keys(game.cards))
      expect(encoded).not.toContain(JSON.stringify(cardId));
    expect(encoded).not.toMatch(/cardIds|rngSeed|deckOrder|pendingChoice/);
    const before = batches(client).length;
    client.send({ type: 'COMMAND', command });
    await client.ping();
    expect(batches(client)).toHaveLength(before);
    client.socket.close();
    await evictDurableObject(stubFor(host.roomId));
    const resumed = await connect(host.roomId);
    await resumed.hello(host.credentials);
    expect(batches(resumed).flatMap((batch) => batch.events)).toEqual(expected);
    expect(expected.length).toBeGreaterThan(10);
    expect(batches(resumed).every((batch) => batch.mode === 'HISTORY')).toBe(
      true,
    );
    const ready = resumed.next(
      (message) => message.type === 'COMMAND_REJECTED',
    );
    resumed.send({
      type: 'COMMAND',
      command: {
        ...command,
        commandId: 'command_stale_resync',
        type: 'SKIP_ACTION',
        expectedStateVersion: 0,
      },
    });
    await ready;
    await resumed.ping();
    expect(batches(resumed).flatMap((batch) => batch.events)).toEqual(expected);
    expect(latestPublic(resumed).version).toBe(game.version);
    resumed.socket.close();
  });
});

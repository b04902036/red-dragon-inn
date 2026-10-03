import { env } from 'cloudflare:workers';
import { beforeEach, expect, it } from 'vitest';
import { sampleContentPack } from '../../src/content/sample';
import { createMatch } from '../../src/engine/setup';
import { applyCommand } from '../../src/engine/commands';
import type { Seat } from '../../src/engine/model';
import { D1MatchRepository } from '../../worker/repositories/matches';
import { D1EventRepository } from '../../worker/repositories/events';
import { freshDatabase, matchInput, seedDatabase } from './database-helpers';
import type { CoreGameState } from '../../src/engine/types';
import type { DomainEvent } from '../../src/protocol/events';
import type { PlayerId } from '../../src/shared/ids';
import { assertCoreInvariants } from '../../src/engine/invariants';
import { snapshotInputSchema } from '../../worker/repositories/schemas';

beforeEach(async () => {
  await freshDatabase();
  await seedDatabase();
});
it('persists a three-level response stack in D1 and resumes with identical events inside Workers', async () => {
  const match = matchInput();
  match.players.push(
    ...[2, 3].map((seat) => ({
      ...match.players[0]!,
      playerId: sampleContentPack.characters[seat]!.id.replace(
        'character_sample_',
        'player_',
      ) as PlayerId,
      characterId: sampleContentPack.characters[seat]!.id,
      seat,
      displayName: `Sample player ${seat}`,
    })),
  );
  await new D1MatchRepository(env.DB).create(match);
  let state = createMatch({
    roomId: match.roomId,
    matchId: match.id,
    hostPlayerId: match.players[0]!.playerId,
    content: sampleContentPack,
    seed: match.rngSeed,
    players: match.players.map((player) => ({
      id: player.playerId,
      seat: player.seat as Seat,
      characterId: player.characterId,
      displayName: player.displayName,
    })),
  });
  const events: DomainEvent[] = [];
  const accept = (
    type: string,
    fields: Record<string, unknown> = {},
    actorId = state.activePlayerId ?? state.control.hostPlayerId,
  ) => {
    const result = applyCommand(
      state,
      {
        type,
        ...fields,
        roomId: state.roomId,
        commandId: `command_${state.version + 1}`,
        expectedStateVersion: state.version,
      },
      { actorId },
    );
    expect(result.status).toBe('ACCEPTED');
    events.push(...result.events);
    state = result.state;
  };
  const card = (seat: number, suffix: string) =>
    state.players[seat]!.hand.find(
      (id) => state.cards[id]!.definitionId === `carddef_sample_${suffix}`,
    )!;
  accept('START_MATCH');
  accept('DISCARD', { cardIds: [] });
  accept('PLAY_CARD', {
    cardId: card(0, 'shove'),
    targetPlayerId: match.players[1]!.playerId,
  });
  accept(
    'PLAY_RESPONSE',
    { responseWindowId: state.responseWindow!.id, cardId: card(1, 'ignore') },
    match.players[1]!.playerId,
  );
  accept(
    'PLAY_RESPONSE',
    { responseWindowId: state.responseWindow!.id, cardId: card(2, 'negate') },
    match.players[2]!.playerId,
  );
  expect(state.resolutionStack).toHaveLength(3);
  const repository = new D1EventRepository(env.DB);
  const stored = events.map((event, index) => ({ sequence: index + 1, event }));
  await repository.append(match.id, stored);
  await repository.saveSnapshot(
    match.id,
    snapshotInputSchema.parse({
      sequence: stored.length,
      stateVersion: state.version,
      snapshot: state,
    }),
  );
  const saved = await repository.getLatestSnapshot(match.id);
  const restored = saved!.snapshot as unknown as CoreGameState;
  assertCoreInvariants(restored);
  expect(restored).toEqual(state);
  const finish = (input: CoreGameState) => {
    let current = input;
    const emitted: DomainEvent[] = [];
    while (current.responseWindow !== null) {
      const result = applyCommand(
        current,
        {
          type: 'PASS_RESPONSE',
          responseWindowId: current.responseWindow.id,
          roomId: current.roomId,
          commandId: `command_${current.version + 1}`,
          expectedStateVersion: current.version,
        },
        { actorId: current.responseWindow.priorityPlayerId! },
      );
      expect(result.status).toBe('ACCEPTED');
      emitted.push(...result.events);
      current = result.state;
    }
    return { state: current, events: emitted };
  };
  const completed = finish(restored);
  expect(completed).toEqual(finish(state));
  expect(completed.state.players[1]!.fortitude).toBe(18);
  expect(completed.state.phase).toBe('ORDER_DRINK');
  expect(
    completed.events
      .filter((event) => event.type === 'RESOLUTION_COMPLETED')
      .map((event) => event.canceled),
  ).toEqual([false, true, false]);
  const continued = completed.events.map((event, index) => ({
    sequence: stored.length + index + 1,
    event,
  }));
  await repository.append(match.id, continued);
  expect(await repository.list(match.id, 0, 1000)).toEqual([
    ...stored,
    ...continued,
  ]);
});
it('runs the portable engine in Workers and round-trips its setup events through D1', async () => {
  const match = matchInput();
  await new D1MatchRepository(env.DB).create(match);
  const state = createMatch({
    roomId: match.roomId,
    matchId: match.id,
    hostPlayerId: match.players[0]!.playerId,
    content: sampleContentPack,
    seed: match.rngSeed,
    players: match.players.map((p) => ({
      id: p.playerId,
      seat: p.seat as Seat,
      characterId: p.characterId,
      displayName: p.displayName,
    })),
  });
  const result = applyCommand(
    state,
    {
      type: 'START_MATCH',
      commandId: 'command_start',
      roomId: match.roomId,
      expectedStateVersion: 0,
    },
    { actorId: match.players[0]!.playerId },
  );
  expect(result.status).toBe('ACCEPTED');
  expect(result.state.rng.seed).toBe(match.rngSeed);
  const events = new D1EventRepository(env.DB);
  const stored = result.events.map((event, i) => ({ sequence: i + 1, event }));
  await events.append(match.id, stored);
  expect(await events.list(match.id)).toEqual(stored);
  expect(result.events).toContainEqual(
    expect.objectContaining({
      type: 'MATCH_CONFIGURED',
      contentVersionId: match.contentVersionId,
    }),
  );
});

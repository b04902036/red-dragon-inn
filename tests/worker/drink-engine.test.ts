import { env } from 'cloudflare:workers';
import { expect, it } from 'vitest';
import type { CoreGameState } from '../../src/engine/types';
import { assertCoreInvariants } from '../../src/engine/invariants';
import { D1MatchRepository } from '../../worker/repositories/matches';
import { D1EventRepository } from '../../worker/repositories/events';
import { snapshotInputSchema } from '../../worker/repositories/schemas';
import { freshDatabase, seedDatabase, matchInput } from './database-helpers';
import { drinkState, resolveResponses } from '../fixtures/drink-match';
import { accepted } from '../fixtures/core-match';

it('round-trips a revealed compound Drink through actual Workers D1 and resumes elimination with identical events', async () => {
  await freshDatabase();
  await seedDatabase();
  const input = drinkState(['tea', 'tea', 'fizz']);
  input.players[0]!.alcoholContent = 18;
  const queued = accepted(input, 'TAKE_DRINK');
  const state = queued.state;
  const match = matchInput(state.matchId);
  match.roomId = state.roomId;
  match.players = state.players.map((player) => ({
    playerId: player.id,
    characterId: player.characterId!,
    seat: player.seat,
    displayName: player.displayName,
  }));
  await new D1MatchRepository(env.DB).create(match);
  const repository = new D1EventRepository(env.DB);
  const stored = queued.events.map((event, index) => ({
    sequence: index + 1,
    event,
  }));
  await repository.append(match.id, stored);
  await repository.saveSnapshot(
    match.id,
    snapshotInputSchema.parse({
      sequence: stored.length,
      stateVersion: state.version,
      snapshot: state,
    }),
  );
  const restored = (await repository.getLatestSnapshot(match.id))!
    .snapshot as unknown as CoreGameState;
  expect(restored).toEqual(state);
  assertCoreInvariants(restored);
  const completed = resolveResponses(restored);
  expect(completed).toEqual(resolveResponses(state));
  expect(completed.state.players[0]!.eliminated).toBe(true);
  expect(completed.state.activePlayerId).toBe('player_1');
  expect(completed.state.innDrinkDiscard).toHaveLength(3);
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

import { env } from 'cloudflare:workers';
import { expect, it } from 'vitest';
import type { CoreGameState } from '../../src/engine/types';
import { assertCoreInvariants } from '../../src/engine/invariants';
import { projectPublicGame } from '../../src/protocol/projections';
import { D1MatchRepository } from '../../worker/repositories/matches';
import { D1EventRepository } from '../../worker/repositories/events';
import { snapshotInputSchema } from '../../worker/repositories/schemas';
import { freshDatabase, matchInput, seedDatabase } from './database-helpers';
import {
  startRound,
  gamblingPlay,
  finishRound,
} from '../fixtures/gambling-match';
import { passWindow } from '../fixtures/timing-match';

it('persists gambling escrow and a control response window in real D1, then resumes and pays once', async () => {
  await freshDatabase();
  await seedDatabase();
  const round = startRound();
  const played = gamblingPlay(round.state, 1, 'gamble');
  const state = played.state;
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
  const stored = [...round.events, ...played.events].map((event, index) => ({
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
  const loaded = (await repository.getLatestSnapshot(match.id))!
    .snapshot as unknown as CoreGameState;
  expect(loaded).toEqual(state);
  assertCoreInvariants(loaded);
  expect(projectPublicGame(loaded).gambling).toMatchObject({
    pot: 4,
    controlPlayerId: 'player_0',
  });
  const finish = (input: CoreGameState) => {
    const controlled = passWindow(input);
    const cheated = gamblingPlay(controlled.state, 2, 'cheat');
    const resolved = passWindow(cheated.state);
    const completed = finishRound(resolved.state);
    return {
      state: completed.state,
      events: [
        ...controlled.events,
        ...cheated.events,
        ...resolved.events,
        ...completed.events,
      ],
    };
  };
  const completed = finish(loaded);
  expect(completed).toEqual(finish(state));
  expect(completed.state.players.map((player) => player.gold)).toEqual([
    9, 9, 13, 9,
  ]);
  expect(completed.state.gambling).toBeNull();
  expect(completed.state.phase).toBe('ORDER_DRINK');
  expect(
    completed.events.filter((event) => event.type === 'GAMBLING_FINISHED'),
  ).toHaveLength(1);
  const continued = completed.events.map((event, index) => ({
    sequence: stored.length + index + 1,
    event,
  }));
  await repository.append(match.id, continued);
  await repository.saveSnapshot(
    match.id,
    snapshotInputSchema.parse({
      sequence: stored.length + continued.length,
      stateVersion: completed.state.version,
      snapshot: completed.state,
    }),
  );
  expect(await repository.list(match.id, 0, 1000)).toEqual([
    ...stored,
    ...continued,
  ]);
  expect((await repository.getLatestSnapshot(match.id))!.snapshot).toEqual(
    completed.state,
  );
});

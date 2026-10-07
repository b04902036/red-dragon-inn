import { env } from 'cloudflare:workers';
import { beforeEach, expect, it } from 'vitest';
import { D1EventRepository } from '../../worker/repositories/events';
import { D1MatchRepository } from '../../worker/repositories/matches';
import { coreStateSchema } from '../../src/engine/replay';
import { cardDefinitionSchema } from '../../src/content/cards';
import { freshDatabase, seedDatabase, matchInput } from './database-helpers';
import {
  genericState,
  putCard,
  play,
  send,
  until,
  legal,
  settle,
} from '../fixtures/generic-match';
import { numericDrinks, placeFirstDrink, finish } from '../fixtures/step24b';
import type { CoreGameState } from '../../src/engine/types';

beforeEach(async () => {
  await freshDatabase();
  await seedDatabase();
});
async function persist(state: CoreGameState) {
  await new D1MatchRepository(env.DB).create({
    ...matchInput(state.matchId, state.contentVersionId),
    roomId: state.roomId,
    rngSeed: state.rng.seed,
  });
  const repository = new D1EventRepository(env.DB);
  await repository.saveSnapshot(state.matchId, {
    sequence: 0,
    stateVersion: state.version,
    snapshot: JSON.parse(JSON.stringify(state)),
  });
  const restored = coreStateSchema.parse(
    (await repository.getLatestSnapshot(state.matchId))!.snapshot,
  );
  expect(restored).toEqual(state);
  return restored;
}
it('D1 recovery retains split recipients, original source and responder-only mitigation restrictions', async () => {
  const state = genericState();
  const hit = putCard(
    state,
    0,
    [
      {
        op: 'CHANGE_STAT',
        target: 'CHOSEN_PLAYER',
        stat: 'FORTITUDE',
        delta: -3,
      },
    ],
    { type: 'ACTION' },
  );
  const share = putCard(state, 1, [{ op: 'SHARE_FORTITUDE_LOSS' }], {
    trigger: {
      event: 'CARD',
      alternatives: [
        [
          {
            kind: 'PENDING_STAT',
            stat: 'FORTITUDE',
            direction: 'LOSS',
            relation: 'SELF',
          },
        ],
      ],
    },
  });
  let pending = until(
    play(state, 0, hit, state.players[1]!.id).state,
    (s) => legal(s, 1, share) !== undefined,
  );
  pending = until(
    play(pending, 1, share).state,
    (s) => s.resolutionStack.length === 1,
  );
  const restored = await persist(pending);
  expect(
    restored.resolutionStack[0]!.fortitudeLossOverrides![0]!
      .mitigationLockedPlayerIds,
  ).toEqual([state.players[1]!.id]);
  expect(settle(restored)).toEqual(settle(pending));
});
it('D1 recovery preserves the built-in Drink decision and each half’s later response opportunity', async () => {
  const { state, ids } = numericDrinks();
  const definition = state.cards[ids[0]!]!.definitionId;
  state.definitions[definition] = cardDefinitionSchema.parse({
    ...state.definitions[definition],
    builtInSplit: true,
  });
  placeFirstDrink(state, ids);
  const pending = until(
    send(state, 'TAKE_DRINK', {}, 0).state,
    (s) => s.responseWindow?.pendingChoice?.kind === 'OPTION',
  );
  const restored = await persist(pending);
  const fields = { optionId: state.players[1]!.id };
  const resumed = send(restored, 'CHOOSE_OPTION', fields, 0).state;
  expect(resumed).toEqual(send(pending, 'CHOOSE_OPTION', fields, 0).state);
  expect(finish(resumed).players.map((p) => p.alcoholContent)).toEqual([
    2, 2, 0, 0,
  ]);
});

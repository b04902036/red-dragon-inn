import { expect, it } from 'vitest';
import { cardDefinitionSchema } from '../../src/content/cards';
import { DEFAULT_RULES } from '../../src/engine/rules';
import { drinkState } from '../fixtures/drink-match';
import { cardInHand } from '../fixtures/timing-match';
import {
  putCard,
  play,
  until,
  settle,
  reconnectAndReplay,
} from '../fixtures/generic-match';

it('repeats only tied highest drinkers, scores revealed values despite Ignore, then collects from every other player', () => {
  const state = drinkState([]);
  state.phase = 'ACTION';
  state.rules.timing = { ...DEFAULT_RULES.timing };
  state.innDrinkDeck.cardIds.forEach((id, index) => {
    const definition = cardDefinitionSchema.parse({
      id: `carddef_contest_original_${index}`,
      source: 'TEST_FIXTURE',
      name: 'Original contest Drink',
      rulesText: 'Original numeric fixture.',
      type: 'DRINK',
      alcoholContent: [3, 3, 1, 2, 2, 4][index] ?? 1,
      fortitudeChange: 0,
      chaser: false,
      effects: [],
    });
    state.definitions[definition.id] = definition;
    state.cards[id]!.definitionId = definition.id;
  });
  const contest = putCard(state, 0, [{ op: 'DRINKING_CONTEST' }], {
    type: 'ACTION',
  });
  let pending = play(state, 0, contest).state;
  pending = until(pending, (s) => s.resolutionStack.at(-1)?.kind === 'DRINK');
  expect(
    pending.resolutionStack.find((f) => f.task?.kind === 'DRINK_BATCH')!.task,
  ).toMatchObject({
    scores: [
      { playerId: state.players[0]!.id, score: 3 },
      { playerId: state.players[1]!.id, score: 3 },
      { playerId: state.players[2]!.id, score: 1 },
      { playerId: state.players[3]!.id, score: 2 },
    ],
  });
  reconnectAndReplay(pending);
  pending = until(
    pending,
    (s) => s.responseWindow?.priorityPlayerId === s.players[0]!.id,
  );
  pending = play(pending, 0, cardInHand(pending, 0, 'ignore')).state;
  const finished = settle(pending);
  expect(finished.players.map((p) => p.gold)).toEqual(
    state.players.map((p, i) => p.gold + (i === 1 ? 3 : -1)),
  );
  expect(finished.players.map((p) => p.alcoholContent)).toEqual([2, 7, 1, 2]);
  expect(finished.innDrinkDiscard).toHaveLength(6);
});

it('a contest Drink Event scores zero and executes its own effects instead of being skipped', () => {
  const state = drinkState([]);
  state.players[0]!.fortitude = 19;
  state.phase = 'ACTION';
  state.rules.timing = { ...DEFAULT_RULES.timing };
  const first = state.innDrinkDeck.cardIds[0]!;
  const definition = cardDefinitionSchema.parse({
    id: 'carddef_contest_original_event',
    source: 'TEST_FIXTURE',
    name: 'Original contest event',
    rulesText: 'Gain Fortitude.',
    type: 'DRINK_EVENT',
    effects: [
      { op: 'CHANGE_STAT', stat: 'FORTITUDE', target: 'SELF', delta: 1 },
    ],
  });
  state.definitions[definition.id] = definition;
  state.cards[first]!.definitionId = definition.id;
  const contest = putCard(state, 0, [{ op: 'DRINKING_CONTEST' }], {
    type: 'ACTION',
  });
  let pending = play(state, 0, contest).state;
  pending = until(
    pending,
    (s) => s.resolutionStack.at(-1)?.kind === 'DRINK_EVENT',
  );
  expect(
    pending.resolutionStack.find((f) => f.task?.kind === 'DRINK_BATCH')!.task,
  ).toMatchObject({
    scores: expect.arrayContaining([
      { playerId: state.players[0]!.id, score: 0 },
    ]),
  });
  pending = until(
    pending,
    (s) => s.players[0]!.fortitude === state.players[0]!.fortitude + 1,
  );
  expect(pending.innDrinkDiscard).toContain(first);
});

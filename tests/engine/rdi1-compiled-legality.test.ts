import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { compileRdi1Source } from '../../src/content/rdi1-compiler';
import { createMatch } from '../../src/engine/setup';
import { applyCommand } from '../../src/engine/commands';
import { projectPrivatePlayer } from '../../src/protocol/projections';
import { cardDefinitionSchema } from '../../src/content/cards';
import { setupInput, accepted, intent } from '../fixtures/core-match';
import { until, play, settle } from '../fixtures/generic-match';
import { drinkState, resolveResponses } from '../fixtures/drink-match';

const content = compileRdi1Source(
  JSON.parse(
    readFileSync('content-private/imports/rdi1/source-normalized.json', 'utf8'),
  ) as unknown,
);
function action() {
  const setup = setupInput(1, 40);
  setup.content = content;
  setup.players = setup.players.map((player, seat) => ({
    ...player,
    characterId: content.characters[seat]!.id,
  }));
  let state = accepted(createMatch(setup), 'START_MATCH').state;
  state = accepted(state, 'DISCARD', { cardIds: [] }).state;
  return settle(state);
}
const find = (state: ReturnType<typeof action>, seat: number, suffix: string) =>
  state.players[seat]!.hand.find((id) =>
    state.cards[id]!.definitionId.endsWith(`_${suffix}`),
  )!;

it('server legalPlays and forged commands reject round-only Gambling during the Action phase', () => {
  const state = action();
  const cardId = find(state, 0, 'gambling_raise_one');
  expect(cardId).toBeDefined();
  expect(
    projectPrivatePlayer(state, state.players[0]!.id).legalPlays.some(
      (p) => p.cardId === cardId,
    ),
  ).toBe(false);
  expect(
    applyCommand(state, intent(state, 'PLAY_CARD', { cardId }), {
      actorId: state.players[0]!.id,
    }),
  ).toMatchObject({ status: 'REJECTED', code: 'ILLEGAL_TIMING', state });
});

it('compiled explicit start/control effects execute once, and raising antes every player exactly once', () => {
  let state = action();
  state = play(state, 0, find(state, 0, 'gambling_start_or_control')).state;
  state = until(
    state,
    (s) => s.gambling?.stage === 'ROUND' && s.responseWindow === null,
  );
  expect(state.gambling!.pot).toBe(4);
  const seat = state.players.findIndex(
    (p) => p.id === state.gambling!.priorityPlayerId,
  );
  const result = play(state, seat, find(state, seat, 'gambling_raise_one'));
  state = until(result.state, (s) => s.responseWindow === null);
  expect(state.gambling!.controlPlayerId).toBe(state.players[seat]!.id);
  expect(state.gambling!.pot).toBe(8);
  expect(state.players.map((p) => p.gold)).toEqual([8, 8, 8, 8]);
});

it('signed Drink Alcohol contributes its real negative delta and clamps only the final player stat', () => {
  const state = drinkState();
  const actor = state.players[0]!;
  actor.alcoholContent = 3;
  const definitionId = state.cards[actor.drinkPile[0]!]!.definitionId;
  state.definitions[definitionId] = cardDefinitionSchema.parse({
    ...state.definitions[definitionId],
    type: 'DRINK',
    effects: [],
    alcoholContent: -1,
    fortitudeChange: 0,
    chaser: false,
  });
  const result = resolveResponses(accepted(state, 'TAKE_DRINK').state);
  expect(result.state.players[0]!.alcoholContent).toBe(2);
});

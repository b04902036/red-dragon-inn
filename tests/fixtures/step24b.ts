import { expect } from 'vitest';
import { cardDefinitionSchema } from '../../src/content/cards';
import { applyCommand, applyTimeout } from '../../src/engine/commands';
import { coreStateSchema, replayFromSnapshot } from '../../src/engine/replay';
import type { CoreGameState } from '../../src/engine/types';
import {
  projectPrivatePlayer,
  projectPublicGame,
} from '../../src/protocol/projections';
import { intent } from './core-match';
import { drinkState } from './drink-match';
import { DEFAULT_RULES } from '../../src/engine/rules';
import { passCurrent, send } from './generic-match';

export function numericDrinks(values: number[] = [3, 2, 1, 1, 1, 1]) {
  const state = drinkState([]);
  state.rules.timing = { ...DEFAULT_RULES.timing };
  const ids = [...state.innDrinkDeck.cardIds];
  ids.forEach((id, i) => {
    const definition = cardDefinitionSchema.parse({
      id: `carddef_test_step24b_drink_${i}`,
      name: 'Original generic test Drink',
      rulesText: 'Synthetic numeric Drink.',
      source: 'TEST_FIXTURE',
      type: 'DRINK',
      alcoholContent: values[i] ?? 1,
      fortitudeChange: 0,
      chaser: false,
      effects: [],
    });
    state.definitions[definition.id] = definition;
    state.cards[id]!.definitionId = definition.id;
  });
  return { state, ids };
}
export function placeFirstDrink(
  state: ReturnType<typeof numericDrinks>['state'],
  ids: ReturnType<typeof numericDrinks>['ids'],
  count = 1,
) {
  state.players[0]!.drinkPile = ids.slice(0, count);
  state.innDrinkDeck.cardIds = ids.slice(count);
  for (const id of ids.slice(0, count))
    state.cards[id]!.location = {
      zone: 'DRINK_PILE',
      playerId: state.players[0]!.id,
    };
}
export function advance(state: CoreGameState) {
  const choice = state.responseWindow?.pendingChoice;
  if (choice)
    return send(
      state,
      choice.kind === 'OPTION' ? 'CHOOSE_OPTION' : 'CHOOSE_TARGET',
      choice.kind === 'OPTION'
        ? {
            optionId:
              choice.options.find((o) => o.id === 'KEEP')?.id ??
              choice.options[0]!.id,
          }
        : { targetPlayerIds: [choice.options[0]!.id] },
      state.players.findIndex((p) => p.id === choice.playerId),
    ).state;
  return passCurrent(state).state;
}
export function finish(state: CoreGameState) {
  for (
    let n = 0;
    n < 256 &&
    (state.responseWindow !== null || state.control.phaseEnd !== null);
    n++
  )
    state = advance(state);
  expect(state.responseWindow).toBeNull();
  return state;
}
/** Exercise the real prompt and command boundary, projection and snapshot replay. */
export function verifyOpportunity(
  state: CoreGameState,
  seat: number,
  card: string,
) {
  const prompt = state.control.timedPrompt!;
  expect(prompt.priorityPlayerId).toBe(state.players[seat]!.id);
  expect(prompt.deadlineAt).toBe(
    seat === state.players.findIndex((p) => p.id === state.activePlayerId)
      ? null
      : prompt.openedAt + 30_000,
  );
  const ownView = projectPrivatePlayer(state, state.players[seat]!.id);
  expect(ownView.responsePrompt!.hasLegalSometimes).toBe(
    ownView.legalPlays.some(
      (play) =>
        state.definitions[
          state.cards[play.cardId as keyof typeof state.cards]!.definitionId
        ]!.type === 'SOMETIMES',
    ),
  );
  const raw = intent(state, 'PLAY_RESPONSE', {
    cardId: card,
    responseWindowId: state.responseWindow!.id,
    promptId: 'prompt_stale',
  });
  expect(
    applyCommand(state, raw, {
      actorId: state.players[seat]!.id,
      clock: { now: () => prompt.openedAt },
    }),
  ).toMatchObject({ status: 'REJECTED', state, events: [] });
  expect(JSON.stringify(projectPublicGame(state))).not.toContain(
    JSON.stringify(card),
  );
  for (const player of state.players.filter(
    (p) => p.id !== state.players[seat]!.id,
  ))
    expect(
      JSON.stringify(projectPrivatePlayer(state, player.id)),
    ).not.toContain(JSON.stringify(card));
  const restored = coreStateSchema.parse(JSON.parse(JSON.stringify(state)));
  expect(projectPrivatePlayer(restored, state.players[seat]!.id)).toEqual(
    projectPrivatePlayer(state, state.players[seat]!.id),
  );
  const command = intent(state, 'PASS_RESPONSE', {
    responseWindowId: state.responseWindow!.id,
    promptId: prompt.promptId,
  });
  const result = applyCommand(restored, command, {
    actorId: prompt.priorityPlayerId,
    clock: { now: () => prompt.openedAt },
  });
  expect(result.status).toBe('ACCEPTED');
  expect(
    replayFromSnapshot(restored, 0, [
      {
        actorId: prompt.priorityPlayerId,
        command,
        firstSequence: 1,
        lastSequence: result.events.length,
        events: result.events,
        acceptedAt: new Date(prompt.openedAt).toISOString(),
        clockTime: prompt.openedAt,
      },
    ]).state,
  ).toEqual(result.state);
  if (prompt.deadlineAt !== null) {
    const expired = applyTimeout(state, {
      type: 'EXPIRE_PROMPT',
      roomId: state.roomId,
      commandId: `command_expiry_${state.version}`,
      expectedStateVersion: state.version,
      promptId: prompt.promptId,
      now: prompt.deadlineAt,
    });
    expect(expired.status).toBe('ACCEPTED');
    expect(expired.state.version).toBe(state.version + 1);
  } else {
    expect(
      applyTimeout(state, {
        type: 'EXPIRE_PROMPT',
        roomId: state.roomId,
        commandId: `command_expiry_${state.version}`,
        expectedStateVersion: state.version,
        promptId: prompt.promptId,
        now: prompt.openedAt + 600000,
      }),
    ).toMatchObject({ status: 'REJECTED', state, events: [] });
  }
}

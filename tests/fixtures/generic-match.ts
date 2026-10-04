import { expect } from 'vitest';
import { cardDefinitionSchema } from '../../src/content/cards';
import type { Effect } from '../../src/content/effects';
import type { ResponseTrigger } from '../../src/content/reaction-triggers';
import type { CoreGameState, MutableGameState } from '../../src/engine/types';
import { applyCommand, applyTimeout } from '../../src/engine/commands';
import { DEFAULT_RULES } from '../../src/engine/rules';
import { assertCoreInvariants } from '../../src/engine/invariants';
import { projectPrivatePlayer } from '../../src/protocol/projections';
import { coreStateSchema, replayFromSnapshot } from '../../src/engine/replay';
import { intent, mutable } from './core-match';
import { actionState, cardInHand } from './timing-match';

export function genericState() {
  const state = actionState();
  state.rules.timing = { ...DEFAULT_RULES.timing };
  return state;
}
export function putCard(
  state: MutableGameState,
  seat: number,
  effects: Effect[],
  options: {
    trigger?: ResponseTrigger;
    type?: 'ACTION' | 'ANYTIME' | 'SOMETIMES' | 'CHEATING';
    suffix?: string;
    phaseOpportunity?: 'ORDER_DRINK';
    counterFamily?: string;
    counterPolicy?: 'SAME_FAMILY_ONLY';
    targetPolicy?: 'ANY_LIVING_PLAYER';
    mandatoryGoldCost?: number;
  } = {},
) {
  const id = cardInHand(state, seat, options.suffix ?? 'breather');
  const { trigger, suffix: _suffix, ...metadata } = options;
  void _suffix;
  const type = options.type ?? 'SOMETIMES';
  const definition = cardDefinitionSchema.parse({
    id: `carddef_test_generic_${seat}_${id}`,
    name: 'Original mechanic fixture',
    rulesText: 'Original test data for generic engine operations.',
    source: 'TEST_FIXTURE',
    effects,
    type,
    ...metadata,
    ...(type === 'SOMETIMES'
      ? {
          responseKind: 'SOMETIMES',
          ...(trigger === undefined ? {} : { responseTrigger: trigger }),
        }
      : {}),
  });
  state.definitions[definition.id] = definition;
  state.cards[id]!.definitionId = definition.id;
  return id;
}
export function legal(state: CoreGameState, seat: number, cardId: string) {
  return projectPrivatePlayer(state, state.players[seat]!.id).legalPlays.find(
    (p) => p.cardId === cardId,
  );
}
export function send(
  state: CoreGameState,
  type: string,
  fields: Record<string, unknown> = {},
  seat = state.responseWindow?.priorityPlayerId === undefined ||
  state.responseWindow.priorityPlayerId === null
    ? state.players.findIndex((p) => p.id === state.activePlayerId)
    : state.players.findIndex(
        (p) => p.id === state.responseWindow!.priorityPlayerId,
      ),
  now = state.control.timedPrompt?.openedAt ?? 1000,
) {
  const command = intent(state, type, fields);
  const result = applyCommand(state, command, {
    actorId: state.players[seat]!.id,
    clock: { now: () => now },
  });
  expect(result.status, result.status === 'REJECTED' ? result.code : type).toBe(
    'ACCEPTED',
  );
  assertCoreInvariants(result.state);
  return result;
}
export function play(
  state: CoreGameState,
  seat: number,
  cardId: string,
  targetPlayerId?: string,
  now = state.control.timedPrompt?.openedAt ?? 1000,
) {
  const choice = legal(state, seat, cardId)!;
  expect(choice).toBeDefined();
  return send(
    state,
    choice.commandType,
    {
      cardId,
      ...(choice.commandType === 'PLAY_RESPONSE'
        ? { responseWindowId: state.responseWindow!.id }
        : {}),
      ...(choice.promptId === undefined ? {} : { promptId: choice.promptId }),
      ...(targetPlayerId === undefined ? {} : { targetPlayerId }),
    },
    seat,
    now,
  );
}
export function passCurrent(state: CoreGameState) {
  if (state.responseWindow !== null)
    return send(state, 'PASS_RESPONSE', {
      responseWindowId: state.responseWindow.id,
    });
  const grace = state.control.phaseEnd!;
  const seat = state.players.findIndex((p) => p.id === grace.priorityPlayerId);
  return send(state, 'PASS_ANYTIME', { responseWindowId: grace.id }, seat);
}
export function until(
  state: CoreGameState,
  stop: (state: CoreGameState) => boolean,
  limit = 128,
) {
  for (let i = 0; i < limit && !stop(state); i++)
    state = passCurrent(state).state;
  expect(stop(state)).toBe(true);
  return state;
}
export function settle(state: CoreGameState) {
  return until(
    state,
    (s) => s.responseWindow === null && s.control.phaseEnd === null,
  );
}
export function expire(state: CoreGameState) {
  const prompt = state.control.timedPrompt!;
  const command = {
    type: 'EXPIRE_PROMPT',
    commandId: `command_timeout_${state.version}`,
    roomId: state.roomId,
    expectedStateVersion: state.version,
    promptId: prompt.promptId,
    now: prompt.deadlineAt,
  };
  const result = applyTimeout(state, command);
  expect(result.status).toBe('ACCEPTED');
  return { result, command };
}
export function reconnectAndReplay(state: CoreGameState) {
  const restored = coreStateSchema.parse(
    JSON.parse(JSON.stringify(state)) as unknown,
  );
  const { result, command } = expire(restored);
  const history = [
    {
      actorId: state.control.timedPrompt!.priorityPlayerId,
      command,
      firstSequence: 1,
      lastSequence: result.events.length,
      events: result.events,
      acceptedAt: new Date(state.control.timedPrompt!.deadlineAt).toISOString(),
    },
  ];
  expect(replayFromSnapshot(restored, 0, history).state).toEqual(result.state);
  expect(expire(state).result).toEqual(result);
  return mutable(result.state);
}
export function systemTrigger(
  event:
    | 'ANTE_REQUIRED'
    | 'PAYMENT_REQUIRED'
    | 'GAMBLING_CHECKPOINT'
    | 'GAMBLING_WIN_BEFORE_PAYOUT'
    | 'FORTITUDE_LOSS_RESOLVED',
  extra: ResponseTrigger['alternatives'][number] = [],
): ResponseTrigger {
  return {
    event: 'SYSTEM',
    alternatives: [[{ kind: 'SYSTEM_EVENT', events: [event] }, ...extra]],
  };
}

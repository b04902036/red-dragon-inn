import { describe, expect, it } from 'vitest';
import { applyCommand, applyTimeout } from '../../src/engine/commands';
import { DEFAULT_RULES } from '../../src/engine/rules';
import {
  projectPrivatePlayer,
  projectPublicGame,
} from '../../src/protocol/projections';
import { replayFromSnapshot } from '../../src/engine/replay';
import { synchronizePrompt } from '../../src/engine/timed-prompts';
import type { CoreGameState } from '../../src/engine/types';
import { actionState, cardInHand, playAction } from '../fixtures/timing-match';
import { intent, mutable, started } from '../fixtures/core-match';

function timed(state: CoreGameState) {
  const copy = mutable(state);
  copy.rules.timing = { ...DEFAULT_RULES.timing };
  return copy;
}
function command(
  state: CoreGameState,
  type: string,
  fields: Record<string, unknown> = {},
  now = 1000,
  actor = state.activePlayerId!,
) {
  const result = applyCommand(state, intent(state, type, fields), {
    actorId: actor,
    clock: { now: () => now },
  });
  expect(result.status).toBe('ACCEPTED');
  if (result.status !== 'ACCEPTED') throw new Error(JSON.stringify(result));
  return result;
}
function expire(
  state: CoreGameState,
  now = state.control.timedPrompt!.deadlineAt,
  promptId = state.control.timedPrompt!.promptId,
) {
  return applyTimeout(state, {
    type: 'EXPIRE_PROMPT',
    commandId: `command_timeout_${state.version}`,
    roomId: state.roomId,
    expectedStateVersion: state.version,
    promptId,
    now,
  });
}
function responsesDone(state: CoreGameState, now = 2000) {
  while (state.responseWindow)
    state = command(
      state,
      'PASS_RESPONSE',
      { responseWindowId: state.responseWindow.id },
      now,
      state.responseWindow.priorityPlayerId!,
    ).state;
  return state;
}
describe('authoritative timed prompts', () => {
  it('uses production 30s/15s defaults and an injected clock', () => {
    const result = command(timed(actionState()), 'PLAY_CARD', {
      cardId: cardInHand(actionState(), 0, 'shove'),
      targetPlayerId: 'player_1',
    });
    expect(result.state.control.timedPrompt).toMatchObject({
      kind: 'RESPONSE_DECISION',
      openedAt: 1000,
      deadlineAt: 31000,
    });
    expect(result.events.some((e) => e.type === 'TIMED_PROMPT_OPENED')).toBe(
      true,
    );
    const privateView = projectPrivatePlayer(
      result.state,
      result.state.responseWindow!.priorityPlayerId!,
    );
    expect(privateView.responsePrompt?.hasLegalSometimes).toBe(true);
    expect(
      projectPrivatePlayer(result.state, result.state.players[3]!.id)
        .responsePrompt,
    ).toBeNull();
  });
  it('skips a source with no legal responses without a 30s decision', () => {
    const state = timed(actionState());
    for (const d of Object.values(state.definitions))
      if (d.type === 'ANYTIME' || d.type === 'SOMETIMES')
        d.effects = [{ op: 'NEGATE', scope: 'TOP_STACK' }];
    const source =
      state.definitions[
        state.cards[cardInHand(state, 0, 'shove')]!.definitionId
      ]!;
    source.negatable = false;
    const result = command(state, 'PLAY_CARD', {
      cardId: cardInHand(state, 0, 'shove'),
      targetPlayerId: 'player_1',
    });
    expect(result.state.responseWindow).toBeNull();
    expect(result.state.phase).toBe('ORDER_DRINK');
    expect(result.state.control.timedPrompt).toBeNull();
  });
  it('manual pass advances with a new immutable identity and full deadline', () => {
    const state = timed(playAction().state);
    synchronizePrompt(state, 1000, () => {});
    const before = state.control.timedPrompt!;
    const after = command(
      state,
      'PASS_RESPONSE',
      { responseWindowId: state.responseWindow!.id },
      2000,
      before.priorityPlayerId,
    ).state;
    expect(after.control.timedPrompt?.promptId).not.toBe(before.promptId);
    expect(after.control.timedPrompt?.deadlineAt).toBe(32000);
  });
  it('accepts a legal response before expiry and rejects a late command without mutating', () => {
    const state = timed(playAction().state);
    synchronizePrompt(state, 1000, () => {});
    const prompt = state.control.timedPrompt!;
    const card = projectPrivatePlayer(
      state,
      prompt.priorityPlayerId,
    ).legalResponses.find((c) => !c.requiresTarget)!;
    const fields = { cardId: card.cardId, responseWindowId: prompt.windowId };
    expect(
      command(state, 'PLAY_RESPONSE', fields, 30999, prompt.priorityPlayerId)
        .state.version,
    ).toBe(state.version + 1);
    const before = JSON.stringify(state);
    expect(
      applyCommand(state, intent(state, 'PLAY_RESPONSE', fields), {
        actorId: prompt.priorityPlayerId,
        clock: { now: () => 31000 },
      }),
    ).toMatchObject({ status: 'REJECTED', code: 'WRONG_WINDOW' });
    expect(JSON.stringify(state)).toBe(before);
  });
  it('system expiry passes, rejects early/stale identities, and cannot be forged over the player boundary', () => {
    const state = timed(playAction().state);
    synchronizePrompt(state, 1000, () => {});
    expect(expire(state, 30999).status).toBe('REJECTED');
    const old = state.control.timedPrompt!;
    const result = expire(state);
    expect(result.status).toBe('ACCEPTED');
    if (result.status !== 'ACCEPTED') throw new Error('expiry rejected');
    expect(result.events[0]).toMatchObject({
      type: 'TIMED_PROMPT_EXPIRED',
      promptId: old.promptId,
    });
    expect(result.state.responseWindow!.passedPlayerIds).toContain(
      old.priorityPlayerId,
    );
    expect(expire(result.state, 999999, old.promptId).status).toBe('REJECTED');
    expect(
      applyCommand(
        state,
        {
          ...intent(state, 'PASS_RESPONSE', { responseWindowId: old.windowId }),
          commandId: 'command_system_timeout_999',
        },
        { actorId: old.priorityPlayerId },
      ).status,
    ).toBe('REJECTED');
    expect(
      applyCommand(
        result.state,
        intent(result.state, 'PASS_RESPONSE', {
          responseWindowId: result.state.responseWindow!.id,
          promptId: old.promptId,
        }),
        { actorId: result.state.control.timedPrompt!.priorityPlayerId },
      ),
    ).toMatchObject({ status: 'REJECTED', code: 'WRONG_WINDOW' });
    expect(
      applyCommand(
        state,
        {
          ...intent(state, 'EXPIRE_PROMPT'),
          promptId: old.promptId,
          now: 31000,
        },
        { actorId: old.priorityPlayerId },
      ).status,
    ).toBe('REJECTED');
  });
  it('records timeout input and reproduces exact state/events without reading wall time', () => {
    const state = timed(playAction().state);
    synchronizePrompt(state, 1000, () => {});
    const action = {
      ...intent(state, 'EXPIRE_PROMPT'),
      promptId: state.control.timedPrompt!.promptId,
      now: 31000,
    };
    const result = applyTimeout(state, action);
    expect(result.status).toBe('ACCEPTED');
    if (result.status !== 'ACCEPTED') throw new Error('expiry rejected');
    expect(
      replayFromSnapshot(state, 0, [
        {
          actorId: state.control.timedPrompt!.priorityPlayerId,
          command: action,
          events: result.events,
          firstSequence: 1,
          lastSequence: result.events.length,
          acceptedAt: '2026-10-03T00:00:00.000Z',
        },
      ]).state,
    ).toEqual(result.state);
  });
  it('a nested response and return to parent restart evaluation with fresh deadlines', () => {
    const state = timed(playAction().state);
    synchronizePrompt(state, 1000, () => {});
    const parentId = state.responseWindow!.id;
    const next = command(
      state,
      'PLAY_RESPONSE',
      { cardId: cardInHand(state, 0, 'breather'), responseWindowId: parentId },
      2000,
      state.players[0]!.id,
    ).state;
    expect(next.control.timedPrompt?.deadlineAt).toBe(32000);
    let after = next;
    const childId = after.responseWindow!.id;
    while (after.responseWindow?.id === childId)
      after = command(
        after,
        'PASS_RESPONSE',
        { responseWindowId: childId },
        3000,
        after.responseWindow.priorityPlayerId!,
      ).state;
    expect(after.responseWindow?.id).not.toBe(parentId);
    expect(after.control.timedPrompt?.deadlineAt).toBe(33000);
    expect(
      applyCommand(
        after,
        intent(after, 'PASS_RESPONSE', { responseWindowId: parentId }),
        { actorId: after.control.timedPrompt!.priorityPlayerId },
      ).status,
    ).toBe('REJECTED');
  });
  it.each(['DISCARD_DRAW', 'ACTION', 'ORDER_DRINK', 'DRINK'] as const)(
    'completes %s special action before a 15s Anytime grace',
    (phase) => {
      let state = timed(started(1, 7));
      state.phase = phase;
      let result;
      if (phase === 'DISCARD_DRAW')
        result = command(state, 'DISCARD', { cardIds: [] });
      else if (phase === 'ACTION') result = command(state, 'SKIP_ACTION');
      else if (phase === 'ORDER_DRINK')
        result = command(state, 'ORDER_DRINK', { targetPlayerId: 'player_1' });
      else result = command(state, 'TAKE_DRINK');
      state = mutable(responsesDone(result.state));
      expect(state.phase).toBe(phase);
      expect(state.control.phaseEnd?.phase).toBe(phase);
      expect(state.control.timedPrompt).toMatchObject({
        kind: 'PHASE_END_ANYTIME',
        deadlineAt: phase === 'DRINK' ? 17000 : 16000,
      });
      expect(
        projectPrivatePlayer(state, state.control.timedPrompt!.priorityPlayerId)
          .responsePrompt?.hasLegalSometimes,
      ).toBe(false);
      expect(projectPublicGame(state)).not.toHaveProperty('legalAnytime');
    },
  );
  it('phase-end passes and expiry rotate then transition, while no holders transition immediately', () => {
    let state = command(timed(started(1, 7)), 'DISCARD', { cardIds: [] }).state;
    const first = state.control.timedPrompt!;
    state = command(
      state,
      'PASS_ANYTIME',
      { responseWindowId: first.windowId },
      2000,
      first.priorityPlayerId,
    ).state;
    expect(state.control.timedPrompt?.priorityPlayerId).not.toBe(
      first.priorityPlayerId,
    );
    while (state.control.phaseEnd) {
      const result = expire(state);
      if (result.status !== 'ACCEPTED') throw new Error('expiry rejected');
      state = result.state;
    }
    expect(state.phase).toBe('ACTION');
    const noHolders = timed(started(1, 7));
    for (const d of Object.values(noHolders.definitions))
      if (d.type === 'ANYTIME')
        d.effects = [{ op: 'NEGATE', scope: 'TOP_STACK' }];
    expect(command(noHolders, 'DISCARD', { cardIds: [] }).state.phase).toBe(
      'ACTION',
    );
  });
  it('Anytime play suspends grace through nested responses, resets passes and restarts the origin', () => {
    let state = command(timed(started(1, 7)), 'DISCARD', { cardIds: [] }).state;
    const old = state.control.timedPrompt!;
    state = command(
      state,
      'PLAY_CARD',
      { cardId: cardInHand(state, 0, 'breather') },
      2000,
      old.priorityPlayerId,
    ).state;
    expect(state.resolutionStack.length).toBeGreaterThan(0);
    state = responsesDone(state, 3000);
    expect(state.control.phaseEnd?.passedPlayerIds).toEqual([]);
    expect(state.control.timedPrompt).toMatchObject({
      kind: 'PHASE_END_ANYTIME',
      deadlineAt: 18000,
      priorityPlayerId: 'player_1',
    });
    expect(state.control.timedPrompt!.promptId).not.toBe(old.promptId);
  });
  it('keeps a dying player eligible until the guaranteed grace lets their healing resolve', () => {
    const initial = timed(started(1, 7));
    initial.phase = 'DRINK';
    initial.players[0]!.fortitude = 1;
    initial.definitions[
      initial.cards[cardInHand(initial, 0, 'breather')]!.definitionId
    ]!.effects = [
      { op: 'CHANGE_STAT', target: 'SELF', stat: 'FORTITUDE', delta: 5 },
    ];
    let state = responsesDone(command(initial, 'TAKE_DRINK').state);
    expect(state.players[0]!.alcoholContent).toBeGreaterThanOrEqual(
      state.players[0]!.fortitude,
    );
    expect(state.players[0]!.eliminated).toBe(false);
    expect(state.control.phaseEnd).not.toBeNull();
    state = responsesDone(
      command(
        state,
        'PLAY_CARD',
        { cardId: cardInHand(state, 0, 'breather') },
        3000,
        state.players[0]!.id,
      ).state,
      4000,
    );
    while (state.control.phaseEnd)
      state = command(
        state,
        'PASS_ANYTIME',
        { responseWindowId: state.control.phaseEnd.id },
        5000,
        state.control.timedPrompt!.priorityPlayerId,
      ).state;
    expect(state.players[0]!.eliminated).toBe(false);
    expect(state.players[0]!.fortitude).toBe(6);
  });
});

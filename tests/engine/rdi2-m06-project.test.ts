import { describe, expect, it } from 'vitest';
import { applyCommand, applyTimeout } from '../../src/engine/commands';
import { coreStateSchema, replayFromSnapshot } from '../../src/engine/replay';
import {
  projectPrivatePlayer,
  projectPublicGame,
} from '../../src/protocol/projections';
import type { CoreGameState } from '../../src/engine/types';
import type { DomainEvent } from '../../src/protocol/events';
import { intent, mutable } from '../fixtures/core-match';
import { cardInHand } from '../fixtures/timing-match';
import {
  genericState,
  putCard,
  play,
  send,
  until,
  settle,
  legal,
} from '../fixtures/generic-match';
import {
  m06ProjectEffects,
  m06ProjectTrigger,
} from '../fixtures/rdi2-m06-project';

function setup(eject = false, counter = false) {
  const initial = genericState();
  const anti = putCard(initial, 2, m06ProjectEffects, {
    trigger: m06ProjectTrigger,
  });
  const cheating = putCard(
    initial,
    1,
    eject
      ? [{ op: 'FORCE_LEAVE_GAMBLING', target: 'CHOSEN_PLAYER' }]
      : [
          {
            op: 'CHANGE_STAT',
            target: 'CHOSEN_PLAYER',
            stat: 'FORTITUDE',
            delta: -2,
          },
        ],
    { type: 'CHEATING', suffix: 'cheat' },
  );
  const negate = counter
    ? putCard(initial, 3, [{ op: 'NEGATE', scope: 'TOP_STACK' }], {
        trigger: {
          event: 'CARD',
          alternatives: [[{ kind: 'SOURCE_TYPE', types: ['SOMETIMES'] }]],
        },
      })
    : null;
  const round = settle(
    play(initial, 0, cardInHand(initial, 0, 'gamble')).state,
  );
  return { initial, round, anti, cheating, negate };
}
function opportunity(eject = false, counter = false) {
  const f = setup(eject, counter);
  const pending = play(f.round, 1, f.cheating, f.round.players[2]!.id).state;
  return {
    ...f,
    pending: until(pending, (s) => legal(s, 2, f.anti) !== undefined),
  };
}
function finishWithEvents(state: CoreGameState) {
  const events: DomainEvent[] = [];
  while (state.responseWindow !== null || state.control.phaseEnd !== null) {
    const response = state.responseWindow;
    const grace = state.control.phaseEnd;
    const window = response ?? grace!;
    const seat = state.players.findIndex(
      (p) => p.id === window.priorityPlayerId,
    );
    const result = send(
      state,
      response ? 'PASS_RESPONSE' : 'PASS_ANYTIME',
      { responseWindowId: window.id },
      seat,
    );
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}
function submit(
  state: CoreGameState,
  anti: string,
  fields: Record<string, unknown> = {},
) {
  return applyCommand(
    state,
    intent(state, 'PLAY_RESPONSE', {
      responseWindowId: state.responseWindow!.id,
      promptId: state.control.timedPrompt!.promptId,
      cardId: anti,
      ...fields,
    }),
    {
      actorId: state.players[2]!.id,
      clock: { now: () => state.control.timedPrompt!.openedAt },
    },
  );
}

describe('M06 project ruleset on the existing generic engine', () => {
  it.each([false, true])(
    'responds to Cheating (control-and-eject=%s), suppresses unresolved effects, ends the Round and awards the whole pot',
    (eject) => {
      const f = opportunity(eject);
      const accepted = play(f.pending, 2, f.anti);
      const finished = finishWithEvents(accepted.state);
      const events = [...accepted.events, ...finished.events];
      expect(finished.state.gambling).toBeNull();
      expect(finished.state.players[2]!.gold).toBe(
        f.pending.players[2]!.gold + f.pending.gambling!.pot,
      );
      expect(finished.state.players[2]!.fortitude).toBe(
        f.pending.players[2]!.fortitude,
      );
      expect(finished.state.phase).toBe('ORDER_DRINK');
      expect(events).toContainEqual(
        expect.objectContaining({
          type: 'GAMBLING_FINISHED',
          winnerPlayerId: f.pending.players[2]!.id,
          reason: 'IMMEDIATE_WIN',
          pot: f.pending.gambling!.pot,
        }),
      );
      expect(
        events.some((e) =>
          [
            'GAMBLING_PLAYER_LEFT',
            'GAMBLING_CONTROL_CHANGED',
            'GAMBLING_PRIORITY_CHANGED',
            'GAMBLING_PASSED',
          ].includes(e.type),
        ),
      ).toBe(false);
      expect(finished.state.players[1]!.characterDiscard).toContain(f.cheating);
    },
  );
  it('allows the participant who is being forced out to respond before leave resolves', () => {
    const f = opportunity(true);
    expect(f.pending.gambling!.leftPlayerIds).not.toContain(
      f.pending.players[2]!.id,
    );
    expect(legal(f.pending, 2, f.anti)).toBeDefined();
    expect(settle(play(f.pending, 2, f.anti).state).gambling).toBeNull();
  });
  it('rejects the card after an actual forced leave has resolved', () => {
    const f = setup(true);
    const departed = settle(
      play(f.round, 1, f.cheating, f.round.players[2]!.id).state,
    );
    expect(departed.gambling!.leftPlayerIds).toContain(departed.players[2]!.id);
    const next = play(departed, 3, cardInHand(departed, 3, 'cheat')).state;
    expect(legal(next, 2, f.anti)).toBeUndefined();
    const rejected = applyCommand(
      next,
      intent(next, 'PLAY_RESPONSE', {
        responseWindowId: next.responseWindow!.id,
        cardId: f.anti,
      }),
      { actorId: next.players[2]!.id },
    );
    expect(rejected.status).toBe('REJECTED');
    expect(rejected.events).toEqual([]);
  });
  it('rejects a nonparticipant even when a Cheating card is pending', () => {
    const f = setup();
    const state = mutable(f.round);
    state.gambling!.participants = state.gambling!.participants.filter(
      (id) => id !== state.players[2]!.id,
    );
    state.gambling!.excludedPlayerIds.push(state.players[2]!.id);
    const contribution = state.gambling!.contributions.find(
      (c) => c.playerId === state.players[2]!.id,
    )!;
    state.gambling!.contributions = state.gambling!.contributions.filter(
      (c) => c !== contribution,
    );
    state.gambling!.pot -= contribution.amount;
    state.players[2]!.gold += contribution.amount;
    const pending = play(state, 1, f.cheating, state.players[3]!.id).state;
    expect(legal(pending, 2, f.anti)).toBeUndefined();
    expect(
      applyCommand(
        pending,
        intent(pending, 'PLAY_RESPONSE', {
          responseWindowId: pending.responseWindow!.id,
          cardId: f.anti,
        }),
        { actorId: pending.players[2]!.id },
      ).status,
    ).toBe('REJECTED');
  });
  it('does not respond to a non-Cheating Gambling card or outside an active Round', () => {
    const f = setup();
    expect(legal(f.initial, 2, f.anti)).toBeUndefined();
    const pending = play(f.round, 1, cardInHand(f.round, 1, 'gamble')).state;
    expect(legal(pending, 2, f.anti)).toBeUndefined();
    expect(
      applyCommand(
        pending,
        intent(pending, 'PLAY_RESPONSE', {
          responseWindowId: pending.responseWindow!.id,
          cardId: f.anti,
        }),
        { actorId: pending.players[2]!.id },
      ).status,
    ).toBe('REJECTED');
  });
  it('countering M06 keeps the original Cheating card pending and lets all original effects continue', () => {
    const f = opportunity(true, true);
    let state = play(f.pending, 2, f.anti).state;
    state = until(state, (s) => legal(s, 3, f.negate!) !== undefined);
    state = play(state, 3, f.negate!).state;
    const afterCounter = until(
      state,
      (s) => s.resolutionStack.at(-1)?.sourceCardId === f.cheating,
    );
    expect(afterCounter.gambling).not.toBeNull();
    const finished = finishWithEvents(afterCounter);
    expect(finished.state.gambling!.controlPlayerId).toBe(
      f.pending.players[1]!.id,
    );
    expect(finished.state.gambling!.leftPlayerIds).toContain(
      f.pending.players[2]!.id,
    );
    expect(finished.state.gambling!.pot).toBe(f.pending.gambling!.pot);
    expect(finished.events.some((e) => e.type === 'GAMBLING_FINISHED')).toBe(
      false,
    );
  });
  it.each(['promptId', 'responseWindowId'])(
    'rejects a stale %s without applying M06',
    (field) => {
      const f = opportunity();
      const result = submit(f.pending, f.anti, {
        [field]: field === 'promptId' ? 'prompt_stale' : 'window_stale',
      });
      expect(result.status).toBe('REJECTED');
      expect(result.events).toEqual([]);
      expect(result.state).toEqual(f.pending);
    },
  );
  it('uses the existing 30-second guest response deadline and rejects stale/early timeout requests', () => {
    const f = opportunity(true),
      p = f.pending.control.timedPrompt!;
    expect(p.kind).toBe('RESPONSE_DECISION');
    expect(p.priorityPlayerId).toBe(f.pending.players[2]!.id);
    expect(p.deadlineAt).toBe(p.openedAt + 30_000);
    const timeout = {
      type: 'EXPIRE_PROMPT',
      commandId: 'command_m06_timeout',
      roomId: f.pending.roomId,
      expectedStateVersion: f.pending.version,
      promptId: p.promptId,
      now: p.deadlineAt!,
    };
    expect(
      applyTimeout(f.pending, { ...timeout, now: p.deadlineAt! - 1 }).status,
    ).toBe('REJECTED');
    expect(
      applyTimeout(f.pending, { ...timeout, promptId: 'prompt_stale' }).status,
    ).toBe('REJECTED');
    const expired = applyTimeout(f.pending, timeout);
    expect(expired.status).toBe('ACCEPTED');
    expect(expired.state.control.timedPrompt?.promptId).not.toBe(p.promptId);
  });
  it('reconnect preserves the current M06 opportunity and deterministic replay matches its accepted command', () => {
    const f = opportunity(true);
    const restored = coreStateSchema.parse(
      JSON.parse(JSON.stringify(f.pending)) as unknown,
    );
    expect(projectPrivatePlayer(restored, restored.players[2]!.id)).toEqual(
      projectPrivatePlayer(f.pending, f.pending.players[2]!.id),
    );
    expect(legal(restored, 2, f.anti)).toBeDefined();
    const now = restored.control.timedPrompt!.openedAt;
    const command = intent(restored, 'PLAY_RESPONSE', {
      cardId: f.anti,
      responseWindowId: restored.responseWindow!.id,
      promptId: restored.control.timedPrompt!.promptId,
    });
    const result = applyCommand(restored, command, {
      actorId: restored.players[2]!.id,
      clock: { now: () => now },
    });
    expect(result.status).toBe('ACCEPTED');
    expect(
      replayFromSnapshot(restored, 0, [
        {
          actorId: restored.players[2]!.id,
          command,
          firstSequence: 1,
          lastSequence: result.events.length,
          events: result.events,
          clockTime: now,
          acceptedAt: new Date(now).toISOString(),
        },
      ]).state,
    ).toEqual(result.state);
    expect(settle(result.state).gambling).toBeNull();
  });
  it('keeps the hidden M06 card ID and legal play private to its owner', () => {
    const f = opportunity(true);
    expect(
      projectPrivatePlayer(f.pending, f.pending.players[2]!.id).legalPlays,
    ).toContainEqual(expect.objectContaining({ cardId: f.anti }));
    expect(JSON.stringify(projectPublicGame(f.pending))).not.toContain(f.anti);
    for (const seat of [0, 1, 3])
      expect(
        JSON.stringify(
          projectPrivatePlayer(f.pending, f.pending.players[seat]!.id),
        ),
      ).not.toContain(f.anti);
  });
});

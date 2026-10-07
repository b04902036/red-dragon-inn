import { describe, expect, it } from 'vitest';
import { cardDefinitionSchema } from '../../src/content/cards';
import { applyCommand } from '../../src/engine/commands';
import { activeGamblers } from '../../src/engine/gambling';
import { taskEvent } from '../../src/engine/workflow-state';
import type { CoreGameState } from '../../src/engine/types';
import type { DomainEvent } from '../../src/protocol/events';
import {
  projectPrivatePlayer,
  projectPublicGame,
} from '../../src/protocol/projections';
import { intent, mutable } from '../fixtures/core-match';
import { drinkState } from '../fixtures/drink-match';
import { cardInHand } from '../fixtures/timing-match';
import {
  genericState,
  putCard,
  play,
  send,
  until,
  settle,
  legal,
  systemTrigger,
  reconnectAndReplay,
} from '../fixtures/generic-match';
import {
  m12AnteEffects,
  m12AnteTrigger,
  m12DualEffects,
  m12DualTrigger,
} from '../fixtures/rdi2-m12-project';

function fixture(dual = false) {
  const initial = genericState();
  const avoidance = putCard(
    initial,
    2,
    dual ? m12DualEffects : m12AnteEffects,
    {
      trigger: dual ? m12DualTrigger : m12AnteTrigger,
    },
  );
  function addRaise(seat: number) {
    const card = putCard(
      initial,
      seat,
      [
        {
          op: 'TAKE_GAMBLING_CONTROL',
          allowedNextCategories: ['GAMBLING', 'CHEATING'],
        },
        { op: 'ANTE_ALL_ACTIVE', amount: 1 },
      ],
      { type: 'CHEATING', suffix: 'cheat' },
    );
    const definition = initial.definitions[initial.cards[card]!.definitionId]!;
    initial.definitions[definition.id] = cardDefinitionSchema.parse({
      ...definition,
      type: 'GAMBLING',
    });
    return card;
  }
  return { initial, avoidance, raise: addRaise(1), laterRaise: addRaise(3) };
}
function currentAnte(state: CoreGameState, seat: number) {
  const task = state.resolutionStack.at(-1)?.task;
  return (
    task?.kind === 'PAYMENT' &&
    task.purpose === 'ANTE' &&
    task.payer === state.players[seat]!.id
  );
}
function initialOpportunity(dual = false) {
  const f = fixture(dual);
  const queued = play(f.initial, 0, cardInHand(f.initial, 0, 'gamble'));
  const pending = until(
    queued.state,
    (s) => currentAnte(s, 2) && legal(s, 2, f.avoidance) !== undefined,
  );
  return { ...f, pending };
}
function raiseOpportunity(dual = false) {
  const f = fixture(dual);
  const round = settle(
    play(f.initial, 0, cardInHand(f.initial, 0, 'gamble')).state,
  );
  const pending = until(
    play(round, 1, f.raise).state,
    (s) => currentAnte(s, 2) && legal(s, 2, f.avoidance) !== undefined,
  );
  return { ...f, round, pending };
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

describe('M12 user override through generic authoritative workflows', () => {
  it('Template A avoids initial ante before deduction and leaves participation', () => {
    const f = initialOpportunity();
    expect(f.pending.players[2]!.gold).toBe(f.initial.players[2]!.gold);
    expect(taskEvent(f.pending.resolutionStack.at(-1)!.task)).toBe(
      'ANTE_REQUIRED',
    );
    expect(
      f.pending.gambling!.contributions.find(
        (c) => c.playerId === f.pending.players[2]!.id,
      )!.amount,
    ).toBe(0);
    const played = play(f.pending, 2, f.avoidance);
    const done = finishWithEvents(played.state);
    expect(done.state.players.map((p) => p.gold)).toEqual([9, 9, 10, 9]);
    expect(done.state.gambling!.pot).toBe(3);
    expect(activeGamblers(mutable(done.state))).not.toContain(
      f.initial.players[2]!.id,
    );
    expect(done.state.gambling!.leftPlayerIds).toContain(
      f.initial.players[2]!.id,
    );
    expect(
      [...played.events, ...done.events].filter(
        (e) =>
          e.type === 'GAMBLING_ANTE_PAID' &&
          e.playerId === f.initial.players[2]!.id,
      ),
    ).toEqual([]);
  });

  it.each([false, true])(
    'later I raise! uses Template B=%s without canceling the raise or refunding prior antes',
    (dual) => {
      const f = raiseOpportunity(dual);
      expect(f.pending.players[2]!.gold).toBe(9);
      expect(f.pending.resolutionStack.at(-1)!.task).toMatchObject({
        kind: 'PAYMENT',
        purpose: 'ANTE',
        amount: 1,
        canceled: false,
      });
      const done = settle(play(f.pending, 2, f.avoidance).state);
      expect(done.players.map((p) => p.gold)).toEqual([8, 8, 9, 8]);
      expect(done.gambling!.pot).toBe(7);
      expect(done.gambling!.contributions.map((c) => c.amount)).toEqual([
        2, 2, 1, 2,
      ]);
      expect(done.gambling!.controlPlayerId).toBe(f.initial.players[1]!.id);
      expect(done.gambling!.leftPlayerIds).toContain(f.initial.players[2]!.id);
      expect(done.players[2]!.characterDiscard).toContain(f.avoidance);
    },
  );

  it('keeps the previously anted Gold in the pot without issuing a refund', () => {
    const f = raiseOpportunity();
    expect(
      f.round.gambling!.contributions.find(
        (c) => c.playerId === f.round.players[2]!.id,
      )!.amount,
    ).toBe(1);
    const played = play(f.pending, 2, f.avoidance);
    const done = finishWithEvents(played.state);
    expect(done.state.players[2]!.gold).toBe(f.round.players[2]!.gold);
    expect(
      done.state.gambling!.contributions.find(
        (c) => c.playerId === f.round.players[2]!.id,
      )!.amount,
    ).toBe(1);
    expect(done.state.gambling!.pot).toBe(7);
    expect(
      [...played.events, ...done.events].filter(
        (e) =>
          e.type === 'GOLD_CHANGED' && e.playerId === f.round.players[2]!.id,
      ),
    ).toEqual([]);
  });

  it('future raises after leaving charge only active participants and create no Gog ante window', () => {
    const f = raiseOpportunity();
    const left = settle(play(f.pending, 2, f.avoidance).state);
    // Seat 3 has the next priority after the interrupted raise finishes.
    const priority = until(
      left,
      (s) => legal(s, 3, f.laterRaise) !== undefined,
    );
    const started = play(priority, 3, f.laterRaise);
    const done = finishWithEvents(started.state);
    const events = [...started.events, ...done.events];
    expect(done.state.players.map((p) => p.gold)).toEqual([7, 7, 9, 7]);
    expect(done.state.gambling!.pot).toBe(10);
    expect(
      done.state.gambling!.contributions.find(
        (c) => c.playerId === f.initial.players[2]!.id,
      )!.amount,
    ).toBe(1);
    expect(
      events.filter(
        (e) =>
          e.type === 'GAMBLING_ANTE_PAID' &&
          e.playerId === f.initial.players[2]!.id,
      ),
    ).toEqual([]);
    // Inspect every emitted window's authoritative source frame while draining
    // separately; no PAYMENT task for the departed player may appear.
    let state = started.state;
    while (state.responseWindow !== null) {
      expect(currentAnte(state, 2)).toBe(false);
      state = send(state, 'PASS_RESPONSE', {
        responseWindowId: state.responseWindow.id,
      }).state;
    }
  });

  it('post-leave Gambling/Cheating are rejected while legal Sometimes/Anytime remain available', () => {
    const f = fixture();
    f.initial.players[2]!.fortitude = 18;
    const sometimes = putCard(
      f.initial,
      2,
      [{ op: 'TAKE_FROM_GAMBLING_POT', amount: 1 }],
      {
        trigger: systemTrigger('GAMBLING_CHECKPOINT'),
        suffix: 'ignore',
      },
    );
    const anytime = putCard(
      f.initial,
      2,
      [{ op: 'CHANGE_STAT', target: 'SELF', stat: 'FORTITUDE', delta: 1 }],
      {
        type: 'ANYTIME',
        suffix: 'shove',
      },
    );
    const pending = until(
      play(f.initial, 0, cardInHand(f.initial, 0, 'gamble')).state,
      (s) => currentAnte(s, 2) && legal(s, 2, f.avoidance) !== undefined,
    );
    const played = play(pending, 2, f.avoidance);
    const checkpoint = until(
      played.state,
      (s) => legal(s, 2, sometimes) !== undefined,
    );
    expect(legal(checkpoint, 2, anytime)).toBeDefined();
    const cards = [
      cardInHand(checkpoint, 2, 'gamble'),
      cardInHand(checkpoint, 2, 'cheat'),
    ];
    for (const card of cards) {
      expect(legal(checkpoint, 2, card)).toBeUndefined();
      const rejected = applyCommand(
        checkpoint,
        intent(checkpoint, 'PLAY_RESPONSE', {
          cardId: card,
          responseWindowId: checkpoint.responseWindow!.id,
          promptId: checkpoint.control.timedPrompt!.promptId,
        }),
        { actorId: checkpoint.players[2]!.id },
      );
      expect(rejected.status).toBe('REJECTED');
      expect(rejected.state).toBe(checkpoint);
      expect(rejected.events).toEqual([]);
    }
    const taking = settle(play(checkpoint, 2, sometimes).state);
    const healed = settle(play(taking, 2, anytime).state);
    expect(healed.players[2]!.fortitude).toBe(19);
    expect(healed.gambling!.leftPlayerIds).toContain(f.initial.players[2]!.id);
    for (const card of cards) {
      expect(card).toBeDefined();
      expect(legal(healed, 2, card)).toBeUndefined();
      const rejected = applyCommand(
        healed,
        intent(healed, 'GAMBLING_PLAY', { cardId: card }),
        { actorId: healed.players[2]!.id },
      );
      expect(rejected).toMatchObject({
        status: 'REJECTED',
        code: 'NOT_ELIGIBLE',
        events: [],
      });
      expect(rejected.state).toBe(healed);
    }
  });

  it('Template B ignores the complete Drink with Chaser through shared resolution and never runs its leave branch', () => {
    const initial = drinkState(['tea', 'fizz']);
    initial.phase = 'ACTION';
    initial.players[0]!.fortitude = 18;
    const ignore = putCard(initial, 0, m12DualEffects, {
      trigger: m12DualTrigger,
    });
    const force = putCard(
      initial,
      1,
      [{ op: 'FORCE_DRINK', target: 'CHOSEN_PLAYER' }],
      { type: 'ANYTIME' },
    );
    const pending = until(
      play(initial, 1, force, initial.players[0]!.id).state,
      (s) =>
        s.resolutionStack.at(-1)?.kind === 'DRINK' &&
        legal(s, 0, ignore) !== undefined,
    );
    expect(pending.resolutionStack.at(-1)!.sourceCardIds).toHaveLength(2);
    const played = play(pending, 0, ignore);
    const done = finishWithEvents(played.state);
    expect(done.state.players[0]!.alcoholContent).toBe(
      initial.players[0]!.alcoholContent,
    );
    expect(done.state.players[0]!.fortitude).toBe(
      initial.players[0]!.fortitude,
    );
    expect(done.state.players[0]!.gold).toBe(initial.players[0]!.gold);
    expect(done.state.gambling).toBeNull();
    expect(
      [...played.events, ...done.events].some(
        (e) => e.type === 'GAMBLING_PLAYER_LEFT',
      ),
    ).toBe(false);
    expect(
      [...played.events, ...done.events].some(
        (e) => e.type === 'SOURCE_IGNORED',
      ),
    ).toBe(true);
  });

  it('a concrete later ante response preserves the 30-second guest opportunity, reconnect, replay and hidden IDs', () => {
    const f = raiseOpportunity();
    expect(f.pending.control.timedPrompt!.deadlineAt).toBe(
      f.pending.control.timedPrompt!.openedAt + 30_000,
    );
    expect(legal(f.pending, 2, f.avoidance)).toBeDefined();
    expect(JSON.stringify(projectPublicGame(f.pending))).not.toContain(
      f.avoidance,
    );
    expect(
      JSON.stringify(projectPrivatePlayer(f.pending, f.pending.players[1]!.id)),
    ).not.toContain(f.avoidance);
    reconnectAndReplay(f.pending);
    const before = JSON.stringify(f.pending);
    const stale = applyCommand(
      f.pending,
      intent(f.pending, 'PLAY_RESPONSE', {
        cardId: f.avoidance,
        responseWindowId: f.pending.responseWindow!.id,
        promptId: 'prompt_stale_m12',
      }),
      { actorId: f.pending.players[2]!.id },
    );
    expect(stale.status).toBe('REJECTED');
    expect(JSON.stringify(f.pending)).toBe(before);
  });
});

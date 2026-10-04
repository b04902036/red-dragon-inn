import { expect, it } from 'vitest';
import type { Effect } from '../../src/content/effects';
import type { ResponseTrigger } from '../../src/content/reaction-triggers';
import type { CoreGameState } from '../../src/engine/types';
import { applyCommand } from '../../src/engine/commands';
import {
  projectPublicGame,
  projectPrivatePlayer,
} from '../../src/protocol/projections';
import { DEFAULT_RULES } from '../../src/engine/rules';
import { intent } from '../fixtures/core-match';
import { drinkState } from '../fixtures/drink-match';
import { cardInHand } from '../fixtures/timing-match';
import {
  genericState,
  putCard,
  play,
  send,
  until,
  legal,
  systemTrigger,
  reconnectAndReplay,
} from '../fixtures/generic-match';

const cases: {
  effect: Effect;
  opportunity:
    | 'ANTE_REQUIRED'
    | 'PAYMENT_REQUIRED'
    | 'GAMBLING_CHECKPOINT'
    | 'GAMBLING_WIN_BEFORE_PAYOUT'
    | 'FORTITUDE_LOSS_RESOLVED'
    | 'PHASE'
    | 'DRINK'
    | 'CARD';
  seat: number;
}[] = [
  {
    effect: { op: 'SUBSTITUTE_PAYMENT_FROM_INN', amount: 1 },
    opportunity: 'ANTE_REQUIRED',
    seat: 0,
  },
  {
    effect: { op: 'SUBSTITUTE_PAYMENT_FROM_INN', amount: 1 },
    opportunity: 'PAYMENT_REQUIRED',
    seat: 0,
  },
  {
    effect: { op: 'CANCEL_CURRENT_ANTE_FOR_SELF' },
    opportunity: 'ANTE_REQUIRED',
    seat: 0,
  },
  {
    effect: {
      op: 'CONTEXT_BRANCH',
      branches: ['CANCEL_ANTE_AND_LEAVE', 'IGNORE_CURRENT_DRINK'],
    },
    opportunity: 'ANTE_REQUIRED',
    seat: 0,
  },
  {
    effect: { op: 'ANTE_ALL_ACTIVE', amount: 1 },
    opportunity: 'GAMBLING_CHECKPOINT',
    seat: 1,
  },
  {
    effect: { op: 'END_GAMBLING', potDestination: 'INN' },
    opportunity: 'GAMBLING_CHECKPOINT',
    seat: 1,
  },
  {
    effect: { op: 'TAKE_FROM_GAMBLING_POT', amount: 1 },
    opportunity: 'GAMBLING_CHECKPOINT',
    seat: 1,
  },
  {
    effect: { op: 'REPLACE_GAMBLING_WINNER', target: 'SELF' },
    opportunity: 'GAMBLING_WIN_BEFORE_PAYOUT',
    seat: 1,
  },
  {
    effect: {
      op: 'CHANGE_STAT',
      target: 'ORIGINAL_SOURCE_PLAYER',
      stat: 'FORTITUDE',
      delta: -2,
    },
    opportunity: 'FORTITUDE_LOSS_RESOLVED',
    seat: 1,
  },
  {
    effect: { op: 'ORDER_EXTRA_DRINKS', count: 2 },
    opportunity: 'PHASE',
    seat: 0,
  },
  {
    effect: { op: 'PASS_CURRENT_DRINK', target: 'CHOSEN_PLAYER' },
    opportunity: 'DRINK',
    seat: 0,
  },
  {
    effect: { op: 'SPLIT_CURRENT_DRINK', target: 'CHOSEN_PLAYER' },
    opportunity: 'DRINK',
    seat: 0,
  },
  {
    effect: { op: 'REPLACE_DRINK_ALCOHOL_WITH_FORTITUDE' },
    opportunity: 'DRINK',
    seat: 0,
  },
  {
    effect: { op: 'QUEUE_EXTRA_DRINK', target: 'SOURCE_ACTOR' },
    opportunity: 'DRINK',
    seat: 1,
  },
  {
    effect: {
      op: 'CONTEXT_BRANCH',
      branches: ['CANCEL_ANTE_AND_LEAVE', 'IGNORE_DRINK_AND_PAY_INN_1'],
    },
    opportunity: 'DRINK',
    seat: 0,
  },
  {
    effect: { op: 'MODIFY_DRINK', alcoholDelta: 2, fortitudeDelta: 0 },
    opportunity: 'DRINK',
    seat: 0,
  },
  {
    effect: { op: 'IGNORE', scope: 'CURRENT_EFFECT' },
    opportunity: 'DRINK',
    seat: 0,
  },
  {
    effect: { op: 'REDIRECT_FORTITUDE_LOSS', target: 'CHOSEN_PLAYER' },
    opportunity: 'CARD',
    seat: 1,
  },
];
it.each(cases)(
  '$effect.op at $opportunity rejects stale prompts and resets after a nested counter, then times out/reconnects/replays safely',
  ({ effect, opportunity, seat }) => {
    const state =
      opportunity === 'DRINK' ? drinkState(['fizz', 'tea']) : genericState();
    state.rules.timing = { ...DEFAULT_RULES.timing };
    if (opportunity === 'PHASE') state.phase = 'ORDER_DRINK';
    const trigger: ResponseTrigger =
      opportunity === 'PHASE'
        ? {
            event: 'SYSTEM',
            alternatives: [
              [
                {
                  kind: 'PHASE_OPPORTUNITY',
                  phase: 'ORDER_DRINK',
                  actor: 'SELF',
                },
              ],
            ],
          }
        : opportunity === 'DRINK' || opportunity === 'CARD'
          ? { event: opportunity, alternatives: [[]] }
          : systemTrigger(opportunity);
    const options = {
      trigger,
      ...(opportunity === 'PHASE'
        ? { phaseOpportunity: 'ORDER_DRINK' as const }
        : {}),
    };
    const response = putCard(state, seat, [effect], options);
    putCard(state, seat, [{ op: 'DRAW_CARDS', target: 'SELF', count: 1 }], {
      ...options,
      suffix: 'shove',
    });
    const counterSeat = seat === 0 ? 2 : 3;
    const counter = putCard(
      state,
      counterSeat,
      [{ op: 'NEGATE', scope: 'TOP_STACK' }],
      { trigger: { event: 'CARD', alternatives: [[]] }, suffix: 'negate' },
    );
    let pending: CoreGameState;
    if (opportunity === 'DRINK')
      pending = send(state, 'TAKE_DRINK', {}, 0).state;
    else if (opportunity === 'PHASE')
      pending = play(state, 0, response).state; // Its root play is legal before the system opportunity.
    else if (
      opportunity === 'CARD' ||
      opportunity === 'FORTITUDE_LOSS_RESOLVED'
    ) {
      const attack = putCard(
        state,
        0,
        [
          {
            op: 'CHANGE_STAT',
            target: 'CHOSEN_PLAYER',
            stat: 'FORTITUDE',
            delta: -2,
          },
        ],
        { type: 'ACTION', suffix: 'gamble' },
      );
      pending = play(state, 0, attack, state.players[1]!.id).state;
    } else if (opportunity === 'PAYMENT_REQUIRED') {
      const charge = putCard(
        state,
        1,
        [{ op: 'PAY_INN', target: 'CHOSEN_PLAYER', amount: 2 }],
        { type: 'ANYTIME', suffix: 'gamble' },
      );
      pending = play(state, 1, charge, state.players[0]!.id).state;
    } else pending = play(state, 0, cardInHand(state, 0, 'gamble')).state;
    if (opportunity === 'GAMBLING_WIN_BEFORE_PAYOUT') {
      pending = until(pending, (s) => s.responseWindow === null);
      while (pending.resolutionStack.at(-1)?.task?.kind !== 'SETTLEMENT') {
        if (pending.responseWindow !== null) {
          pending = send(pending, 'PASS_RESPONSE', {
            responseWindowId: pending.responseWindow.id,
          }).state;
          continue;
        }
        pending = send(
          pending,
          'GAMBLING_PASS',
          {},
          pending.players.findIndex(
            (p) => p.id === pending.gambling!.priorityPlayerId,
          ),
        ).state;
      }
    }
    if (opportunity === 'PHASE') {
      // Cancel the root card first; a separately held phase card creates the system prompt.
      pending = until(
        pending,
        (s) =>
          s.responseWindow?.priorityPlayerId === s.players[counterSeat]!.id,
      );
      pending = play(pending, counterSeat, counter).state;
      pending = until(
        pending,
        (s) => s.resolutionStack.at(-1)?.task?.kind === 'PHASE',
      );
      reconnectAndReplay(pending);
      return;
    }
    pending = until(pending, (s) => legal(s, seat, response) !== undefined);
    const parent = pending.resolutionStack.at(-1)!.id;
    const old = pending.control.timedPrompt!;
    expect(old.deadlineAt - old.openedAt).toBe(30000);
    const target =
      'target' in effect && effect.target === 'CHOSEN_PLAYER'
        ? state.players[2]!.id
        : undefined;
    pending = play(pending, seat, response, target, old.openedAt + 100).state;
    expect(
      applyCommand(
        pending,
        intent(pending, 'PASS_RESPONSE', {
          responseWindowId: old.windowId,
          promptId: old.promptId,
        }),
        {
          actorId: state.players[seat]!.id,
          clock: { now: () => old.openedAt + 101 },
        },
      ).status,
    ).toBe('REJECTED');
    pending = until(
      pending,
      (s) => legal(s, counterSeat, counter) !== undefined,
    );
    pending = play(pending, counterSeat, counter).state;
    pending = until(
      pending,
      (s) =>
        s.resolutionStack.at(-1)?.id === parent && s.responseWindow !== null,
    );
    const fresh = pending.control.timedPrompt!;
    expect(fresh.promptId).not.toBe(old.promptId);
    expect(fresh.deadlineAt).toBe(old.openedAt + 100 + 30000);
    for (const foreign of pending.players[counterSeat]!.hand)
      expect(
        JSON.stringify(
          projectPrivatePlayer(pending, pending.players[seat]!.id),
        ),
      ).not.toContain(JSON.stringify(foreign));
    expect(JSON.stringify(projectPublicGame(pending))).not.toContain(
      'legalPlays',
    );
    reconnectAndReplay(pending);
  },
  10000,
);

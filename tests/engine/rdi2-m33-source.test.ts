import { expect, it } from 'vitest';
import type { Effect } from '../../src/content/effects';
import { applyCommand } from '../../src/engine/commands';
import { intent } from '../fixtures/core-match';
import {
  genericState,
  putCard,
  play,
  settle,
  until,
  legal,
  passCurrent,
  systemTrigger,
  reconnectAndReplay,
} from '../fixtures/generic-match';

// Synthetic definitions exercise shared handlers; this is not compiled RDI2 content.
const effects: Effect[] = [
  { op: 'CHANGE_STAT', target: 'CHOSEN_PLAYER', stat: 'FORTITUDE', delta: -3 },
  { op: 'PAY_INN', target: 'SELF', amount: 1 },
];
function fixture() {
  const state = genericState();
  const card = putCard(state, 0, effects, { type: 'ACTION' });
  return { state, card };
}
function defense(
  state: ReturnType<typeof genericState>,
  seat: number,
  op: 'IGNORE' | 'NEGATE',
  gold = false,
) {
  return putCard(
    state,
    seat,
    [
      op === 'IGNORE'
        ? { op, scope: 'CURRENT_EFFECT' }
        : { op, scope: 'TOP_STACK' },
    ],
    {
      suffix: 'shove',
      trigger: {
        event: 'CARD',
        alternatives: [
          [
            { kind: 'SOURCE_TYPE', types: ['ACTION', 'SOMETIMES', 'ANYTIME'] },
            ...(gold
              ? [
                  {
                    kind: 'PENDING_STAT' as const,
                    stat: 'GOLD' as const,
                    direction: 'ANY' as const,
                    relation: 'SELF' as const,
                  },
                ]
              : []),
          ],
        ],
      },
    },
  );
}
it('A/B: responses precede ordered three-damage and one-Gold payment, with normal replayable timing', () => {
  const { state, card } = fixture();
  defense(state, 1, 'IGNORE');
  const played = play(state, 0, card, state.players[1]!.id);
  expect(played.state.players.map((p) => [p.fortitude, p.gold])).toEqual(
    state.players.map((p) => [p.fortitude, p.gold]),
  );
  expect(played.state.responseWindow).not.toBeNull();
  expect(played.events.some((e) => e.type === 'GOLD_CHANGED')).toBe(false);
  reconnectAndReplay(played.state);
  let pending = until(
    played.state,
    (s) => s.control.timedPrompt?.priorityPlayerId === s.players[1]!.id,
  );
  expect(
    pending.control.timedPrompt!.deadlineAt! -
      pending.control.timedPrompt!.openedAt,
  ).toBe(30000);
  const events = [...played.events];
  for (
    let i = 0;
    i < 128 &&
    (pending.responseWindow !== null || pending.control.phaseEnd !== null);
    i++
  ) {
    const result = passCurrent(pending);
    events.push(...result.events);
    pending = result.state;
  }
  expect(pending.responseWindow).toBeNull();
  expect(pending.control.phaseEnd).toBeNull();
  expect(pending.players[1]!.fortitude).toBe(state.players[1]!.fortitude - 3);
  expect(pending.players[0]!.gold).toBe(state.players[0]!.gold - 1);
  const changes = events.filter(
    (e) => e.type === 'FORTITUDE_CHANGED' || e.type === 'GOLD_CHANGED',
  );
  expect(changes).toMatchObject([
    { type: 'FORTITUDE_CHANGED', playerId: state.players[1]!.id, delta: -3 },
    { type: 'GOLD_CHANGED', playerId: state.players[0]!.id, delta: -1 },
  ]);
});
it.each(['NEGATE', 'IGNORE'] as const)(
  'C/D: target %s preserves standard cancellation boundaries',
  (op) => {
    const { state, card } = fixture();
    const response = defense(state, 1, op);
    let pending = until(
      play(state, 0, card, state.players[1]!.id).state,
      (s) => legal(s, 1, response) !== undefined,
    );
    pending = play(pending, 1, response).state;
    const final = settle(pending);
    expect(final.players[1]!.fortitude).toBe(state.players[1]!.fortitude);
    expect(final.players[0]!.gold).toBe(
      state.players[0]!.gold - (op === 'IGNORE' ? 1 : 0),
    );
    expect(final.players[1]!.gold).toBe(state.players[1]!.gold);
  },
);
it('E: existing Inn substitution responds to the later self-payment without undoing damage', () => {
  const { state, card } = fixture();
  const response = putCard(
    state,
    0,
    [{ op: 'SUBSTITUTE_PAYMENT_FROM_INN', amount: 1 }],
    {
      suffix: 'shove',
      trigger: systemTrigger('PAYMENT_REQUIRED', [
        {
          kind: 'PAYMENT_CONTEXT',
          payer: 'SELF',
          purpose: 'PAYMENT',
          minAmount: 1,
        },
      ]),
    },
  );
  let pending = until(
    play(state, 0, card, state.players[1]!.id).state,
    (s) => legal(s, 0, response) !== undefined,
  );
  const task = pending.resolutionStack.at(-1)!.task;
  expect(task).toMatchObject({
    kind: 'PAYMENT',
    payer: state.players[0]!.id,
    destination: 'INN',
    amount: 1,
    full: false,
  });
  expect(pending.players[1]!.fortitude).toBe(state.players[1]!.fortitude - 3);
  expect(pending.players[0]!.gold).toBe(state.players[0]!.gold);
  reconnectAndReplay(pending);
  pending = play(pending, 0, response).state;
  const final = settle(pending);
  expect(final.players[0]!.gold).toBe(state.players[0]!.gold);
  expect(final.players[1]!.fortitude).toBe(state.players[1]!.fortitude - 3);
});
it("F: an otherwise eligible Gold Ignore cannot avoid payment from the actor's own Action", () => {
  const { state, card } = fixture();
  const response = defense(state, 0, 'IGNORE', true);
  const pending = play(state, 0, card, state.players[1]!.id).state;
  expect(legal(pending, 0, response)).toBeUndefined();
  const result = applyCommand(
    pending,
    intent(pending, 'PLAY_RESPONSE', {
      cardId: response,
      responseWindowId: pending.responseWindow!.id,
    }),
    { actorId: state.players[0]!.id, clock: { now: () => 1000 } },
  );
  expect(result.status).toBe('REJECTED');
  expect(result.state).toEqual(pending);
  const final = settle(pending);
  expect(final.players[0]!.gold).toBe(state.players[0]!.gold - 1);
  expect(final.players[1]!.fortitude).toBe(state.players[1]!.fortitude - 3);
});
it('G: forged self-target rejects through server validation', () => {
  const { state, card } = fixture();
  expect(legal(state, 0, card)!.legalTargetPlayerIds).not.toContain(
    state.players[0]!.id,
  );
  const result = applyCommand(
    state,
    intent(state, 'PLAY_CARD', {
      cardId: card,
      targetPlayerId: state.players[0]!.id,
    }),
    { actorId: state.players[0]!.id },
  );
  expect(result.status).toBe('REJECTED');
  expect(result.state).toEqual(state);
});
it.each([0, 1])(
  'Gold %s does not impose an upfront prerequisite or roll damage back; elimination remains deferred',
  (gold) => {
    const { state, card } = fixture();
    state.players[0]!.gold = gold;
    const rescue = putCard(
      state,
      0,
      [{ op: 'CHANGE_STAT', target: 'SELF', stat: 'GOLD', delta: 1 }],
      { type: 'ANYTIME', suffix: 'shove' },
    );
    expect(legal(state, 0, card)).toBeDefined();
    const played = play(state, 0, card, state.players[1]!.id);
    expect(played.state.players[0]!.gold).toBe(gold);
    const pending = until(
      played.state,
      (s) =>
        s.players[1]!.fortitude === state.players[1]!.fortitude - 3 &&
        s.players[0]!.gold === 0 &&
        s.control.phaseEnd !== null,
    );
    expect(pending.players[0]!.eliminated).toBe(false);
    expect(legal(pending, 0, rescue)).toBeDefined();
    const final = settle(play(pending, 0, rescue).state);
    expect(final.players[0]!.gold).toBe(1);
    expect(final.players[0]!.eliminated).toBe(false);
    expect(final.players[1]!.fortitude).toBe(state.players[1]!.fortitude - 3);
  },
);
it("F regression: Gold Ignore still protects against another player's payment card", () => {
  const state = genericState(),
    response = defense(state, 1, 'IGNORE', true);
  const card = putCard(
    state,
    0,
    [{ op: 'PAY_INN', target: 'CHOSEN_PLAYER', amount: 1 }],
    { type: 'ACTION' },
  );
  const pending = until(
    play(state, 0, card, state.players[1]!.id).state,
    (s) => legal(s, 1, response) !== undefined,
  );
  expect(settle(play(pending, 1, response).state).players[1]!.gold).toBe(
    state.players[1]!.gold,
  );
});
it('F regression: own Gold gain may still be Ignored; the restriction is payment-specific', () => {
  const state = genericState(),
    response = defense(state, 0, 'IGNORE', true);
  const card = putCard(
    state,
    0,
    [{ op: 'CHANGE_STAT', target: 'SELF', stat: 'GOLD', delta: 1 }],
    { type: 'ACTION' },
  );
  const pending = play(state, 0, card).state;
  expect(legal(pending, 0, response)).toBeDefined();
  expect(settle(play(pending, 0, response).state).players[0]!.gold).toBe(
    state.players[0]!.gold,
  );
});
it('F regression: own payment to another player uses the same Gold Ignore restriction', () => {
  const state = genericState(),
    response = defense(state, 0, 'IGNORE', true);
  const card = putCard(
    state,
    0,
    [{ op: 'TRANSFER_GOLD', target: 'CHOSEN_PLAYER', amount: 1 }],
    { type: 'ACTION' },
  );
  const pending = play(state, 0, card, state.players[1]!.id).state;
  expect(legal(pending, 0, response)).toBeUndefined();
  const final = settle(pending);
  expect(final.players[0]!.gold).toBe(state.players[0]!.gold - 1);
  expect(final.players[1]!.gold).toBe(state.players[1]!.gold + 1);
});

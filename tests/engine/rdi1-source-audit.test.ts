import { describe, expect, it } from 'vitest';
import { cardDefinitionSchema } from '../../src/content/cards';
import type { Effect } from '../../src/content/effects';
import type { ResponseTrigger } from '../../src/content/reaction-triggers';
import { applyCommand } from '../../src/engine/commands';
import type { CoreGameState } from '../../src/engine/types';
import { projectPrivatePlayer } from '../../src/protocol/projections';
import { accepted, intent, mutable } from '../fixtures/core-match';
import { drinkState, resolveResponses } from '../fixtures/drink-match';
import { gamblingPlay, startRound } from '../fixtures/gambling-match';
import {
  actionState,
  cardInHand,
  playAction,
  priorityFor,
} from '../fixtures/timing-match';

// These are Step-20 behavior probes, not a compiler for the private source.
// Unsupported positive source expectations belong to Step 21B implementation.
function configure(
  input: CoreGameState,
  seat: number,
  effects: Effect[],
  trigger?: ResponseTrigger,
) {
  const state = mutable(input);
  const id = state.cards[cardInHand(state, seat, 'breather')]!.definitionId;
  state.definitions[id] = cardDefinitionSchema.parse({
    ...state.definitions[id],
    type: trigger === undefined ? 'ANYTIME' : 'SOMETIMES',
    ...(trigger === undefined
      ? {}
      : { responseKind: 'SOMETIMES', responseTrigger: trigger }),
    effects,
  });
  return state;
}
function projected(state: CoreGameState, seat: number) {
  return projectPrivatePlayer(state, state.players[seat]!.id).legalPlays.find(
    (p) => p.cardId === cardInHand(state, seat, 'breather'),
  );
}
function submit(state: CoreGameState, seat: number, target?: string) {
  const command = state.responseWindow === null ? 'PLAY_CARD' : 'PLAY_RESPONSE';
  return applyCommand(
    state,
    intent(state, command, {
      cardId: cardInHand(state, seat, 'breather'),
      ...(state.responseWindow === null
        ? {}
        : { responseWindowId: state.responseWindow.id }),
      ...(target === undefined ? {} : { targetPlayerId: target }),
    }),
    { actorId: state.players[seat]!.id },
  );
}
const ignore: Effect[] = [{ op: 'IGNORE', scope: 'CURRENT_EFFECT' }];
const cardLoss: ResponseTrigger = {
  event: 'CARD',
  alternatives: [
    [
      { kind: 'SOURCE_TYPE', types: ['ACTION', 'SOMETIMES'] },
      {
        kind: 'PENDING_STAT',
        stat: 'FORTITUDE',
        direction: 'LOSS',
        relation: 'SELF',
      },
    ],
  ],
};

describe('Step-20 primitives and source boundaries', () => {
  it.each([
    { stat: 'FORTITUDE', delta: -2, legal: true },
    { stat: 'FORTITUDE', delta: 2, legal: false },
    { stat: 'ALCOHOL', delta: 2, legal: false },
    { stat: 'GOLD', delta: -1, legal: false },
  ] as const)(
    'direct Fortitude loss Ignore distinguishes $stat/$delta',
    ({ stat, delta, legal }) => {
      const source = configure(
        actionState([
          { op: 'CHANGE_STAT', target: 'CHOSEN_PLAYER', stat, delta },
        ]),
        1,
        ignore,
        cardLoss,
      );
      const pending = priorityFor(playAction(source).state, 1);
      expect(projected(pending, 1) !== undefined).toBe(legal);
      const result = submit(pending, 1);
      expect(result.status).toBe(legal ? 'ACCEPTED' : 'REJECTED');
      if (result.status === 'ACCEPTED') {
        const resolved = resolveResponses(result.state).state;
        expect(resolved.players[1]!.fortitude).toBe(20);
      } else expect(result.events).toEqual([]);
    },
  );

  it('Drink Ignore is limited to the affected drinker, including combined Chasers', () => {
    const state = mutable(drinkState(['tea', 'fizz']));
    const id = state.cards[cardInHand(state, 0, 'breather')]!.definitionId;
    state.definitions[id] = cardDefinitionSchema.parse({
      ...state.definitions[id],
      type: 'SOMETIMES',
      responseKind: 'SOMETIMES',
      responseTrigger: {
        event: 'DRINK',
        alternatives: [[{ kind: 'AFFECTS', relation: 'SELF' }]],
      },
      effects: ignore,
    });
    const pending = accepted(state, 'TAKE_DRINK').state;
    expect(projected(pending, 0)).toMatchObject({
      commandType: 'PLAY_RESPONSE',
    });
    const result = submit(pending, 0);
    expect(result.status).toBe('ACCEPTED');
    expect(
      resolveResponses(result.state).state.players[0]!.alcoholContent,
    ).toBe(0);
    expect(pending.responseWindow!.eligiblePlayerIds).not.toContain('player_1');
    expect(projected(pending, 1)).toBeUndefined();
    expect(submit(pending, 1).status).toBe('REJECTED');
  });

  it.each([2, -2])(
    'current-Drink alcohol modifier %i rejects Drink Events',
    (alcoholDelta) => {
      for (const suffix of ['fizz', 'toast']) {
        const source = configure(drinkState([suffix]), 1, [
          {
            op: 'MODIFY_DRINK',
            alcoholDelta,
            fortitudeDelta: 0,
          },
        ]);
        const queued = accepted(source, 'TAKE_DRINK').state;
        const pending = suffix === 'fizz' ? priorityFor(queued, 1) : queued;
        expect(projected(pending, 1) !== undefined).toBe(suffix === 'fizz');
        const result = submit(pending, 1);
        expect(result.status).toBe(suffix === 'fizz' ? 'ACCEPTED' : 'REJECTED');
        if (result.status === 'ACCEPTED')
          expect(
            resolveResponses(result.state).state.players[0]!.alcoholContent,
          ).toBe(Math.max(0, 2 + alcoholDelta));
      }
    },
  );

  it('Anytime works in ordinary phases but is absent/rejected during gambling', () => {
    const normal = actionState();
    expect(projected(normal, 1)).toBeDefined();
    expect(submit(normal, 1).status).toBe('ACCEPTED');
    const gambling = startRound().state;
    expect(projected(gambling, 1)).toBeUndefined();
    expect(submit(gambling, 1)).toMatchObject({
      status: 'REJECTED',
      code: 'RESOLUTION_PENDING',
      events: [],
    });
  });

  it('a negate-Cheating response cannot currently win the round immediately', () => {
    const source = configure(
      startRound().state,
      2,
      [{ op: 'NEGATE', scope: 'TOP_STACK' }, { op: 'WIN_GAMBLING' }],
      {
        event: 'CARD',
        alternatives: [
          [
            { kind: 'SOURCE_TYPE', types: ['CHEATING'] },
            { kind: 'GAMBLING', fact: 'PARTICIPANT' },
            { kind: 'NEGATABLE', value: true },
          ],
        ],
      },
    );
    const pending = priorityFor(gamblingPlay(source, 1, 'cheat').state, 2);
    expect(projected(pending, 2)).toBeUndefined();
    expect(submit(pending, 2)).toMatchObject({
      status: 'REJECTED',
      events: [],
    });
    expect(pending.gambling!.pot).toBe(4);
    expect(pending.resolutionStack.at(-1)!.parentId).toBe(
      pending.gambling!.suspended.resolutionId,
    );
  });

  it('phase-scoped Sometimes is not an Order Drink opportunity before or after ordering', () => {
    const state = configure(
      drinkState([]),
      0,
      [
        {
          op: 'PAY_INN',
          target: 'SELF',
          amount: 1,
        },
      ],
      {
        event: 'SYSTEM',
        alternatives: [[{ kind: 'PHASE', phases: ['ORDER_DRINK'] }]],
      },
    );
    state.phase = 'ORDER_DRINK';
    expect(projected(state, 0)).toBeUndefined();
    expect(submit(state, 0).status).toBe('REJECTED');
    const ordered = accepted(state, 'ORDER_DRINK', {
      targetPlayerId: state.players[1]!.id,
    }).state;
    expect(projected(ordered, 0)).toBeUndefined();
    expect(submit(ordered, 0).status).toBe('REJECTED');
  });

  it('pending loss is not the required post-loss retaliation event', () => {
    const source = configure(
      actionState(),
      1,
      [
        {
          op: 'CHANGE_STAT',
          target: 'CHOSEN_PLAYER',
          stat: 'FORTITUDE',
          delta: -2,
        },
      ],
      cardLoss,
    );
    const pending = priorityFor(playAction(source).state, 1);
    // A naive pending-loss predicate offers retaliation too early.
    expect(pending.players[1]!.fortitude).toBe(20);
    expect(projected(pending, 1)).toBeDefined();
    const resolved = resolveResponses(pending).state;
    expect(resolved.players[1]!.fortitude).toBe(18);
    expect(resolved.responseWindow).toBeNull();
    expect(projected(resolved, 1)).toBeUndefined();
  });

  it('TRANSFER_GOLD currently pays actor to target, so collection cannot reuse it', () => {
    const state = configure(actionState(), 0, [
      { op: 'TRANSFER_GOLD', target: 'CHOSEN_PLAYER', amount: 1 },
    ]);
    const before = state.players.map((p) => p.gold);
    const result = submit(state, 0, 'player_1');
    expect(result.status).toBe('ACCEPTED');
    const resolved = resolveResponses(result.state).state;
    expect(resolved.players[0]!.gold).toBe(before[0]! - 1);
    expect(resolved.players[1]!.gold).toBe(before[1]! + 1);
  });

  it('chosen targets exclude SELF even when source legality allows any living player', () => {
    const state = configure(actionState(), 0, [
      { op: 'PAY_INN', target: 'CHOSEN_PLAYER', amount: 1 },
    ]);
    expect(projected(state, 0)!.legalTargetPlayerIds).toEqual([
      'player_1',
      'player_2',
      'player_3',
    ]);
    expect(submit(state, 0, 'player_0')).toMatchObject({
      status: 'REJECTED',
      code: 'INVALID_TARGET',
      events: [],
    });
  });

  it('capped payment does not establish full mandatory-cost affordability', () => {
    const state = configure(actionState(), 0, [
      { op: 'PAY_INN', target: 'SELF', amount: 2 },
    ]);
    state.players[0]!.gold = 1;
    expect(projected(state, 0)).toBeDefined();
    const result = submit(state, 0);
    expect(result.status).toBe('ACCEPTED');
    const resolved = resolveResponses(result.state);
    expect(resolved.events).toContainEqual(
      expect.objectContaining({
        type: 'GOLD_CHANGED',
        playerId: 'player_0',
        delta: -1,
      }),
    );
  });

  it('unqualified NEGATE lacks the protected-family and Drink-change exclusion rules', () => {
    const source = configure(
      actionState([{ op: 'DRAW_CARDS', target: 'SELF', count: 1 }]),
      1,
      [{ op: 'NEGATE', scope: 'TOP_STACK' }],
      { event: 'CARD', alternatives: [[{ kind: 'NEGATABLE', value: true }]] },
    );
    const pending = priorityFor(playAction(source, null).state, 1);
    expect(projected(pending, 1)).toBeDefined();
    expect(submit(pending, 1).status).toBe('ACCEPTED');
    // Source is a draw, not a Drink-changing card; generic NEGATE is too broad.
    expect(pending.resolutionStack.at(-1)!.effects).toEqual([
      { op: 'DRAW_CARDS', target: 'SELF', count: 1 },
    ]);
  });
});

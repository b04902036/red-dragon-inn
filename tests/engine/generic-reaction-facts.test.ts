import { expect, it } from 'vitest';
import type { ReactionCondition } from '../../src/content/reaction-triggers';
import {
  legalResponsesForPlayer,
  reactionContext,
} from '../../src/engine/reaction-legality';
import { sourceCapabilities } from '../../src/engine/source-capabilities';
import { cardDefinitionSchema } from '../../src/content/cards';
import { mutable } from '../fixtures/core-match';
import { cardInHand } from '../fixtures/timing-match';
import {
  genericState,
  putCard,
  play,
  settle,
  systemTrigger,
  until,
} from '../fixtures/generic-match';

it.each([
  [
    {
      kind: 'SOURCE_CAPABILITY',
      capabilities: ['DIRECT_ALCOHOL_STAT'],
      match: 'ANY',
    },
    true,
  ],
  [
    {
      kind: 'SOURCE_CAPABILITY',
      capabilities: ['DIRECT_ALCOHOL_STAT', 'FORCES_DRINK'],
      match: 'ALL',
    },
    false,
  ],
  [
    {
      kind: 'SOURCE_CAPABILITY',
      capabilities: ['DIRECT_ALCOHOL_STAT'],
      match: 'ALL',
    },
    true,
  ],
  [
    {
      kind: 'SOURCE_CAPABILITY',
      capabilities: ['DIRECT_ALCOHOL_STAT'],
      match: 'NONE',
    },
    false,
  ],
  [
    {
      kind: 'SOURCE_CAPABILITY',
      capabilities: ['ORDERS_DRINK'],
      match: 'NONE',
    },
    true,
  ],
  [{ kind: 'COUNTER_FAMILY', relation: 'SAME' }, true],
  [{ kind: 'COUNTER_FAMILY', relation: 'DIFFERENT' }, false],
  [{ kind: 'COUNTER_FAMILY', relation: 'UNPROTECTED' }, false],
] satisfies [ReactionCondition, boolean][])(
  'evaluates source facts %j without titles',
  (condition, expected) => {
    const state = genericState();
    const source = putCard(
      state,
      0,
      [{ op: 'CHANGE_STAT', target: 'SELF', stat: 'ALCOHOL', delta: 1 }],
      {
        type: 'ANYTIME',
        counterFamily: 'original-family',
        counterPolicy: 'SAME_FAMILY_ONLY',
      },
    );
    const response = putCard(
      state,
      1,
      [{ op: 'DRAW_CARDS', target: 'SELF', count: 1 }],
      {
        trigger: { event: 'CARD', alternatives: [[condition]] },
        counterFamily: 'original-family',
      },
    );
    const pending = play(state, 0, source).state;
    const context = reactionContext(pending, pending.resolutionStack.at(-1)!);
    expect(
      legalResponsesForPlayer(pending, pending.players[1]!.id, context).some(
        (c) => c.cardId === response,
      ),
    ).toBe(expected);
  },
);

it.each([
  'notAfterFinalPass',
  'notAnteAvoidance',
  'sourceWillNotEndRound',
] as const)(
  'enforces checkpoint restriction %s in shared legality',
  (restriction) => {
    const state = genericState();
    const response = putCard(
      state,
      1,
      [{ op: 'END_GAMBLING', potDestination: 'INN' }],
      {
        trigger: systemTrigger('GAMBLING_CHECKPOINT', [
          {
            kind: 'GAMBLING_CHECKPOINT',
            notAfterFinalPass: true,
            notAnteAvoidance: true,
            sourceWillNotEndRound: true,
            potMin: 1,
          },
        ]),
      },
    );
    let pending = play(state, 0, cardInHand(state, 0, 'gamble')).state;
    pending = until(
      pending,
      (s) => s.resolutionStack.at(-1)?.task?.kind === 'CHECKPOINT',
    );
    const copy = mutable(pending);
    const frame = copy.resolutionStack.at(-1)!;
    if (frame.task?.kind !== 'CHECKPOINT')
      throw new Error('Missing checkpoint');
    const context = reactionContext(copy, frame);
    expect(
      legalResponsesForPlayer(copy, copy.players[1]!.id, context).some(
        (c) => c.cardId === response,
      ),
    ).toBe(true);
    if (restriction === 'notAfterFinalPass') frame.task.afterFinalPass = true;
    if (restriction === 'notAnteAvoidance') frame.task.anteAvoidance = true;
    if (restriction === 'sourceWillNotEndRound')
      frame.task.sourceEndsRound = true;
    expect(
      legalResponsesForPlayer(
        copy,
        copy.players[1]!.id,
        reactionContext(copy, frame),
      ).some((c) => c.cardId === response),
    ).toBe(false);
  },
);

it('evaluates original-source and actual-loss thresholds on committed post-loss facts', () => {
  const state = genericState();
  const response = putCard(
    state,
    1,
    [
      {
        op: 'CHANGE_STAT',
        target: 'ORIGINAL_SOURCE_PLAYER',
        stat: 'FORTITUDE',
        delta: -1,
      },
    ],
    {
      trigger: systemTrigger('FORTITUDE_LOSS_RESOLVED', [
        { kind: 'ORIGINAL_SOURCE_PLAYER', relation: 'OTHER' },
        {
          kind: 'ACTUAL_STAT_LOSS',
          stat: 'FORTITUDE',
          relation: 'SELF',
          minAmount: 2,
        },
      ]),
    },
  );
  let pending = play(
    state,
    0,
    cardInHand(state, 0, 'shove'),
    state.players[1]!.id,
  ).state;
  pending = until(
    pending,
    (s) => s.resolutionStack.at(-1)?.task?.kind === 'POST_LOSS',
  );
  const copy = mutable(pending),
    frame = copy.resolutionStack.at(-1)!;
  expect(
    legalResponsesForPlayer(
      copy,
      copy.players[1]!.id,
      reactionContext(copy, frame),
    ).some((c) => c.cardId === response),
  ).toBe(true);
  if (frame.task?.kind !== 'POST_LOSS') throw new Error('Missing loss');
  frame.task.amount = 1;
  expect(
    legalResponsesForPlayer(
      copy,
      copy.players[1]!.id,
      reactionContext(copy, frame),
    ).some((c) => c.cardId === response),
  ).toBe(false);
  frame.task.amount = 2;
  frame.task.originalPlayer = null;
  expect(
    legalResponsesForPlayer(
      copy,
      copy.players[1]!.id,
      reactionContext(copy, frame),
    ).some((c) => c.cardId === response),
  ).toBe(false);
});

it('evaluates a phase opportunity predicate and derives declared/excluded operation capabilities', () => {
  const state = genericState();
  state.phase = 'ORDER_DRINK';
  const response = putCard(state, 0, [{ op: 'ORDER_EXTRA_DRINKS', count: 1 }], {
    phaseOpportunity: 'ORDER_DRINK',
    trigger: {
      event: 'SYSTEM',
      alternatives: [
        [{ kind: 'PHASE_OPPORTUNITY', phase: 'ORDER_DRINK', actor: 'SELF' }],
      ],
    },
  });
  const frame = {
    ...play(
      genericState(),
      0,
      cardInHand(genericState(), 0, 'shove'),
      state.players[1]!.id,
    ).state.resolutionStack[0]!,
    kind: 'SYSTEM' as const,
    sourceCardId: null,
    effects: [],
    task: {
      kind: 'PHASE' as const,
      phase: 'ORDER_DRINK' as const,
      normalOrderComplete: false,
    },
  };
  expect(
    legalResponsesForPlayer(
      state,
      state.players[0]!.id,
      reactionContext(state, frame),
    ).some((c) => c.cardId === response),
  ).toBe(true);
  frame.actorId = state.players[1]!.id;
  expect(
    legalResponsesForPlayer(
      state,
      state.players[0]!.id,
      reactionContext(state, frame),
    ).some((c) => c.cardId === response),
  ).toBe(false);
  const definition = cardDefinitionSchema.parse({
    id: 'carddef_test_capabilities',
    source: 'TEST_FIXTURE',
    name: 'Original fixture',
    rulesText: 'Original fixture.',
    type: 'ANYTIME',
    capabilities: ['FORCES_DRINK'],
    effects: [
      { op: 'DEAL_DRINKS', target: 'CHOSEN_PLAYER', count: 1 },
      {
        op: 'MODIFY_DRINK',
        alcoholDelta: 1,
        fortitudeDelta: 0,
        allowDrinkEvents: true,
      },
      { op: 'IGNORE', scope: 'CURRENT_EFFECT' },
      {
        op: 'CONTEXT_BRANCH',
        branches: ['CANCEL_ANTE_AND_LEAVE', 'IGNORE_CURRENT_DRINK'],
      },
    ],
  });
  expect(sourceCapabilities(definition)).toEqual([
    'AFFECTS_DRINK_EVENT',
    'CHANGES_DRINK_EFFECT',
    'FORCES_DRINK',
    'ORDERS_DRINK',
  ]);
  expect(sourceCapabilities(definition, { ...frame, kind: 'DRINK' })).toContain(
    'CHANGES_DRINK_EFFECT',
  );
  expect(
    sourceCapabilities(definition, {
      ...frame,
      task: {
        kind: 'PAYMENT',
        payer: state.players[0]!.id,
        amount: 1,
        purpose: 'ANTE',
        destination: 'POT',
        recipient: null,
        substituted: 0,
        canceled: false,
        full: false,
      },
    }),
  ).toContain('AVOIDS_ANTE');
  expect(
    settle(
      play(genericState(), 1, cardInHand(genericState(), 1, 'breather')).state,
    ).players[1]!.fortitude,
  ).toBe(20);
});

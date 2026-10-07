import { expect, it } from 'vitest';
import { cardDefinitionSchema } from '../../src/content/cards';
import {
  genericState,
  putCard,
  play,
  until,
  settle,
  legal,
} from '../fixtures/generic-match';
import { verifyOpportunity } from '../fixtures/step24b';
import {
  legalResponsesForPlayer,
  reactionContext,
} from '../../src/engine/reaction-legality';

const lossTrigger = {
  event: 'CARD' as const,
  alternatives: [
    [
      {
        kind: 'PENDING_STAT' as const,
        relation: 'SELF' as const,
        stat: 'FORTITUDE' as const,
        direction: 'LOSS' as const,
      },
    ],
  ],
};
const ignoreEffects = [
  { op: 'IGNORE' as const, scope: 'CURRENT_EFFECT' as const },
];
it.each([3, 4])(
  'shares %i Fortitude loss using ceiling rounding, preserves the source and locks only the responder',
  (amount) => {
    const state = genericState();
    const hit = putCard(
      state,
      0,
      [
        {
          op: 'CHANGE_STAT',
          target: 'CHOSEN_PLAYER',
          stat: 'FORTITUDE',
          delta: -amount,
        },
        {
          op: 'CHANGE_STAT',
          target: 'CHOSEN_PLAYER',
          stat: 'ALCOHOL',
          delta: 1,
        },
      ],
      { type: 'ACTION' },
    );
    const share = putCard(state, 1, [{ op: 'SHARE_FORTITUDE_LOSS' }], {
      trigger: lossTrigger,
    });
    const ignore = putCard(state, 1, ignoreEffects, {
      trigger: lossTrigger,
      suffix: 'ignore',
    });
    const attackerIgnore = putCard(state, 0, ignoreEffects, {
      trigger: lossTrigger,
      suffix: 'ignore',
    });
    const pending = until(
      play(state, 0, hit, state.players[1]!.id).state,
      (s) => legal(s, 1, share) !== undefined,
    );
    verifyOpportunity(pending, 1, share);
    const routed = until(
      play(pending, 1, share).state,
      (s) => s.resolutionStack.length === 1,
    );
    expect(routed.resolutionStack[0]!.origin).toEqual({
      playerId: state.players[0]!.id,
      cardId: hit,
    });
    expect(legal(routed, 1, ignore)).toBeUndefined();
    expect(
      legalResponsesForPlayer(
        routed,
        routed.players[1]!.id,
        reactionContext(routed, routed.resolutionStack[0]!),
      ).some((p) => p.cardId === ignore),
    ).toBe(false);
    expect(legal(routed, 0, attackerIgnore)).toBeDefined();
    const unignored = settle(routed);
    expect(unignored.players.slice(0, 2).map((p) => p.fortitude)).toEqual([
      20 - Math.ceil(amount / 2),
      20 - Math.ceil(amount / 2),
    ]);
    expect(unignored.players[1]!.alcoholContent).toBe(1);
    const final = settle(play(routed, 0, attackerIgnore).state);
    expect(final.players[0]!.fortitude).toBe(20);
    expect(final.players[1]!.fortitude).toBe(20 - Math.ceil(amount / 2));
  },
);
it('Share Pain that is itself Negated leaves the source and responder mitigation unchanged', () => {
  const state = genericState();
  const share = putCard(state, 1, [{ op: 'SHARE_FORTITUDE_LOSS' }], {
    trigger: lossTrigger,
  });
  const ignore = putCard(state, 1, ignoreEffects, {
    trigger: lossTrigger,
    suffix: 'ignore',
  });
  const counter = putCard(state, 2, [{ op: 'NEGATE', scope: 'TOP_STACK' }], {
    trigger: {
      event: 'CARD',
      alternatives: [[{ kind: 'SOURCE_TYPE', types: ['SOMETIMES'] }]],
    },
  });
  const hit = putCard(
    state,
    0,
    [
      {
        op: 'CHANGE_STAT',
        target: 'CHOSEN_PLAYER',
        stat: 'FORTITUDE',
        delta: -3,
      },
    ],
    { type: 'ACTION' },
  );
  let pending = until(
    play(state, 0, hit, state.players[1]!.id).state,
    (s) => legal(s, 1, share) !== undefined,
  );
  pending = until(
    play(pending, 1, share).state,
    (s) => legal(s, 2, counter) !== undefined,
  );
  pending = until(
    play(pending, 2, counter).state,
    (s) => s.resolutionStack.length === 1 && legal(s, 1, ignore) !== undefined,
  );
  expect(pending.resolutionStack[0]!.fortitudeLossOverrides).toBeUndefined();
  const final = settle(play(pending, 1, ignore).state);
  expect(final.players.slice(0, 2).map((p) => p.fortitude)).toEqual([20, 20]);
});
it('redirect excludes the original attacker, preserves source provenance and redirects only the Fortitude effect', () => {
  const state = genericState();
  const hit = putCard(
    state,
    0,
    [
      {
        op: 'CHANGE_STAT',
        target: 'CHOSEN_PLAYER',
        stat: 'FORTITUDE',
        delta: -4,
      },
      { op: 'PAY_INN', target: 'SELF', amount: 1 },
    ],
    { type: 'ACTION' },
  );
  const redirect = putCard(
    state,
    1,
    [
      {
        op: 'REDIRECT_FORTITUDE_LOSS',
        target: 'CHOSEN_PLAYER',
        excludeOriginalSource: true,
        twoPlayerIgnoreFallback: true,
      },
    ],
    { trigger: lossTrigger },
  );
  const pending = until(
    play(state, 0, hit, state.players[1]!.id).state,
    (s) => legal(s, 1, redirect) !== undefined,
  );
  verifyOpportunity(pending, 1, redirect);
  expect(legal(pending, 1, redirect)!.legalTargetPlayerIds).toEqual(
    state.players.slice(2).map((p) => p.id),
  );
  const routed = until(
    play(pending, 1, redirect, state.players[2]!.id).state,
    (s) => s.resolutionStack.length === 1,
  );
  expect(routed.resolutionStack[0]!.origin).toEqual({
    playerId: state.players[0]!.id,
    cardId: hit,
  });
  const final = settle(routed);
  expect(final.players.map((p) => p.fortitude)).toEqual([20, 20, 16, 20]);
  expect(final.players[0]!.gold).toBe(state.players[0]!.gold - 1);
});
it('two-player fallback uses the normal whole-card Ignore and requires no target', () => {
  const state = genericState();
  state.players.slice(2).forEach((p) => {
    p.eliminated = true;
  });
  const hit = putCard(
    state,
    0,
    [
      {
        op: 'CHANGE_STAT',
        target: 'CHOSEN_PLAYER',
        stat: 'FORTITUDE',
        delta: -3,
      },
      { op: 'CHANGE_STAT', target: 'CHOSEN_PLAYER', stat: 'ALCOHOL', delta: 2 },
    ],
    { type: 'ACTION' },
  );
  const redirect = putCard(
    state,
    1,
    [
      {
        op: 'REDIRECT_FORTITUDE_LOSS',
        target: 'CHOSEN_PLAYER',
        excludeOriginalSource: true,
        twoPlayerIgnoreFallback: true,
      },
    ],
    { trigger: lossTrigger },
  );
  const pending = until(
    play(state, 0, hit, state.players[1]!.id).state,
    (s) => legal(s, 1, redirect) !== undefined,
  );
  expect(legal(pending, 1, redirect)!.requiresTarget).toBe(false);
  const final = settle(play(pending, 1, redirect).state);
  expect(final.players[1]!.fortitude).toBe(20);
  expect(final.players[1]!.alcoholContent).toBe(0);
});
it('generic living-player-count predicates are bounded and use current living players', () => {
  const state = genericState();
  const card = putCard(state, 1, ignoreEffects, {
    trigger: {
      event: 'CARD',
      alternatives: [
        [
          { kind: 'LIVING_PLAYER_COUNT', min: 2, max: 2 },
          ...lossTrigger.alternatives[0]!,
        ],
      ],
    },
  });
  const hit = putCard(
    state,
    0,
    [
      {
        op: 'CHANGE_STAT',
        target: 'CHOSEN_PLAYER',
        stat: 'FORTITUDE',
        delta: -1,
      },
    ],
    { type: 'ACTION' },
  );
  const pending = play(state, 0, hit, state.players[1]!.id).state;
  expect(legal(pending, 1, card)).toBeUndefined();
  expect(
    cardDefinitionSchema.safeParse({
      ...state.definitions[state.cards[card]!.definitionId],
      responseTrigger: {
        event: 'CARD',
        alternatives: [[{ kind: 'LIVING_PLAYER_COUNT', min: 4, max: 2 }]],
      },
    }).success,
  ).toBe(false);
});

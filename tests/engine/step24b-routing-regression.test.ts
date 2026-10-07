import { expect, it } from 'vitest';
import {
  legalResponsesForPlayer,
  reactionContext,
} from '../../src/engine/reaction-legality';
import { coreStateSchema } from '../../src/engine/replay';
import {
  genericState,
  putCard,
  play,
  until,
  settle,
  legal,
} from '../fixtures/generic-match';
import { mutable } from '../fixtures/core-match';

const trigger = {
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
it('multi-target Share Pain retains other losses, adds the original source’s share and forbids the responder’s later reduction', () => {
  const state = genericState();
  const hit = putCard(
    state,
    0,
    [
      {
        op: 'CHANGE_STAT',
        target: 'ALL_PLAYERS',
        stat: 'FORTITUDE',
        delta: -3,
      },
    ],
    { type: 'ACTION' },
  );
  const share = putCard(state, 1, [{ op: 'SHARE_FORTITUDE_LOSS' }], {
    trigger,
  });
  const reduction = putCard(
    state,
    1,
    [{ op: 'MODIFY_PENDING_EFFECT', effectIndex: 0, delta: 1 }],
    { trigger, suffix: 'ignore' },
  );
  const redirect = putCard(
    state,
    1,
    [
      {
        op: 'REDIRECT_FORTITUDE_LOSS',
        target: 'CHOSEN_PLAYER',
        excludeOriginalSource: true,
      },
    ],
    { trigger, suffix: 'shove' },
  );
  let pending = until(
    play(state, 0, hit).state,
    (s) => legal(s, 1, share) !== undefined,
  );
  pending = until(
    play(pending, 1, share).state,
    (s) => s.resolutionStack.length === 1,
  );
  const plays = legalResponsesForPlayer(
    pending,
    pending.players[1]!.id,
    reactionContext(pending, pending.resolutionStack[0]!),
  );
  expect(
    plays.some((p) => p.cardId === reduction || p.cardId === redirect),
  ).toBe(false);
  const final = settle(pending);
  expect(final.players.map((p) => p.fortitude)).toEqual([15, 18, 17, 17]);
});
it('successive redirects update one pending loss in play order while retaining the original attacker', () => {
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
    ],
    { type: 'ACTION' },
  );
  const first = putCard(
    state,
    1,
    [
      {
        op: 'REDIRECT_FORTITUDE_LOSS',
        target: 'CHOSEN_PLAYER',
        excludeOriginalSource: true,
      },
    ],
    { trigger },
  );
  const second = putCard(
    state,
    2,
    [
      {
        op: 'REDIRECT_FORTITUDE_LOSS',
        target: 'CHOSEN_PLAYER',
        excludeOriginalSource: true,
      },
    ],
    { trigger },
  );
  let pending = until(
    play(state, 0, hit, state.players[1]!.id).state,
    (s) => legal(s, 1, first) !== undefined,
  );
  pending = until(
    play(pending, 1, first, state.players[2]!.id).state,
    (s) => s.resolutionStack.length === 1 && legal(s, 2, second) !== undefined,
  );
  expect(legal(pending, 2, second)!.legalTargetPlayerIds).not.toContain(
    state.players[0]!.id,
  );
  const final = settle(play(pending, 2, second, state.players[3]!.id).state);
  expect(final.players.map((p) => p.fortitude)).toEqual([20, 20, 20, 16]);
});
it('a snapshot cannot inject duplicate recipients, unknown players or non-Fortitude routing', () => {
  const state = genericState();
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
  const share = putCard(state, 1, [{ op: 'SHARE_FORTITUDE_LOSS' }], {
    trigger,
  });
  let pending = until(
    play(state, 0, hit, state.players[1]!.id).state,
    (s) => legal(s, 1, share) !== undefined,
  );
  pending = until(
    play(pending, 1, share).state,
    (s) => s.resolutionStack.length === 1,
  );
  const duplicate = mutable(pending);
  duplicate.resolutionStack[0]!.fortitudeLossOverrides![0]!.targets.push(
    duplicate.resolutionStack[0]!.fortitudeLossOverrides![0]!.targets[0]!,
  );
  expect(coreStateSchema.safeParse(duplicate).success).toBe(false);
  const wrongEffect = mutable(pending);
  wrongEffect.resolutionStack[0]!.effects[0] = {
    op: 'CHANGE_STAT',
    target: 'CHOSEN_PLAYER',
    stat: 'ALCOHOL',
    delta: -3,
  };
  expect(coreStateSchema.safeParse(wrongEffect).success).toBe(false);
});

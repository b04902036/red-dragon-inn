import { expect, it } from 'vitest';
import { assertCoreInvariants } from '../../src/engine/invariants';
import { applyCommand } from '../../src/engine/commands';
import type { MutableGameState } from '../../src/engine/types';
import {
  cardInstanceIdSchema,
  playerIdSchema,
  resolutionIdSchema,
} from '../../src/shared/ids';
import { intent, mutable } from '../fixtures/core-match';
import { startRound } from '../fixtures/gambling-match';
import { coreStateSchema } from '../../src/engine/replay';

it('restores deferred contest pass-outs and rejects corrupted player lists', () => {
  const state = mutable(startRound().state);
  state.control.deferredContestPassOutPlayerIds = [state.players[1]!.id];
  expect(coreStateSchema.parse(JSON.parse(JSON.stringify(state)))).toEqual(
    state,
  );
  for (const ids of [
    [state.players[1]!.id, state.players[1]!.id],
    [playerIdSchema.parse('player_missing')],
    Array.from({ length: 5 }, () => state.players[1]!.id),
  ]) {
    const corrupt = mutable(state);
    corrupt.control.deferredContestPassOutPlayerIds = ids;
    expect(() => coreStateSchema.parse(corrupt)).toThrow();
  }
});

it.each([
  [
    'duplicate participant',
    (state: MutableGameState) => {
      state.gambling!.participants.push(state.gambling!.participants[0]!);
    },
  ],
  [
    'duplicate pass',
    (state: MutableGameState) => {
      state.gambling!.passedPlayerIds = [
        state.players[1]!.id,
        state.players[1]!.id,
      ];
    },
  ],
  [
    'unknown participant',
    (state: MutableGameState) => {
      state.gambling!.participants[1] = playerIdSchema.parse('player_missing');
    },
  ],
  [
    'unknown initiator',
    (state: MutableGameState) => {
      state.gambling!.initiatorPlayerId =
        playerIdSchema.parse('player_missing');
    },
  ],
  [
    'missing participants',
    (state: MutableGameState) => {
      state.gambling!.participants.pop();
    },
  ],
  [
    'excluded participant',
    (state: MutableGameState) => {
      state.gambling!.excludedPlayerIds = [state.players[1]!.id];
    },
  ],
  [
    'unknown passed player',
    (state: MutableGameState) => {
      state.gambling!.passedPlayerIds = [
        playerIdSchema.parse('player_missing'),
      ];
    },
  ],
  [
    'both left and passed',
    (state: MutableGameState) => {
      state.gambling!.passedPlayerIds = [state.players[1]!.id];
      state.gambling!.leftPlayerIds = [state.players[1]!.id];
    },
  ],
  [
    'controller departed',
    (state: MutableGameState) => {
      state.gambling!.leftPlayerIds = [state.players[0]!.id];
    },
  ],
  [
    'missing settling winner',
    (state: MutableGameState) => {
      state.gambling!.stage = 'SETTLING';
    },
  ],
  [
    'premature winner',
    (state: MutableGameState) => {
      state.gambling!.winnerPlayerId = state.players[1]!.id;
    },
  ],
  [
    'winner departed',
    (state: MutableGameState) => {
      state.gambling!.stage = 'SETTLING';
      state.gambling!.winnerPlayerId = state.players[1]!.id;
      state.gambling!.leftPlayerIds = [state.players[1]!.id];
    },
  ],
  [
    'controller has priority',
    (state: MutableGameState) => {
      state.gambling!.priorityPlayerId = state.players[0]!.id;
    },
  ],
  [
    'missing priority',
    (state: MutableGameState) => {
      state.gambling!.priorityPlayerId = null;
    },
  ],
  [
    'wrong ante',
    (state: MutableGameState) => {
      state.gambling!.anteAmount = 2;
    },
  ],
  [
    'zero contribution',
    (state: MutableGameState) => {
      state.gambling!.contributions[0]!.amount = 0;
    },
  ],
  [
    'excessive contribution',
    (state: MutableGameState) => {
      state.gambling!.contributions[0]!.amount = 2;
    },
  ],
  [
    'missing contribution',
    (state: MutableGameState) => {
      state.gambling!.contributions.pop();
    },
  ],
  [
    'duplicate contribution',
    (state: MutableGameState) => {
      state.gambling!.contributions[1]!.playerId =
        state.gambling!.contributions[0]!.playerId;
    },
  ],
  [
    'wrong pot',
    (state: MutableGameState) => {
      state.gambling!.pot += 1;
    },
  ],
  [
    'duplicate control category',
    (state: MutableGameState) => {
      state.gambling!.allowedControlCategories = ['CHEATING', 'CHEATING'];
    },
  ],
  [
    'unknown control source',
    (state: MutableGameState) => {
      state.gambling!.controlSourceCardId =
        cardInstanceIdSchema.parse('card_missing');
    },
  ],
  [
    'wrong suspension source',
    (state: MutableGameState) => {
      state.gambling!.suspended.resolutionId =
        resolutionIdSchema.parse('resolution_missing');
    },
  ],
  [
    'wrong suspended phase',
    (state: MutableGameState) => {
      state.gambling!.suspended.phase = 'DRINK';
    },
  ],
  [
    'wrong suspended actor',
    (state: MutableGameState) => {
      state.gambling!.suspended.activePlayerId = state.players[1]!.id;
    },
  ],
  [
    'insufficient payout capacity',
    (state: MutableGameState) => {
      state.rules.statBounds.gold = { min: 0, max: 10 };
    },
  ],
] as const)('rejects corrupt gambling snapshot: %s', (_label, corrupt) => {
  const state = mutable(startRound().state);
  corrupt(state);
  const before = JSON.stringify(state);
  expect(() => assertCoreInvariants(state)).toThrow();
  expect(() =>
    applyCommand(state, intent(state, 'GAMBLING_PASS'), {
      actorId: state.players[1]!.id,
    }),
  ).toThrow();
  expect(JSON.stringify(state)).toBe(before);
});

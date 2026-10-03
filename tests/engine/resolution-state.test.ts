import { describe, expect, it } from 'vitest';
import { assertCoreInvariants } from '../../src/engine/invariants';
import { applyCommand } from '../../src/engine/commands';
import type { MutableGameState } from '../../src/engine/types';
import { playerIdSchema, resolutionIdSchema } from '../../src/shared/ids';
import { intent, mutable } from '../fixtures/core-match';
import {
  actionState,
  playAction,
  response,
  passWindow,
} from '../fixtures/timing-match';

describe('serializable resolution invariants', () => {
  it.each([
    [
      'duplicate frame',
      (state: MutableGameState) => {
        state.resolutionStack.push(state.resolutionStack[0]!);
      },
    ],
    [
      'wrong parent',
      (state: MutableGameState) => {
        state.resolutionStack[0]!.parentId =
          resolutionIdSchema.parse('resolution_missing');
      },
    ],
    [
      'unknown actor',
      (state: MutableGameState) => {
        state.resolutionStack[0]!.actorId =
          playerIdSchema.parse('player_missing');
      },
    ],
    [
      'unknown target',
      (state: MutableGameState) => {
        state.resolutionStack[0]!.targetPlayerIds = [
          playerIdSchema.parse('player_missing'),
        ];
      },
    ],
    [
      'cursor beyond effects',
      (state: MutableGameState) => {
        state.resolutionStack[0]!.nextEffectIndex = 31;
      },
    ],
    [
      'wrong stage',
      (state: MutableGameState) => {
        state.resolutionStack[0]!.stage = 'OPERATIONS';
      },
    ],
    [
      'wrong source',
      (state: MutableGameState) => {
        state.resolutionStack[0]!.window!.resolutionId =
          resolutionIdSchema.parse('resolution_missing');
      },
    ],
    [
      'unknown eligibility',
      (state: MutableGameState) => {
        state.resolutionStack[0]!.window!.eligiblePlayerIds[0] =
          playerIdSchema.parse('player_missing');
      },
    ],
    [
      'missing living player',
      (state: MutableGameState) => {
        state.resolutionStack[0]!.window!.eligiblePlayerIds.pop();
      },
    ],
    [
      'passed ineligible player',
      (state: MutableGameState) => {
        state.resolutionStack[0]!.window!.passedPlayerIds.push(
          playerIdSchema.parse('player_missing'),
        );
      },
    ],
    [
      'null priority',
      (state: MutableGameState) => {
        state.resolutionStack[0]!.window!.priorityPlayerId = null;
      },
    ],
    [
      'passed priority',
      (state: MutableGameState) => {
        state.resolutionStack[0]!.window!.passedPlayerIds.push(
          state.responseWindow!.priorityPlayerId!,
        );
      },
    ],
    [
      'unknown priority',
      (state: MutableGameState) => {
        state.resolutionStack[0]!.window!.priorityPlayerId =
          playerIdSchema.parse('player_missing');
      },
    ],
    [
      'active window mismatch',
      (state: MutableGameState) => {
        state.responseWindow = null;
      },
    ],
  ] as const)(
    'fails closed on %s before a command can mutate the stack',
    (_label, corrupt) => {
      const state = mutable(playAction().state);
      // A normal JSON reload gives each window its own copy.
      corrupt(state);
      const before = JSON.stringify(state);
      expect(() =>
        applyCommand(
          state,
          intent(state, 'PASS_RESPONSE', {
            responseWindowId: 'window_missing',
          }),
          { actorId: state.players[1]!.id },
        ),
      ).toThrow();
      expect(JSON.stringify(state)).toBe(before);
    },
  );
  it.each([
    [
      'wrong choice stage',
      (state: MutableGameState) => {
        state.resolutionStack[0]!.stage = 'RESPONSES';
      },
    ],
    [
      'choice priority',
      (state: MutableGameState) => {
        state.resolutionStack[0]!.window!.priorityPlayerId =
          state.players[0]!.id;
      },
    ],
    [
      'unknown chooser',
      (state: MutableGameState) => {
        state.resolutionStack[0]!.window!.pendingChoice!.playerId =
          playerIdSchema.parse('player_missing');
      },
    ],
    [
      'choice min/max',
      (state: MutableGameState) => {
        state.resolutionStack[0]!.window!.pendingChoice!.min = 64;
      },
    ],
    [
      'unowned choice card',
      (state: MutableGameState) => {
        state.resolutionStack[0]!.window!.pendingChoice!.options[0]!.id =
          state.players[0]!.hand[0]!;
      },
    ],
  ] as const)('rejects malformed pending choice: %s', (_label, corrupt) => {
    const state = mutable(
      passWindow(
        playAction(
          actionState([
            { op: 'DISCARD_CARDS', target: 'CHOSEN_PLAYER', count: 1 },
          ]),
        ).state,
      ).state,
    );
    corrupt(state);
    expect(() => assertCoreInvariants(state)).toThrow();
  });
  it('accepts snapshots with different object key order and rejects invalid target options', () => {
    const state = mutable(response(playAction().state, 1, 'ignore').state);
    state.responseWindow = Object.fromEntries(
      Object.entries(state.responseWindow!).reverse(),
    ) as typeof state.responseWindow;
    expect(() => assertCoreInvariants(state)).not.toThrow();
    const choice = mutable(
      passWindow(
        playAction(
          actionState([{ op: 'OPEN_CHOICE', target: 'SELF', kind: 'TARGET' }]),
          null,
        ).state,
      ).state,
    );
    choice.resolutionStack[0]!.window!.pendingChoice!.options[0]!.id =
      'player_missing';
    expect(() => assertCoreInvariants(choice)).toThrow('invalid target');
  });
});

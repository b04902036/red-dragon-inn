import { expect, it } from 'vitest';
import type { MutableGameState } from '../../src/engine/types';
import { assertCoreInvariants } from '../../src/engine/invariants';
import { accepted, mutable } from '../fixtures/core-match';
import { drinkState, takeDrink } from '../fixtures/drink-match';
import { cardInstanceIdSchema } from '../../src/shared/ids';

it.each([
  [
    'missing compound',
    (state: MutableGameState) => {
      delete state.resolutionStack[0]!.sourceCardIds;
    },
  ],
  [
    'duplicate compound',
    (state: MutableGameState) => {
      state.resolutionStack[0]!.sourceCardIds!.push(
        state.resolutionStack[0]!.sourceCardId!,
      );
    },
  ],
  [
    'wrong first source',
    (state: MutableGameState) => {
      state.resolutionStack[0]!.sourceCardIds!.reverse();
    },
  ],
  [
    'wrong continuation',
    (state: MutableGameState) => {
      state.resolutionStack[0]!.continuation = 'ORDER_DRINK';
    },
  ],
  [
    'unknown card',
    (state: MutableGameState) => {
      state.resolutionStack[0]!.sourceCardIds![1] =
        cardInstanceIdSchema.parse('card_missing');
    },
  ],
  [
    'non-Drink card',
    (state: MutableGameState) => {
      state.resolutionStack[0]!.sourceCardIds![1] = state.players[0]!.hand[0]!;
    },
  ],
  [
    'wrong event kind',
    (state: MutableGameState) => {
      state.resolutionStack[0]!.kind = 'DRINK_EVENT';
    },
  ],
  [
    'character compound',
    (state: MutableGameState) => {
      state.resolutionStack[0]!.kind = 'CARD';
    },
  ],
] as const)('rejects corrupt Drink snapshots: %s', (_name, corrupt) => {
  const state = mutable(
    accepted(drinkState(['tea', 'fizz']), 'TAKE_DRINK').state,
  );
  corrupt(state);
  expect(() => assertCoreInvariants(state)).toThrow();
});
it('rejects finished matches with an incorrect winner or multiple survivors', () => {
  const state = drinkState([]);
  state.players.forEach((player) => {
    player.gold = 0;
  });
  const finished = mutable(takeDrink(state).state);
  finished.winners = [finished.players[0]!.id];
  expect(() => assertCoreInvariants(finished)).toThrow();
  finished.players[0]!.eliminated = false;
  finished.players[1]!.eliminated = false;
  finished.winners = [finished.players[0]!.id, finished.players[1]!.id];
  expect(() => assertCoreInvariants(finished)).toThrow();
});

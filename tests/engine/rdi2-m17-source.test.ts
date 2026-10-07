import { expect, it } from 'vitest';
import { DEFAULT_RULES } from '../../src/engine/rules';
import { drinkState } from '../fixtures/drink-match';
import {
  putCard,
  send,
  play,
  until,
  legal,
  settle,
} from '../fixtures/generic-match';
import { m17Trigger, m17Effects } from '../fixtures/rdi2-m17-source';
function fixture() {
  const initial = drinkState(['tea', 'fizz']);
  initial.rules.timing = { ...DEFAULT_RULES.timing };
  initial.players[0]!.fortitude = 18;
  return initial;
}
it('verified M17 uses shared Ignore for the whole Drink and all Chasers', () => {
  const initial = fixture(),
    defense = putCard(initial, 0, m17Effects, { trigger: m17Trigger });
  const pending = until(
    send(initial, 'TAKE_DRINK', {}, 0).state,
    (s) => legal(s, 0, defense) !== undefined,
  );
  expect(pending.resolutionStack[0]!.sourceCardIds).toHaveLength(2);
  const done = settle(play(pending, 0, defense).state);
  expect(done.players[0]).toMatchObject({
    fortitude: 18,
    alcoholContent: 0,
    gold: 10,
  });
  expect(done.innDrinkDiscard).toEqual(
    expect.arrayContaining(initial.players[0]!.drinkPile),
  );
});
it('the second physical defense remains legal after the first is Negated, matching the official example', () => {
  const initial = fixture();
  const first = putCard(initial, 0, m17Effects, { trigger: m17Trigger }),
    second = putCard(initial, 0, m17Effects, {
      suffix: 'ignore',
      trigger: m17Trigger,
    });
  const counter = putCard(initial, 1, [{ op: 'NEGATE', scope: 'TOP_STACK' }], {
    trigger: {
      event: 'CARD',
      alternatives: [
        [
          { kind: 'SOURCE_TYPE', types: ['SOMETIMES'] },
          { kind: 'PENDING_OPERATION', operations: ['IGNORE'] },
        ],
      ],
    },
  });
  const drink = until(
    send(initial, 'TAKE_DRINK', {}, 0).state,
    (s) => legal(s, 0, first) !== undefined,
  );
  const defended = play(drink, 0, first).state;
  const counterOpportunity = until(
    defended,
    (s) => legal(s, 1, counter) !== undefined,
  );
  const negated = play(counterOpportunity, 1, counter).state;
  const resumed = until(
    negated,
    (s) => s.resolutionStack.length === 1 && legal(s, 0, second) !== undefined,
  );
  expect(resumed.players[0]!.characterDiscard).toContain(first);
  expect(resumed.resolutionStack[0]).toMatchObject({
    canceled: false,
    ignoredPlayerIds: [],
  });
  expect(settle(play(resumed, 0, second).state).players[0]).toMatchObject({
    fortitude: 18,
    alcoholContent: 0,
  });
});

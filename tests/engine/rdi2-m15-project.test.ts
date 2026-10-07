import { describe, expect, it } from 'vitest';
import type { Effect } from '../../src/content/effects';
import { cardDefinitionSchema } from '../../src/content/cards';
import { applyCommand } from '../../src/engine/commands';
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
  settle,
  legal,
} from '../fixtures/generic-match';
import { m15Effects, m15Trigger } from '../fixtures/rdi2-m15-project';

const hit: Effect = {
  op: 'CHANGE_STAT',
  target: 'CHOSEN_PLAYER',
  stat: 'FORTITUDE',
  delta: -2,
};
function opportunity(
  type: 'ACTION' | 'SOMETIMES' | 'ANYTIME' = 'ACTION',
  effects: Effect[] = [hit],
  targeted = true,
) {
  const initial = genericState();
  const defense = putCard(initial, 2, m15Effects, { trigger: m15Trigger });
  const source = putCard(initial, type === 'SOMETIMES' ? 1 : 0, effects, {
    type,
    ...(type === 'SOMETIMES'
      ? {
          trigger: {
            event: 'CARD' as const,
            alternatives: [
              [{ kind: 'SOURCE_TYPE' as const, types: ['ACTION' as const] }],
            ],
          },
        }
      : {}),
  });
  let pending = initial as ReturnType<typeof play>['state'];
  const seat = type === 'SOMETIMES' ? 1 : 0;
  if (type === 'SOMETIMES') {
    pending = play(
      initial,
      0,
      cardInHand(initial, 0, 'shove'),
      initial.players[1]!.id,
    ).state;
    pending = until(pending, (s) => legal(s, 1, source) !== undefined);
  }
  pending = play(
    pending,
    seat,
    source,
    targeted ? initial.players[2]!.id : undefined,
  ).state;
  pending = until(pending, (s) => legal(s, 2, defense) !== undefined);
  return { initial, pending, source, defense };
}

describe('M15 USER OVERRIDE using shared direct-stat and Ignore operations', () => {
  it.each(['ACTION', 'SOMETIMES', 'ANYTIME'] as const)(
    '%s directly affecting own Fortitude is legal and is Ignored',
    (type) => {
      const f = opportunity(type);
      expect(legal(f.pending, 2, f.defense)).toBeDefined();
      const sourceFrame = f.pending.resolutionStack.at(-1)!.id;
      const response = play(f.pending, 2, f.defense);
      const ignored = until(
        response.state,
        (s) =>
          !s.resolutionStack.some((frame) => frame.sourceCardId === f.defense),
      );
      const original = ignored.resolutionStack.find(
        (frame) => frame.id === sourceFrame,
      )!;
      expect(original.canceled).toBe(false);
      expect(original.ignoredPlayerIds).toEqual([f.initial.players[2]!.id]);
      const done = settle(ignored);
      expect(done.players[2]!.fortitude).toBe(20);
      expect(done.players[2]!.characterDiscard).toContain(f.defense);
      if (type === 'SOMETIMES') expect(done.players[1]!.fortitude).toBe(18);
    },
  );

  it('Ignores all source effects on self while every other target remains affected and source is not Negated', () => {
    const f = opportunity(
      'ACTION',
      [
        {
          op: 'CHANGE_STAT',
          target: 'EACH_OTHER_PLAYER',
          stat: 'FORTITUDE',
          delta: -2,
        },
        { op: 'CHANGE_STAT', target: 'ALL_PLAYERS', stat: 'ALCOHOL', delta: 1 },
        { op: 'PAY_INN', target: 'EACH_OTHER_PLAYER', amount: 1 },
      ],
      false,
    );
    const response = play(f.pending, 2, f.defense);
    const ignored = until(
      response.state,
      (s) =>
        !s.resolutionStack.some((frame) => frame.sourceCardId === f.defense),
    );
    expect(ignored.resolutionStack[0]).toMatchObject({
      canceled: false,
      ignoredPlayerIds: [f.initial.players[2]!.id],
    });
    expect(
      settle(ignored).players.map((p) => [
        p.fortitude,
        p.alcoholContent,
        p.gold,
      ]),
    ).toEqual([
      [20, 1, 10],
      [18, 1, 9],
      [20, 0, 10],
      [18, 1, 9],
    ]);
  });

  it('rejects a Fortitude-damaging Drink while a proper shared Drink defense is legal', () => {
    const initial = drinkState(['fizz']);
    initial.rules.timing = { ...DEFAULT_RULES.timing };
    const id = initial.cards[initial.players[0]!.drinkPile[0]!]!.definitionId;
    initial.definitions[id] = cardDefinitionSchema.parse({
      ...initial.definitions[id],
      fortitudeChange: -2,
    });
    const defense = putCard(initial, 0, m15Effects, { trigger: m15Trigger });
    const drinkDefense = putCard(initial, 0, m15Effects, {
      suffix: 'ignore',
      trigger: {
        event: 'DRINK',
        alternatives: [[{ kind: 'AFFECTS', relation: 'SELF' }]],
      },
    });
    const pending = until(
      send(initial, 'TAKE_DRINK', {}, 0).state,
      (s) => legal(s, 0, drinkDefense) !== undefined,
    );
    expect(legal(pending, 0, defense)).toBeUndefined();
    const rejected = applyCommand(
      pending,
      intent(pending, 'PLAY_RESPONSE', {
        cardId: defense,
        responseWindowId: pending.responseWindow!.id,
        promptId: pending.control.timedPrompt!.promptId,
      }),
      { actorId: pending.players[0]!.id },
    );
    expect(rejected.status).toBe('REJECTED');
    expect(rejected.state).toBe(pending);
    expect(rejected.events).toEqual([]);
    expect(settle(pending).players[0]!.fortitude).toBe(18);
    expect(
      settle(play(pending, 0, drinkDefense).state).players[0]!.fortitude,
    ).toBe(20);
  });

  it('rejects a Drink Event even if it directly changes own Fortitude', () => {
    const initial = drinkState(['toast']);
    const id = initial.cards[initial.players[0]!.drinkPile[0]!]!.definitionId;
    initial.definitions[id] = cardDefinitionSchema.parse({
      ...initial.definitions[id],
      effects: [
        { op: 'CHANGE_STAT', target: 'SELF', stat: 'FORTITUDE', delta: -2 },
      ],
    });
    const defense = putCard(initial, 0, m15Effects, { trigger: m15Trigger });
    const pending = send(initial, 'TAKE_DRINK', {}, 0).state;
    expect(pending.resolutionStack[0]!.kind).toBe('DRINK_EVENT');
    expect(legal(pending, 0, defense)).toBeUndefined();
    expect(settle(pending).players[0]!.fortitude).toBe(18);
  });

  it('does not treat a pending Drink modifier as a direct own-Fortitude card', () => {
    const initial = drinkState(['fizz']);
    const defense = putCard(initial, 0, m15Effects, { trigger: m15Trigger });
    const modifier = putCard(
      initial,
      1,
      [{ op: 'MODIFY_DRINK', alcoholDelta: 0, fortitudeDelta: -2 }],
      {
        trigger: { event: 'DRINK', alternatives: [[]] },
      },
    );
    const drink = until(
      send(initial, 'TAKE_DRINK', {}, 0).state,
      (s) => legal(s, 1, modifier) !== undefined,
    );
    const pending = play(drink, 1, modifier).state;
    expect(pending.resolutionStack.at(-1)!.sourceCardId).toBe(modifier);
    expect(legal(pending, 0, defense)).toBeUndefined();
    expect(settle(pending).players[0]!.fortitude).toBe(18);
  });

  it('a legal counter Negates only the defense and the original card affects self normally', () => {
    // Add a legal fixture counter before the play; keep instance ownership/zones intact.
    const initial = genericState();
    const defense = putCard(initial, 2, m15Effects, { trigger: m15Trigger });
    const counter = putCard(
      initial,
      3,
      [{ op: 'NEGATE', scope: 'TOP_STACK' }],
      {
        trigger: {
          event: 'CARD',
          alternatives: [
            [
              { kind: 'SOURCE_TYPE', types: ['SOMETIMES'] },
              { kind: 'NEGATABLE', value: true },
            ],
          ],
        },
      },
    );
    const pending = until(
      play(initial, 0, cardInHand(initial, 0, 'shove'), initial.players[2]!.id)
        .state,
      (s) => legal(s, 2, defense) !== undefined,
    );
    const defended = play(pending, 2, defense);
    const counterOpportunity = until(
      defended.state,
      (s) => legal(s, 3, counter) !== undefined,
    );
    const countered = play(counterOpportunity, 3, counter);
    const unwound = until(
      countered.state,
      (s) => !s.resolutionStack.some((frame) => frame.sourceCardId === defense),
    );
    expect(unwound.resolutionStack[0]).toMatchObject({
      canceled: false,
      ignoredPlayerIds: [],
    });
    expect(settle(unwound).players[2]!.fortitude).toBe(18);
  });

  it('uses affects-attribute legality for a gain already clamped at the 20 Fortitude cap', () => {
    const f = opportunity('ANYTIME', [{ ...hit, delta: 1 }]);
    expect(legal(f.pending, 2, f.defense)).toBeDefined();
    expect(
      settle(play(f.pending, 2, f.defense).state).players[2]!.fortitude,
    ).toBe(20);
  });
});

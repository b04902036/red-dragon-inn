import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { compileRdi1Source } from '../../src/content/rdi1-compiler';
import { cardDefinitionSchema } from '../../src/content/cards';
import type { Effect } from '../../src/content/effects';
import {
  legalResponsesForPlayer,
  reactionContext,
} from '../../src/engine/reaction-legality';
import { applyCommand } from '../../src/engine/commands';
import { projectPrivatePlayer } from '../../src/protocol/projections';
import { intent, mutable } from '../fixtures/core-match';
import {
  rdi1Card,
  rdi1DrinkPile,
  rdi1Keep,
  rdi1Match,
  rdi1Play,
  rdi1Send,
  rdi1Until,
} from '../fixtures/rdi1-match';

const pack = compileRdi1Source(
  JSON.parse(
    readFileSync('content-private/imports/rdi1/source-normalized.json', 'utf8'),
  ) as unknown,
);
function response() {
  const state = rdi1Match(pack);
  const counter = rdi1Card(state, 'negate_drink_change_card');
  const modifier = rdi1Card(state, 'add_two_alcohol_to_drink', 0);
  const hard = rdi1Card(state, 'negate_sometimes_counter', 0);
  rdi1Keep(state, [counter, modifier, hard]);
  state.phase = 'DRINK';
  rdi1DrinkPile(state, 0, ['wine']);
  let pending = rdi1Send(state, 0, 'TAKE_DRINK').state;
  pending = rdi1Until(pending, (s) =>
    projectPrivatePlayer(s, s.cards[modifier]!.ownerId!).legalPlays.some(
      (p) => p.cardId === modifier,
    ),
  );
  pending = rdi1Play(pending, modifier).state;
  return { state: pending, counter, modifier, hard };
}
const cases: {
  name: string;
  effects: Effect[];
  legal: boolean;
  type?: 'SOMETIMES' | 'ANYTIME' | 'ACTION';
  family?: string;
}[] = [
  {
    name: 'numeric Drink modification',
    effects: [{ op: 'MODIFY_DRINK', alcoholDelta: 2, fortitudeDelta: 0 }],
    legal: true,
  },
  {
    name: 'Ignore Drink',
    effects: [{ op: 'IGNORE', scope: 'CURRENT_EFFECT' }],
    legal: true,
  },
  {
    name: 'Negate Drink',
    effects: [{ op: 'NEGATE', scope: 'TOP_STACK' }],
    legal: true,
  },
  {
    name: 'pass Drink',
    effects: [{ op: 'PASS_CURRENT_DRINK', target: 'CHOSEN_PLAYER' }],
    legal: true,
  },
  {
    name: 'split Drink',
    effects: [{ op: 'SPLIT_CURRENT_DRINK', target: 'CHOSEN_PLAYER' }],
    legal: true,
  },
  {
    name: 'another copy of this counter',
    effects: [{ op: 'NEGATE', scope: 'TOP_STACK' }],
    family: 'rdi_core_drink_change',
    legal: false,
  },
  {
    name: 'order Drinks',
    effects: [{ op: 'DEAL_DRINKS', target: 'SELF', count: 1 }],
    legal: false,
  },
  {
    name: 'force drinking',
    effects: [{ op: 'FORCE_DRINK', target: 'SELF' }],
    legal: false,
  },
  {
    name: 'direct Alcohol change',
    effects: [{ op: 'CHANGE_STAT', stat: 'ALCOHOL', target: 'SELF', delta: 1 }],
    legal: false,
  },
  {
    name: 'affect Drink Events',
    effects: [
      {
        op: 'MODIFY_DRINK',
        alcoholDelta: 1,
        fortitudeDelta: 0,
        allowDrinkEvents: true,
      },
    ],
    legal: false,
  },
  {
    name: 'Anytime Drink modifier',
    effects: [{ op: 'MODIFY_DRINK', alcoholDelta: 1, fortitudeDelta: 0 }],
    type: 'ANYTIME',
    legal: false,
  },
  {
    name: 'Action Drink modifier',
    effects: [{ op: 'MODIFY_DRINK', alcoholDelta: 1, fortitudeDelta: 0 }],
    type: 'ACTION',
    legal: false,
  },
];
it.each(cases)(
  'the compiled counter enforces the server predicate for $name',
  ({ effects, legal, type = 'SOMETIMES', family }) => {
    const { state: initial, counter, modifier } = response();
    const state = mutable(initial);
    const id = state.cards[modifier]!.definitionId;
    state.definitions[id] = cardDefinitionSchema.parse({
      id,
      source: 'TEST_FIXTURE',
      name: 'Original response fixture',
      rulesText: 'Source category probe.',
      type,
      effects,
      ...(type === 'SOMETIMES'
        ? {
            responseKind: 'SOMETIMES',
            responseTrigger: {
              event: 'DRINK',
              alternatives: [[{ kind: 'SOURCE_KIND', kinds: ['DRINK'] }]],
            },
          }
        : {}),
      ...(family ? { counterFamily: family } : {}),
    });
    const frame = state.resolutionStack.at(-1)!;
    frame.effects = effects;
    const actor = state.cards[counter]!.ownerId!;
    expect(
      legalResponsesForPlayer(state, actor, reactionContext(state, frame)).some(
        (p) => p.cardId === counter,
      ),
    ).toBe(legal);
    if (!legal) {
      const result = applyCommand(
        state,
        intent(state, 'PLAY_RESPONSE', {
          cardId: counter,
          responseWindowId: state.responseWindow!.id,
        }),
        { actorId: actor, clock: { now: () => 1000 } },
      );
      expect(result).toMatchObject({ status: 'REJECTED', events: [] });
      expect(result.state).toEqual(state);
    }
  },
);
it('only the protected hard-counter family can affect the Drink-change counter', () => {
  const scenario = response();
  const { counter, hard } = scenario;
  let state = scenario.state;
  state = rdi1Until(state, (s) =>
    projectPrivatePlayer(s, s.cards[counter]!.ownerId!).legalPlays.some(
      (p) => p.cardId === counter,
    ),
  );
  const pending = rdi1Play(state, counter).state;
  expect(
    projectPrivatePlayer(
      pending,
      pending.cards[hard]!.ownerId!,
    ).legalPlays.some((p) => p.cardId === hard),
  ).toBe(true);
  const foreign = mutable(pending);
  const id = foreign.cards[hard]!.definitionId;
  foreign.definitions[id] = cardDefinitionSchema.parse({
    ...foreign.definitions[id],
    counterFamily: 'unrelated_counter_family',
  });
  expect(
    projectPrivatePlayer(
      foreign,
      foreign.cards[hard]!.ownerId!,
    ).legalPlays.some((p) => p.cardId === hard),
  ).toBe(false);
  expect(
    applyCommand(
      foreign,
      intent(foreign, 'PLAY_RESPONSE', {
        cardId: hard,
        responseWindowId: foreign.responseWindow!.id,
      }),
      { actorId: foreign.cards[hard]!.ownerId!, clock: { now: () => 1000 } },
    ),
  ).toMatchObject({ status: 'REJECTED', events: [] });
});

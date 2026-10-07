import { expect, it } from 'vitest';
import { cardDefinitionSchema } from '../../src/content/cards';
import type { Effect } from '../../src/content/effects';
import { applyCommand, applyTimeout } from '../../src/engine/commands';
import { sourceCapabilities } from '../../src/engine/source-capabilities';
import {
  reactionContext,
  triggerMatches,
  legalResponsesForPlayer,
} from '../../src/engine/reaction-legality';
import { DEFAULT_RULES } from '../../src/engine/rules';
import {
  projectPrivatePlayer,
  projectPublicGame,
} from '../../src/protocol/projections';
import { intent, mutable } from '../fixtures/core-match';
import { drinkState } from '../fixtures/drink-match';
import {
  putCard,
  play,
  send,
  until,
  legal,
  settle,
  reconnectAndReplay,
} from '../fixtures/generic-match';
import {
  m16Effects,
  m16Trigger,
  m16Metadata,
} from '../fixtures/rdi2-m16-source';
import {
  m27Effects,
  m27Trigger,
  m27Metadata,
} from '../fixtures/rdi2-m27-source';

function fixture(
  effects: Effect[],
  event = false,
  type: 'SOMETIMES' | 'ANYTIME' = 'SOMETIMES',
) {
  const initial = drinkState(['fizz']);
  initial.rules.timing = { ...DEFAULT_RULES.timing };
  const drink = initial.players[0]!.drinkPile[0]!,
    defId = initial.cards[drink]!.definitionId;
  initial.definitions[defId] = cardDefinitionSchema.parse(
    event
      ? {
          id: defId,
          type: 'DRINK_EVENT',
          name: 'Original synthetic Event',
          rulesText: 'Synthetic Event numeric effect.',
          source: 'TEST_FIXTURE',
          effects: [
            { op: 'CHANGE_STAT', target: 'SELF', stat: 'ALCOHOL', delta: 3 },
          ],
        }
      : {
          ...initial.definitions[defId],
          alcoholContent: 3,
          fortitudeChange: 0,
          chaser: false,
        },
  );
  const source = putCard(initial, 0, effects, {
    type,
    trigger: { event: event ? 'DRINK_EVENT' : 'DRINK', alternatives: [[]] },
  });
  const counter = putCard(initial, 1, m27Effects, { trigger: m27Trigger });
  const counterDefinition = initial.cards[counter]!.definitionId;
  initial.definitions[counterDefinition] = cardDefinitionSchema.parse({
    ...initial.definitions[counterDefinition],
    ...m27Metadata,
  });
  // Keep a real response opportunity even when M27 itself is illegal.
  putCard(
    initial,
    2,
    [{ op: 'CHANGE_STAT', target: 'SELF', stat: 'FORTITUDE', delta: 1 }],
    { type: 'ANYTIME' },
  );
  const hard = putCard(initial, 2, m16Effects, {
    suffix: 'negate',
    trigger: m16Trigger,
    ...m16Metadata,
  });
  const second = putCard(initial, 3, m27Effects, { trigger: m27Trigger });
  initial.definitions[initial.cards[second]!.definitionId] =
    cardDefinitionSchema.parse({
      ...initial.definitions[initial.cards[second]!.definitionId],
      ...m27Metadata,
    });
  const unrelated = putCard(initial, 3, m16Effects, {
    suffix: 'negate',
    trigger: m16Trigger,
    counterFamily: 'test.unrelated',
  });
  putCard(
    initial,
    3,
    [{ op: 'CHANGE_STAT', target: 'SELF', stat: 'FORTITUDE', delta: 1 }],
    { type: 'ANYTIME', suffix: 'shove' },
  );
  let s = until(
    send(initial, 'TAKE_DRINK', {}, 0).state,
    (x) => legal(x, 0, source) !== undefined,
  );
  s = play(
    s,
    0,
    source,
    effects.some((e) => 'target' in e && e.target === 'CHOSEN_PLAYER')
      ? initial.players[3]!.id
      : undefined,
  ).state;
  return { initial, state: s, source, counter, hard, second, unrelated };
}
function countered(f: ReturnType<typeof fixture>) {
  const s = until(f.state, (x) => legal(x, 1, f.counter) !== undefined);
  return play(s, 1, f.counter).state;
}
function mayRespond(f: ReturnType<typeof fixture>) {
  return legalResponsesForPlayer(
    f.state,
    f.state.players[1]!.id,
    reactionContext(f.state, f.state.resolutionStack.at(-1)!),
  ).some((p) => p.cardId === f.counter);
}
it('A: Negates the Sometimes Ignore, so the Drink still affects its original recipient', () => {
  const f = fixture([{ op: 'IGNORE', scope: 'CURRENT_EFFECT' }]);
  expect(mayRespond(f)).toBe(true);
  expect(settle(countered(f)).players[0]!.alcoholContent).toBe(
    f.initial.players[0]!.alcoholContent + 3,
  );
});
it.each([2, -1])('B: Negates a direct Drink modifier of %s', (delta) => {
  const f = fixture([
    {
      op: 'MODIFY_DRINK',
      alcoholDelta: delta,
      fortitudeDelta: 0,
      allowDrinkEvents: false,
    },
  ]);
  expect(mayRespond(f)).toBe(true);
  expect(settle(countered(f)).players[0]!.alcoholContent).toBe(
    f.initial.players[0]!.alcoholContent + 3,
  );
});
it.each([2, -1])(
  'B: derives a direct pending-Drink numeric modifier of %s without manual capability labels',
  (delta) => {
    const f = fixture([{ op: 'MODIFY_PENDING_EFFECT', effectIndex: 0, delta }]);
    expect(mayRespond(f)).toBe(true);
    expect(settle(countered(f)).players[0]!.alcoholContent).toBe(
      f.initial.players[0]!.alcoholContent + 3,
    );
  },
);
it('B/H: a card capable of affecting Events still qualifies when it is currently modifying an actual Drink', () => {
  const f = fixture([
    {
      op: 'MODIFY_DRINK',
      alcoholDelta: 2,
      fortitudeDelta: 0,
      allowDrinkEvents: true,
    },
  ]);
  expect(mayRespond(f)).toBe(true);
  expect(settle(countered(f)).players[0]!.alcoholContent).toBe(
    f.initial.players[0]!.alcoholContent + 3,
  );
});
it.each(['PASS_CURRENT_DRINK', 'SPLIT_CURRENT_DRINK'] as const)(
  'C/D: Negates %s without passing or splitting the Drink',
  (op) => {
    const f = fixture([{ op, target: 'CHOSEN_PLAYER' }]);
    expect(mayRespond(f)).toBe(true);
    const final = settle(countered(f));
    expect(final.players.map((p) => p.alcoholContent)).toEqual(
      f.initial.players.map((p, i) => p.alcoholContent + (i === 0 ? 3 : 0)),
    );
  },
);
it.each([
  ['E: force another Drink', { op: 'FORCE_DRINK', target: 'CHOSEN_PLAYER' }],
  [
    'F: directly change player Alcohol',
    { op: 'CHANGE_STAT', target: 'SELF', stat: 'ALCOHOL', delta: 2 },
  ],
  ['G: order Drinks', { op: 'DEAL_DRINKS', target: 'CHOSEN_PLAYER', count: 1 }],
] as const)('%s cannot trigger M27', (_name, effect) => {
  const f = fixture([effect]);
  expect(mayRespond(f)).toBe(false);
  expect(
    reactionContext(f.state, f.state.resolutionStack.at(-1)!).capabilities,
  ).not.toContain('CHANGES_DRINK_EFFECT');
});
it('H: a modifier currently affecting a Drink Event cannot trigger M27', () => {
  const f = fixture(
    [
      {
        op: 'MODIFY_PENDING_EFFECT',
        effectIndex: 0,
        delta: 2,
        allowDrinkEvents: true,
      },
    ],
    true,
  );
  expect(mayRespond(f)).toBe(false);
});
it('requires a Sometimes source even if an Anytime directly modifies the Drink', () => {
  const f = fixture(
    [{ op: 'MODIFY_DRINK', alcoholDelta: 2, fortitudeDelta: 0 }],
    false,
    'ANYTIME',
  );
  expect(mayRespond(f)).toBe(false);
});
it('I: M27 against M27 fails its direct-Drink predicate independently of protection', () => {
  const f = fixture([
    { op: 'MODIFY_DRINK', alcoholDelta: 2, fortitudeDelta: 0 },
  ]);
  const s = countered(f),
    frame = s.resolutionStack.at(-1)!,
    context = reactionContext(s, frame);
  expect(context.capabilities).not.toContain('CHANGES_DRINK_EFFECT');
  expect(triggerMatches(s, s.players[3]!.id, context, m27Trigger)).toBe(false);
  const unprotected = mutable(s),
    id = unprotected.cards[f.counter]!.definitionId;
  delete unprotected.definitions[id]!.allowedCounterFamilies;
  expect(
    legalResponsesForPlayer(
      unprotected,
      s.players[3]!.id,
      reactionContext(unprotected, frame),
    ).some((p) => p.cardId === f.second),
  ).toBe(false);
  expect(context.allowedCounterFamilies).toEqual(
    m27Metadata.allowedCounterFamilies,
  );
});
it.each(['rdi.negate_sometimes', 'rdi_core_hard_no'])(
  'J: equivalent %s counter Negates M27 and restores the original modifier',
  (family) => {
    const f = fixture([
      { op: 'MODIFY_DRINK', alcoholDelta: 2, fortitudeDelta: 0 },
    ]);
    const s = mutable(countered(f));
    s.definitions[s.cards[f.hard]!.definitionId]!.counterFamily = family;
    const responding = until(s, (x) => legal(x, 2, f.hard) !== undefined);
    const final = settle(play(responding, 2, f.hard).state);
    expect(final.players[0]!.alcoholContent).toBe(
      f.initial.players[0]!.alcoholContent + 5,
    );
  },
);
it('K: unrelated counter is rejected by incoming protection even though its Sometimes trigger matches', () => {
  const f = fixture([
    { op: 'MODIFY_DRINK', alcoholDelta: 2, fortitudeDelta: 0 },
  ]);
  const s = countered(f),
    context = reactionContext(s, s.resolutionStack.at(-1)!);
  expect(triggerMatches(s, s.players[3]!.id, context, m16Trigger)).toBe(true);
  expect(
    legalResponsesForPlayer(s, s.players[3]!.id, context).some(
      (p) => p.cardId === f.unrelated,
    ),
  ).toBe(false);
  const unprotected = mutable(s),
    id = unprotected.cards[f.counter]!.definitionId;
  delete unprotected.definitions[id]!.allowedCounterFamilies;
  expect(
    legalResponsesForPlayer(
      unprotected,
      s.players[3]!.id,
      reactionContext(unprotected, unprotected.resolutionStack.at(-1)!),
    ).some((p) => p.cardId === f.unrelated),
  ).toBe(true);
  const priority = until(
    s,
    (x) => x.responseWindow?.priorityPlayerId === x.players[3]!.id,
  );
  const result = applyCommand(
    priority,
    intent(priority, 'PLAY_RESPONSE', {
      cardId: f.unrelated,
      responseWindowId: priority.responseWindow!.id,
      promptId: priority.control.timedPrompt!.promptId,
    }),
    {
      actorId: priority.players[3]!.id,
      clock: { now: () => priority.control.timedPrompt!.openedAt },
    },
  );
  expect(result).toMatchObject({
    status: 'REJECTED',
    state: priority,
    events: [],
  });
});
it('preserves the 30-second opportunity, rejects stale prompts and keeps hidden IDs private across reconnect/replay', () => {
  const f = fixture([
    { op: 'MODIFY_DRINK', alcoholDelta: 2, fortitudeDelta: 0 },
  ]);
  const s = until(f.state, (x) => legal(x, 1, f.counter) !== undefined),
    prompt = s.control.timedPrompt!;
  expect(prompt.deadlineAt! - prompt.openedAt).toBe(30000);
  expect(JSON.stringify(projectPublicGame(s))).not.toContain(f.counter);
  expect(
    JSON.stringify(projectPrivatePlayer(s, s.players[2]!.id)),
  ).not.toContain(f.counter);
  reconnectAndReplay(s);
  const late = applyTimeout(s, {
    type: 'EXPIRE_PROMPT',
    commandId: 'command_m27_expire',
    roomId: s.roomId,
    expectedStateVersion: s.version,
    promptId: prompt.promptId,
    now: prompt.deadlineAt!,
  });
  expect(late.status).toBe('ACCEPTED');
  const rejected = applyCommand(
    late.state,
    intent(late.state, 'PLAY_RESPONSE', {
      cardId: f.counter,
      responseWindowId: s.responseWindow!.id,
      promptId: prompt.promptId,
    }),
    { actorId: s.players[1]!.id, clock: { now: () => prompt.deadlineAt! } },
  );
  expect(rejected).toMatchObject({
    status: 'REJECTED',
    state: late.state,
    events: [],
  });
});
it('publisher Negate-Drink category is a direct change; a counter of that card is an indirect change', () => {
  const f = fixture([{ op: 'IGNORE', scope: 'CURRENT_EFFECT' }]);
  const parent = f.state.resolutionStack[0]!,
    definition = cardDefinitionSchema.parse({
      id: 'carddef_test_m27_negate_drink',
      source: 'TEST_FIXTURE',
      name: 'Original synthetic Drink cancellation',
      rulesText: 'Synthetic classification only.',
      type: 'SOMETIMES',
      responseKind: 'SOMETIMES',
      effects: m27Effects,
    });
  expect(sourceCapabilities(definition, parent)).toContain(
    'CHANGES_DRINK_EFFECT',
  );
  expect(
    sourceCapabilities(definition, f.state.resolutionStack.at(-1)!),
  ).not.toContain('CHANGES_DRINK_EFFECT');
});

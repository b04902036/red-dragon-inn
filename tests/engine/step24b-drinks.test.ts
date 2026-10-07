import { expect, it } from 'vitest';
import { cardDefinitionSchema } from '../../src/content/cards';
import { coreStateSchema } from '../../src/engine/replay';
import { applyCommand } from '../../src/engine/commands';
import { intent } from '../fixtures/core-match';
import { putCard, play, send, until, legal } from '../fixtures/generic-match';
import {
  numericDrinks,
  placeFirstDrink,
  finish,
  verifyOpportunity,
} from '../fixtures/step24b';

const drinkTrigger = {
  event: 'DRINK' as const,
  alternatives: [[{ kind: 'SOURCE_KIND' as const, kinds: ['DRINK' as const] }]],
};
const selfDrink = {
  event: 'DRINK' as const,
  alternatives: [[{ kind: 'AFFECTS' as const, relation: 'SELF' as const }]],
};
function updateDrink(
  state: ReturnType<typeof numericDrinks>['state'],
  id: string,
  fields: Record<string, unknown>,
) {
  const definition = state.cards[id as keyof typeof state.cards]!.definitionId;
  state.definitions[definition] = cardDefinitionSchema.parse(
    Object.fromEntries(
      Object.entries({ ...state.definitions[definition], ...fields }).filter(
        ([, value]) => value !== undefined,
      ),
    ),
  );
}
it('fixed Drink-base replacement removes the full compound source while retaining prior and later non-Drink modifiers', () => {
  const { state, ids } = numericDrinks([3, 2]);
  updateDrink(state, ids[0]!, {
    chaser: true,
    fortitudeChange: -2,
    effects: [{ op: 'PAY_INN', target: 'SELF', amount: 2 }],
  });
  placeFirstDrink(state, ids, 2);
  const prior = putCard(
    state,
    1,
    [{ op: 'MODIFY_DRINK', alcoholDelta: 2, fortitudeDelta: -1 }],
    { trigger: drinkTrigger },
  );
  const replacement = putCard(
    state,
    1,
    [{ op: 'REPLACE_DRINK_BASE', alcohol: 4, fortitude: 0 }],
    { trigger: drinkTrigger, suffix: 'ignore' },
  );
  const later = putCard(
    state,
    2,
    [{ op: 'MODIFY_DRINK', alcoholDelta: 1, fortitudeDelta: 0 }],
    { trigger: drinkTrigger },
  );
  let pending = until(
    send(state, 'TAKE_DRINK', {}, 0).state,
    (s) => legal(s, 1, prior) !== undefined,
  );
  pending = until(
    play(pending, 1, prior).state,
    (s) =>
      s.resolutionStack.length === 1 && legal(s, 1, replacement) !== undefined,
  );
  verifyOpportunity(pending, 1, replacement);
  pending = until(
    play(pending, 1, replacement).state,
    (s) => s.resolutionStack.length === 1 && legal(s, 2, later) !== undefined,
  );
  const final = finish(play(pending, 2, later).state);
  expect(final.players[0]!.alcoholContent).toBe(7);
  expect(final.players[0]!.fortitude).toBe(19);
  expect(final.players[0]!.gold).toBe(state.players[0]!.gold);
  expect(final.innDrinkDiscard).toEqual(ids.slice(0, 2));
});
it('simultaneous Inn Drinks skip leading Events, finish Chasers, reveal every source before any consumption', () => {
  const { state, ids } = numericDrinks([0, 2, 0, 1, 1, 1]);
  state.phase = 'ACTION';
  updateDrink(state, ids[0]!, {
    type: 'DRINK_EVENT',
    alcoholContent: undefined,
    fortitudeChange: undefined,
    chaser: undefined,
    effects: [
      { op: 'CHANGE_STAT', target: 'SELF', stat: 'FORTITUDE', delta: -10 },
    ],
  });
  updateDrink(state, ids[1]!, { chaser: true });
  updateDrink(state, ids[2]!, {
    type: 'DRINK_EVENT',
    alcoholContent: undefined,
    fortitudeChange: undefined,
    chaser: undefined,
    effects: [
      { op: 'CHANGE_STAT', target: 'SELF', stat: 'FORTITUDE', delta: -10 },
    ],
  });
  const action = putCard(
    state,
    0,
    [
      {
        op: 'FORCE_SIMULTANEOUS_DRINK',
        targets: 'ALL_PLAYERS',
        source: 'INN',
        skipLeadingEvents: true,
      },
    ],
    { type: 'ACTION' },
  );
  let pending = play(state, 0, action).state;
  pending = until(pending, (s) => s.resolutionStack.at(-1)?.kind === 'DRINK');
  expect(pending.players.map((p) => p.alcoholContent)).toEqual([0, 0, 0, 0]);
  expect(pending.innDrinkDeck.cardIds).not.toContain(ids[1]);
  expect(pending.innDrinkDiscard).toContain(ids[0]);
  const final = finish(pending);
  expect(final.players.map((p) => p.alcoholContent)).toEqual([2, 1, 1, 1]);
  expect(final.players.map((p) => p.fortitude)).toEqual([20, 20, 20, 20]);
});
it.each(['OGRE', 'HALF_OGRE', 'ORC', 'TROLL', 'HUMAN'])(
  'whole numeric trait replacement supports %s without character-name rules',
  (trait) => {
    const { state, ids } = numericDrinks([2]);
    updateDrink(state, ids[0]!, {
      fortitudeChange: -1,
      traitReplacements: [
        { trait: 'OGRE', alcoholContent: 3, fortitudeChange: 0 },
        { trait: 'HALF_OGRE', alcoholContent: 3, fortitudeChange: 0 },
        { trait: 'ORC', alcoholContent: 2, fortitudeChange: 0 },
        { trait: 'TROLL', alcoholContent: 2, fortitudeChange: 0 },
      ],
    });
    state.players[0]!.traits = [trait];
    placeFirstDrink(state, ids);
    const final = finish(send(state, 'TAKE_DRINK', {}, 0).state);
    expect(final.players[0]!.alcoholContent).toBe(
      trait === 'OGRE' || trait === 'HALF_OGRE' ? 3 : 2,
    );
    expect(final.players[0]!.fortitude).toBe(trait === 'HUMAN' ? 19 : 20);
  },
);
function mead() {
  const result = numericDrinks();
  updateDrink(result.state, result.ids[0]!, { builtInSplit: true });
  placeFirstDrink(result.state, result.ids);
  return result;
}
it('built-in split waits for initial modifications, then permits independent half modifications and rejects external split', () => {
  const { state, ids } = mead();
  const prior = putCard(
    state,
    1,
    [{ op: 'MODIFY_DRINK', alcoholDelta: 2, fortitudeDelta: 0 }],
    { trigger: drinkTrigger },
  );
  const external = putCard(
    state,
    0,
    [{ op: 'SPLIT_CURRENT_DRINK', target: 'CHOSEN_PLAYER' }],
    { trigger: selfDrink },
  );
  const later = putCard(
    state,
    2,
    [{ op: 'MODIFY_DRINK', alcoholDelta: 1, fortitudeDelta: 0 }],
    { trigger: selfDrink },
  );
  let pending = until(
    send(state, 'TAKE_DRINK', {}, 0).state,
    (s) => legal(s, 1, prior) !== undefined,
  );
  expect(legal(pending, 0, external)).toBeUndefined();
  pending = until(
    play(pending, 1, prior).state,
    (s) => s.responseWindow?.pendingChoice?.kind === 'OPTION',
  );
  expect(pending.players[0]!.alcoholContent).toBe(0);
  expect(coreStateSchema.parse(JSON.parse(JSON.stringify(pending)))).toEqual(
    pending,
  );
  pending = send(
    pending,
    'CHOOSE_OPTION',
    { optionId: state.players[2]!.id },
    0,
  ).state;
  pending = until(
    pending,
    (s) =>
      s.resolutionStack.at(-1)?.actorId === state.players[2]!.id &&
      legal(s, 2, later) !== undefined,
  );
  verifyOpportunity(pending, 2, later);
  const final = finish(play(pending, 2, later).state);
  expect(final.players.map((p) => p.alcoholContent)).toEqual([3, 0, 4, 0]);
  expect(final.innDrinkDiscard.filter((id) => id === ids[0])).toHaveLength(1);
});
it('built-in split can be declined and does not split when appearing as a Chaser or Event result', () => {
  const { state } = mead();
  let pending = until(
    send(state, 'TAKE_DRINK', {}, 0).state,
    (s) => s.responseWindow?.pendingChoice?.kind === 'OPTION',
  );
  const final = finish(
    send(pending, 'CHOOSE_OPTION', { optionId: 'KEEP' }, 0).state,
  );
  expect(final.players[0]!.alcoholContent).toBe(3);
  const chaser = numericDrinks([1, 3]);
  updateDrink(chaser.state, chaser.ids[0]!, { chaser: true });
  updateDrink(chaser.state, chaser.ids[1]!, { builtInSplit: true });
  placeFirstDrink(chaser.state, chaser.ids, 2);
  expect(
    finish(send(chaser.state, 'TAKE_DRINK', {}, 0).state).players[0]!
      .alcoholContent,
  ).toBe(4);
  const event = mead();
  event.state.players[0]!.drinkPile = [];
  event.state.innDrinkDeck.cardIds = event.ids;
  event.ids.forEach((id) => {
    event.state.cards[id]!.location = {
      zone: 'INN_DRINK_DECK',
      deckId: event.state.innDrinkDeck.deckId,
    };
  });
  event.state.phase = 'ACTION';
  const house = putCard(event.state, 0, [{ op: 'ROUND_ON_HOUSE' }], {
    type: 'ACTION',
  });
  pending = play(event.state, 0, house).state;
  expect(finish(pending).players.map((p) => p.alcoholContent)).toEqual([
    3, 3, 3, 3,
  ]);
});
it.each(['ACCEPT', 'DECLINE'])(
  'optional Challenge %s uses two independent Inn Drinks, then pays only on survival',
  (optionId) => {
    const { state, ids } = numericDrinks([0, 2, 3]);
    updateDrink(state, ids[0]!, {
      type: 'DRINK_EVENT',
      alcoholContent: undefined,
      fortitudeChange: undefined,
      chaser: undefined,
      effects: [{ op: 'OPTIONAL_DRINK_CHALLENGE', target: 'SELF' }],
    });
    placeFirstDrink(state, ids);
    let pending = until(
      send(state, 'TAKE_DRINK', {}, 0).state,
      (s) => s.responseWindow?.pendingChoice?.kind === 'OPTION',
    );
    pending = send(pending, 'CHOOSE_OPTION', { optionId }, 0).state;
    const final = finish(pending);
    expect(final.players[0]!.alcoholContent).toBe(
      optionId === 'ACCEPT' ? 5 : 0,
    );
    expect(final.players.map((p) => p.gold)).toEqual(
      state.players.map(
        (p, i) => p.gold + (optionId === 'DECLINE' ? 0 : i === 0 ? 3 : -1),
      ),
    );
    expect(final.innDrinkDeck.cardIds).toEqual(
      optionId === 'DECLINE' ? ids.slice(1) : ids.slice(3),
    );
  },
);
it('a failed Challenge pays nothing after both Drinks', () => {
  const { state, ids } = numericDrinks([0, 2, 3]);
  state.players[0]!.fortitude = 5;
  updateDrink(state, ids[0]!, {
    type: 'DRINK_EVENT',
    alcoholContent: undefined,
    fortitudeChange: undefined,
    chaser: undefined,
    effects: [{ op: 'OPTIONAL_DRINK_CHALLENGE', target: 'SELF' }],
  });
  placeFirstDrink(state, ids);
  let pending = until(
    send(state, 'TAKE_DRINK', {}, 0).state,
    (s) => s.responseWindow?.pendingChoice?.kind === 'OPTION',
  );
  pending = send(pending, 'CHOOSE_OPTION', { optionId: 'ACCEPT' }, 0).state;
  const final = finish(pending);
  expect(final.players[0]!.eliminated).toBe(true);
  expect([...final.innDrinkDiscard].sort()).toEqual(ids.slice(0, 3).sort());
  expect(final.players[0]!.gold).toBe(0);
});

it('Drink replacement preserves an earlier Alcohol-to-Fortitude conversion and later modifiers', () => {
  const { state, ids } = numericDrinks([3]);
  placeFirstDrink(state, ids);
  const conversion = putCard(
    state,
    0,
    [{ op: 'REPLACE_DRINK_ALCOHOL_WITH_FORTITUDE' }],
    { trigger: selfDrink },
  );
  const replacement = putCard(
    state,
    1,
    [{ op: 'REPLACE_DRINK_BASE', alcohol: 4, fortitude: 0 }],
    { trigger: drinkTrigger },
  );
  const modifier = putCard(
    state,
    2,
    [{ op: 'MODIFY_DRINK', alcoholDelta: 2, fortitudeDelta: 0 }],
    { trigger: drinkTrigger },
  );
  state.players[0]!.fortitude = 10;
  let pending = until(
    send(state, 'TAKE_DRINK', {}, 0).state,
    (s) => legal(s, 0, conversion) !== undefined,
  );
  pending = until(
    play(pending, 0, conversion).state,
    (s) =>
      s.resolutionStack.length === 1 && legal(s, 1, replacement) !== undefined,
  );
  pending = until(
    play(pending, 1, replacement).state,
    (s) =>
      s.resolutionStack.length === 1 && legal(s, 2, modifier) !== undefined,
  );
  const final = finish(play(pending, 2, modifier).state);
  expect(final.players[0]!.alcoholContent).toBe(0);
  expect(final.players[0]!.fortitude).toBe(16);
});
it('Challenge skips leading Events but an Event Chaser ends that chain without starting a replacement base search', () => {
  const { state, ids } = numericDrinks([0, 0, 2, 0, 3]);
  const event = {
    type: 'DRINK_EVENT',
    alcoholContent: undefined,
    fortitudeChange: undefined,
    chaser: undefined,
    effects: [],
  };
  updateDrink(state, ids[0]!, {
    ...event,
    effects: [{ op: 'OPTIONAL_DRINK_CHALLENGE', target: 'SELF' }],
  });
  updateDrink(state, ids[1]!, event);
  updateDrink(state, ids[2]!, { chaser: true });
  updateDrink(state, ids[3]!, event);
  placeFirstDrink(state, ids);
  let pending = until(
    send(state, 'TAKE_DRINK', {}, 0).state,
    (s) => s.responseWindow?.pendingChoice?.kind === 'OPTION',
  );
  expect(
    applyCommand(
      pending,
      intent(pending, 'CHOOSE_OPTION', {
        optionId: 'ACCEPT',
        responseWindowId: 'window_stale',
      }),
      { actorId: state.players[0]!.id },
    ),
  ).toMatchObject({ status: 'REJECTED', state: pending, events: [] });
  pending = send(pending, 'CHOOSE_OPTION', { optionId: 'ACCEPT' }, 0).state;
  const final = finish(pending);
  expect(final.players[0]!.alcoholContent).toBe(5);
  expect([...final.innDrinkDiscard].sort()).toEqual(ids.slice(0, 5).sort());
  expect(final.innDrinkDeck.cardIds).toEqual(ids.slice(5));
});
it('normal Event Ignore prevents Challenge choices and draws', () => {
  const { state, ids } = numericDrinks();
  updateDrink(state, ids[0]!, {
    type: 'DRINK_EVENT',
    alcoholContent: undefined,
    fortitudeChange: undefined,
    chaser: undefined,
    effects: [{ op: 'OPTIONAL_DRINK_CHALLENGE', target: 'SELF' }],
  });
  placeFirstDrink(state, ids);
  const ignore = putCard(
    state,
    0,
    [{ op: 'IGNORE', scope: 'CURRENT_EFFECT' }],
    {
      trigger: {
        event: 'DRINK_EVENT',
        alternatives: [[{ kind: 'AFFECTS', relation: 'SELF' }]],
      },
    },
  );
  const pending = until(
    send(state, 'TAKE_DRINK', {}, 0).state,
    (s) => legal(s, 0, ignore) !== undefined,
  );
  const final = finish(play(pending, 0, ignore).state);
  expect(final.innDrinkDeck.cardIds).toEqual(ids.slice(1));
  expect(final.players[0]!.alcoholContent).toBe(0);
});

import { expect, it } from 'vitest';
import { cardDefinitionSchema } from '../../src/content/cards';
import { DEFAULT_RULES } from '../../src/engine/rules';
import { createMatch } from '../../src/engine/setup';
import { projectPublicGame } from '../../src/protocol/projections';
import { drinkState } from '../fixtures/drink-match';
import { cardInHand } from '../fixtures/timing-match';
import {
  genericState,
  putCard,
  play,
  send,
  until,
  settle,
  systemTrigger,
  reconnectAndReplay,
  legal,
} from '../fixtures/generic-match';
import { setupInput } from '../fixtures/core-match';

it('initializes generic character traits and preserves additional Drink operations in House copies', () => {
  const setup = setupInput();
  setup.content.characters[0]!.rules.traits = ['TROLL'];
  expect(createMatch(setup).players[0]!.traits).toEqual(['TROLL']);
  const state = drinkState([]);
  state.phase = 'ACTION';
  state.rules.timing = { ...DEFAULT_RULES.timing };
  const id = state.cards[state.innDrinkDeck.cardIds[0]!]!.definitionId;
  state.definitions[id] = cardDefinitionSchema.parse({
    ...state.definitions[id],
    type: 'DRINK',
    alcoholContent: 3,
    fortitudeChange: 0,
    chaser: false,
    effects: [
      { op: 'CHANGE_STAT', target: 'SELF', stat: 'FORTITUDE', delta: 2 },
      { op: 'CHANGE_STAT', target: 'SELF', stat: 'ALCOHOL', delta: 1 },
    ],
  });
  const house = putCard(state, 0, [{ op: 'ROUND_ON_HOUSE' }], {
    type: 'ACTION',
  });
  const finished = settle(play(state, 0, house).state);
  expect(finished.players.map((player) => player.fortitude)).toEqual([
    22, 22, 22, 22,
  ]);
  expect(finished.players.map((player) => player.alcoholContent)).toEqual([
    4, 4, 4, 4,
  ]);
});

it('does not offer an ante substitution or raise that would overflow reserved payout capacity', () => {
  const state = genericState();
  state.rules.statBounds.gold = { min: 0, max: 13 };
  const sub = putCard(
    state,
    0,
    [{ op: 'SUBSTITUTE_PAYMENT_FROM_INN', amount: 1 }],
    { trigger: systemTrigger('ANTE_REQUIRED') },
  );
  // Other original Sometimes responders keep the source interruptible; the unaffordable system response is skipped.
  const pending = settle(play(state, 0, cardInHand(state, 0, 'gamble')).state);
  expect(legal(pending, 0, sub)).toBeUndefined();
  const raised = genericState();
  raised.rules.statBounds.gold = { min: 0, max: 13 };
  const raise = putCard(raised, 1, [{ op: 'ANTE_ALL_ACTIVE', amount: 1 }], {
    type: 'CHEATING',
    suffix: 'cheat',
  });
  const round = settle(play(raised, 0, cardInHand(raised, 0, 'gamble')).state);
  expect(legal(round, 1, raise)).toBeUndefined();
});

it('ignoring the source cannot turn its mandatory payment into a free effect', () => {
  const state = drinkState();
  state.rules.timing = { ...DEFAULT_RULES.timing };
  const ignore = putCard(
    state,
    0,
    [{ op: 'IGNORE', scope: 'CURRENT_EFFECT' }],
    { mandatoryGoldCost: 1, trigger: { event: 'DRINK', alternatives: [[]] } },
  );
  let pending = send(state, 'TAKE_DRINK', {}, 0).state;
  pending = until(pending, (s) => legal(s, 0, ignore) !== undefined);
  pending = play(pending, 0, ignore).state;
  pending = until(
    pending,
    (s) => legal(s, 0, cardInHand(s, 0, 'ignore')) !== undefined,
  );
  pending = play(pending, 0, cardInHand(pending, 0, 'ignore')).state;
  const finished = settle(pending);
  expect(finished.players[0]!.gold).toBe(state.players[0]!.gold - 1);
  expect(finished.players[0]!.alcoholContent).toBe(0);
});

it('a full cost that becomes unaffordable during nested responses cancels the paid effect before Ignore', () => {
  const state = drinkState();
  state.rules.timing = { ...DEFAULT_RULES.timing };
  state.players[0]!.gold = 1;
  const ignore = putCard(
    state,
    0,
    [{ op: 'IGNORE', scope: 'CURRENT_EFFECT' }],
    { mandatoryGoldCost: 1, trigger: { event: 'DRINK', alternatives: [[]] } },
  );
  const charge = putCard(
    state,
    1,
    [{ op: 'PAY_INN', target: 'CHOSEN_PLAYER', amount: 1 }],
    { type: 'ANYTIME' },
  );
  let pending = send(state, 'TAKE_DRINK', {}, 0).state;
  pending = until(pending, (s) => legal(s, 0, ignore) !== undefined);
  pending = play(pending, 0, ignore).state;
  pending = until(pending, (s) => legal(s, 1, charge) !== undefined);
  pending = play(pending, 1, charge, state.players[0]!.id).state;
  expect(settle(pending).players[0]).toMatchObject({
    gold: 0,
    alcoholContent: 2,
  });
});

it('Inn substitution credits a player recipient when the payer has no remaining Gold', () => {
  const state = genericState();
  state.players[1]!.gold = 0;
  const sub = putCard(
    state,
    1,
    [{ op: 'SUBSTITUTE_PAYMENT_FROM_INN', amount: 1 }],
    { trigger: systemTrigger('PAYMENT_REQUIRED') },
  );
  const collect = putCard(
    state,
    0,
    [{ op: 'COLLECT_GOLD', target: 'CHOSEN_PLAYER', amount: 2 }],
    { type: 'ANYTIME' },
  );
  let pending = play(state, 0, collect, state.players[1]!.id).state;
  pending = until(pending, (s) => legal(s, 1, sub) !== undefined);
  pending = play(pending, 1, sub).state;
  expect(settle(pending).players[0]!.gold).toBe(11);
});

it('canceling an uncommitted ante preserves the payer stash and never refunds earlier pot contributions', () => {
  const state = genericState();
  const cancel = putCard(state, 0, [{ op: 'CANCEL_CURRENT_ANTE_FOR_SELF' }], {
    trigger: systemTrigger('ANTE_REQUIRED'),
  });
  let pending = play(state, 0, cardInHand(state, 0, 'gamble')).state;
  pending = until(pending, (s) => legal(s, 0, cancel) !== undefined);
  pending = play(pending, 0, cancel).state;
  const finished = settle(pending);
  expect(finished.gambling!.pot).toBe(3);
  expect(finished.players[0]!.gold).toBe(10);
});

it('House skips source Events, publishes every independent copy only after preparation, and modifications affect one copy', () => {
  const state = drinkState([]);
  state.phase = 'ACTION';
  state.rules.timing = { ...DEFAULT_RULES.timing };
  const event = state.innDrinkDeck.cardIds[0]!,
    drink = state.innDrinkDeck.cardIds[1]!;
  const eventDefinition = cardDefinitionSchema.parse({
    id: 'carddef_test_source_event',
    source: 'TEST_FIXTURE',
    name: 'Original source event',
    rulesText: 'Gain Fortitude.',
    type: 'DRINK_EVENT',
    effects: [
      { op: 'CHANGE_STAT', target: 'SELF', stat: 'FORTITUDE', delta: 100 },
    ],
  });
  const drinkDefinition = cardDefinitionSchema.parse({
    id: 'carddef_test_house_drink',
    source: 'TEST_FIXTURE',
    name: 'Original shared Drink',
    rulesText: 'Gain Alcohol.',
    type: 'DRINK',
    alcoholContent: 3,
    fortitudeChange: -1,
    chaser: false,
    effects: [],
  });
  state.definitions[eventDefinition.id] = eventDefinition;
  state.cards[event]!.definitionId = eventDefinition.id;
  state.definitions[drinkDefinition.id] = drinkDefinition;
  state.cards[drink]!.definitionId = drinkDefinition.id;
  const house = putCard(state, 0, [{ op: 'ROUND_ON_HOUSE' }], {
    type: 'ACTION',
  });
  const modify = putCard(
    state,
    0,
    [{ op: 'MODIFY_DRINK', alcoholDelta: 2, fortitudeDelta: 0 }],
    {
      suffix: 'shove',
      trigger: {
        event: 'DRINK',
        alternatives: [[{ kind: 'AFFECTS', relation: 'SELF' }]],
      },
    },
  );
  let pending = play(state, 0, house).state;
  expect(legal(pending, 0, modify)).toBeUndefined();
  pending = until(pending, (s) => legal(s, 0, modify) !== undefined);
  expect(pending.innDrinkDiscard).toContain(event);
  expect(
    projectPublicGame(pending)
      .resolutionStack.find((f) => f.revealedDrinks?.length === 3)
      ?.revealedDrinks!.every((w) => w.cards[0]!.id === drink),
  ).toBe(true);
  expect(
    projectPublicGame(pending).resolutionStack.at(-1)!.sourceCard?.id,
  ).toBe(drink);
  reconnectAndReplay(pending);
  pending = play(pending, 0, modify).state;
  const finished = settle(pending);
  expect(finished.players.map((p) => p.alcoholContent)).toEqual([5, 3, 3, 3]);
  expect(finished.players.map((p) => p.fortitude)).toEqual([19, 19, 19, 19]);
  expect(finished.innDrinkDiscard.filter((id) => id === drink)).toHaveLength(1);
});

it('split combines Chasers before halving both signed effects, with an independent Ignore on just one copy', () => {
  const state = drinkState(['tea', 'fizz']);
  state.rules.timing = { ...DEFAULT_RULES.timing };
  const first = state.cards[state.players[0]!.drinkPile[0]!]!.definitionId;
  state.definitions[first] = cardDefinitionSchema.parse({
    ...state.definitions[first],
    chaser: true,
    chaserSource: 'SAME_SOURCE',
    alcoholContent: 3,
    fortitudeChange: -3,
  });
  const split = putCard(
    state,
    0,
    [{ op: 'SPLIT_CURRENT_DRINK', target: 'CHOSEN_PLAYER' }],
    { trigger: { event: 'DRINK', alternatives: [[]] } },
  );
  let pending = send(state, 'TAKE_DRINK', {}, 0).state;
  pending = until(pending, (s) => legal(s, 0, split) !== undefined);
  expect(pending.resolutionStack[0]!.sourceCardIds).toHaveLength(2);
  pending = play(pending, 0, split, state.players[1]!.id).state;
  pending = until(
    pending,
    (s) =>
      s.resolutionStack.at(-1)?.kind === 'DRINK' &&
      s.resolutionStack.at(-1)?.actorId === s.players[1]!.id &&
      legal(s, 1, cardInHand(s, 1, 'ignore')) !== undefined,
  );
  pending = play(pending, 1, cardInHand(pending, 1, 'ignore')).state;
  const finished = settle(pending);
  expect(finished.players[0]).toMatchObject({
    alcoholContent: 3,
    fortitude: 19,
  });
  expect(finished.players[1]).toMatchObject({
    alcoholContent: 0,
    fortitude: 20,
  });
  expect(finished.innDrinkDiscard).toHaveLength(2);
});

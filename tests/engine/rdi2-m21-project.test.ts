import { expect, it } from 'vitest';
import { cardDefinitionSchema } from '../../src/content/cards';
import { applyCommand } from '../../src/engine/commands';
import { sourceCapabilities } from '../../src/engine/source-capabilities';
import {
  projectPublicGame,
  projectPrivatePlayer,
} from '../../src/protocol/projections';
import { DEFAULT_RULES } from '../../src/engine/rules';
import { drinkState } from '../fixtures/drink-match';
import { intent } from '../fixtures/core-match';
import {
  putCard,
  play,
  send,
  until,
  settle,
  legal,
  reconnectAndReplay,
} from '../fixtures/generic-match';
import { m21Effects, m21Trigger } from '../fixtures/rdi2-m21-project';

function fixture({ chaser = false, empty = false, contest = false } = {}) {
  const state = drinkState([]);
  state.rules.timing = { ...DEFAULT_RULES.timing };
  const cards = [...state.innDrinkDeck.cardIds];
  expect(cards.length).toBeGreaterThanOrEqual(5);
  cards.forEach((id, i) => {
    const definition = cardDefinitionSchema.parse({
      id: `carddef_test_m21_drink_${i}`,
      name: 'Original synthetic M21 Drink',
      rulesText: 'Original numeric test fixture.',
      source: 'TEST_FIXTURE',
      type: 'DRINK',
      alcoholContent: contest
        ? ([6, 2, 3, 1, 1][i] ?? 1)
        : ([2, 6, 4, 1, 1][i] ?? 1),
      fortitudeChange: 0,
      chaser: chaser && i === 0,
      effects: [],
    });
    state.definitions[definition.id] = definition;
    state.cards[id]!.definitionId = definition.id;
  });
  const pile = contest || empty ? cards.slice(0, 1) : cards.slice(0, 3);
  state.players[0]!.drinkPile = pile;
  state.innDrinkDeck.cardIds = cards.slice(pile.length);
  pile.forEach((id) => {
    state.cards[id]!.location = {
      zone: 'DRINK_PILE',
      playerId: state.players[0]!.id,
    };
  });
  const card = putCard(state, 1, m21Effects, { trigger: m21Trigger });
  return { state, card, cards };
}
const pendingDrink = (
  state: ReturnType<typeof fixture>['state'],
  card: string,
) =>
  until(
    send(state, 'TAKE_DRINK', {}, 0).state,
    (s) => legal(s, 1, card) !== undefined,
  );

it('A/B/D: an actual other-player reveal queues exactly one independent own-pile Drink after the original, without an Inn draw', () => {
  const { state, card, cards } = fixture();
  expect(legal(state, 1, card)).toBeUndefined();
  let pending = pendingDrink(state, card);
  pending = play(pending, 1, card).state;
  pending = until(pending, (s) => s.resolutionStack.length === 1);
  expect(pending.players[0]!.drinkPile).toEqual(cards.slice(1, 3));
  expect(pending.players[0]!.alcoholContent).toBe(
    state.players[0]!.alcoholContent,
  );
  expect(pending.innDrinkDeck.cardIds).toEqual(state.innDrinkDeck.cardIds);
  const hidden = cards[1]!;
  expect(JSON.stringify(projectPublicGame(pending))).not.toContain(hidden);
  expect(
    JSON.stringify(projectPrivatePlayer(pending, state.players[1]!.id)),
  ).not.toContain(hidden);
  reconnectAndReplay(pending);
  pending = until(
    pending,
    (s) => s.resolutionStack.at(-1)?.sourceCardIds?.includes(hidden) === true,
  );
  expect(pending.players[0]!.alcoholContent).toBe(
    state.players[0]!.alcoholContent + 2,
  );
  expect(pending.resolutionStack.at(-1)!.sourceCardIds).toEqual([hidden]);
  const final = settle(pending);
  expect(final.players[0]!.alcoholContent).toBe(
    state.players[0]!.alcoholContent + 8,
  );
  expect(final.players[0]!.drinkPile).toEqual([cards[2]]);
  expect(final.innDrinkDeck.cardIds).toEqual(state.innDrinkDeck.cardIds);
  expect([...final.innDrinkDiscard].sort()).toEqual(cards.slice(0, 2).sort());
  expect(final.players.slice(1).map((p) => p.alcoholContent)).toEqual(
    state.players.slice(1).map((p) => p.alcoholContent),
  );
});
it('C: self reveals and forged self-use are rejected by the authoritative engine', () => {
  const { state } = fixture();
  const own = putCard(state, 0, m21Effects, { trigger: m21Trigger });
  const pending = until(
    send(state, 'TAKE_DRINK', {}, 0).state,
    (s) => s.responseWindow?.priorityPlayerId === s.players[0]!.id,
  );
  expect(legal(pending, 0, own)).toBeUndefined();
  expect(
    applyCommand(
      pending,
      intent(pending, 'PLAY_RESPONSE', {
        cardId: own,
        responseWindowId: pending.responseWindow!.id,
        promptId: pending.control.timedPrompt!.promptId,
      }),
      {
        actorId: pending.players[0]!.id,
        clock: { now: () => pending.control.timedPrompt!.openedAt },
      },
    ),
  ).toMatchObject({ status: 'REJECTED', state: pending, events: [] });
});
it('E: the shared reveal completes all Chasers before M21 is legal; the extra Drink is a separate base Drink', () => {
  const { state, card, cards } = fixture({ chaser: true });
  const revealed = send(state, 'TAKE_DRINK', {}, 0);
  expect(
    revealed.events.filter((e) => e.type === 'DRINK_REVEALED'),
  ).toHaveLength(2);
  expect(revealed.state.resolutionStack.at(-1)!.sourceCardIds).toEqual(
    cards.slice(0, 2),
  );
  const pending = until(revealed.state, (s) => legal(s, 1, card) !== undefined);
  expect(pending.players[0]!.drinkPile).toEqual([cards[2]]);
  const final = settle(play(pending, 1, card).state);
  expect(final.players[0]!.alcoholContent).toBe(
    state.players[0]!.alcoholContent + 12,
  );
  expect([...final.innDrinkDiscard].sort()).toEqual(cards.slice(0, 3).sort());
});
it.each(['IGNORE', 'MODIFY'] as const)(
  'F: %s of the original does not cancel, merge or modify the queued extra Drink',
  (mode) => {
    const { state, card } = fixture();
    const response = putCard(
      state,
      0,
      mode === 'IGNORE'
        ? [{ op: 'IGNORE', scope: 'CURRENT_EFFECT' }]
        : [
            {
              op: 'MODIFY_DRINK',
              alcoholDelta: 2,
              fortitudeDelta: 0,
              allowDrinkEvents: false,
            },
          ],
      {
        trigger: {
          event: 'DRINK',
          alternatives: [[{ kind: 'AFFECTS', relation: 'SELF' }]],
        },
        suffix: 'ignore',
      },
    );
    let pending = play(pendingDrink(state, card), 1, card).state;
    pending = until(pending, (s) => legal(s, 0, response) !== undefined);
    const final = settle(play(pending, 0, response).state);
    expect(final.players[0]!.alcoholContent).toBe(
      state.players[0]!.alcoholContent + (mode === 'IGNORE' ? 6 : 10),
    );
  },
);
it('G: a contest reveal permits M21; actual Alcohol increases but the extra Drink cannot change the comparison or winner', () => {
  const { state, card, cards } = fixture({ contest: true });
  state.phase = 'ACTION';
  const contest = putCard(
    state,
    0,
    [
      {
        op: 'DRINKING_CONTEST',
        rules: {
          drinkEvents: 'IGNORE',
          scoring: 'REVEALED_WITH_MODIFIERS',
          settlement: 'AFTER_CONTEST',
        },
      },
    ],
    { type: 'ACTION' },
  );
  const pending = until(
    play(state, 0, contest).state,
    (s) => legal(s, 1, card) !== undefined,
  );
  expect(pending.resolutionStack.at(-1)!.actorId).toBe(state.players[0]!.id);
  expect(pending.resolutionStack.at(-1)!.sourceCardIds).toEqual([cards[1]]);
  const final = settle(play(pending, 1, card).state);
  expect(final.players.map((p) => p.alcoholContent)).toEqual([8, 3, 1, 1]);
  expect(final.players.map((p) => p.gold)).toEqual(
    state.players.map((p, i) => p.gold + (i === 1 ? 3 : -1)),
  );
  expect(final.players[0]!.drinkPile).toEqual([]);
  expect(final.innDrinkDiscard).toContain(cards[0]);
});
it.each(['SOBER', 'SKIP'] as const)(
  'H: an empty own pile uses shared %s behavior without an Inn substitute',
  (emptyPile) => {
    const { state, card } = fixture({ empty: true });
    state.players[0]!.alcoholContent = 5;
    state.rules.drinks.emptyPile = emptyPile;
    const final = settle(play(pendingDrink(state, card), 1, card).state);
    expect(final.players[0]!.alcoholContent).toBe(
      emptyPile === 'SOBER' ? 6 : 7,
    );
    expect(final.innDrinkDeck.cardIds).toEqual(state.innDrinkDeck.cardIds);
  },
);
it('the extra Drink supports its own Ignore response, without ignoring the original', () => {
  const { state, card, cards } = fixture();
  const ignore = putCard(
    state,
    0,
    [{ op: 'IGNORE', scope: 'CURRENT_EFFECT' }],
    {
      trigger: {
        event: 'DRINK',
        alternatives: [[{ kind: 'AFFECTS', relation: 'SELF' }]],
      },
      suffix: 'ignore',
    },
  );
  let pending = play(pendingDrink(state, card), 1, card).state;
  pending = until(
    pending,
    (s) =>
      s.resolutionStack.at(-1)?.sourceCardIds?.includes(cards[1]!) === true &&
      legal(s, 0, ignore) !== undefined,
  );
  const final = settle(play(pending, 0, ignore).state);
  expect(final.players[0]!.alcoholContent).toBe(
    state.players[0]!.alcoholContent + 2,
  );
  expect([...final.innDrinkDiscard].sort()).toEqual(cards.slice(0, 2).sort());
});
it('a Drink-modification-only counter cannot counter M21, while a legal Sometimes Negate prevents the extra Drink', () => {
  const { state, card, cards } = fixture();
  const drinkCounter = putCard(
    state,
    2,
    [{ op: 'NEGATE', scope: 'TOP_STACK' }],
    {
      trigger: {
        event: 'CARD',
        alternatives: [
          [
            {
              kind: 'SOURCE_CAPABILITY',
              capabilities: ['CHANGES_DRINK_EFFECT'],
              match: 'ANY',
            },
          ],
        ],
      },
    },
  );
  const counter = putCard(state, 2, [{ op: 'NEGATE', scope: 'TOP_STACK' }], {
    suffix: 'ignore',
    trigger: {
      event: 'CARD',
      alternatives: [
        [
          { kind: 'SOURCE_TYPE', types: ['SOMETIMES'] },
          { kind: 'NEGATABLE', value: true },
        ],
      ],
    },
  });
  let pending = play(pendingDrink(state, card), 1, card).state;
  expect(
    sourceCapabilities(
      pending.definitions[pending.cards[card]!.definitionId],
      pending.resolutionStack.at(-2),
    ),
  ).toEqual(['FORCES_DRINK']);
  pending = until(pending, (s) => legal(s, 2, counter) !== undefined);
  expect(legal(pending, 2, drinkCounter)).toBeUndefined();
  const final = settle(play(pending, 2, counter).state);
  expect(final.players[0]!.alcoholContent).toBe(
    state.players[0]!.alcoholContent + 2,
  );
  expect(final.players[0]!.drinkPile).toEqual(cards.slice(1, 3));
});
it('two legally resolved copies queue two independent Drinks without a once-per-phase restriction', () => {
  const { state, card, cards } = fixture();
  const second = putCard(state, 1, m21Effects, {
    trigger: m21Trigger,
    suffix: 'ignore',
  });
  let pending = play(pendingDrink(state, card), 1, card).state;
  pending = until(
    pending,
    (s) => s.resolutionStack.length === 1 && legal(s, 1, second) !== undefined,
  );
  const final = settle(play(pending, 1, second).state);
  expect(final.players[0]!.alcoholContent).toBe(
    state.players[0]!.alcoholContent + 12,
  );
  expect([...final.innDrinkDiscard].sort()).toEqual(cards.slice(0, 3).sort());
});
it('extra-Drink pass-out uses shared elimination and the live prompt retains guest timing, stale rejection and reconnect/replay', () => {
  const { state, card } = fixture();
  state.players[0]!.fortitude = 7;
  const pending = pendingDrink(state, card);
  const prompt = pending.control.timedPrompt!;
  expect(prompt.deadlineAt! - prompt.openedAt).toBe(30000);
  const wrong = applyCommand(
    pending,
    intent(pending, 'PLAY_RESPONSE', {
      cardId: card,
      responseWindowId: pending.responseWindow!.id,
      promptId: 'prompt_stale',
    }),
    { actorId: state.players[1]!.id, clock: { now: () => prompt.openedAt } },
  );
  expect(wrong).toMatchObject({
    status: 'REJECTED',
    state: pending,
    events: [],
  });
  reconnectAndReplay(pending);
  const final = settle(play(pending, 1, card).state);
  expect(final.players[0]!.eliminated).toBe(true);
});
it.each(['PASS', 'SPLIT'] as const)(
  'the extra Drink supports its own %s using shared recipient rules',
  (mode) => {
    const { state, card, cards } = fixture();
    const response = putCard(
      state,
      0,
      [
        {
          op: mode === 'PASS' ? 'PASS_CURRENT_DRINK' : 'SPLIT_CURRENT_DRINK',
          target: 'CHOSEN_PLAYER',
        },
      ],
      {
        suffix: 'ignore',
        trigger: {
          event: 'DRINK',
          alternatives: [[{ kind: 'AFFECTS', relation: 'SELF' }]],
        },
      },
    );
    let pending = play(pendingDrink(state, card), 1, card).state;
    pending = until(
      pending,
      (s) =>
        s.resolutionStack.at(-1)?.sourceCardIds?.includes(cards[1]!) === true &&
        legal(s, 0, response) !== undefined,
    );
    const final = settle(
      play(pending, 0, response, state.players[2]!.id).state,
    );
    expect(final.players[0]!.alcoholContent).toBe(mode === 'PASS' ? 2 : 5);
    expect(final.players[2]!.alcoholContent).toBe(mode === 'PASS' ? 6 : 3);
  },
);
it('the additional Drink completes its own Chasers and applies Fortitude effects independently', () => {
  const { state, card, cards } = fixture();
  const extra = state.cards[cards[1]!]!.definitionId;
  state.definitions[extra] = cardDefinitionSchema.parse({
    ...state.definitions[extra],
    chaser: true,
    fortitudeChange: -2,
  });
  const final = settle(play(pendingDrink(state, card), 1, card).state);
  expect(final.players[0]!.alcoholContent).toBe(12);
  expect(final.players[0]!.fortitude).toBe(18);
  expect(final.players[0]!.drinkPile).toEqual([]);
  expect([...final.innDrinkDiscard].sort()).toEqual(cards.slice(0, 3).sort());
});
it('the reveal response also works outside the normal Drink Phase, and entering a phase alone is insufficient', () => {
  const { state, card } = fixture();
  state.phase = 'ACTION';
  expect(legal(state, 1, card)).toBeUndefined();
  const force = putCard(
    state,
    2,
    [{ op: 'FORCE_DRINK', target: 'CHOSEN_PLAYER' }],
    { type: 'ANYTIME' },
  );
  const pending = until(
    play(state, 2, force, state.players[0]!.id).state,
    (s) => legal(s, 1, card) !== undefined,
  );
  expect(pending.phase).toBe('ACTION');
  expect(settle(play(pending, 1, card).state).players[0]!.alcoholContent).toBe(
    8,
  );
});
it.each(['EMPTY', 'EVENT'] as const)(
  'M21 requires an actual Drink, rejecting %s even when an Anytime keeps a response opportunity open',
  (mode) => {
    const { state, card, cards } = fixture();
    if (mode === 'EMPTY') {
      state.players[0]!.drinkPile = [];
      state.innDrinkDeck.cardIds = cards;
      cards.forEach((id) => {
        state.cards[id]!.location = {
          zone: 'INN_DRINK_DECK',
          deckId: state.innDrinkDeck.deckId,
        };
      });
    } else {
      const definition = cardDefinitionSchema.parse({
        id: 'carddef_test_m21_event',
        name: 'Original empty test event',
        rulesText: 'Original fixture.',
        source: 'TEST_FIXTURE',
        type: 'DRINK_EVENT',
        effects: [],
      });
      state.definitions[definition.id] = definition;
      state.cards[cards[0]!]!.definitionId = definition.id;
    }
    const anytime = putCard(
      state,
      2,
      [{ op: 'CHANGE_STAT', stat: 'FORTITUDE', target: 'SELF', delta: 1 }],
      { type: 'ANYTIME' },
    );
    const pending = until(
      send(state, 'TAKE_DRINK', {}, 0).state,
      (s) => legal(s, 2, anytime) !== undefined,
    );
    expect(pending.resolutionStack.at(-1)!.kind).toBe(
      mode === 'EMPTY' ? 'DRINK' : 'DRINK_EVENT',
    );
    expect(legal(pending, 1, card)).toBeUndefined();
  },
);

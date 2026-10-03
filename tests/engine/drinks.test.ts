import { describe, expect, it } from 'vitest';
import type { Effect } from '../../src/content/effects';
import type { CoreGameState } from '../../src/engine/types';
import { applyCommand } from '../../src/engine/commands';
import { assertCoreInvariants } from '../../src/engine/invariants';
import { DEFAULT_RULES, rulesConfigSchema } from '../../src/engine/rules';
import { domainEventSchema } from '../../src/protocol/events';
import { projectPublicGame } from '../../src/protocol/projections';
import { accepted, intent, mutable } from '../fixtures/core-match';
import {
  cardInHand,
  pass,
  response,
  passWindow,
} from '../fixtures/timing-match';
import {
  drinkState,
  takeDrink,
  resolveResponses,
} from '../fixtures/drink-match';

function configureResponse(input: CoreGameState, effects: Effect[]) {
  const state = mutable(input);
  state.definitions[
    state.cards[cardInHand(state, 1, 'breather')]!.definitionId
  ]!.effects = effects;
  return state;
}
function rejected(
  state: CoreGameState,
  type: string,
  fields: Record<string, unknown> = {},
  seat = 0,
  code = 'RESOLUTION_PENDING',
) {
  const before = JSON.stringify(state);
  expect(
    applyCommand(state, intent(state, type, fields), {
      actorId: state.players[seat]!.id,
    }),
  ).toMatchObject({ status: 'REJECTED', code, state, events: [] });
  expect(JSON.stringify(state)).toBe(before);
}
describe('hidden ordering, reveal, compound Drinks, and configured fallback', () => {
  it('validates bounded Chaser work and server-owned fallback/distribution policies', () => {
    for (const drinks of [
      { ...DEFAULT_RULES.drinks, maxChainCards: 0 },
      { ...DEFAULT_RULES.drinks, maxChainCards: 33 },
      { ...DEFAULT_RULES.drinks, soberAmount: 0 },
      { ...DEFAULT_RULES.drinks, emptyPile: 'CLIENT_RESULT' },
      { ...DEFAULT_RULES.drinks, chaserSource: 'HAND' },
      { ...DEFAULT_RULES.drinks, chaserEvent: 'EXECUTE' },
    ])
      expect(
        rulesConfigSchema.safeParse({ ...DEFAULT_RULES, drinks }).success,
      ).toBe(false);
    for (const elimination of [
      { ...DEFAULT_RULES.elimination, passOutGold: 'CLIENT_PAYOUT' },
      { ...DEFAULT_RULES.elimination, innShareRounding: 'RANDOM' },
    ])
      expect(
        rulesConfigSchema.safeParse({ ...DEFAULT_RULES, elimination }).success,
      ).toBe(false);
  });
  it('orders the actual hidden Inn top to another player and projects only a count', () => {
    const state = drinkState([]);
    state.phase = 'ORDER_DRINK';
    const previous = state.innDrinkDeck.cardIds.pop()!;
    state.players[1]!.drinkPile = [previous];
    state.cards[previous]!.location = {
      zone: 'DRINK_PILE',
      playerId: state.players[1]!.id,
    };
    const id = state.innDrinkDeck.cardIds[0]!;
    const result = accepted(state, 'ORDER_DRINK', {
      targetPlayerId: state.players[1]!.id,
    });
    expect(result.state.players[1]!.drinkPile).toEqual([id, previous]);
    expect(result.state.cards[id]!.location).toEqual({
      zone: 'DRINK_PILE',
      playerId: 'player_1',
    });
    expect(projectPublicGame(result.state).players[1]!.drinkPileCount).toBe(2);
    expect(JSON.stringify(projectPublicGame(result.state))).not.toContain(id);
    rejected(result.state, 'TAKE_DRINK', {}, 1, 'NOT_ACTIVE_PLAYER');
  });
  it('reveals only the own top Drink, waits for responses, applies stats, and discards once', () => {
    const state = drinkState(['fizz', 'fizz']);
    const id = state.players[0]!.drinkPile[0]!;
    const result = takeDrink(state);
    expect(result.queued.state.players[0]!.alcoholContent).toBe(0);
    expect(result.queued.state.players[0]!.drinkPile).toHaveLength(1);
    const view = projectPublicGame(result.queued.state);
    expect(view.resolutionStack[0]).toMatchObject({
      kind: 'DRINK',
      sourceCards: [{ id, definitionId: 'carddef_sample_fizz' }],
    });
    expect(JSON.stringify(view)).not.toContain(state.players[0]!.drinkPile[1]!);
    expect(result.state.players[0]!.alcoholContent).toBe(2);
    expect(result.state.innDrinkDiscard).toEqual([id]);
    expect(result.state.phase).toBe('ELIMINATION_CHECK');
    expect(
      result.events.filter((event) => event.type === 'DRINK_REVEALED'),
    ).toHaveLength(1);
    assertCoreInvariants(result.state);
    rejected(result.queued.state, 'ADVANCE_PHASE');
    rejected(state, 'TAKE_DRINK', { alcoholContent: 99 }, 0, 'INVALID_COMMAND');
    const wrong = mutable(state);
    wrong.phase = 'ACTION';
    rejected(wrong, 'TAKE_DRINK', {}, 0, 'WRONG_PHASE');
  });
  it.each(['SOBER', 'SKIP'] as const)(
    'empty pile follows %s and does not invent a card',
    (emptyPile) => {
      const state = drinkState([]);
      state.rules.drinks.emptyPile = emptyPile;
      state.rules.drinks.soberAmount = 3;
      state.players[0]!.alcoholContent = 2;
      const result = takeDrink(state);
      expect(result.state.players[0]!.alcoholContent).toBe(
        emptyPile === 'SOBER' ? 0 : 2,
      );
      expect(result.state.innDrinkDiscard).toEqual([]);
      expect(result.events).toContainEqual(
        expect.objectContaining({ type: 'DRINK_EMPTY', rule: emptyPile }),
      );
      expect(result.queued.state.resolutionStack[0]!.sourceCardId).toBeNull();
      expect(result.state.phase).toBe('ELIMINATION_CHECK');
    },
  );
  it.each([[['tea', 'fizz']], [['tea', 'tea', 'fizz']]])(
    'combines %j into one logical Drink with one response window',
    (suffixes) => {
      const state = drinkState(suffixes);
      const original = [...state.players[0]!.drinkPile];
      const result = takeDrink(state);
      expect(result.queued.state.resolutionStack).toHaveLength(1);
      expect(result.queued.state.resolutionStack[0]!.sourceCardIds).toEqual(
        original,
      );
      expect(
        result.queued.events
          .filter((event) => event.type === 'DRINK_REVEALED')
          .map((event) => event.cardId),
      ).toEqual(original);
      expect(result.queued.events.at(-1)!.type).toBe('RESPONSE_WINDOW_OPENED');
      expect(result.state.players[0]!.alcoholContent).toBe(suffixes.length + 1);
      expect(result.state.players[0]!.fortitude).toBe(20 + suffixes.length - 1);
      expect(result.state.innDrinkDiscard).toEqual(original);
      expect(
        result.events.filter(
          (event) => event.type === 'RESPONSE_WINDOW_OPENED',
        ),
      ).toHaveLength(1);
      assertCoreInvariants(result.queued.state);
      assertCoreInvariants(result.state);
    },
  );
  it('a missing pile Chaser adds no sobering effect and preserves hidden Inn cards', () => {
    const result = takeDrink(drinkState(['tea']));
    expect(result.state.players[0]!.alcoholContent).toBe(1);
    expect(result.state.players[0]!.fortitude).toBe(21);
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: 'DRINK_CHAIN_STOPPED',
        reason: 'EMPTY_SOURCE',
      }),
    );
    expect(result.events.some((event) => event.type === 'DRINK_EMPTY')).toBe(
      false,
    );
  });
  it('uses a content-specified Inn Chaser, reshuffles deterministically, and excludes held sources', () => {
    const state = drinkState(['tea']);
    const tea =
      state.definitions[
        state.cards[state.players[0]!.drinkPile[0]!]!.definitionId
      ]!;
    if (tea.type !== 'DRINK') throw new Error('Fixture');
    tea.chaserSource = 'INN';
    const fizz = state.innDrinkDeck.cardIds.find(
      (id) => state.cards[id]!.definitionId === 'carddef_sample_fizz',
    )!;
    state.innDrinkDiscard.push(fizz);
    state.innDrinkDeck.cardIds.splice(
      state.innDrinkDeck.cardIds.indexOf(fizz),
      1,
    );
    state.cards[fizz]!.location = {
      zone: 'INN_DRINK_DISCARD',
      deckId: state.innDrinkDeck.deckId,
    };
    for (const id of [...state.innDrinkDeck.cardIds]) {
      state.players[1]!.drinkPile.push(id);
      state.cards[id]!.location = {
        zone: 'DRINK_PILE',
        playerId: state.players[1]!.id,
      };
    }
    state.innDrinkDeck.cardIds = [];
    const result = takeDrink(state);
    expect(result.state.players[0]!.alcoholContent).toBe(3);
    const shuffled = result.events.find(
      (event) => event.type === 'DECK_SHUFFLED',
    );
    expect(shuffled).toMatchObject({ cardIds: [fizz], reason: 'EXHAUSTED' });
    expect(result.state.innDrinkDiscard).toHaveLength(2);
    assertCoreInvariants(result.state);
  });
  it('supports a configured Inn source and safely stops an empty Inn source', () => {
    const state = drinkState(['tea']);
    state.rules.drinks.chaserSource = 'INN';
    const rest = [...state.innDrinkDeck.cardIds];
    state.innDrinkDeck.cardIds = [];
    state.players[1]!.drinkPile = rest;
    for (const id of rest)
      state.cards[id]!.location = {
        zone: 'DRINK_PILE',
        playerId: state.players[1]!.id,
      };
    expect(takeDrink(state).events).toContainEqual(
      expect.objectContaining({
        type: 'DRINK_CHAIN_STOPPED',
        reason: 'EMPTY_SOURCE',
      }),
    );
  });
  it('bounds Chaser work, preserves unrevealed cards, and rejects oversized effect batches atomically', () => {
    const state = drinkState(['tea', 'tea', 'fizz']);
    state.rules.drinks.maxChainCards = 2;
    const result = takeDrink(state);
    expect(result.queued.state.resolutionStack[0]!.sourceCardIds).toHaveLength(
      2,
    );
    expect(result.state.players[0]!.drinkPile).toHaveLength(1);
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'DRINK_CHAIN_STOPPED', reason: 'LIMIT' }),
    );
    const crowded = drinkState(['fizz']);
    crowded.definitions[
      crowded.cards[crowded.players[0]!.drinkPile[0]!]!.definitionId
    ]!.effects = Array.from(
      { length: 32 },
      () =>
        ({
          op: 'CHANGE_STAT',
          target: 'SELF',
          stat: 'ALCOHOL',
          delta: 0,
        }) as const,
    );
    rejected(crowded, 'TAKE_DRINK', {}, 0, 'INVALID_EFFECT');
  });
});
describe('Drink Events, reactions, modifiers, and reconnect safety', () => {
  it('supports unbounded Fortitude and Alcohol with safe integer arithmetic', () => {
    const state = drinkState(['fizz']);
    state.rules.statBounds.fortitude = null;
    state.rules.statBounds.alcoholContent = null;
    state.definitions[
      state.cards[state.players[0]!.drinkPile[0]!]!.definitionId
    ]!.effects = [
      { op: 'CHANGE_STAT', target: 'SELF', stat: 'FORTITUDE', delta: 200 },
      { op: 'CHANGE_STAT', target: 'SELF', stat: 'ALCOHOL', delta: -10 },
    ];
    const result = takeDrink(state);
    expect(result.state.players[0]).toMatchObject({
      fortitude: 220,
      alcoholContent: -8,
      eliminated: false,
    });
    assertCoreInvariants(result.state);
  });
  it('resolves a normal Drink Event through a distinct source and permits a private target choice', () => {
    const state = drinkState(['toast']);
    state.definitions[
      state.cards[state.players[0]!.drinkPile[0]!]!.definitionId
    ]!.effects = [
      { op: 'OPEN_CHOICE', target: 'SELF', kind: 'TARGET' },
      { op: 'CHANGE_STAT', target: 'CHOSEN_PLAYER', stat: 'ALCOHOL', delta: 3 },
    ];
    const choosing = passWindow(accepted(state, 'TAKE_DRINK').state).state;
    expect(choosing.resolutionStack[0]!.kind).toBe('DRINK_EVENT');
    const result = accepted(choosing, 'CHOOSE_TARGET', {
      responseWindowId: choosing.responseWindow!.id,
      targetPlayerIds: ['player_2'],
    });
    expect(result.state.players[2]!.alcoholContent).toBe(3);
    expect(result.state.players[0]!.alcoholContent).toBe(0);
    expect(result.state.innDrinkDiscard).toHaveLength(1);
    const invalid = drinkState(['toast']);
    invalid.definitions[
      invalid.cards[invalid.players[0]!.drinkPile[0]!]!.definitionId
    ]!.effects = [
      { op: 'CHANGE_STAT', target: 'CHOSEN_PLAYER', stat: 'GOLD', delta: 1 },
    ];
    rejected(invalid, 'TAKE_DRINK', {}, 0, 'INVALID_TARGET');
  });
  it.each(['DISCARD_STOP', 'DISCARD_CONTINUE'] as const)(
    'Chaser event context %s discards without executing',
    (chaserEvent) => {
      const state = drinkState(['tea', 'toast', 'fizz']);
      state.rules.drinks.chaserEvent = chaserEvent;
      state.definitions[
        state.cards[state.players[0]!.drinkPile[1]!]!.definitionId
      ]!.effects = [
        {
          op: 'CHANGE_STAT',
          target: 'ALL_PLAYERS',
          stat: 'ALCOHOL',
          delta: 99,
        },
      ];
      const result = takeDrink(state);
      expect(
        result.state.players.map((player) => player.alcoholContent),
      ).toEqual([chaserEvent === 'DISCARD_STOP' ? 1 : 3, 0, 0, 0]);
      expect(result.state.players[0]!.drinkPile).toHaveLength(
        chaserEvent === 'DISCARD_STOP' ? 1 : 0,
      );
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: 'DRINK_EVENT_DISCARDED',
          context: 'CHASER',
        }),
      );
      assertCoreInvariants(result.state);
    },
  );
  it('compound modifiers adjust the combined Drink before any stats apply', () => {
    const queued = accepted(drinkState(['tea', 'fizz']), 'TAKE_DRINK').state;
    const state = configureResponse(queued, [
      { op: 'MODIFY_DRINK', alcoholDelta: 2, fortitudeDelta: -3 },
    ]);
    const result = resolveResponses(response(state, 1, 'breather').state);
    expect(result.state.players[0]).toMatchObject({
      alcoholContent: 5,
      fortitude: 18,
    });
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: 'DRINK_MODIFIED',
        alcoholDelta: 2,
        fortitudeDelta: -3,
      }),
    );
  });
  it('ordinary pending/compound modifiers cannot modify an Event without explicit permission', () => {
    const state = drinkState(['toast']);
    state.definitions[
      state.cards[state.players[0]!.drinkPile[0]!]!.definitionId
    ]!.effects = [
      { op: 'CHANGE_STAT', target: 'SELF', stat: 'ALCOHOL', delta: 2 },
      { op: 'CHANGE_STAT', target: 'SELF', stat: 'FORTITUDE', delta: 0 },
    ];
    const queued = accepted(state, 'TAKE_DRINK').state;
    for (const effect of [
      { op: 'MODIFY_DRINK', alcoholDelta: 1, fortitudeDelta: 0 },
      { op: 'MODIFY_PENDING_EFFECT', effectIndex: 0, delta: 1 },
    ] as Effect[]) {
      const denied = configureResponse(queued, [effect]);
      rejected(
        denied,
        'PLAY_RESPONSE',
        {
          responseWindowId: denied.responseWindow!.id,
          cardId: cardInHand(denied, 1, 'breather'),
        },
        1,
        effect.op === 'MODIFY_DRINK' ? 'ILLEGAL_TIMING' : 'INVALID_EFFECT',
      );
      const permitted = configureResponse(queued, [
        { ...effect, allowDrinkEvents: true } as Effect,
      ]);
      expect(
        resolveResponses(response(permitted, 1, 'breather').state).state
          .players[0]!.alcoholContent,
      ).toBe(3);
    }
  });
  it('rejects modifier context, missing stat hooks, and unsafe compound arithmetic without consuming a card', () => {
    const emptyEvent = accepted(drinkState(['toast']), 'TAKE_DRINK').state;
    const missing = configureResponse(emptyEvent, [
      {
        op: 'MODIFY_DRINK',
        alcoholDelta: 1,
        fortitudeDelta: 0,
        allowDrinkEvents: true,
      },
    ]);
    rejected(
      missing,
      'PLAY_RESPONSE',
      {
        responseWindowId: missing.responseWindow!.id,
        cardId: cardInHand(missing, 1, 'breather'),
      },
      1,
      'INVALID_EFFECT',
    );
    const queued = accepted(drinkState(), 'TAKE_DRINK').state;
    const unsafe = configureResponse(queued, [
      {
        op: 'MODIFY_DRINK',
        alcoholDelta: Number.MAX_SAFE_INTEGER,
        fortitudeDelta: 0,
      },
    ]);
    rejected(
      unsafe,
      'PLAY_RESPONSE',
      {
        responseWindowId: unsafe.responseWindow!.id,
        cardId: cardInHand(unsafe, 1, 'breather'),
      },
      1,
      'INVALID_EFFECT',
    );
    const root = drinkState();
    root.phase = 'ACTION';
    root.definitions[
      root.cards[cardInHand(root, 0, 'shove')]!.definitionId
    ]!.effects = [{ op: 'MODIFY_DRINK', alcoholDelta: 0, fortitudeDelta: 0 }];
    rejected(
      root,
      'PLAY_CARD',
      { cardId: cardInHand(root, 0, 'shove') },
      0,
      'ILLEGAL_TIMING',
    );
  });
  it('Ignore suppresses the complete Drink chain, Negate can restore it, and snapshots resume identically', () => {
    let queued: CoreGameState = accepted(
      drinkState(['tea', 'fizz']),
      'TAKE_DRINK',
    ).state;
    for (let i = 0; i < 3; i += 1) queued = pass(queued).state;
    const ignored = response(queued, 0, 'ignore').state;
    expect(resolveResponses(ignored).state.players[0]).toMatchObject({
      fortitude: 20,
      alcoholContent: 0,
    });
    const negated = response(ignored, 1, 'negate').state;
    const restored = JSON.parse(JSON.stringify(negated)) as CoreGameState;
    expect(resolveResponses(restored)).toEqual(resolveResponses(negated));
    expect(resolveResponses(restored).state.players[0]).toMatchObject({
      fortitude: 21,
      alcoholContent: 3,
    });
  });
  it('clamps compound Alcohol/Fortitude changes and payments to configured bounds', () => {
    const state = drinkState(['fizz']);
    state.players[0]!.alcoholContent = 19;
    state.rules.statBounds.alcoholContent = { min: 0, max: 20 };
    state.definitions[
      state.cards[state.players[0]!.drinkPile[0]!]!.definitionId
    ]!.effects = [
      { op: 'CHANGE_STAT', target: 'SELF', stat: 'FORTITUDE', delta: 99 },
      { op: 'CHANGE_STAT', target: 'SELF', stat: 'GOLD', delta: -99 },
      { op: 'CHANGE_STAT', target: 'SELF', stat: 'ALCOHOL', delta: -99 },
    ];
    state.rules.statBounds.fortitude = { min: 0, max: 25 };
    const result = takeDrink(state);
    expect(result.state.players[0]).toMatchObject({
      fortitude: 25,
      alcoholContent: 0,
      gold: 0,
      eliminated: true,
    });
    assertCoreInvariants(result.state);
  });
  it('duplicate/stale commands cannot reveal or consume a Drink twice, and replay preserves elimination causation', () => {
    const state = drinkState(['tea', 'tea', 'fizz']);
    state.players[0]!.alcoholContent = 18;
    const command = intent(state, 'TAKE_DRINK');
    const queued = applyCommand(state, command, {
      actorId: state.players[0]!.id,
    });
    const finish = (input: CoreGameState) => resolveResponses(input);
    const result = finish(queued.state);
    expect(result.state.players[0]!.eliminated).toBe(true);
    expect(
      finish(JSON.parse(JSON.stringify(queued.state)) as CoreGameState),
    ).toEqual(result);
    expect(
      applyCommand(result.state, command, { actorId: state.players[0]!.id }),
    ).toMatchObject({ status: 'DUPLICATE', events: [] });
    rejected(
      queued.state,
      'TAKE_DRINK',
      { expectedStateVersion: 0 },
      0,
      'VERSION_CONFLICT',
    );
    for (const event of [...queued.events, ...result.events])
      expect(domainEventSchema.parse(event)).toEqual(event);
    assertCoreInvariants(result.state);
  });
});

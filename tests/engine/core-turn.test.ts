import { startRound } from '../fixtures/gambling-match';
import { passWindow } from '../fixtures/timing-match';
import { describe, expect, it } from 'vitest';
import { createMatch } from '../../src/engine/setup';
import { applyCommand } from '../../src/engine/commands';
import { assertCoreInvariants } from '../../src/engine/invariants';
import { DEFAULT_RULES, rulesConfigSchema } from '../../src/engine/rules';
import { contentPackSchema } from '../../src/content/pack';
import {
  projectPrivatePlayer,
  projectPublicGame,
} from '../../src/protocol/projections';
import { decodeDomainEvent, encodeDomainEvent } from '../../src/protocol/codec';
import { matchIdSchema, playerIdSchema } from '../../src/shared/ids';
import { stateVersionSchema } from '../../src/shared/version';
import type { CoreGameState } from '../../src/engine/types';
import {
  accepted,
  fullTurn,
  intent,
  mutable,
  setupInput,
  started,
  withAction,
} from '../fixtures/core-match';

function rejected(
  state: CoreGameState,
  type: string,
  fields: Record<string, unknown>,
  code: string,
  actorId = state.activePlayerId ?? state.control.hostPlayerId,
) {
  const before = JSON.stringify(state);
  const result = applyCommand(state, intent(state, type, fields), { actorId });
  expect(result).toMatchObject({ status: 'REJECTED', code, events: [] });
  expect(result.state).toBe(state);
  expect(JSON.stringify(state)).toBe(before);
}
describe('core setup and configured values', () => {
  it('starts deterministically with initial hands, stats, face-down Drink Me piles, and one active seat', () => {
    const setup = setupInput(1, DEFAULT_RULES.handSize);
    const prepared = createMatch(setup);
    expect(prepared).toMatchObject({
      lifecycle: 'SETUP',
      phase: null,
      activePlayerId: null,
      version: 0,
    });
    const a = accepted(prepared, 'START_MATCH');
    const b = accepted(createMatch(setup), 'START_MATCH');
    expect(a).toEqual(b);
    expect(a.state).toMatchObject({
      lifecycle: 'PLAYING',
      phase: 'DISCARD_DRAW',
      activePlayerId: 'player_0',
      version: 1,
      contentVersionId: 'content_sample_v1',
      initialCardCount: 34,
      control: { turnNumber: 1 },
      rng: { seed: 1, draws: 29 },
    });
    for (const player of a.state.players) {
      expect(player).toMatchObject({
        ...DEFAULT_RULES.initialStats,
        eliminated: false,
      });
      expect(player.hand).toHaveLength(7);
      expect(player.characterDeck.cardIds).toHaveLength(0);
      expect(player.drinkPile).toHaveLength(1);
      expect(
        projectPrivatePlayer(a.state, player.id).hand.map((c) => c.id),
      ).toEqual(player.hand);
    }
    expect(a.state.innDrinkDeck.cardIds).toHaveLength(2);
    expect(
      a.state.players.map((p) =>
        p.hand.map((id) =>
          a.state.cards[id]!.definitionId.replace('carddef_sample_', ''),
        ),
      ),
    ).toEqual([
      ['cheat', 'shove', 'shove', 'ignore', 'gamble', 'breather', 'negate'],
      ['shove', 'breather', 'cheat', 'ignore', 'gamble', 'shove', 'negate'],
      ['shove', 'ignore', 'negate', 'shove', 'cheat', 'gamble', 'breather'],
      ['shove', 'shove', 'ignore', 'breather', 'cheat', 'negate', 'gamble'],
    ]);
    expect(
      a.state.innDrinkDeck.cardIds.map((id) => a.state.cards[id]!.definitionId),
    ).toEqual(['carddef_sample_toast', 'carddef_sample_tea']);
    expect(
      a.state.players.map((p) => a.state.cards[p.drinkPile[0]!]!.definitionId),
    ).toEqual([
      'carddef_sample_fizz',
      'carddef_sample_tea',
      'carddef_sample_fizz',
      'carddef_sample_fizz',
    ]);
    expect(Object.keys(a.state.cards)).toHaveLength(34);
    expect(a.state.players[1]?.special.resources.tokens).toEqual({
      value: 0,
      visibility: 'PUBLIC',
    });
    expect(a.events.filter((e) => e.type === 'DRINK_DEALT')).toHaveLength(4);
    expect(a.events.filter((e) => e.type === 'DECK_SHUFFLED')).toHaveLength(5);
    for (const [i, event] of a.events.entries()) {
      expect(event).toMatchObject({
        commandId: 'command_1',
        matchId: prepared.matchId,
        roomId: prepared.roomId,
        stateVersion: 1,
        eventIndex: i,
      });
      expect(decodeDomainEvent(encodeDomainEvent(event))).toEqual(event);
    }
    expect(new Set(a.events.map((e) => e.eventId)).size).toBe(a.events.length);
    assertCoreInvariants(a.state);
  });
  it('pins reproducible orders while different seeds can yield different hands/deck orders', () => {
    const a = started(21);
    expect(a).toEqual(started(21));
    expect(started(22).players[0]?.characterDeck.cardIds).not.toEqual(
      a.players[0]?.characterDeck.cardIds,
    );
    const input = setupInput(21);
    input.content.deckCards.reverse();
    input.content.cards.reverse();
    input.players.reverse();
    expect(accepted(createMatch(input), 'START_MATCH').state.players).toEqual(
      a.players,
    );
  });
  it('sorts sparse seats, starts at the lowest seat, and reserves start authority for the host', () => {
    const state = createMatch(setupInput(1, 3, [3, 1, 0]));
    expect(state.players.map((p) => p.seat)).toEqual([0, 1, 3]);
    rejected(
      state,
      'START_MATCH',
      {},
      'NOT_HOST',
      playerIdSchema.parse('player_0'),
    );
    expect(accepted(state, 'START_MATCH').state.activePlayerId).toBe(
      'player_0',
    );
  });
  it('uses supplied stats/bounds/hand size and can disable initial drinks', () => {
    const input = setupInput(0, 1, [0, 2]);
    input.rules = rulesConfigSchema.parse({
      ...DEFAULT_RULES,
      initialStats: { fortitude: 42, alcoholContent: 3, gold: 0 },
      handSize: 1,
      initialDrinkCount: 0,
      statBounds: {
        fortitude: null,
        alcoholContent: null,
        gold: { min: 0, max: 5 },
      },
    });
    const state = accepted(createMatch(input), 'START_MATCH').state;
    expect(state.players[0]).toMatchObject({
      fortitude: 42,
      alcoholContent: 3,
      gold: 0,
      hand: [expect.any(String)],
      drinkPile: [],
    });
    expect(state.innDrinkDeck.cardIds).toHaveLength(6);
    assertCoreInvariants(state);
  });
  it('initializes configured stats at acceptance even if prepared stats were edited by server code', () => {
    const state = mutable(createMatch(setupInput()));
    state.players[0]!.fortitude = 17;
    state.players[0]!.gold = 5;
    const result = accepted(state, 'START_MATCH');
    expect(result.state.players[0]).toMatchObject(DEFAULT_RULES.initialStats);
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: 'PLAYER_STATS_INITIALIZED',
        playerId: 'player_0',
        fortitude: 20,
        gold: 10,
      }),
    );
    expect(state.players[0]?.fortitude).toBe(17);
  });
  it('detaches default rules across prepared matches', () => {
    const input = setupInput();
    delete input.rules;
    const first = createMatch(input);
    const second = createMatch(input);
    expect(first.rules).toEqual(DEFAULT_RULES);
    expect(first.rules).not.toBe(DEFAULT_RULES);
    expect(first.rules.initialStats).not.toBe(DEFAULT_RULES.initialStats);
    expect(first.rules).not.toBe(second.rules);
    expect(first.rules.statBounds).not.toBe(second.rules.statBounds);
  });
  it('rejects invalid setup graphs, missing initial cards, duplicate seats/players, and nonmember hosts', () => {
    const base = setupInput();
    const invalidInputs = [
      { ...base, players: [base.players[0], base.players[0]] },
      { ...base, hostPlayerId: 'player_unknown' },
      { ...base, players: base.players.map((p) => ({ ...p, seat: 0 })) },
      {
        ...base,
        players: base.players.map((p) => ({
          ...p,
          characterId: 'character_missing',
        })),
      },
      { ...base, rules: { ...DEFAULT_RULES, handSize: 8 } },
      { ...base, rules: { ...DEFAULT_RULES, initialDrinkCount: 4 } },
      {
        ...base,
        content: {
          ...base.content,
          decks: base.content.decks.filter((d) => d.type !== 'INN_DRINK'),
          deckCards: base.content.deckCards.filter(
            (entry) => entry.deckId !== 'deck_sample_inn',
          ),
        },
      },
      {
        ...base,
        content: {
          ...base.content,
          decks: [
            ...base.content.decks,
            { ...base.content.decks[0], id: 'deck_extra', slug: 'extra' },
          ],
        },
      },
      {
        ...base,
        content: {
          ...base.content,
          decks: [
            ...base.content.decks,
            {
              ...base.content.decks.find((d) => d.type === 'INN_DRINK'),
              id: 'deck_extra',
              slug: 'extra',
            },
          ],
        },
      },
    ];
    for (const invalid of invalidInputs)
      expect(() => createMatch(invalid as typeof base)).toThrow();
    const large = contentPackSchema.parse({
      ...base.content,
      deckCards: base.content.deckCards.map((entry) => ({
        ...entry,
        quantity: 64,
      })),
    });
    expect(() => createMatch({ ...base, content: large })).toThrow(
      '256 copies',
    );
    expect(() =>
      createMatch({
        ...base,
        players: [{ ...base.players[0]!, displayName: '  ' }, base.players[1]!],
      }),
    ).toThrow();
  });
  it.each([
    { initialStats: { fortitude: 101, alcoholContent: 0, gold: 10 } },
    { initialStats: { fortitude: 20, alcoholContent: -1, gold: 10 } },
    { initialStats: { fortitude: 20, alcoholContent: 0, gold: -1 } },
    {
      statBounds: {
        ...DEFAULT_RULES.statBounds,
        fortitude: { min: 10, max: 1 },
      },
    },
    { handSize: 0 },
  ])('rejects invalid configured bounds and values %j', (change) => {
    expect(
      rulesConfigSchema.safeParse({ ...DEFAULT_RULES, ...change }).success,
    ).toBe(false);
  });
});

describe('turn phases and card authority', () => {
  it('discards owned cards, redraws to configured size, and advances exactly once to action', () => {
    const state = started();
    const player = state.players[0]!;
    const discarded = player.hand.slice(0, 2);
    const future = player.characterDeck.cardIds.slice(0, 2);
    const result = accepted(state, 'DISCARD', { cardIds: discarded });
    expect(result.state.phase).toBe('ACTION');
    expect(result.state.players[0]?.hand).toHaveLength(3);
    expect(result.state.players[0]?.hand).toEqual([player.hand[2], ...future]);
    expect(result.state.players[0]?.characterDiscard).toEqual(discarded);
    expect(result.events.map((e) => e.type)).toEqual([
      'CARDS_DISCARDED',
      'CARDS_DRAWN',
      'PHASE_CHANGED',
    ]);
    expect(result.state.version).toBe(state.version + 1);
    expect(state.players[0]?.hand).toEqual(player.hand);
    assertCoreInvariants(result.state);
  });
  it('supports keeping all cards and rejects other-player, future, nonexistent, and repeated discards atomically', () => {
    const state = started();
    rejected(
      state,
      'DISCARD',
      { cardIds: [state.players[0]!.hand[0], state.players[1]!.hand[0]] },
      'CARD_NOT_IN_HAND',
    );
    rejected(
      state,
      'DISCARD',
      { cardIds: [state.players[0]!.characterDeck.cardIds[0]] },
      'CARD_NOT_IN_HAND',
    );
    rejected(
      state,
      'DISCARD',
      { cardIds: ['card_unknown'] },
      'CARD_NOT_IN_HAND',
    );
    rejected(
      state,
      'DISCARD',
      { cardIds: [state.players[0]!.hand[0], state.players[0]!.hand[0]] },
      'INVALID_COMMAND',
    );
    expect(
      accepted(state, 'DISCARD', { cardIds: [] }).events.map((e) => e.type),
    ).toEqual(['PHASE_CHANGED']);
  });
  it('preserves all six phases and advances to the next living seat with wraparound', () => {
    let state = started(1, 3, [3, 0, 2]);
    const copy = mutable(state);
    copy.players.find((p) => p.seat === 2)!.eliminated = true;
    state = copy;
    const first = fullTurn(state);
    expect(first.phaseResults.map((r) => r.state.phase)).toEqual([
      'ACTION',
      'ORDER_DRINK',
      'DRINK',
      'ELIMINATION_CHECK',
      'NEXT_TURN',
      'DISCARD_DRAW',
    ]);
    expect(first.state.activePlayerId).toBe('player_3');
    expect(first.state.control.turnNumber).toBe(2);
    expect(fullTurn(first.state).state.activePlayerId).toBe('player_0');
    const phases = first.events
      .filter((e) => e.type === 'PHASE_CHANGED')
      .map((e) => e.phase);
    expect(phases).toEqual([
      'ACTION',
      'ORDER_DRINK',
      'DRINK',
      'ELIMINATION_CHECK',
      'NEXT_TURN',
      'DISCARD_DRAW',
    ]);
  });
  it('accepts an empty-effect action and stages real effects without silently applying or skipping them', () => {
    const action = accepted(started(), 'DISCARD', { cardIds: [] }).state;
    const empty = withAction(action, true);
    const played = accepted(empty.state, 'PLAY_CARD', { cardId: empty.cardId });
    expect(played.state.phase).toBe('ACTION');
    const completed = passWindow(played.state);
    expect(completed.state.phase).toBe('ORDER_DRINK');
    expect(completed.state.players[0]?.characterDiscard).toContain(
      empty.cardId,
    );
    expect(played.events.map((e) => e.type)).toEqual([
      'CARD_PLAYED',
      'ACTION_QUEUED',
      'RESOLUTION_STARTED',
      'RESPONSE_WINDOW_OPENED',
    ]);
    const effectful = withAction(action);
    const queued = accepted(effectful.state, 'PLAY_CARD', {
      cardId: effectful.cardId,
      targetPlayerId: 'player_1',
    });
    expect(queued.state.phase).toBe('ACTION');
    expect(queued.state.players[1]?.fortitude).toBe(20);
    expect(queued.state.resolutionStack).toHaveLength(1);
    expect(queued.state.cards[effectful.cardId]?.location.zone).toBe(
      'RESOLUTION',
    );
    expect(queued.events.map((e) => e.type)).toEqual([
      'CARD_PLAYED',
      'ACTION_QUEUED',
      'RESOLUTION_STARTED',
      'RESPONSE_WINDOW_OPENED',
    ]);
    expect(
      projectPublicGame(queued.state).resolutionStack[0]?.sourceCard?.id,
    ).toBe(effectful.cardId);
    rejected(queued.state, 'SKIP_ACTION', {}, 'RESOLUTION_PENDING');
    assertCoreInvariants(queued.state);
    const self = withAction(action);
    self.state.definitions[
      self.state.cards[self.cardId]!.definitionId
    ]!.effects = [
      { op: 'CHANGE_STAT', target: 'SELF', stat: 'FORTITUDE', delta: 1 },
    ];
    expect(
      accepted(self.state, 'PLAY_CARD', { cardId: self.cardId }).state
        .resolutionStack[0]?.targetPlayerIds,
    ).toEqual([]);
  });
  it('rejects actions outside action phase, unowned cards, reaction cards, and invalid chosen targets', () => {
    const state = started();
    rejected(
      state,
      'PLAY_CARD',
      { cardId: state.players[0]!.hand[0] },
      'WRONG_PHASE',
    );
    const action = accepted(state, 'DISCARD', { cardIds: [] }).state;
    const playable = withAction(action);
    rejected(
      action,
      'PLAY_CARD',
      { cardId: action.players[1]!.hand[0] },
      'CARD_NOT_IN_HAND',
    );
    rejected(
      action,
      'PLAY_CARD',
      { cardId: 'card_unknown' },
      'CARD_NOT_IN_HAND',
    );
    for (const targetPlayerId of [undefined, 'player_0', 'player_unknown'])
      rejected(
        playable.state,
        'PLAY_CARD',
        { cardId: playable.cardId, targetPlayerId },
        'INVALID_TARGET',
      );
    const eliminated = mutable(playable.state);
    eliminated.players[1]!.eliminated = true;
    rejected(
      eliminated,
      'PLAY_CARD',
      { cardId: playable.cardId, targetPlayerId: 'player_1' },
      'INVALID_TARGET',
    );
    const noTarget = withAction(action, true);
    rejected(
      noTarget.state,
      'PLAY_CARD',
      { cardId: noTarget.cardId, targetPlayerId: 'player_1' },
      'INVALID_TARGET',
    );
    const reaction = action.players[0]!.hand.find(
      (id) =>
        action.definitions[action.cards[id]!.definitionId]!.type !== 'ACTION',
    )!;
    rejected(action, 'PLAY_CARD', { cardId: reaction }, 'UNSUPPORTED_CARD');
  });
  it('orders only a server-selected top card to another living player during the order phase', () => {
    const state = started();
    rejected(
      state,
      'ORDER_DRINK',
      { targetPlayerId: 'player_1' },
      'WRONG_PHASE',
    );
    let order = accepted(state, 'DISCARD', { cardIds: [] }).state;
    order = accepted(order, 'SKIP_ACTION').state;
    for (const targetPlayerId of ['player_0', 'player_unknown'])
      rejected(order, 'ORDER_DRINK', { targetPlayerId }, 'INVALID_TARGET');
    const eliminated = mutable(order);
    eliminated.players[1]!.eliminated = true;
    rejected(
      eliminated,
      'ORDER_DRINK',
      { targetPlayerId: 'player_1' },
      'INVALID_TARGET',
    );
    const top = order.innDrinkDeck.cardIds[0];
    for (const field of [
      'cardId',
      'deckOrder',
      'rng',
      'state',
      'phase',
      'gold',
    ])
      rejected(
        order,
        'ORDER_DRINK',
        { targetPlayerId: 'player_1', [field]: top },
        'INVALID_COMMAND',
      );
    const result = accepted(order, 'ORDER_DRINK', {
      targetPlayerId: 'player_1',
    });
    expect(result.state.players[1]?.drinkPile).toEqual([
      top,
      ...order.players[1]!.drinkPile,
    ]);
    expect(result.state.cards[top!]?.location).toEqual({
      zone: 'DRINK_PILE',
      playerId: 'player_1',
    });
    expect(result.events[0]).toMatchObject({
      type: 'DRINK_ORDERED',
      cardId: top,
      targetPlayerId: 'player_1',
    });
    expect(result.state.phase).toBe('DRINK');
  });
  it('reshuffles character discard on exhaustion and reports short draws without creating cards', () => {
    const state = started(1, 7);
    const discard = state.players[0]!.hand.slice(0, 3);
    const result = accepted(state, 'DISCARD', { cardIds: discard });
    expect(result.state.players[0]?.hand).toHaveLength(7);
    expect(result.state.players[0]?.characterDiscard).toEqual([]);
    expect(result.events.map((e) => e.type)).toEqual([
      'CARDS_DISCARDED',
      'DECK_SHUFFLED',
      'CARDS_DRAWN',
      'PHASE_CHANGED',
    ]);
    expect([...result.state.players[0]!.hand].sort()).toEqual(
      [...state.players[0]!.hand].sort(),
    );
    assertCoreInvariants(result.state);
    const shortage = withAction(
      accepted(started(), 'DISCARD', { cardIds: [] }).state,
    );
    // A queued card is conserved in RESOLUTION, unavailable to a draw; later resolution will release it.
    const queued = accepted(shortage.state, 'PLAY_CARD', {
      cardId: shortage.cardId,
      targetPlayerId: 'player_1',
    }).state;
    const copy = mutable(queued);
    const player = copy.players[0]!;
    const held = player.hand.splice(0);
    player.characterDeck.cardIds.push(...held);
    for (const id of held)
      copy.cards[id]!.location = {
        zone: 'CHARACTER_DECK',
        playerId: player.id,
        deckId: player.characterDeck.deckId,
      };
    copy.rules.handSize = 7;
    copy.responseWindow = null;
    copy.resolutionStack = []; // Move the held action into a future special zone instead.
    const heldCard = copy.cards[shortage.cardId]!;
    heldCard.location = {
      zone: 'SPECIAL_DECK',
      playerId: player.id,
      deckId: player.characterDeck.deckId,
    };
    player.special.sideDecks.held = {
      visibility: 'SERVER',
      deck: { deckId: player.characterDeck.deckId, cardIds: [heldCard.id] },
      discard: [],
    };
    copy.phase = 'DISCARD_DRAW';
    const short = accepted(copy, 'DISCARD', { cardIds: [] });
    expect(short.state.players[0]?.hand).toHaveLength(6);
    expect(short.events).toContainEqual(
      expect.objectContaining({
        type: 'DRAW_SHORTFALL',
        requested: 7,
        drawn: 6,
      }),
    );
    assertCoreInvariants(short.state);
  });
  it('reshuffles available Inn discards and safely skips ordering when the Inn is empty', () => {
    const state = fullTurn(fullTurn(started()).state).state;
    expect(state.innDrinkDeck.cardIds).toEqual([]);
    const copy = mutable(state);
    const target = copy.players[1]!;
    const recycled = target.drinkPile.splice(0, 2);
    copy.innDrinkDiscard.push(...recycled);
    for (const id of recycled)
      copy.cards[id]!.location = {
        zone: 'INN_DRINK_DISCARD',
        deckId: copy.innDrinkDeck.deckId,
      };
    const turn = fullTurn(copy);
    expect(turn.events).toContainEqual(
      expect.objectContaining({
        type: 'DECK_SHUFFLED',
        reason: 'EXHAUSTED',
        playerId: null,
      }),
    );
    const empty = mutable(state);
    for (const id of [
      ...empty.innDrinkDeck.cardIds,
      ...empty.innDrinkDiscard,
    ]) {
      empty.players[1]!.drinkPile.push(id);
      empty.cards[id]!.location = {
        zone: 'DRINK_PILE',
        playerId: empty.players[1]!.id,
      };
    }
    empty.innDrinkDeck.cardIds = [];
    empty.innDrinkDiscard = [];
    const skipped = fullTurn(empty);
    expect(skipped.events).toContainEqual(
      expect.objectContaining({
        type: 'DRINK_ORDER_SKIPPED',
        reason: 'EMPTY_INN',
      }),
    );
    expect(Object.keys(skipped.state.cards)).toHaveLength(34);
    assertCoreInvariants(skipped.state);
  });
  it.each(['DISCARD', 'SKIP_ACTION', 'ADVANCE_PHASE'])(
    'rejects %s during the wrong phase',
    (type) => {
      const state = accepted(started(), 'DISCARD', { cardIds: [] }).state;
      const wrong = type === 'SKIP_ACTION' ? started() : state;
      rejected(
        wrong,
        type,
        type === 'DISCARD' ? { cardIds: [] } : {},
        'WRONG_PHASE',
      );
    },
  );
});

describe('command transaction and deterministic dedupe', () => {
  it('rejects stale versions, incorrect room/lifecycle/actor, unsupported commands, and invalid payloads', () => {
    const state = started();
    rejected(
      state,
      'DISCARD',
      { cardIds: [], expectedStateVersion: 0 },
      'VERSION_CONFLICT',
    );
    rejected(
      state,
      'DISCARD',
      { cardIds: [], roomId: 'room_other' },
      'WRONG_ROOM',
    );
    rejected(
      state,
      'DISCARD',
      { cardIds: [] },
      'NOT_ACTIVE_PLAYER',
      playerIdSchema.parse('player_1'),
    );
    rejected(
      state,
      'DISCARD',
      { cardIds: [] },
      'UNKNOWN_PLAYER',
      playerIdSchema.parse('player_unknown'),
    );
    rejected(
      state,
      'DISCARD',
      { cardIds: [] },
      'UNKNOWN_PLAYER',
      'invalid' as typeof state.control.hostPlayerId,
    );
    rejected(state, 'START_MATCH', {}, 'WRONG_LIFECYCLE');
    rejected(
      createMatch(setupInput()),
      'DISCARD',
      { cardIds: [] },
      'WRONG_LIFECYCLE',
    );
    rejected(
      state,
      'JOIN_ROOM',
      { displayName: 'Sample', expectedStateVersion: undefined },
      'INVALID_COMMAND',
    );
    const join = {
      type: 'JOIN_ROOM',
      roomId: state.roomId,
      commandId: 'command_join',
      displayName: 'Sample',
    };
    expect(
      applyCommand(state, join, { actorId: state.players[0]!.id }),
    ).toMatchObject({ status: 'REJECTED', code: 'UNSUPPORTED_COMMAND' });
    for (const [type, fields] of [
      ['GAMBLING_PASS', {}],
      ['GAMBLING_PLAY', { cardId: state.players[0]!.hand[0] }],
      [
        'CHOOSE_TARGET',
        { responseWindowId: 'window_future', targetPlayerIds: ['player_1'] },
      ],
      ['PASS_RESPONSE', { responseWindowId: 'window_future' }],
      [
        'CHOOSE_OPTION',
        { responseWindowId: 'window_future', optionId: 'future' },
      ],
    ] as const)
      rejected(
        state,
        type,
        fields,
        type.startsWith('GAMBLING') ? 'NO_GAMBLING' : 'WRONG_WINDOW',
      );
    expect(
      applyCommand(state, null, { actorId: state.players[0]!.id }),
    ).toMatchObject({ status: 'REJECTED', code: 'INVALID_COMMAND' });
    const finished = mutable(state);
    finished.lifecycle = 'FINISHED';
    finished.activePlayerId = null;
    finished.phase = null;
    finished.players.forEach((player) => {
      player.eliminated = true;
    });
    rejected(finished, 'DISCARD', { cardIds: [] }, 'WRONG_LIFECYCLE');
  });
  it('acknowledges exact retries after later commands without replaying events or mutations', () => {
    const state = started();
    const command = intent(state, 'DISCARD', {
      cardIds: state.players[0]!.hand.slice(0, 1),
    });
    const first = applyCommand(state, command, {
      actorId: state.players[0]!.id,
    });
    expect(first.status).toBe('ACCEPTED');
    const later = accepted(first.state, 'SKIP_ACTION').state;
    const duplicate = applyCommand(later, command, {
      actorId: state.players[0]!.id,
    });
    expect(duplicate).toMatchObject({
      status: 'DUPLICATE',
      acceptedVersion: 2,
      events: [],
    });
    expect(duplicate.state).toBe(later);
    expect(duplicate.state.version).toBe(3);
    const reordered = Object.fromEntries(Object.entries(command).reverse());
    expect(
      applyCommand(later, reordered, { actorId: state.players[0]!.id }),
    ).toMatchObject({ status: 'DUPLICATE' });
    rejected(
      later,
      'DISCARD',
      { ...command, cardIds: [] },
      'COMMAND_ID_CONFLICT',
    );
    rejected(
      later,
      'DISCARD',
      command,
      'COMMAND_ID_CONFLICT',
      state.players[1]!.id,
    );
    const start = intent(createMatch(setupInput()), 'START_MATCH');
    expect(
      applyCommand(later, start, { actorId: state.control.hostPlayerId }),
    ).toMatchObject({ status: 'DUPLICATE', acceptedVersion: 1 });
    expect(
      later.control.acceptedCommands[
        command.commandId as keyof typeof later.control.acceptedCommands
      ]?.acceptedVersion,
    ).toBe(2);
  });
  it('detaches accepted outputs and leaves frozen inputs unchanged even when the RNG throws', () => {
    const prepared = createMatch(setupInput());
    const before = JSON.stringify(prepared);
    const deepFreeze = (value: unknown) => {
      if (value && typeof value === 'object') {
        Object.freeze(value);
        for (const child of Object.values(value)) deepFreeze(child);
      }
    };
    deepFreeze(prepared);
    const result = accepted(prepared, 'START_MATCH');
    expect(result.state).not.toBe(prepared);
    expect(result.state.players[0]).not.toBe(prepared.players[0]);
    expect(JSON.stringify(prepared)).toBe(before);
    expect(() =>
      applyCommand(prepared, intent(prepared, 'START_MATCH'), {
        actorId: prepared.control.hostPlayerId,
        rng: {
          next: () => {
            throw new Error('Injected failure');
          },
        },
      }),
    ).toThrow('Injected failure');
    expect(JSON.stringify(prepared)).toBe(before);
  });
  it('rejects version/turn overflow and suspends turn commands for pending responses or gambling', () => {
    const max = mutable(started());
    max.version = stateVersionSchema.parse(Number.MAX_SAFE_INTEGER);
    rejected(max, 'DISCARD', { cardIds: [] }, 'VERSION_EXHAUSTED');
    const turn = mutable(fullTurn(started()).phaseResults[4]!.state);
    turn.control.turnNumber = Number.MAX_SAFE_INTEGER;
    rejected(turn, 'ADVANCE_PHASE', {}, 'TURN_LIMIT');
    const gambling = startRound().state;
    rejected(gambling, 'DISCARD', { cardIds: [] }, 'RESOLUTION_PENDING');
    const pending = withAction(
      accepted(started(), 'DISCARD', { cardIds: [] }).state,
    );
    const response = accepted(pending.state, 'PLAY_CARD', {
      cardId: pending.cardId,
      targetPlayerId: 'player_1',
    }).state;
    rejected(response, 'DISCARD', { cardIds: [] }, 'RESOLUTION_PENDING');
  });
  it('uses bounded deterministic IDs even for maximum-length match and command IDs', () => {
    const input = setupInput();
    input.matchId = matchIdSchema.parse(`match_${'x'.repeat(64)}`);
    const state = createMatch(input);
    const result = accepted(state, 'START_MATCH', {
      commandId: `command_${'x'.repeat(64)}`,
    });
    expect(result.events.every((e) => e.eventId.length < 70)).toBe(true);
    expect(Object.keys(result.state.cards).every((id) => id.length < 69)).toBe(
      true,
    );
    expect(result.events[0]?.eventId).not.toBe(
      accepted(createMatch(setupInput()), 'START_MATCH').events[0]?.eventId,
    );
  });
});

describe('replay, conservation, and privacy invariants', () => {
  it('replays the same commands and events deterministically across many seeds and turns', () => {
    for (let seed = 0; seed < 12; seed += 1) {
      let left = started(seed);
      let right = started(seed);
      const initialIds = Object.keys(left.cards).sort();
      for (let turn = 0; turn < 8; turn += 1) {
        const a = fullTurn(left);
        const b = fullTurn(right);
        expect(a).toEqual(b);
        expect(Object.keys(a.state.cards).sort()).toEqual(initialIds);
        assertCoreInvariants(a.state);
        for (const result of a.results) {
          expect(
            result.events.every(
              (e, i) =>
                e.stateVersion === result.state.version && e.eventIndex === i,
            ),
          ).toBe(true);
          const publicJson = JSON.stringify(projectPublicGame(result.state));
          for (const card of Object.values(result.state.cards).filter(
            (card) => card.location.zone !== 'RESOLUTION',
          ))
            expect(publicJson).not.toContain(JSON.stringify(card.id));
          expect(publicJson).not.toContain('rng');
          expect(publicJson).not.toContain('definitions');
          expect(publicJson).not.toContain('acceptedCommands');
          for (const player of result.state.players) {
            const privateView = projectPrivatePlayer(result.state, player.id);
            const privateJson = JSON.stringify(privateView);
            expect(privateView.hand.map((c) => c.id)).toEqual(player.hand);
            for (const other of result.state.players.filter(
              (p) => p.id !== player.id,
            ))
              for (const id of other.hand)
                expect(privateJson).not.toContain(JSON.stringify(id));
            for (const id of [
              ...player.characterDeck.cardIds,
              ...player.drinkPile,
              ...result.state.innDrinkDeck.cardIds,
            ])
              expect(privateJson).not.toContain(JSON.stringify(id));
          }
        }
        left = a.state;
        right = b.state;
      }
    }
  }, 20000);
});

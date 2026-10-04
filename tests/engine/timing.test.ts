import { startRound } from '../fixtures/gambling-match';
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../src/engine/commands';
import { assertCoreInvariants } from '../../src/engine/invariants';
import {
  projectPrivatePlayer,
  projectPublicGame,
} from '../../src/protocol/projections';
import { domainEventSchema } from '../../src/protocol/events';
import { cardDefinitionSchema } from '../../src/content/cards';
import type { CoreGameState } from '../../src/engine/types';
import type { Effect } from '../../src/content/effects';
import { accepted, intent, mutable, started } from '../fixtures/core-match';
import { setupInput } from '../fixtures/core-match';
import { createMatch } from '../../src/engine/setup';
import { resolutionIdSchema } from '../../src/shared/ids';
import {
  actionState,
  cardInHand,
  playAction,
  response,
  pass,
  passWindow,
  responseEffects,
  priorityFor,
} from '../fixtures/timing-match';

it('repeated Ignore operations in one validated response exclude the player only once', () => {
  const action = playAction().state;
  const input = responseEffects(action, [
    { op: 'IGNORE', scope: 'CURRENT_EFFECT' },
    { op: 'IGNORE', scope: 'CURRENT_EFFECT' },
  ]);
  const child = response(input, 1, 'breather');
  const parent = passWindow(child.state).state;
  expect(parent.resolutionStack[0]!.ignoredPlayerIds).toEqual(['player_1']);
  const finished = passWindow(parent).state;
  expect(finished.players[1]!.fortitude).toBe(20);
  expect(finished.phase).toBe('ORDER_DRINK');
  assertCoreInvariants(finished);
});

function reject(
  state: CoreGameState,
  type: string,
  fields: Record<string, unknown>,
  code: string,
  seat = 1,
) {
  if (
    type === 'PLAY_RESPONSE' &&
    ![
      'NOT_PRIORITY',
      'ALREADY_PASSED',
      'NOT_ELIGIBLE',
      'WRONG_WINDOW',
      'VERSION_CONFLICT',
    ].includes(code)
  )
    state = priorityFor(state, seat);
  const before = JSON.stringify(state);
  const result = applyCommand(state, intent(state, type, fields), {
    actorId: state.players[seat]!.id,
  });
  expect(result).toMatchObject({ status: 'REJECTED', code, events: [] });
  expect(result.state).toBe(state);
  expect(JSON.stringify(state)).toBe(before);
}
function choices(
  state: CoreGameState,
  type: string,
  fields: Record<string, unknown>,
  seat = 0,
) {
  return accepted(
    state,
    type,
    { responseWindowId: state.responseWindow!.id, ...fields },
    state.players[seat]!.id,
  );
}
const hit: Effect = {
  op: 'CHANGE_STAT',
  target: 'CHOSEN_PLAYER',
  stat: 'FORTITUDE',
  delta: -2,
};

describe('response priority and source resolution', () => {
  it('resolves a simple Action after every living player passes in seat order', () => {
    const queued = playAction();
    expect(queued.state.responseWindow).toMatchObject({
      eligiblePlayerIds: ['player_0', 'player_1', 'player_2', 'player_3'],
      priorityPlayerId: 'player_0',
      passedPlayerIds: [],
      kind: 'SOMETIMES',
    });
    expect(queued.state.players[1]!.fortitude).toBe(20);
    const complete = passWindow(queued.state);
    expect(
      complete.events
        .filter((event) => event.type === 'RESPONSE_PASSED')
        .filter(
          (event) => event.responseWindowId === queued.state.responseWindow!.id,
        )
        .map((event) => event.playerId),
    ).toEqual(['player_0', 'player_1', 'player_2', 'player_3']);
    expect(complete.state.responseWindow).toBeNull();
    expect(complete.state.resolutionStack).toEqual([]);
    expect(complete.state.players[1]!.fortitude).toBe(18);
    expect(complete.state.phase).toBe('ORDER_DRINK');
    expect(
      complete.state.cards[queued.state.resolutionStack[0]!.sourceCardId!]!
        .location.zone,
    ).toBe('CHARACTER_DISCARD');
    const loss = complete.events.findIndex(
      (event) => event.type === 'FORTITUDE_CHANGED',
    );
    const postLoss = complete.events.findIndex(
      (event) => event.type === 'RESPONSE_WINDOW_OPENED',
    );
    const discarded = complete.events.findIndex(
      (event) => event.type === 'CARDS_DISCARDED',
    );
    expect(postLoss).toBeGreaterThan(loss);
    expect(discarded).toBeGreaterThan(postLoss);
    expect(complete.events.map((event) => event.type).slice(-2)).toEqual([
      'PHASE_CHANGED',
      'ELIMINATION_CHECKED',
    ]);
    assertCoreInvariants(complete.state);
  });
  it('gives even an empty Action a response opportunity and advances only after all pass', () => {
    const queued = playAction(actionState([]), null);
    expect(queued.state.phase).toBe('ACTION');
    expect(passWindow(queued.state).state.phase).toBe('ORDER_DRINK');
  });
  it('resolves one Sometimes child first and resets the parent consensus after a response', () => {
    const initial = responseEffects(actionState(), [
      { op: 'CHANGE_STAT', target: 'SELF', stat: 'ALCOHOL', delta: 2 },
    ]);
    const queued = playAction(initial);
    let state = pass(queued.state).state; // First target passes; next player responds.
    const replyCard = cardInHand(state, 2, 'breather');
    const child = response(state, 2, 'breather');
    expect(child.state.players[2]!.hand).not.toContain(replyCard);
    expect(child.state.cards[replyCard]!.location.zone).toBe('RESOLUTION');
    expect(child.state.players[1]!.hand).toEqual(state.players[1]!.hand);
    expect(child.state.resolutionStack[0]!.window).toMatchObject({
      passedPlayerIds: [],
      priorityPlayerId: 'player_2',
      submittedResponses: [child.state.resolutionStack[1]!.id],
    });
    state = passWindow(child.state).state;
    expect(state.players[2]!.alcoholContent).toBe(2);
    expect(state.players[1]!.fortitude).toBe(20);
    expect(state.resolutionStack).toHaveLength(1);
    expect(state.responseWindow!.priorityPlayerId).toBe('player_0');
    expect(state.cards[replyCard]!.location.zone).toBe('CHARACTER_DISCARD');
    expect(passWindow(state).state.players[1]!.fortitude).toBe(18);
  });
  it('Ignore affects only its actor while an unrelated target still receives all operations', () => {
    const queued = playAction(
      actionState([
        {
          op: 'CHANGE_STAT',
          target: 'EACH_OTHER_PLAYER',
          stat: 'FORTITUDE',
          delta: -2,
        },
        { op: 'CHANGE_STAT', target: 'ALL_PLAYERS', stat: 'ALCOHOL', delta: 1 },
      ]),
      null,
    );
    const ignored = passWindow(response(queued.state, 1, 'ignore').state);
    expect(ignored.state.resolutionStack[0]!.ignoredPlayerIds).toEqual([
      'player_1',
    ]);
    const complete = passWindow(ignored.state);
    expect(
      complete.state.players.map((player) => [
        player.fortitude,
        player.alcoholContent,
      ]),
    ).toEqual([
      [20, 1],
      [20, 0],
      [18, 1],
      [18, 1],
    ]);
    expect(ignored.events).toContainEqual(
      expect.objectContaining({
        type: 'SOURCE_IGNORED',
        playerId: 'player_1',
        resolutionId: queued.state.resolutionStack[0]!.id,
      }),
    );
  });
  it('Negate cancels its immediate parent and skips every operation of the canceled source', () => {
    const queued = playAction(
      actionState([hit, { op: 'PAY_INN', target: 'CHOSEN_PLAYER', amount: 3 }]),
    );
    const complete = passWindow(response(queued.state, 1, 'negate').state);
    expect(complete.state.resolutionStack).toEqual([]);
    expect(complete.state.players[1]).toMatchObject({
      fortitude: 20,
      gold: 10,
    });
    expect(
      complete.events
        .filter((event) => event.type === 'EFFECT_RESOLVED')
        .map((event) => event.resolutionId),
    ).not.toContain(queued.state.resolutionStack[0]!.id);
    expect(complete.events).toContainEqual(
      expect.objectContaining({
        type: 'RESOLUTION_COMPLETED',
        resolutionId: queued.state.resolutionStack[0]!.id,
        canceled: true,
      }),
    );
  });
  it('three levels unwind leaf, canceled response, then original Action deterministically', () => {
    function run() {
      const queued = playAction();
      const ignored = response(queued.state, 1, 'ignore');
      const negated = response(ignored.state, 2, 'negate');
      expect(negated.state.resolutionStack).toHaveLength(3);
      const roundTrip = JSON.parse(
        JSON.stringify(negated.state),
      ) as CoreGameState;
      assertCoreInvariants(roundTrip);
      const leaf = passWindow(roundTrip);
      expect(leaf.state.resolutionStack).toHaveLength(1);
      expect(leaf.state.resolutionStack[0]!.ignoredPlayerIds).toEqual([]);
      const root = passWindow(leaf.state);
      expect(root.state.players[1]!.fortitude).toBe(18);
      const events = [
        ...queued.events,
        ...ignored.events,
        ...negated.events,
        ...leaf.events,
        ...root.events,
      ];
      const postLoss = root.events.find(
        (event) => event.type === 'RESPONSE_WINDOW_OPENED',
      );
      expect(postLoss?.type).toBe('RESPONSE_WINDOW_OPENED');
      expect(
        events
          .filter((event) => event.type === 'RESOLUTION_COMPLETED')
          .map((event) => [event.resolutionId, event.canceled]),
      ).toEqual([
        [negated.state.resolutionStack[2]!.id, false],
        [ignored.state.resolutionStack[1]!.id, true],
        [
          postLoss?.type === 'RESPONSE_WINDOW_OPENED'
            ? postLoss.resolutionId
            : null,
          false,
        ],
        [queued.state.resolutionStack[0]!.id, false],
      ]);
      expect(events.filter((event) => event.type === 'SOURCE_NEGATED')).toEqual(
        [
          expect.objectContaining({
            resolutionId: ignored.state.resolutionStack[1]!.id,
            byResolutionId: negated.state.resolutionStack[2]!.id,
          }),
        ],
      );
      for (const event of events)
        expect(domainEventSchema.parse(event)).toEqual(event);
      return { state: root.state, events };
    }
    expect(run()).toEqual(run());
  });
  it('Negate can itself be negated at depth four, preserving an Ignore and its original target', () => {
    const queued = playAction();
    const ignore = response(queued.state, 1, 'ignore');
    const negate = response(ignore.state, 2, 'negate');
    const counter = response(negate.state, 3, 'negate');
    const leaf = passWindow(counter.state);
    expect(leaf.state.resolutionStack).toHaveLength(2);
    const parent = passWindow(leaf.state);
    expect(parent.state.resolutionStack[0]!.ignoredPlayerIds).toEqual([
      'player_1',
    ]);
    expect(passWindow(parent.state).state.players[1]!.fortitude).toBe(20);
  });
  it('preserves a suspended turn when an out-of-turn Anytime card opens its own source', () => {
    const initial = started(1, 7);
    const cardId = cardInHand(initial, 1, 'breather');
    const queued = accepted(
      initial,
      'PLAY_CARD',
      { cardId },
      initial.players[1]!.id,
    );
    expect(queued.state.responseWindow!.kind).toBe('ANYTIME');
    expect(queued.state.activePlayerId).toBe(initial.activePlayerId);
    const complete = passWindow(queued.state);
    expect(complete.state.phase).toBe('DISCARD_DRAW');
    expect(complete.state.control.turnNumber).toBe(1);
    expect(complete.state.players[1]!.fortitude).toBe(21);
  });
  it('allows Anytime responses during a source window', () => {
    const queued = playAction();
    const complete = passWindow(response(queued.state, 1, 'breather').state);
    expect(complete.state.players[1]!.fortitude).toBe(21);
    expect(passWindow(complete.state).state.players[1]!.fortitude).toBe(19);
  });
});

describe('validation, privacy, retries, and reconnect state', () => {
  it('rejects incorrect priority and duplicate passes without corrupting the window', () => {
    const queued = playAction().state;
    reject(
      queued,
      'PASS_RESPONSE',
      { responseWindowId: queued.responseWindow!.id },
      'NOT_PRIORITY',
      2,
    );
    const passed = pass(queued).state;
    reject(
      passed,
      'PASS_RESPONSE',
      { responseWindowId: passed.responseWindow!.id },
      'ALREADY_PASSED',
      0,
    );
    reject(
      passed,
      'PLAY_RESPONSE',
      {
        responseWindowId: passed.responseWindow!.id,
        cardId: cardInHand(passed, 0, 'ignore'),
      },
      'ALREADY_PASSED',
      0,
    );
  });
  it('eligibility excludes eliminated players and is independent of secret hands', () => {
    const state = actionState();
    state.players[2]!.eliminated = true;
    const queued = playAction(state).state;
    expect(queued.responseWindow!.eligiblePlayerIds).toEqual([
      'player_0',
      'player_1',
      'player_3',
    ]);
    reject(
      queued,
      'PLAY_RESPONSE',
      {
        responseWindowId: queued.responseWindow!.id,
        cardId: cardInHand(queued, 2, 'negate'),
      },
      'NOT_ELIGIBLE',
      2,
    );
    const alternate = mutable(queued);
    const player = alternate.players[3]!;
    for (const id of player.hand) {
      player.characterDeck.cardIds.push(id);
      alternate.cards[id]!.location = {
        zone: 'CHARACTER_DECK',
        playerId: player.id,
        deckId: player.characterDeck.deckId,
      };
    }
    player.hand = [];
    expect(projectPublicGame(alternate).responseWindow).toEqual(
      projectPublicGame(queued).responseWindow,
    );
    assertCoreInvariants(alternate);
  });
  it('rejects illegal response timing, unowned cards, old window IDs, and turn bypasses', () => {
    const queued = playAction().state;
    const fields = { responseWindowId: queued.responseWindow!.id };
    reject(
      queued,
      'PLAY_RESPONSE',
      { ...fields, cardId: cardInHand(queued, 1, 'shove') },
      'ILLEGAL_TIMING',
    );
    reject(
      queued,
      'PLAY_RESPONSE',
      { ...fields, cardId: cardInHand(queued, 2, 'negate') },
      'CARD_NOT_IN_HAND',
    );
    reject(
      queued,
      'PLAY_RESPONSE',
      { ...fields, cardId: 'card_missing' },
      'CARD_NOT_IN_HAND',
    );
    reject(
      queued,
      'PASS_RESPONSE',
      { responseWindowId: 'window_missing' },
      'WRONG_WINDOW',
    );
    reject(
      queued,
      'PLAY_CARD',
      { cardId: cardInHand(queued, 1, 'breather') },
      'RESOLUTION_PENDING',
    );
    reject(
      queued,
      'CHOOSE_OPTION',
      { ...fields, optionId: 'anything' },
      'INVALID_CHOICE',
    );
    const selfSource = playAction(
      actionState([
        { op: 'CHANGE_STAT', target: 'SELF', stat: 'FORTITUDE', delta: 2 },
      ]),
      null,
    ).state;
    reject(
      selfSource,
      'PLAY_RESPONSE',
      {
        responseWindowId: selfSource.responseWindow!.id,
        cardId: cardInHand(selfSource, 1, 'ignore'),
      },
      'ILLEGAL_TIMING',
    );
    const nested = response(queued, 1, 'ignore').state;
    reject(
      nested,
      'PLAY_RESPONSE',
      {
        responseWindowId: queued.responseWindow!.id,
        cardId: cardInHand(nested, 2, 'negate'),
      },
      'WRONG_WINDOW',
      2,
    );
    reject(
      nested,
      'PASS_RESPONSE',
      { responseWindowId: nested.responseWindow!.id, expectedStateVersion: 0 },
      'VERSION_CONFLICT',
      2,
    );
  });
  it('retries an accepted nested response after child commands without executing it again', () => {
    const queued = pass(playAction().state).state;
    const command = intent(queued, 'PLAY_RESPONSE', {
      responseWindowId: queued.responseWindow!.id,
      cardId: cardInHand(queued, 1, 'ignore'),
    });
    const acceptedResult = applyCommand(queued, command, {
      actorId: queued.players[1]!.id,
    });
    const later = pass(acceptedResult.state).state;
    const retry = applyCommand(later, command, {
      actorId: queued.players[1]!.id,
    });
    expect(retry).toMatchObject({
      status: 'DUPLICATE',
      events: [],
      acceptedVersion: acceptedResult.state.version,
    });
    expect(retry.state).toBe(later);
  });
  it('public windows expose priority and revealed sources while keeping hands and choice data private', () => {
    const nested = response(playAction().state, 1, 'ignore').state;
    const view = projectPublicGame(nested);
    expect(view.responseWindow).toMatchObject({
      priorityPlayerId: 'player_1',
      kind: 'IGNORE',
    });
    expect(view.resolutionStack).toHaveLength(2);
    const json = JSON.stringify(view);
    for (const player of nested.players)
      for (const id of [
        ...player.hand,
        ...player.characterDeck.cardIds,
        ...player.drinkPile,
      ])
        expect(json).not.toContain(JSON.stringify(id));
    for (const field of [
      'effects',
      'rng',
      'window',
      'ignoredPlayerIds',
      'acceptedCommands',
      'definitions',
    ])
      expect(view.resolutionStack[0]).not.toHaveProperty(field);
    expect(view.responseWindow).not.toHaveProperty('pendingChoice');
    expect(
      projectPrivatePlayer(nested, nested.players[2]!.id).hand.map(
        (card) => card.id,
      ),
    ).toEqual(nested.players[2]!.hand);
    const restored = JSON.parse(
      JSON.stringify(pass(nested).state),
    ) as CoreGameState;
    expect(passWindow(restored)).toEqual(passWindow(pass(nested).state));
  });
  it('allows Anytime during gambling and rejects setup, eliminated actors, and another hand', () => {
    const state = mutable(started(1, 7));
    const cardId = cardInHand(state, 1, 'breather');
    state.players[1]!.eliminated = true;
    reject(state, 'PLAY_CARD', { cardId }, 'NOT_ELIGIBLE');
    state.players[1]!.eliminated = false;
    reject(state, 'PLAY_CARD', { cardId }, 'CARD_NOT_IN_HAND', 2);
    const gambling = startRound().state;
    expect(
      accepted(gambling, 'PLAY_CARD', { cardId }, gambling.players[1]!.id).state
        .resolutionStack,
    ).toHaveLength(2);
    state.gambling = null;
    state.lifecycle = 'SETUP';
    state.activePlayerId = null;
    state.phase = null;
    reject(state, 'PLAY_CARD', { cardId }, 'WRONG_LIFECYCLE');
    reject(
      state,
      'PASS_RESPONSE',
      { responseWindowId: 'window_missing' },
      'WRONG_LIFECYCLE',
    );
  });
});

describe('validated effect operations and choices', () => {
  it('rejects cumulative modifier overflow before accepting a response', () => {
    const queued = playAction(
      actionState([{ ...hit, delta: Number.MAX_SAFE_INTEGER - 1 }]),
    ).state;
    const state = responseEffects(queued, [
      { op: 'MODIFY_PENDING_EFFECT', effectIndex: 0, delta: 1 },
      { op: 'MODIFY_PENDING_EFFECT', effectIndex: 0, delta: 1 },
    ]);
    reject(
      state,
      'PLAY_RESPONSE',
      {
        responseWindowId: state.responseWindow!.id,
        cardId: cardInHand(state, 1, 'breather'),
      },
      'INVALID_EFFECT',
    );
    expect(passWindow(state).state.players[1]!.fortitude).toBe(100);
  });
  it.each([Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER])(
    'saturates sequential resource changes at safe integer boundary %s',
    (bound) => {
      const state = actionState([
        {
          op: 'CUSTOM',
          target: 'CHOSEN_PLAYER',
          effect_key: 'sample.adjust-resource',
          params: { resource: 'tokens', delta: bound > 0 ? 1 : -1 },
        },
        {
          op: 'CUSTOM',
          target: 'CHOSEN_PLAYER',
          effect_key: 'sample.adjust-resource',
          params: { resource: 'tokens', delta: bound > 0 ? 1 : -1 },
        },
      ]);
      state.players[1]!.special.resources.tokens!.value = bound;
      const complete = passWindow(playAction(state).state);
      expect(complete.state.players[1]!.special.resources.tokens!.value).toBe(
        bound,
      );
      expect(
        complete.events
          .filter((event) => event.type === 'RESOURCE_CHANGED')
          .map((event) => event.delta),
      ).toEqual([0, 0]);
    },
  );
  it('executes Fortitude, Alcohol, Gold, transfer, and Inn payment in operation order', () => {
    const effects: Effect[] = [
      { op: 'CHANGE_STAT', target: 'SELF', stat: 'FORTITUDE', delta: -50 },
      { op: 'CHANGE_STAT', target: 'SELF', stat: 'ALCOHOL', delta: 500 },
      { op: 'CHANGE_STAT', target: 'SELF', stat: 'GOLD', delta: -500 },
      { op: 'TRANSFER_GOLD', target: 'CHOSEN_PLAYER', amount: 3 },
      { op: 'PAY_INN', target: 'CHOSEN_PLAYER', amount: 4 },
    ];
    const complete = passWindow(playAction(actionState(effects)).state);
    expect(complete.state.players[0]).toMatchObject({
      fortitude: 0,
      alcoholContent: 100,
      gold: 0,
    });
    expect(complete.state.players[1]!.gold).toBe(6);
    expect(
      complete.events
        .filter((event) => event.type === 'EFFECT_RESOLVED')
        .map((event) => event.effectIndex),
    ).toEqual([0, 1, 2, 3, 4]);
    const transfer = passWindow(
      playAction(
        actionState([
          { op: 'TRANSFER_GOLD', target: 'CHOSEN_PLAYER', amount: 30 },
        ]),
      ).state,
    );
    expect(transfer.state.players.map((player) => player.gold)).toEqual([
      0, 20, 10, 10,
    ]);
  });
  it('keeps transfers within configured Gold limits and skips transferring to self', () => {
    const state = actionState([
      { op: 'TRANSFER_GOLD', target: 'ALL_PLAYERS', amount: 20 },
      { op: 'PAY_INN', target: 'SELF', amount: 20 },
    ]);
    state.rules.statBounds.gold = { min: 5, max: 12 };
    const complete = passWindow(playAction(state, null).state);
    expect(complete.state.players.map((player) => player.gold)).toEqual([
      5, 12, 12, 11,
    ]);
  });
  it('never creates Gold from negative configured lower bounds', () => {
    const state = actionState([
      { op: 'TRANSFER_GOLD', target: 'CHOSEN_PLAYER', amount: 15 },
      { op: 'PAY_INN', target: 'SELF', amount: 15 },
    ]);
    state.rules.statBounds.gold = { min: -5, max: 100 };
    const complete = passWindow(playAction(state).state);
    expect(complete.state.players.map((player) => player.gold)).toEqual([
      0, 20, 10, 10,
    ]);
  });
  it('Ignore on the payer prevents a transfer without creating Gold for its recipient', () => {
    const queued = playAction(
      actionState([
        { op: 'TRANSFER_GOLD', target: 'CHOSEN_PLAYER', amount: 3 },
      ]),
    );
    const state = queued.state;
    const ignored = passWindow(response(state, 0, 'ignore').state);
    expect(
      passWindow(ignored.state).state.players.map((player) => player.gold),
    ).toEqual([10, 10, 10, 10]);
  });
  it.each(['sample.adjust-resource', 'core.adjust-resource'] as const)(
    'runs %s only through the registered handler with validated resource params',
    (effectKey) => {
      const queued = playAction(
        responseEffects(actionState(), [
          {
            op: 'CUSTOM',
            target: 'SELF',
            effect_key: effectKey,
            params: { resource: 'tokens', delta: 2 },
          },
        ]),
      );
      const complete = passWindow(response(queued.state, 1, 'breather').state);
      expect(complete.state.players[1]!.special.resources.tokens!.value).toBe(
        2,
      );
      expect(complete.events).toContainEqual(
        expect.objectContaining({
          type: 'RESOURCE_CHANGED',
          resource: 'tokens',
          delta: 2,
          value: 2,
        }),
      );
      const bad = responseEffects(queued.state, [
        {
          op: 'CUSTOM',
          target: 'SELF',
          effect_key: 'sample.adjust-resource',
          params: { resource: 'missing', delta: 1 },
        },
      ]);
      reject(
        bad,
        'PLAY_RESPONSE',
        {
          responseWindowId: bad.responseWindow!.id,
          cardId: cardInHand(bad, 1, 'breather'),
        },
        'INVALID_EFFECT',
      );
    },
  );
  it('modifies only an unexecuted stat operation on the immediate parent', () => {
    const queued = playAction(
      responseEffects(actionState(), [
        { op: 'MODIFY_PENDING_EFFECT', effectIndex: 0, delta: -3 },
      ]),
    );
    const child = passWindow(response(queued.state, 1, 'breather').state);
    expect(child.state.resolutionStack[0]!.effects[0]).toMatchObject({
      delta: -5,
    });
    expect(passWindow(child.state).state.players[1]!.fortitude).toBe(15);
    expect(child.events).toContainEqual(
      expect.objectContaining({
        type: 'PENDING_EFFECT_MODIFIED',
        effectIndex: 0,
        delta: -3,
      }),
    );
    const bad = responseEffects(queued.state, [
      { op: 'MODIFY_PENDING_EFFECT', effectIndex: 31, delta: 1 },
    ]);
    reject(
      bad,
      'PLAY_RESPONSE',
      {
        responseWindowId: bad.responseWindow!.id,
        cardId: cardInHand(bad, 1, 'breather'),
      },
      'INVALID_EFFECT',
    );
  });
  it('draws through the shared RNG, reshuffles only discards, and caps the hand', () => {
    const queued = playAction(
      actionState([{ op: 'DRAW_CARDS', target: 'SELF', count: 2 }]),
      null,
    );
    const complete = passWindow(queued.state);
    expect(complete.state.players[0]!.hand).toHaveLength(6); // Source is held; neither deck nor discard has a card.
    expect(complete.events).toContainEqual(
      expect.objectContaining({
        type: 'DRAW_SHORTFALL',
        requested: 1,
        drawn: 0,
      }),
    );
    const state = actionState([{ op: 'DRAW_CARDS', target: 'SELF', count: 2 }]);
    const player = state.players[0]!;
    const discarded = player.hand.splice(0, 2);
    for (const id of discarded) {
      player.characterDiscard.push(id);
      state.cards[id]!.location = {
        zone: 'CHARACTER_DISCARD',
        playerId: player.id,
        deckId: player.characterDeck.deckId,
      };
    }
    const action = playAction(state, null);
    const draw = passWindow(action.state);
    expect(draw.state.rng.draws).toBe(state.rng.draws + 1);
    expect(draw.events).toContainEqual(
      expect.objectContaining({ type: 'DECK_SHUFFLED', reason: 'EXHAUSTED' }),
    );
    expect(draw.state.players[0]!.hand).toHaveLength(6);
    const capped = playAction(
      actionState([{ op: 'DRAW_CARDS', target: 'CHOSEN_PLAYER', count: 64 }]),
    );
    expect(passWindow(capped.state).state.players[1]!.hand).toHaveLength(7);
  });
  it('opens a private exact-count discard choice, validates intent, and resumes remaining effects', () => {
    const queued = playAction(
      actionState([
        { op: 'DISCARD_CARDS', target: 'CHOSEN_PLAYER', count: 2 },
        hit,
      ]),
    );
    const suspended = passWindow(queued.state).state;
    expect(suspended.resolutionStack[0]!.stage).toBe('CHOICE');
    const owner = suspended.players[1]!.id;
    const view = projectPrivatePlayer(suspended, owner);
    expect(view.pendingChoice).toMatchObject({ kind: 'CARD', min: 2, max: 2 });
    expect(
      projectPrivatePlayer(suspended, suspended.players[0]!.id).pendingChoice,
    ).toBeNull();
    expect(JSON.stringify(projectPublicGame(suspended))).not.toContain(
      view.pendingChoice!.options[0]!.id,
    );
    reject(
      suspended,
      'PASS_RESPONSE',
      { responseWindowId: suspended.responseWindow!.id },
      'ILLEGAL_TIMING',
    );
    reject(
      suspended,
      'CHOOSE_CARDS',
      {
        responseWindowId: suspended.responseWindow!.id,
        cardIds: [suspended.players[1]!.hand[0]],
      },
      'INVALID_CHOICE',
    );
    reject(
      suspended,
      'CHOOSE_CARDS',
      {
        responseWindowId: suspended.responseWindow!.id,
        cardIds: suspended.players[1]!.hand.slice(0, 2),
      },
      'INVALID_CHOICE',
      2,
    );
    reject(
      suspended,
      'CHOOSE_TARGET',
      {
        responseWindowId: suspended.responseWindow!.id,
        targetPlayerIds: ['player_2'],
      },
      'INVALID_CHOICE',
    );
    const selected = suspended.players[1]!.hand.slice(0, 2);
    const chosen = choices(
      JSON.parse(JSON.stringify(suspended)) as CoreGameState,
      'CHOOSE_CARDS',
      { cardIds: selected },
      1,
    );
    const complete = passWindow(chosen.state);
    expect(complete.state.players[1]!.hand).toHaveLength(5);
    expect(complete.state.players[1]!.characterDiscard).toEqual(selected);
    expect(complete.state.players[1]!.fortitude).toBe(18);
    expect(complete.state.phase).toBe('ORDER_DRINK');
  });
  it('chooses a server-listed target for later operations without a client-authoritative effect', () => {
    const queued = playAction(
      actionState([{ op: 'OPEN_CHOICE', target: 'SELF', kind: 'TARGET' }, hit]),
      null,
    );
    const suspended = passWindow(queued.state).state;
    expect(
      projectPrivatePlayer(
        suspended,
        suspended.players[0]!.id,
      ).pendingChoice!.options.map((option) => option.id),
    ).toEqual(['player_1', 'player_2', 'player_3']);
    reject(
      suspended,
      'CHOOSE_TARGET',
      {
        responseWindowId: suspended.responseWindow!.id,
        targetPlayerIds: ['player_0'],
      },
      'INVALID_CHOICE',
      0,
    );
    const complete = choices(suspended, 'CHOOSE_TARGET', {
      targetPlayerIds: ['player_2'],
    });
    expect(complete.state.players[2]!.fortitude).toBe(18);
    expect(complete.state.players[1]!.fortitude).toBe(20);
    expect(complete.events).toContainEqual(
      expect.objectContaining({
        type: 'CHOICE_SELECTED',
        selections: ['player_2'],
      }),
    );
  });
  it('records a validated option, opens sequential choices, and resumes suspended parent windows', () => {
    const effects: Effect[] = [
      {
        op: 'OPEN_OPTION',
        target: 'SELF',
        options: [
          { id: 'sample-a', label: 'Sample option A' },
          { id: 'sample-b', label: 'Sample option B' },
        ],
      },
      { op: 'OPEN_CHOICE', target: 'SELF', kind: 'TARGET' },
      hit,
    ];
    const queued = playAction(responseEffects(actionState(), effects));
    const suspended = passWindow(
      response(queued.state, 1, 'breather').state,
    ).state;
    reject(
      suspended,
      'CHOOSE_OPTION',
      { responseWindowId: suspended.responseWindow!.id, optionId: 'missing' },
      'INVALID_CHOICE',
    );
    const chosen = choices(
      suspended,
      'CHOOSE_OPTION',
      { optionId: 'sample-b' },
      1,
    ).state;
    expect(chosen.resolutionStack.at(-1)!.selectedOptionId).toBe('sample-b');
    expect(chosen.responseWindow!.id).not.toBe(suspended.responseWindow!.id);
    const targeted = choices(
      chosen,
      'CHOOSE_TARGET',
      { targetPlayerIds: ['player_3'] },
      1,
    ).state;
    expect(targeted.players[3]!.fortitude).toBe(18);
    expect(targeted.responseWindow!.id).not.toBe(
      queued.state.responseWindow!.id,
    );
    expect(passWindow(targeted).state.players[1]!.fortitude).toBe(18);
  });
  it('skips choices for ignored targets and empty hands while preserving operation events', () => {
    const queued = playAction(
      actionState([
        { op: 'DISCARD_CARDS', target: 'CHOSEN_PLAYER', count: 64 },
      ]),
    );
    const ignored = passWindow(response(queued.state, 1, 'ignore').state);
    expect(passWindow(ignored.state).state.responseWindow).toBeNull();
    const state = actionState([
      { op: 'DISCARD_CARDS', target: 'CHOSEN_PLAYER', count: 64 },
    ]);
    const player = state.players[1]!;
    for (const id of player.hand) {
      player.characterDiscard.push(id);
      state.cards[id]!.location = {
        zone: 'CHARACTER_DISCARD',
        playerId: player.id,
        deckId: player.characterDeck.deckId,
      };
    }
    player.hand = [];
    expect(passWindow(playAction(state).state).state.responseWindow).toBeNull();
  });
  it('starts gambling from a resolved effect and suspends its source', () => {
    const complete = passWindow(
      playAction(actionState([{ op: 'START_GAMBLING' }]), null).state,
    );
    expect(complete.state.gambling).toMatchObject({ pot: 4 });
    expect(complete.events).toContainEqual(
      expect.objectContaining({
        type: 'GAMBLING_REQUESTED',
        playerId: 'player_0',
      }),
    );
  });
  it('rejects invalid source effects before removing any card', () => {
    for (const effects of [
      [{ op: 'IGNORE', scope: 'CURRENT_EFFECT' }],
      [{ op: 'NEGATE', scope: 'TOP_STACK' }],
      [{ op: 'OPEN_CHOICE', kind: 'TARGET', target: 'ALL_PLAYERS' }],
    ] as Effect[][]) {
      const state = actionState(effects);
      reject(
        state,
        'PLAY_CARD',
        { cardId: cardInHand(state, 0, 'shove') },
        effects[0]!.op === 'OPEN_CHOICE' ? 'INVALID_EFFECT' : 'ILLEGAL_TIMING',
        0,
      );
    }
    const state = actionState([
      { op: 'MODIFY_PENDING_EFFECT', effectIndex: 0, delta: 1 },
    ]);
    reject(
      state,
      'PLAY_CARD',
      { cardId: cardInHand(state, 0, 'shove') },
      'INVALID_EFFECT',
      0,
    );
  });
  it('rejects executable content and unknown handler keys before engine execution', () => {
    expect(
      cardDefinitionSchema.safeParse({
        id: 'carddef_unsafe',
        type: 'ACTION',
        source: 'SAMPLE',
        name: 'Sample unsafe',
        rulesText: 'Test',
        effects: [
          {
            op: 'CUSTOM',
            target: 'SELF',
            effect_key: 'eval',
            params: { script: 'return 42;' },
          },
        ],
      }).success,
    ).toBe(false);
  });
});

describe('bounded stack and invariant replay', () => {
  it('auto-skips further responses at depth 32 without losing unplayed cards', () => {
    const input = setupInput(1, 22);
    for (const entry of input.content.deckCards)
      if (entry.cardId === 'carddef_sample_breather') entry.quantity = 16;
    let state = accepted(createMatch(input), 'START_MATCH').state;
    state = accepted(state, 'DISCARD', { cardIds: [] }).state;
    state = playAction(state).state;
    while (state.resolutionStack.length < 31) {
      const actor = state.responseWindow!.priorityPlayerId!;
      const player = state.players.find((player) => player.id === actor)!;
      const cardId = player.hand.find(
        (id) => state.cards[id]!.definitionId === 'carddef_sample_breather',
      );
      if (cardId === undefined) {
        state = pass(state).state;
        continue;
      }
      state = accepted(
        state,
        'PLAY_RESPONSE',
        { responseWindowId: state.responseWindow!.id, cardId },
        actor,
      ).state;
    }
    const actor = state.responseWindow!.priorityPlayerId!;
    const cardId = state.players
      .find((player) => player.id === actor)!
      .hand.find(
        (id) => state.cards[id]!.definitionId === 'carddef_sample_breather',
      )!;
    const result = accepted(
      state,
      'PLAY_RESPONSE',
      { responseWindowId: state.responseWindow!.id, cardId },
      actor,
    );
    const child = result.events.find(
      (event) => event.type === 'RESOLUTION_STARTED',
    )!;
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: 'RESOLUTION_COMPLETED',
        resolutionId: child.resolutionId,
      }),
    );
    expect(result.state.resolutionStack).toHaveLength(31);
    expect(result.state.cards[cardId]!.location.zone).toBe('CHARACTER_DISCARD');
    assertCoreInvariants(result.state);
  });
  it('bounds per-window submitted history and preserves the current source on rejection', () => {
    const state = mutable(playAction().state);
    const history = Array.from({ length: 256 }, (_, index) =>
      resolutionIdSchema.parse(`resolution_history_${index}`),
    );
    state.resolutionStack[0]!.window!.submittedResponses = history;
    state.responseWindow!.submittedResponses = history;
    assertCoreInvariants(state);
    reject(
      state,
      'PLAY_RESPONSE',
      {
        responseWindowId: state.responseWindow!.id,
        cardId: cardInHand(state, 1, 'breather'),
      },
      'STACK_LIMIT',
    );
  });
  it('conserves cards and replays nested commands/snapshots across seeds', () => {
    for (let seed = 0; seed < 8; seed += 1) {
      const initial = accepted(started(seed, 7), 'DISCARD', {
        cardIds: [],
      }).state;
      const run = () => {
        const root = playAction(initial);
        const child = response(root.state, 1, 'ignore');
        const grandchild = response(child.state, 2, 'negate');
        const leaf = passWindow(
          JSON.parse(JSON.stringify(grandchild.state)) as CoreGameState,
        );
        const completed = passWindow(leaf.state);
        const results = [
          root,
          child,
          grandchild,
          ...leaf.results,
          ...completed.results,
        ];
        for (const result of results) {
          assertCoreInvariants(result.state);
          expect(Object.keys(result.state.cards).sort()).toEqual(
            Object.keys(initial.cards).sort(),
          );
          expect(result.events.map((event) => event.eventIndex)).toEqual(
            result.events.map((_event, index) => index),
          );
          expect(
            result.events.every(
              (event) => event.stateVersion === result.state.version,
            ),
          ).toBe(true);
        }
        expect(completed.state.players[1]!.fortitude).toBe(18);
        return results;
      };
      expect(run()).toEqual(run());
    }
  }, 20000);
});

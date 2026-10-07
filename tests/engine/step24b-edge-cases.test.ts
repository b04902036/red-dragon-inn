import { expect, it } from 'vitest';
import { applyCommand } from '../../src/engine/commands';
import { createMatch } from '../../src/engine/setup';
import { coreStateSchema, replayFromSnapshot } from '../../src/engine/replay';
import { contentPackSchema } from '../../src/content/pack';
import { cardDefinitionSchema } from '../../src/content/cards';
import { intent, setupInput } from '../fixtures/core-match';
import {
  genericState,
  putCard,
  play,
  send,
  until,
  legal,
  settle,
  systemTrigger,
} from '../fixtures/generic-match';
import {
  numericDrinks,
  placeFirstDrink,
  finish,
  verifyOpportunity,
} from '../fixtures/step24b';

it('an explicit payment prevention restriction rejects the response without affecting other legal responses', () => {
  const state = genericState();
  const response = putCard(state, 1, [{ op: 'PREVENT_CURRENT_GOLD_LOSS' }], {
    trigger: systemTrigger('PAYMENT_REQUIRED'),
  });
  const source = putCard(
    state,
    0,
    [
      {
        op: 'PAY_INN',
        target: 'CHOSEN_PLAYER',
        amount: 2,
        allowGoldLossPrevention: false,
      },
    ],
    { type: 'ACTION' },
  );
  const pending = until(
    play(state, 0, source, state.players[1]!.id).state,
    (s) => s.resolutionStack.at(-1)?.task?.kind === 'PAYMENT',
  );
  expect(legal(pending, 1, response)).toBeUndefined();
  expect(settle(pending).players[1]!.gold).toBe(8);
});
it('a direct Gold-loss operation enters the same prevention workflow', () => {
  const state = genericState();
  const response = putCard(state, 1, [{ op: 'PREVENT_CURRENT_GOLD_LOSS' }], {
    trigger: systemTrigger('PAYMENT_REQUIRED'),
  });
  const source = putCard(
    state,
    0,
    [{ op: 'CHANGE_STAT', target: 'CHOSEN_PLAYER', stat: 'GOLD', delta: -3 }],
    { type: 'ACTION' },
  );
  const pending = until(
    play(state, 0, source, state.players[1]!.id).state,
    (s) => legal(s, 1, response) !== undefined,
  );
  expect(settle(play(pending, 1, response).state).players[1]!.gold).toBe(10);
});
it('a phase context orders two free Drinks and permits the same other player twice', () => {
  const state = genericState();
  const card = putCard(
    state,
    0,
    [{ op: 'ORDER_EXTRA_OR_WAIVE_REFILL', count: 2 }],
    {
      trigger: {
        event: 'SYSTEM',
        alternatives: [
          [{ kind: 'PHASE_OPPORTUNITY', phase: 'ORDER_DRINK', actor: 'SELF' }],
          [{ kind: 'SYSTEM_EVENT', events: ['DRINK_DECK_REFILL_PAYMENT'] }],
        ],
      },
    },
  );
  const pending = until(
    send(state, 'SKIP_ACTION', {}, 0).state,
    (s) => legal(s, 0, card) !== undefined,
  );
  const gold = state.players[0]!.gold;
  let choice = until(
    play(pending, 0, card).state,
    (s) => s.responseWindow?.pendingChoice?.kind === 'TARGET',
  );
  const before = state.players[1]!.drinkPile.length;
  choice = send(
    choice,
    'CHOOSE_TARGET',
    { targetPlayerIds: [state.players[1]!.id] },
    0,
  ).state;
  choice = send(
    choice,
    'CHOOSE_TARGET',
    { targetPlayerIds: [state.players[1]!.id] },
    0,
  ).state;
  expect(finish(choice).players[1]!.drinkPile.length).toBe(before + 2);
  expect(finish(choice).players[0]!.gold).toBe(gold);
});
it('another player’s Drink phase opens its own opportunity even before an actual Drink reveal', () => {
  const state = genericState();
  const card = putCard(
    state,
    1,
    [{ op: 'QUEUE_EXTRA_DRINK', target: 'SOURCE_ACTOR' }],
    {
      trigger: {
        event: 'SYSTEM',
        alternatives: [
          [{ kind: 'PHASE_OPPORTUNITY', phase: 'DRINK', actor: 'OTHER' }],
        ],
      },
    },
  );
  let pending = send(state, 'SKIP_ACTION', {}, 0).state;
  pending = finish(pending);
  pending = until(
    send(pending, 'ORDER_DRINK', { targetPlayerId: state.players[2]!.id }, 0)
      .state,
    (s) => legal(s, 1, card) !== undefined,
  );
  expect(pending.resolutionStack.at(-1)!.task).toMatchObject({
    kind: 'PHASE',
    phase: 'DRINK',
  });
  verifyOpportunity(pending, 1, card);
  const count = pending.players[0]!.drinkPile.length;
  const final = finish(play(pending, 1, card).state);
  expect(final.players[0]!.drinkPile).toHaveLength(Math.max(0, count - 1));
  expect(final.phase).toBe('DRINK');
});
it('Share Pain leaves its responder locked even when another player reduces their own half to zero', () => {
  const state = genericState();
  const trigger = {
    event: 'CARD' as const,
    alternatives: [
      [
        {
          kind: 'PENDING_STAT' as const,
          stat: 'FORTITUDE' as const,
          direction: 'LOSS' as const,
          relation: 'SELF' as const,
        },
      ],
    ],
  };
  const share = putCard(state, 1, [{ op: 'SHARE_FORTITUDE_LOSS' }], {
    trigger,
  });
  const reduction = putCard(
    state,
    0,
    [{ op: 'MODIFY_PENDING_EFFECT', effectIndex: 0, delta: 5 }],
    { trigger, suffix: 'ignore' },
  );
  const hit = putCard(
    state,
    0,
    [
      {
        op: 'CHANGE_STAT',
        target: 'CHOSEN_PLAYER',
        stat: 'FORTITUDE',
        delta: -3,
      },
    ],
    { type: 'ACTION' },
  );
  let pending = until(
    play(state, 0, hit, state.players[1]!.id).state,
    (s) => legal(s, 1, share) !== undefined,
  );
  pending = until(
    play(pending, 1, share).state,
    (s) =>
      s.resolutionStack.length === 1 && legal(s, 0, reduction) !== undefined,
  );
  const final = settle(play(pending, 0, reduction).state);
  expect(final.players.slice(0, 2).map((p) => p.fortitude)).toEqual([20, 18]);
});
it('Mead’s built-in choice survives snapshot restore and deterministic command replay, and rejects invalid targets', () => {
  const { state, ids } = numericDrinks();
  const id = state.cards[ids[0]!]!.definitionId;
  state.definitions[id] = cardDefinitionSchema.parse({
    ...state.definitions[id],
    builtInSplit: true,
  });
  placeFirstDrink(state, ids);
  const pending = until(
    send(state, 'TAKE_DRINK', {}, 0).state,
    (s) => s.responseWindow?.pendingChoice?.kind === 'OPTION',
  );
  const restored = coreStateSchema.parse(JSON.parse(JSON.stringify(pending)));
  const fields = {
    responseWindowId: pending.responseWindow!.id,
    optionId: state.players[1]!.id,
  };
  const command = intent(pending, 'CHOOSE_OPTION', fields);
  const result = applyCommand(restored, command, {
    actorId: state.players[0]!.id,
  });
  expect(result.status).toBe('ACCEPTED');
  expect(
    replayFromSnapshot(restored, 0, [
      {
        actorId: state.players[0]!.id,
        command,
        firstSequence: 1,
        lastSequence: result.events.length,
        events: result.events,
        acceptedAt: new Date(0).toISOString(),
      },
    ]).state,
  ).toEqual(result.state);
  expect(
    applyCommand(
      pending,
      intent(pending, 'CHOOSE_OPTION', {
        ...fields,
        optionId: state.players[0]!.id,
      }),
      { actorId: state.players[0]!.id },
    ),
  ).toMatchObject({ status: 'REJECTED', state: pending, events: [] });
});
it('Bar Deck setup combines explicitly selected Inn decks, retains unique copies and replays deterministically', () => {
  const setup = setupInput();
  const original = setup.content.decks.find(
    (deck) => deck.type === 'INN_DRINK',
  )!;
  const second = {
    ...original,
    id: 'deck_test_second_inn',
    slug: 'test-second-inn',
    name: 'Synthetic second set',
  };
  setup.content = contentPackSchema.parse({
    ...setup.content,
    decks: [...setup.content.decks, second],
    deckCards: [
      ...setup.content.deckCards,
      ...setup.content.deckCards
        .filter((entry) => entry.deckId === original.id)
        .map((entry) => ({ ...entry, deckId: second.id })),
    ],
  });
  expect(() => createMatch(setup)).toThrow('explicit valid Inn deck selection');
  const selected = { ...setup, innDrinkDeckIds: [original.id, second.id] };
  const match = createMatch(selected);
  expect(match.innDrinkDeck.cardIds.length).toBe(
    createMatch({ ...selected, innDrinkDeckIds: [original.id] }).innDrinkDeck
      .cardIds.length * 2,
  );
  expect(coreStateSchema.parse(JSON.parse(JSON.stringify(match)))).toEqual(
    match,
  );
  expect(createMatch(selected)).toEqual(match);
  expect(() =>
    createMatch({ ...setup, innDrinkDeckIds: ['deck_unknown'] }),
  ).toThrow('explicit valid Inn deck selection');
});
it('Challenge rescue is available at the final survival checkpoint and prevents premature elimination', () => {
  const { state, ids } = numericDrinks([0, 2, 3]);
  state.players[0]!.fortitude = 5;
  const original = state.definitions[state.cards[ids[0]!]!.definitionId]!;
  state.definitions[original.id] = cardDefinitionSchema.parse({
    id: original.id,
    name: 'Original optional test Event',
    rulesText: 'Synthetic challenge.',
    type: 'DRINK_EVENT',
    source: 'TEST_FIXTURE',
    effects: [{ op: 'OPTIONAL_DRINK_CHALLENGE', target: 'SELF' }],
  });
  placeFirstDrink(state, ids);
  const rescue = putCard(
    state,
    0,
    [{ op: 'CHANGE_STAT', target: 'SELF', stat: 'FORTITUDE', delta: 2 }],
    { type: 'ANYTIME' },
  );
  let pending = until(
    send(state, 'TAKE_DRINK', {}, 0).state,
    (s) => s.responseWindow?.pendingChoice?.kind === 'OPTION',
  );
  pending = send(pending, 'CHOOSE_OPTION', { optionId: 'ACCEPT' }, 0).state;
  pending = until(
    pending,
    (s) =>
      s.resolutionStack.at(-1)?.task?.kind === 'CHALLENGE' &&
      (s.resolutionStack.at(-1)!.task as { stage: string }).stage ===
        'SURVIVAL' &&
      legal(s, 0, rescue) !== undefined,
  );
  expect(pending.players[0]!.alcoholContent).toBe(5);
  expect(pending.players[0]!.eliminated).toBe(false);
  const final = finish(play(pending, 0, rescue).state);
  expect(final.players[0]!.eliminated).toBe(false);
  expect(final.players[0]!.gold).toBe(13);
});

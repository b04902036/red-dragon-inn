import { expect, it } from 'vitest';
import { applyCommand } from '../../src/engine/commands';
import { replayFromSnapshot } from '../../src/engine/replay';
import {
  projectPrivatePlayer,
  projectPublicGame,
} from '../../src/protocol/projections';
import { accepted, intent, mutable, started } from '../fixtures/core-match';
import { cardDefinitionIdSchema } from '../../src/shared/ids';

function devState() {
  const state = mutable(started());
  state.rules.devCardSelection = true;
  return state;
}
it('normal matches reject both development commands without mutating state', () => {
  const state = started();
  for (const command of [
    intent(state, 'DEV_DISCARD_DRAW', { cardIds: [], definitionIds: [] }),
    intent(state, 'DEV_ORDER_DRINK', {
      targetPlayerId: state.players[1]!.id,
      definitionId: 'carddef_sample_light_drink',
    }),
  ]) {
    expect(
      applyCommand(state, command, { actorId: state.activePlayerId! }),
    ).toMatchObject({
      status: 'REJECTED',
      code: 'UNSUPPORTED_COMMAND',
      state,
      events: [],
    });
  }
  expect(
    projectPrivatePlayer(state, state.players[0]!.id).devChoices,
  ).toBeUndefined();
});
it('chosen replacement copies come from the owner deck/discard, preserve RNG and replay exactly', () => {
  const state = devState();
  const owner = state.players[0]!;
  const fromDeck = owner.characterDeck.cardIds.at(-1)!;
  const fromDiscard = owner.hand[0]!;
  const definitionIds = [
    state.cards[fromDeck]!.definitionId,
    state.cards[fromDiscard]!.definitionId,
  ];
  const command = intent(state, 'DEV_DISCARD_DRAW', {
    cardIds: owner.hand.slice(0, 2),
    definitionIds,
  });
  const result = applyCommand(state, command, { actorId: owner.id });
  expect(result.status).toBe('ACCEPTED');
  if (result.status !== 'ACCEPTED') throw new Error('Selection rejected');
  expect(
    result.state.players[0]!.hand.map(
      (id) => result.state.cards[id]!.definitionId,
    ).slice(-2),
  ).toEqual(definitionIds);
  expect(result.state.rng).toEqual(state.rng);
  expect(result.events.map((event) => event.type)).toContain('CARDS_DRAWN');
  expect(
    replayFromSnapshot(state, 0, [
      {
        actorId: owner.id,
        command,
        firstSequence: 1,
        lastSequence: result.events.length,
        events: result.events,
        acceptedAt: '2026-10-05T00:00:00.000Z',
      },
    ]).state,
  ).toEqual(result.state);
});
it('wrong phase, non-active player, foreign hand, wrong counts and unavailable definitions reject atomically', () => {
  const state = devState();
  const owner = state.players[0]!;
  const fields = {
    cardIds: [owner.hand[0]!],
    definitionIds: [state.cards[owner.characterDeck.cardIds[0]!]!.definitionId],
  };
  expect(
    applyCommand(state, intent(state, 'DEV_DISCARD_DRAW', fields), {
      actorId: state.players[1]!.id,
    }),
  ).toMatchObject({ status: 'REJECTED', code: 'NOT_ACTIVE_PLAYER' });
  for (const badFields of [
    { ...fields, cardIds: [state.players[1]!.hand[0]!] },
    { ...fields, definitionIds: [] },
    { ...fields, definitionIds: ['carddef_missing'] },
    { cardIds: [], definitionIds: fields.definitionIds },
  ])
    expect(
      applyCommand(state, intent(state, 'DEV_DISCARD_DRAW', badFields), {
        actorId: owner.id,
      }),
    ).toMatchObject({ status: 'REJECTED', state, events: [] });
  state.phase = 'ACTION';
  expect(
    applyCommand(state, intent(state, 'DEV_DISCARD_DRAW', fields), {
      actorId: owner.id,
    }),
  ).toMatchObject({ status: 'REJECTED', code: 'WRONG_PHASE', state });
});
it('a full hand with no discards can finish the phase without selecting or creating cards', () => {
  const state = devState();
  const result = accepted(state, 'DEV_DISCARD_DRAW', {
    cardIds: [],
    definitionIds: [],
  });
  expect(result.state.players[0]!.hand).toEqual(state.players[0]!.hand);
  expect(result.events.some((event) => event.type === 'CARDS_DRAWN')).toBe(
    false,
  );
  expect(result.state.phase).toBe('ACTION');
});
it('does not create extra copies when the same definition is requested too many times', () => {
  const state = devState();
  const owner = state.players[0]!;
  const only = owner.characterDeck.cardIds[0]!;
  const definition = {
    ...state.definitions[state.cards[only]!.definitionId]!,
    id: cardDefinitionIdSchema.parse('carddef_dev_unique'),
  };
  state.definitions[definition.id] = definition;
  state.cards[only]!.definitionId = definition.id;
  expect(
    applyCommand(
      state,
      intent(state, 'DEV_DISCARD_DRAW', {
        cardIds: owner.hand.slice(0, 2),
        definitionIds: [definition.id, definition.id],
      }),
      { actorId: owner.id },
    ),
  ).toMatchObject({
    status: 'REJECTED',
    code: 'INVALID_CHOICE',
    state,
    events: [],
  });
});
it.each(['deck', 'discard'] as const)(
  'orders an existing chosen Drink/Event from the Inn %s face down without changing RNG',
  (pile) => {
    const state = devState();
    state.phase = 'ORDER_DRINK';
    const id = state.innDrinkDeck.cardIds.at(-1)!;
    const definitionId = cardDefinitionIdSchema.parse(
      'carddef_dev_chosen_drink',
    );
    state.definitions[definitionId] = {
      ...state.definitions[state.cards[id]!.definitionId]!,
      id: definitionId,
    };
    state.cards[id]!.definitionId = definitionId;
    if (pile === 'discard') {
      state.innDrinkDeck.cardIds.pop();
      state.innDrinkDiscard.push(id);
      state.cards[id]!.location = {
        zone: 'INN_DRINK_DISCARD',
        deckId: state.innDrinkDeck.deckId,
      };
    }
    const result = accepted(state, 'DEV_ORDER_DRINK', {
      targetPlayerId: state.players[1]!.id,
      definitionId: state.cards[id]!.definitionId,
    });
    const ordered = result.events.find(
      (event) => event.type === 'DRINK_ORDERED',
    )!;
    expect(ordered.type).toBe('DRINK_ORDERED');
    if (ordered.type !== 'DRINK_ORDERED') throw new Error('Order missing');
    expect(result.state.players[1]!.drinkPile[0]).toBe(ordered.cardId);
    expect(ordered.cardId).toBe(id);
    expect(result.state.cards[ordered.cardId]!.definitionId).toBe(
      state.cards[id]!.definitionId,
    );
    expect(result.state.rng).toEqual(state.rng);
    expect(JSON.stringify(projectPublicGame(result.state))).not.toContain(
      ordered.cardId,
    );
    for (const player of state.players)
      expect(
        projectPrivatePlayer(result.state, player.id).hand.some(
          (card) => card.id === ordered.cardId,
        ),
      ).toBe(false);
  },
);
it('dev menus contain only owner character supply and available Inn copies, never physical IDs or deck order', () => {
  const state = devState();
  const own = projectPrivatePlayer(state, state.players[0]!.id).devChoices!;
  expect(own.characterCards.reduce((n, card) => n + card.count, 0)).toBe(
    state.players[0]!.hand.length +
      state.players[0]!.characterDeck.cardIds.length,
  );
  for (const player of state.players.slice(1))
    for (const id of player.hand) expect(JSON.stringify(own)).not.toContain(id);
  expect(projectPublicGame(state)).not.toHaveProperty('devChoices');
});
it('chosen orders validate the recipient and cannot take a card from another drink pile', () => {
  const state = devState();
  state.phase = 'ORDER_DRINK';
  const hiddenId = state.players[1]!.drinkPile[0]!;
  const hiddenDefinition = cardDefinitionIdSchema.parse(
    'carddef_dev_hidden_drink',
  );
  state.definitions[hiddenDefinition] = {
    ...state.definitions[state.cards[hiddenId]!.definitionId]!,
    id: hiddenDefinition,
  };
  state.cards[hiddenId]!.definitionId = hiddenDefinition;
  const definitionId =
    state.cards[state.innDrinkDeck.cardIds[0]!]!.definitionId;
  expect(
    applyCommand(
      state,
      intent(state, 'DEV_ORDER_DRINK', {
        targetPlayerId: state.activePlayerId,
        definitionId,
      }),
      { actorId: state.activePlayerId! },
    ),
  ).toMatchObject({ status: 'REJECTED', code: 'INVALID_TARGET', state });
  expect(
    applyCommand(
      state,
      intent(state, 'DEV_ORDER_DRINK', {
        targetPlayerId: state.players[1]!.id,
        definitionId: hiddenDefinition,
      }),
      { actorId: state.activePlayerId! },
    ),
  ).toMatchObject({ status: 'REJECTED', code: 'INVALID_CHOICE', state });
});

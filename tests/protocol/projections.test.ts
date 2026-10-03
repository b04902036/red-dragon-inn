import { describe, expect, it } from 'vitest';
import {
  projectPrivatePlayer,
  projectPublicGame,
} from '../../src/protocol/projections';
import {
  privatePlayerViewSchema,
  publicGameViewSchema,
} from '../../src/protocol/views';
import { cardInstanceIdSchema, playerIdSchema } from '../../src/shared/ids';
import type { AuthoritativeGameState } from '../../src/engine/model';
import { makeGameState } from '../fixtures/game-state';

function hiddenDeckIds(state: AuthoritativeGameState) {
  return [
    ...state.innDrinkDeck.cardIds,
    ...state.players.flatMap((player) => [
      ...player.characterDeck.cardIds,
      ...player.drinkPile,
      ...Object.values(player.special.sideDecks).flatMap(
        (side) => side.deck.cardIds,
      ),
    ]),
  ];
}

describe('public projections', () => {
  it('conceals every source in an unrevealed compound frame', () => {
    const state = makeGameState();
    const hidden = state.players.flatMap((player) => player.drinkPile);
    const view = projectPublicGame({
      ...state,
      resolutionStack: state.resolutionStack.map((frame, index) =>
        index === 0
          ? { ...frame, sourceCardIds: hidden, sourceRevealed: false }
          : frame,
      ),
    });
    expect(view.resolutionStack[0]).toMatchObject({
      sourceCard: null,
      sourceCards: [],
    });
    for (const id of hidden) {
      expect(JSON.stringify(view)).not.toContain(id);
      expect(JSON.stringify(view)).not.toContain(state.cards[id]!.definitionId);
    }
  });
  it('publishes game status, player stats, counts, and public resources', () => {
    const state = makeGameState();
    const view = projectPublicGame(state);
    expect(publicGameViewSchema.safeParse(view).success).toBe(true);
    expect(view).toMatchObject({
      version: 7,
      lifecycle: 'PLAYING',
      phase: 'ACTION',
      activePlayerId: state.players[0]!.id,
      innDrinkDeckCount: 2,
      innDrinkDiscardCount: 1,
      winners: [],
    });
    expect(
      view.players.map((player) => ({
        seat: player.seat,
        fortitude: player.fortitude,
        handCount: player.handCount,
        characterDeckCount: player.characterDeckCount,
        characterDiscardCount: player.characterDiscardCount,
        drinkPileCount: player.drinkPileCount,
        resources: player.resources,
        sideDecks: player.sideDecks,
      })),
    ).toEqual(
      [0, 1].map((seat) => ({
        seat,
        fortitude: 20,
        handCount: 2,
        characterDeckCount: 2,
        characterDiscardCount: 1,
        drinkPileCount: 1,
        resources: { tokens: 1 },
        sideDecks: { shared: { deckCount: 1, discardCount: 1 } },
      })),
    );
    const { suspended, ...publicRound } = state.gambling!;
    expect(view.gambling).toEqual(publicRound);
    expect(view.gambling).not.toHaveProperty('suspended');
    expect(suspended.resolutionId).toBe('resolution_hidden');
  });

  it('never contains hand identities, face-down drinks, future deck order, or RNG data', () => {
    const state = makeGameState();
    const serialized = JSON.stringify(projectPublicGame(state));
    for (const id of [
      ...hiddenDeckIds(state),
      ...state.players.flatMap((player) => player.hand),
    ]) {
      expect(serialized).not.toContain(id);
      expect(serialized).not.toContain(state.cards[id]!.definitionId);
    }
    for (const field of [
      '"hand":',
      '"cards":',
      '"rng":',
      '"seed":',
      '"cardIds":',
      '"drinkPile":',
      '"owner_tokens":',
      '"server_tokens":',
      '"effects":',
      '"pendingChoice":',
    ]) {
      expect(serialized).not.toContain(field);
    }
    expect(serialized).not.toContain('123456789');
    expect(serialized).not.toContain('234567890');
    expect(serialized).not.toContain('31337');
    expect(serialized).not.toContain('Private sample option');
  });

  it('exposes only explicitly revealed resolution cards and the choice owner', () => {
    const state = makeGameState();
    const view = projectPublicGame(state);
    expect(view.resolutionStack[0]!.sourceCard).toBeNull();
    const revealedId = state.resolutionStack[1]!.sourceCardId!;
    expect(view.resolutionStack[1]!.sourceCard).toEqual({
      id: revealedId,
      definitionId: state.cards[revealedId]!.definitionId,
    });
    expect(view.resolutionStack[2]!.sourceCard).toBeNull();
    expect(view.responseWindow?.choicePlayerId).toBe(state.players[0]!.id);
    expect(view.responseWindow).not.toHaveProperty('pendingChoice');
  });

  it('supports lobby/null sub-states and a response window without a pending choice', () => {
    const state = makeGameState();
    const lobby = projectPublicGame({
      ...state,
      matchId: null,
      lifecycle: 'LOBBY',
      phase: null,
      activePlayerId: null,
      players: [],
      gambling: null,
      resolutionStack: [],
      responseWindow: null,
      rng: null,
    });
    expect(lobby).toMatchObject({
      matchId: null,
      lifecycle: 'LOBBY',
      phase: null,
      activePlayerId: null,
      players: [],
      gambling: null,
      resolutionStack: [],
      responseWindow: null,
    });
    const noChoice = projectPublicGame({
      ...state,
      responseWindow: { ...state.responseWindow!, pendingChoice: null },
    });
    expect(noChoice.responseWindow?.choicePlayerId).toBeNull();
  });

  it('is identical when hidden deck order, opponent hands, drinks, RNG, or choice labels change', () => {
    const state = makeGameState();
    const altered: AuthoritativeGameState = {
      ...state,
      rng: { ...state.rng!, seed: 98765, state: 12345 },
      players: state.players.map((player) => ({
        ...player,
        hand: [...player.hand].reverse(),
        drinkPile: [cardInstanceIdSchema.parse('card_hidden_replacement')],
        characterDeck: {
          ...player.characterDeck,
          cardIds: [...player.characterDeck.cardIds].reverse(),
        },
      })),
      innDrinkDeck: {
        ...state.innDrinkDeck,
        cardIds: [...state.innDrinkDeck.cardIds].reverse(),
      },
      responseWindow: {
        ...state.responseWindow!,
        pendingChoice: {
          ...state.responseWindow!.pendingChoice!,
          options: [{ id: 'changed', label: 'Changed hidden choice' }],
        },
      },
    };
    expect(projectPublicGame(altered)).toEqual(projectPublicGame(state));
  });

  it('does not copy newly added secret fields from any internal object', () => {
    const state = makeGameState();
    const secret = 'PRIVATE_FIELD_CANARY';
    Object.assign(state, { futureSecret: secret });
    Object.assign(state.players[0]!, { futureSecret: secret });
    Object.assign(state.gambling!, { futureSecret: secret });
    Object.assign(state.responseWindow!, { futureSecret: secret });
    Object.assign(state.resolutionStack[1]!, { futureSecret: secret });
    expect(JSON.stringify(projectPublicGame(state))).not.toContain(secret);
    expect(
      JSON.stringify(projectPrivatePlayer(state, state.players[0]!.id)),
    ).not.toContain(secret);
  });

  it('returns detached values that cannot mutate authoritative state', () => {
    const state = makeGameState();
    const before = JSON.stringify(state);
    const view = projectPublicGame(state);
    view.players[0]!.resources.tokens = 500;
    view.players[0]!.sideDecks.shared!.deckCount = 999;
    view.gambling!.participants.pop();
    view.responseWindow!.eligiblePlayerIds.pop();
    view.resolutionStack[0]!.targetPlayerIds.pop();
    view.winners.push(state.players[0]!.id);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('fails closed for a missing or mismatched revealed card', () => {
    const state = makeGameState();
    const revealedId = state.resolutionStack[1]!.sourceCardId!;
    const { [revealedId]: missing, ...cards } = state.cards;
    expect(missing).toBeDefined();
    expect(() => projectPublicGame({ ...state, cards })).toThrow(
      'Invalid authoritative card reference',
    );
    expect(() =>
      projectPublicGame({
        ...state,
        cards: {
          ...state.cards,
          [revealedId]: {
            ...missing!,
            id: cardInstanceIdSchema.parse('card_wrong'),
          },
        },
      }),
    ).toThrow('Invalid authoritative card reference');
  });

  it('supports every lifecycle/phase contract and multiple winners', () => {
    const state = makeGameState();
    for (const lifecycle of [
      'LOBBY',
      'SETUP',
      'PLAYING',
      'FINISHED',
    ] as const) {
      expect(projectPublicGame({ ...state, lifecycle }).lifecycle).toBe(
        lifecycle,
      );
    }
    for (const phase of [
      'DISCARD_DRAW',
      'ACTION',
      'ORDER_DRINK',
      'DRINK',
      'ELIMINATION_CHECK',
      'NEXT_TURN',
    ] as const) {
      expect(projectPublicGame({ ...state, phase }).phase).toBe(phase);
    }
    expect(
      projectPublicGame({
        ...state,
        lifecycle: 'FINISHED',
        winners: state.players.map((player) => player.id),
      }).winners,
    ).toEqual(state.players.map((player) => player.id));
  });
});

describe('private projections', () => {
  it.each([0, 1])(
    'exposes only player %i hand and permitted resources',
    (index) => {
      const state = makeGameState();
      const player = state.players[index]!;
      const view = projectPrivatePlayer(state, player.id);
      expect(privatePlayerViewSchema.safeParse(view).success).toBe(true);
      expect(view.playerId).toBe(player.id);
      expect(view.hand).toEqual(
        player.hand.map((id) => ({
          id,
          definitionId: state.cards[id]!.definitionId,
        })),
      );
      expect(view.resources).toEqual({ tokens: 1, owner_tokens: 71 + index });
      expect(view.sideDecks).toEqual({
        shared: { deckCount: 1, discardCount: 1 },
        personal: { deckCount: 1, discardCount: 1 },
      });
      const serialized = JSON.stringify(view);
      for (const other of state.players.filter(
        (entry) => entry.id !== player.id,
      )) {
        for (const id of other.hand) {
          expect(serialized).not.toContain(id);
          expect(serialized).not.toContain(state.cards[id]!.definitionId);
        }
      }
      for (const id of hiddenDeckIds(state))
        expect(serialized).not.toContain(id);
      expect(serialized).not.toContain('"server_tokens":');
      expect(serialized).not.toContain('"internal":');
      expect(serialized).not.toContain('"rng":');
    },
  );

  it('exposes a choice only to its designated player, without internal player metadata', () => {
    const state = makeGameState();
    expect(
      projectPrivatePlayer(state, state.players[0]!.id).pendingChoice,
    ).toEqual({
      responseWindowId: state.responseWindow!.id,
      kind: 'OPTION',
      options: [{ id: 'secret-choice', label: 'Private sample option' }],
      min: 1,
      max: 1,
    });
    expect(
      projectPrivatePlayer(state, state.players[1]!.id).pendingChoice,
    ).toBeNull();
    expect(
      projectPrivatePlayer(
        { ...state, responseWindow: null },
        state.players[0]!.id,
      ).pendingChoice,
    ).toBeNull();
    expect(
      projectPrivatePlayer(
        {
          ...state,
          responseWindow: { ...state.responseWindow!, pendingChoice: null },
        },
        state.players[0]!.id,
      ).pendingChoice,
    ).toBeNull();
  });

  it('rejects spectators or unknown requester IDs instead of returning a hand', () => {
    const state = makeGameState();
    expect(() =>
      projectPrivatePlayer(state, playerIdSchema.parse('player_unknown')),
    ).toThrow('Player is not in this match');
  });

  it('cannot be used to mutate cards, resources, side deck counts, or private choices', () => {
    const state = makeGameState();
    const before = JSON.stringify(state);
    const view = projectPrivatePlayer(state, state.players[0]!.id);
    view.hand[0]!.definitionId =
      state.cards[state.players[1]!.hand[0]!]!.definitionId;
    view.resources.owner_tokens = 800;
    view.sideDecks.personal!.deckCount = 900;
    view.pendingChoice!.options[0]!.label = 'Changed';
    expect(JSON.stringify(state)).toBe(before);
  });

  it.each([
    'missing',
    'wrong-owner',
    'wrong-zone',
    'wrong-location-player',
    'wrong-card-id',
  ] as const)('fails closed on %s hand state', (corruption) => {
    const state = makeGameState();
    const player = state.players[0]!;
    const handId = player.hand[0]!;
    const original = state.cards[handId]!;
    const cards = { ...state.cards };
    if (corruption === 'missing') delete cards[handId];
    if (corruption === 'wrong-owner')
      cards[handId] = { ...original, ownerId: state.players[1]!.id };
    if (corruption === 'wrong-zone')
      cards[handId] = {
        ...original,
        location: { zone: 'INN_DRINK_DECK', deckId: state.innDrinkDeck.deckId },
      };
    if (corruption === 'wrong-location-player')
      cards[handId] = {
        ...original,
        location: { zone: 'HAND', playerId: state.players[1]!.id },
      };
    if (corruption === 'wrong-card-id')
      cards[handId] = {
        ...original,
        id: cardInstanceIdSchema.parse('card_wrong'),
      };
    expect(() => projectPrivatePlayer({ ...state, cards }, player.id)).toThrow(
      /Invalid authoritative/,
    );
  });

  it('handles an empty hand without manufacturing card identities', () => {
    const state = makeGameState();
    const player = state.players[0]!;
    const empty = {
      ...state,
      players: [{ ...player, hand: [] }, state.players[1]!],
    };
    expect(projectPrivatePlayer(empty, player.id).hand).toEqual([]);
  });
});

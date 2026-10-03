import { cardInstanceSchema } from '../../src/content/cards';
import type { CardInstance } from '../../src/content/cards';
import type {
  AuthoritativeGameState,
  PlayerState,
  SpecialDeck,
} from '../../src/engine/model';
import {
  cardDefinitionIdSchema,
  cardInstanceIdSchema,
  characterIdSchema,
  deckIdSchema,
  matchIdSchema,
  playerIdSchema,
  resolutionIdSchema,
  responseWindowIdSchema,
  roomIdSchema,
} from '../../src/shared/ids';
import type { CardInstanceId } from '../../src/shared/ids';
import { stateVersionSchema } from '../../src/shared/version';

/** Original test identities only; no licensed card content. */
export function makeGameState(): AuthoritativeGameState {
  const cards: Record<CardInstanceId, CardInstance> = {};

  function addCard(
    label: string,
    ownerId: CardInstance['ownerId'],
    location: CardInstance['location'],
  ) {
    const id = cardInstanceIdSchema.parse(`card_${label}`);
    cards[id] = cardInstanceSchema.parse({
      id,
      definitionId: cardDefinitionIdSchema.parse(`carddef_${label}`),
      ownerId,
      location,
    });
    return id;
  }

  function makePlayer(seat: 0 | 1): PlayerState {
    const id = playerIdSchema.parse(`player_${seat}`);
    const deckId = deckIdSchema.parse(`deck_character_${seat}`);
    const name = `p${seat}`;

    function sideDeck(
      visibility: SpecialDeck['visibility'],
      label: string,
    ): SpecialDeck {
      const specialDeckId = deckIdSchema.parse(`deck_${name}_${label}`);
      return {
        visibility,
        deck: {
          deckId: specialDeckId,
          cardIds: [
            addCard(`${name}_${label}_future`, id, {
              zone: 'SPECIAL_DECK',
              playerId: id,
              deckId: specialDeckId,
            }),
          ],
        },
        discard: [
          addCard(`${name}_${label}_discard`, id, {
            zone: 'SPECIAL_DISCARD',
            playerId: id,
            deckId: specialDeckId,
          }),
        ],
      };
    }

    return {
      id,
      seat,
      displayName: `Sample player ${seat + 1}`,
      characterId: characterIdSchema.parse(`character_sample_${seat}`),
      fortitude: 20,
      alcoholContent: seat,
      gold: 10,
      eliminated: false,
      hand: [
        addCard(`${name}_secret_hand_a`, id, { zone: 'HAND', playerId: id }),
        addCard(`${name}_secret_hand_b`, id, { zone: 'HAND', playerId: id }),
      ],
      characterDeck: {
        deckId,
        cardIds: [
          addCard(`${name}_secret_future_a`, id, {
            zone: 'CHARACTER_DECK',
            playerId: id,
            deckId,
          }),
          addCard(`${name}_secret_future_b`, id, {
            zone: 'CHARACTER_DECK',
            playerId: id,
            deckId,
          }),
        ],
      },
      characterDiscard: [
        addCard(`${name}_public_discard`, id, {
          zone: 'CHARACTER_DISCARD',
          playerId: id,
          deckId,
        }),
      ],
      drinkPile: [
        addCard(`${name}_secret_drink`, null, {
          zone: 'DRINK_PILE',
          playerId: id,
        }),
      ],
      special: {
        resources: {
          tokens: { value: 1, visibility: 'PUBLIC' },
          owner_tokens: { value: 71 + seat, visibility: 'OWNER' },
          server_tokens: { value: 991 + seat, visibility: 'SERVER' },
        },
        sideDecks: {
          shared: sideDeck('PUBLIC', 'public_side'),
          personal: sideDeck('OWNER', 'owner_side'),
          internal: sideDeck('SERVER', 'server_side'),
        },
      },
    };
  }

  const players = [makePlayer(0), makePlayer(1)];
  const player0 = players[0]!;
  const player1 = players[1]!;
  const innDeckId = deckIdSchema.parse('deck_inn');
  const innDrinkDeck = {
    deckId: innDeckId,
    cardIds: [
      addCard('inn_secret_future_a', null, {
        zone: 'INN_DRINK_DECK',
        deckId: innDeckId,
      }),
      addCard('inn_secret_future_b', null, {
        zone: 'INN_DRINK_DECK',
        deckId: innDeckId,
      }),
    ],
  };
  const innDrinkDiscard = [
    addCard('inn_public_discard', null, {
      zone: 'INN_DRINK_DISCARD',
      deckId: innDeckId,
    }),
  ];

  return {
    schemaVersion: 1,
    roomId: roomIdSchema.parse('room_sample'),
    matchId: matchIdSchema.parse('match_sample'),
    version: stateVersionSchema.parse(7),
    lifecycle: 'PLAYING',
    phase: 'ACTION',
    activePlayerId: player0.id,
    players,
    cards,
    innDrinkDeck,
    innDrinkDiscard,
    gambling: {
      stage: 'ROUND',
      initiatorPlayerId: player0.id,
      priorityPlayerId: null,
      controlPlayerId: player1.id,
      participants: players.map((player) => player.id),
      passedPlayerIds: [player0.id],
      pot: 2,
      anteAmount: 1,
      contributions: players.map((player) => ({
        playerId: player.id,
        amount: 1,
      })),
      leftPlayerIds: [],
      excludedPlayerIds: [],
      controlSourceCardId: null,
      allowedControlCategories: ['GAMBLING', 'CHEATING'],
      winnerPlayerId: null,
      suspended: {
        resolutionId: resolutionIdSchema.parse('resolution_hidden'),
        activePlayerId: player0.id,
        phase: 'ACTION',
      },
    },
    resolutionStack: [
      {
        id: resolutionIdSchema.parse('resolution_hidden'),
        kind: 'DRINK',
        actorId: player0.id,
        sourceCardId: player0.drinkPile[0]!,
        sourceRevealed: false,
        targetPlayerIds: [player0.id],
        effects: [
          { op: 'CHANGE_STAT', target: 'SELF', stat: 'GOLD', delta: 31337 },
        ],
        nextEffectIndex: 0,
        parentId: null,
        stage: 'OPERATIONS',
        canceled: false,
        ignoredPlayerIds: [],
        window: null,
        continuation: 'RESUME',
        selectedOptionId: null,
      },
      {
        id: resolutionIdSchema.parse('resolution_public'),
        kind: 'CARD',
        actorId: player1.id,
        sourceCardId: player1.characterDiscard[0]!,
        sourceRevealed: true,
        targetPlayerIds: [player0.id],
        effects: [],
        nextEffectIndex: 0,
        parentId: null,
        stage: 'OPERATIONS',
        canceled: false,
        ignoredPlayerIds: [],
        window: null,
        continuation: 'RESUME',
        selectedOptionId: null,
      },
      {
        id: resolutionIdSchema.parse('resolution_system'),
        kind: 'SYSTEM',
        actorId: null,
        sourceCardId: null,
        sourceRevealed: true,
        targetPlayerIds: [],
        effects: [],
        nextEffectIndex: 0,
        parentId: null,
        stage: 'OPERATIONS',
        canceled: false,
        ignoredPlayerIds: [],
        window: null,
        continuation: 'RESUME',
        selectedOptionId: null,
      },
    ],
    responseWindow: {
      id: responseWindowIdSchema.parse('window_sample'),
      kind: 'SOMETIMES',
      resolutionId: resolutionIdSchema.parse('resolution_hidden'),
      eligiblePlayerIds: players.map((player) => player.id),
      passedPlayerIds: [],
      priorityPlayerId: null,
      submittedResponses: [],
      pendingChoice: {
        playerId: player0.id,
        kind: 'OPTION',
        options: [{ id: 'secret-choice', label: 'Private sample option' }],
        min: 1,
        max: 1,
      },
    },
    rng: {
      algorithm: 'MULBERRY32_V1',
      seed: 123456789,
      state: 234567890,
      draws: 5,
    },
    winners: [],
  };
}

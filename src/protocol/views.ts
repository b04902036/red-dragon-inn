import { z } from 'zod';
import { resourceKeySchema } from '../content/effects';
import { MATCH_LIFECYCLES, RESPONSE_KINDS, TURN_PHASES } from '../engine/model';
import {
  cardDefinitionIdSchema,
  cardInstanceIdSchema,
  characterIdSchema,
  matchIdSchema,
  playerIdSchema,
  resolutionIdSchema,
  responseWindowIdSchema,
  roomIdSchema,
} from '../shared/ids';
import { stateVersionSchema } from '../shared/version';
import { timedPromptSchema } from '../engine/timed-prompts';
import { systemEventSchema } from '../content/mechanics';

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const value = z
  .number()
  .int()
  .min(-Number.MAX_SAFE_INTEGER)
  .max(Number.MAX_SAFE_INTEGER);
const playerIds = z.array(playerIdSchema).max(4);
export const publicGamblingViewSchema = z.strictObject({
  stage: z.enum(['ANTE', 'ROUND', 'SETTLING']),
  initiatorPlayerId: playerIdSchema,
  priorityPlayerId: playerIdSchema.nullable(),
  controlPlayerId: playerIdSchema,
  participants: playerIds,
  passedPlayerIds: playerIds,
  leftPlayerIds: playerIds,
  excludedPlayerIds: playerIds,
  pot: count,
  anteAmount: count,
  contributions: z
    .array(z.strictObject({ playerId: playerIdSchema, amount: count }))
    .max(4),
  controlSourceCardId: cardInstanceIdSchema.nullable(),
  allowedControlCategories: z
    .array(z.enum(['GAMBLING', 'CHEATING']))
    .min(1)
    .max(2),
  winnerPlayerId: playerIdSchema.nullable(),
});

export const cardReferenceSchema = z.strictObject({
  id: cardInstanceIdSchema,
  definitionId: cardDefinitionIdSchema,
});
export type CardReference = z.infer<typeof cardReferenceSchema>;
const resources = z.record(resourceKeySchema, value);
const sideDeckCounts = z.record(
  resourceKeySchema,
  z.strictObject({ deckCount: count, discardCount: count }),
);

export const publicPlayerViewSchema = z.strictObject({
  id: playerIdSchema,
  seat: z.number().int().min(0).max(3),
  displayName: z.string().min(1).max(80),
  characterId: characterIdSchema.nullable(),
  fortitude: value,
  alcoholContent: value,
  gold: value,
  eliminated: z.boolean(),
  handCount: count,
  characterDeckCount: count,
  characterDiscardCount: count,
  drinkPileCount: count,
  resources,
  sideDecks: sideDeckCounts,
});

export const publicGameViewSchema = z.strictObject({
  schemaVersion: z.literal(1),
  roomId: roomIdSchema,
  matchId: matchIdSchema.nullable(),
  version: stateVersionSchema,
  attention: z
    .strictObject({
      key: z.string().min(1).max(4000),
      playerId: playerIdSchema,
      kind: z.enum(['TURN', 'RESPONSE', 'CHOICE', 'GAMBLING']),
    })
    .nullable()
    .optional(),
  lifecycle: z.enum(MATCH_LIFECYCLES),
  timedPrompt: timedPromptSchema.nullable().optional(),
  phaseEnd: z
    .strictObject({
      id: responseWindowIdSchema,
      phase: z.enum(TURN_PHASES),
      priorityPlayerId: playerIdSchema.nullable(),
    })
    .nullable()
    .optional(),
  phase: z.enum(TURN_PHASES).nullable(),
  activePlayerId: playerIdSchema.nullable(),
  players: z.array(publicPlayerViewSchema).max(4),
  innDrinkDeckCount: count,
  innDrinkDiscardCount: count,
  gambling: publicGamblingViewSchema.nullable(),
  resolutionStack: z.array(
    z.strictObject({
      id: resolutionIdSchema,
      kind: z.enum(['CARD', 'DRINK', 'DRINK_EVENT', 'SYSTEM']),
      actorId: playerIdSchema.nullable(),
      sourceCard: cardReferenceSchema.nullable(),
      sourceCards: z.array(cardReferenceSchema).max(32).optional(),
      opportunity: systemEventSchema.optional(),
      drinkRecipientId: playerIdSchema.optional(),
      revealedDrinks: z
        .array(
          z.strictObject({
            playerId: playerIdSchema,
            cards: z.array(cardReferenceSchema).max(32),
          }),
        )
        .max(8)
        .optional(),
      targetPlayerIds: playerIds,
    }),
  ),
  responseWindow: z
    .strictObject({
      id: responseWindowIdSchema,
      kind: z.enum(RESPONSE_KINDS),
      resolutionId: resolutionIdSchema,
      eligiblePlayerIds: playerIds,
      passedPlayerIds: playerIds,
      priorityPlayerId: playerIdSchema.nullable(),
      submittedResponses: z.array(resolutionIdSchema),
      choicePlayerId: playerIdSchema.nullable(),
    })
    .nullable(),
  winners: playerIds,
});

export type PublicGameView = z.infer<typeof publicGameViewSchema>;

export const legalResponseSchema = z.strictObject({
  cardId: cardInstanceIdSchema,
  commandType: z.literal('PLAY_RESPONSE'),
  requiresTarget: z.boolean(),
  legalTargetPlayerIds: playerIds,
});
export const legalPlaySchema = legalResponseSchema.extend({
  commandType: z.enum(['PLAY_CARD', 'PLAY_RESPONSE', 'GAMBLING_PLAY']),
  promptId: z.string().min(1).max(128).optional(),
});

export const privatePlayerViewSchema = z.strictObject({
  schemaVersion: z.literal(1),
  roomId: roomIdSchema,
  matchId: matchIdSchema.nullable(),
  version: stateVersionSchema,
  playerId: playerIdSchema,
  hand: z.array(cardReferenceSchema),
  legalPlayVersion: stateVersionSchema.optional(),
  legalPlays: z.array(legalPlaySchema).default([]),
  responsePrompt: timedPromptSchema
    .safeExtend({ hasLegalSometimes: z.boolean() })
    .nullable()
    .optional(),
  legalAnytime: z.array(legalResponseSchema).default([]),
  legalResponses: z.array(legalResponseSchema).default([]),
  resources,
  sideDecks: sideDeckCounts,
  pendingChoice: z
    .strictObject({
      responseWindowId: responseWindowIdSchema,
      kind: z.enum(['TARGET', 'OPTION', 'CARD']),
      options: z.array(
        z.strictObject({
          id: z.string().min(1).max(128),
          label: z.string().max(500),
        }),
      ),
      min: count,
      max: count,
    })
    .nullable(),
});

export type PrivatePlayerView = z.infer<typeof privatePlayerViewSchema>;

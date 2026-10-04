import { z } from 'zod';
import { MATCH_LIFECYCLES, RESPONSE_KINDS, TURN_PHASES } from '../engine/model';
import {
  cardDefinitionIdSchema,
  cardInstanceIdSchema,
  commandIdSchema,
  eventIdSchema,
  matchIdSchema,
  playerIdSchema,
  resolutionIdSchema,
  responseWindowIdSchema,
  roomIdSchema,
  contentVersionIdSchema,
  deckIdSchema,
} from '../shared/ids';
import { stateVersionSchema } from '../shared/version';
import { rulesConfigSchema } from '../engine/rules';
import { timedPromptSchema } from '../engine/timed-prompts';

const eventFields = {
  eventId: eventIdSchema,
  commandId: commandIdSchema,
  roomId: roomIdSchema,
  matchId: matchIdSchema.nullable(),
  stateVersion: stateVersionSchema,
  // All events from one accepted command share a version and have ordered indexes.
  eventIndex: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
};
const ids = z.array(cardInstanceIdSchema).max(64);
const players = z.array(playerIdSchema).max(4);
const integer = z
  .number()
  .int()
  .min(-Number.MAX_SAFE_INTEGER)
  .max(Number.MAX_SAFE_INTEGER);
const statFields = { playerId: playerIdSchema, delta: integer, value: integer };
const controlCategories = z
  .array(z.enum(['GAMBLING', 'CHEATING']))
  .min(1)
  .max(2);

/** Append-only internal events can contain hidden data; they are not socket messages. */
export const domainEventSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('WORKFLOW_CHANGED'),
    ...eventFields,
    resolutionId: resolutionIdSchema,
    operation: z
      .string()
      .regex(/^[A-Z_]+$/)
      .max(64),
    playerId: playerIdSchema.nullable(),
    amount: integer,
  }),
  z.strictObject({
    type: z.literal('DRINK_CONTEST_ROUND'),
    ...eventFields,
    resolutionId: resolutionIdSchema,
    round: z.number().int().min(1).max(256),
    scores: z
      .array(
        z.strictObject({
          playerId: playerIdSchema,
          score: integer.nonnegative(),
        }),
      )
      .min(1)
      .max(4),
  }),
  z.strictObject({
    type: z.literal('TIMED_PROMPT_OPENED'),
    ...eventFields,
    ...timedPromptSchema.shape,
  }),
  z.strictObject({
    type: z.literal('TIMED_PROMPT_EXPIRED'),
    ...eventFields,
    promptId: z.string().min(1).max(128),
    expiredAt: z.number().int().nonnegative().safe(),
  }),
  z.strictObject({
    type: z.literal('PHASE_END_WINDOW_OPENED'),
    ...eventFields,
    windowId: responseWindowIdSchema,
    phase: z.enum(TURN_PHASES),
  }),
  z.strictObject({
    type: z.literal('PHASE_END_WINDOW_CLOSED'),
    ...eventFields,
    windowId: responseWindowIdSchema,
  }),
  z.strictObject({
    type: z.literal('ANYTIME_PASSED'),
    ...eventFields,
    windowId: responseWindowIdSchema,
    playerId: playerIdSchema,
  }),
  z.strictObject({
    type: z.literal('DRINK_EMPTY'),
    ...eventFields,
    playerId: playerIdSchema,
    rule: z.enum(['SOBER', 'SKIP']),
  }),
  z.strictObject({
    type: z.literal('DRINK_CHAIN_STOPPED'),
    ...eventFields,
    resolutionId: resolutionIdSchema,
    reason: z.enum(['EMPTY_SOURCE', 'EVENT', 'LIMIT']),
  }),
  z.strictObject({
    type: z.literal('DRINK_EVENT_DISCARDED'),
    ...eventFields,
    playerId: playerIdSchema,
    cardId: cardInstanceIdSchema,
    context: z.enum(['CHASER', 'SOURCE_SELECTION']),
  }),
  z.strictObject({
    type: z.literal('DRINK_QUEUED'),
    ...eventFields,
    playerId: playerIdSchema,
    resolutionId: resolutionIdSchema,
    cardIds: ids,
    kind: z.enum(['DRINK', 'DRINK_EVENT']),
  }),
  z.strictObject({
    type: z.literal('DRINK_DISCARDED'),
    ...eventFields,
    resolutionId: resolutionIdSchema,
    cardIds: ids,
  }),
  z.strictObject({
    type: z.literal('DRINK_MODIFIED'),
    ...eventFields,
    resolutionId: resolutionIdSchema,
    alcoholDelta: integer,
    fortitudeDelta: integer,
  }),
  z.strictObject({
    type: z.literal('ELIMINATION_CHECKED'),
    ...eventFields,
    playerIds: players,
  }),
  z.strictObject({
    type: z.literal('GOLD_REDISTRIBUTED'),
    ...eventFields,
    playerId: playerIdSchema,
    amount: integer.nonnegative(),
    innGold: integer.nonnegative(),
    payments: z
      .array(
        z.strictObject({
          playerId: playerIdSchema,
          amount: integer.nonnegative(),
        }),
      )
      .max(4),
  }),
  z.strictObject({
    type: z.literal('ELIMINATION_CHECK_REQUESTED'),
    ...eventFields,
    playerId: playerIdSchema,
    reason: z.enum(['BROKE', 'PASSED_OUT']),
  }),
  z.strictObject({
    type: z.literal('GAMBLING_START_CANCELED'),
    ...eventFields,
    resolutionId: resolutionIdSchema,
    reason: z.enum(['NOT_ELIGIBLE', 'GOLD_CAPACITY']),
  }),
  z.strictObject({
    type: z.literal('GAMBLING_ANTE_PAID'),
    ...eventFields,
    playerId: playerIdSchema,
    amount: integer.positive(),
  }),
  z.strictObject({
    type: z.literal('GAMBLING_STARTED'),
    ...eventFields,
    initiatorPlayerId: playerIdSchema,
    controlPlayerId: playerIdSchema,
    participants: players.min(1),
    excludedPlayerIds: players,
    anteAmount: integer.positive(),
    pot: integer.nonnegative(),
    resolutionId: resolutionIdSchema,
  }),
  z.strictObject({
    type: z.literal('GAMBLING_PRIORITY_CHANGED'),
    ...eventFields,
    priorityPlayerId: playerIdSchema.nullable(),
  }),
  z.strictObject({
    type: z.literal('GAMBLING_CONTROL_CHANGED'),
    ...eventFields,
    playerId: playerIdSchema,
    cardId: cardInstanceIdSchema.nullable(),
    allowedControlCategories: controlCategories,
  }),
  z.strictObject({
    type: z.literal('GAMBLING_WIN_REQUESTED'),
    ...eventFields,
    playerId: playerIdSchema,
    resolutionId: resolutionIdSchema,
  }),
  z.strictObject({
    type: z.literal('GAMBLING_PLAYER_LEFT'),
    ...eventFields,
    playerId: playerIdSchema,
  }),
  z.strictObject({
    type: z.literal('GAMBLING_LEAVE_SKIPPED'),
    ...eventFields,
    playerId: playerIdSchema,
  }),
  z.strictObject({
    type: z.literal('GAMBLING_PASSED'),
    ...eventFields,
    playerId: playerIdSchema,
  }),
  z.strictObject({
    type: z.literal('GAMBLING_FINISHED'),
    ...eventFields,
    winnerPlayerId: playerIdSchema,
    pot: integer.nonnegative(),
    reason: z.enum(['IMMEDIATE_WIN', 'ALL_PASSED']),
  }),
  z.strictObject({
    type: z.literal('MATCH_CONFIGURED'),
    ...eventFields,
    contentVersionId: contentVersionIdSchema,
    rngSeed: z.number().int().min(0).max(0xffffffff),
    rules: rulesConfigSchema,
  }),
  z.strictObject({
    type: z.literal('PLAYER_STATS_INITIALIZED'),
    ...eventFields,
    playerId: playerIdSchema,
    fortitude: integer,
    alcoholContent: integer,
    gold: integer.nonnegative(),
  }),
  z.strictObject({
    type: z.literal('DECK_SHUFFLED'),
    ...eventFields,
    deckId: deckIdSchema,
    playerId: playerIdSchema.nullable(),
    reason: z.enum(['INITIAL', 'EXHAUSTED']),
    cardIds: z.array(cardInstanceIdSchema).max(256),
  }),
  z.strictObject({
    type: z.literal('DRINK_DEALT'),
    ...eventFields,
    playerId: playerIdSchema,
    cardIds: ids,
  }),
  z.strictObject({
    type: z.literal('DRAW_SHORTFALL'),
    ...eventFields,
    playerId: playerIdSchema,
    requested: z.number().int().min(1).max(64),
    drawn: z.number().int().min(0).max(64),
  }),
  z.strictObject({
    type: z.literal('DRINK_ORDER_SKIPPED'),
    ...eventFields,
    playerId: playerIdSchema,
    targetPlayerId: playerIdSchema,
    reason: z.literal('EMPTY_INN'),
  }),
  z.strictObject({
    type: z.literal('TURN_STARTED'),
    ...eventFields,
    playerId: playerIdSchema,
    turnNumber: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  }),
  z.strictObject({
    type: z.literal('ACTION_QUEUED'),
    ...eventFields,
    playerId: playerIdSchema,
    cardId: cardInstanceIdSchema,
    resolutionId: resolutionIdSchema,
    targetPlayerIds: players,
  }),
  z.strictObject({
    type: z.literal('PLAYER_JOINED'),
    ...eventFields,
    playerId: playerIdSchema,
    seat: z.number().int().min(0).max(3),
    displayName: z.string().min(1).max(80),
  }),
  z.strictObject({
    type: z.literal('MATCH_STARTED'),
    ...eventFields,
    matchId: matchIdSchema,
    playerIds: players.min(2),
    activePlayerId: playerIdSchema,
  }),
  z.strictObject({
    type: z.literal('CARDS_DISCARDED'),
    ...eventFields,
    playerId: playerIdSchema,
    cardIds: ids,
  }),
  z.strictObject({
    type: z.literal('CARDS_DRAWN'),
    ...eventFields,
    playerId: playerIdSchema,
    cardIds: ids,
  }),
  z.strictObject({
    type: z.literal('CARD_PLAYED'),
    ...eventFields,
    playerId: playerIdSchema,
    cardId: cardInstanceIdSchema,
    definitionId: cardDefinitionIdSchema,
  }),
  z.strictObject({
    type: z.literal('RESPONSE_WINDOW_OPENED'),
    ...eventFields,
    responseWindowId: responseWindowIdSchema,
    resolutionId: resolutionIdSchema,
    kind: z.enum(RESPONSE_KINDS),
    eligiblePlayerIds: players,
    priorityPlayerId: playerIdSchema,
  }),
  z.strictObject({
    type: z.literal('RESPONSE_PASSED'),
    ...eventFields,
    playerId: playerIdSchema,
    responseWindowId: responseWindowIdSchema,
  }),
  z.strictObject({
    type: z.literal('EFFECT_RESOLVED'),
    ...eventFields,
    resolutionId: resolutionIdSchema,
    effectIndex: z.number().int().nonnegative(),
  }),
  z.strictObject({
    type: z.literal('DRINK_ORDERED'),
    ...eventFields,
    playerId: playerIdSchema,
    targetPlayerId: playerIdSchema,
    cardId: cardInstanceIdSchema,
  }),
  z.strictObject({
    type: z.literal('DRINK_REVEALED'),
    ...eventFields,
    playerId: playerIdSchema,
    cardId: cardInstanceIdSchema,
    definitionId: cardDefinitionIdSchema,
  }),
  z.strictObject({
    type: z.literal('GOLD_CHANGED'),
    ...eventFields,
    ...statFields,
  }),
  z.strictObject({
    type: z.literal('FORTITUDE_CHANGED'),
    ...eventFields,
    ...statFields,
  }),
  z.strictObject({
    type: z.literal('ALCOHOL_CHANGED'),
    ...eventFields,
    ...statFields,
  }),
  z.strictObject({
    type: z.literal('PHASE_CHANGED'),
    ...eventFields,
    phase: z.enum(TURN_PHASES),
    activePlayerId: playerIdSchema,
  }),
  z.strictObject({
    type: z.literal('PLAYER_ELIMINATED'),
    ...eventFields,
    playerId: playerIdSchema,
    reason: z.enum(['PASSED_OUT', 'BROKE']),
  }),
  z.strictObject({
    type: z.literal('MATCH_FINISHED'),
    ...eventFields,
    winnerIds: players,
  }),
  z.strictObject({
    type: z.literal('LIFECYCLE_CHANGED'),
    ...eventFields,
    lifecycle: z.enum(MATCH_LIFECYCLES),
  }),
  z.strictObject({
    type: z.literal('RESPONSE_PRIORITY_CHANGED'),
    ...eventFields,
    responseWindowId: responseWindowIdSchema,
    priorityPlayerId: playerIdSchema,
  }),
  z.strictObject({
    type: z.literal('RESPONSE_WINDOW_CLOSED'),
    ...eventFields,
    responseWindowId: responseWindowIdSchema,
    reason: z.enum([
      'ALL_PASSED',
      'CANCELED',
      'CHOICE_COMPLETED',
      'REEVALUATED',
    ]),
  }),
  z.strictObject({
    type: z.literal('RESPONSE_SUBMITTED'),
    ...eventFields,
    responseWindowId: responseWindowIdSchema,
    playerId: playerIdSchema,
    resolutionId: resolutionIdSchema,
  }),
  z.strictObject({
    type: z.literal('RESOLUTION_STARTED'),
    ...eventFields,
    resolutionId: resolutionIdSchema,
    parentId: resolutionIdSchema.nullable(),
    cardId: cardInstanceIdSchema.nullable(),
    playerId: playerIdSchema,
  }),
  z.strictObject({
    type: z.literal('RESOLUTION_COMPLETED'),
    ...eventFields,
    resolutionId: resolutionIdSchema,
    canceled: z.boolean(),
  }),
  z.strictObject({
    type: z.literal('SOURCE_IGNORED'),
    ...eventFields,
    resolutionId: resolutionIdSchema,
    playerId: playerIdSchema,
  }),
  z.strictObject({
    type: z.literal('SOURCE_NEGATED'),
    ...eventFields,
    resolutionId: resolutionIdSchema,
    byResolutionId: resolutionIdSchema,
  }),
  z.strictObject({
    type: z.literal('PENDING_EFFECT_MODIFIED'),
    ...eventFields,
    resolutionId: resolutionIdSchema,
    effectIndex: z.number().int().min(0).max(31),
    delta: integer,
  }),
  z.strictObject({
    type: z.literal('CHOICE_OPENED'),
    ...eventFields,
    resolutionId: resolutionIdSchema,
    responseWindowId: responseWindowIdSchema,
    playerId: playerIdSchema,
    kind: z.enum(['TARGET', 'OPTION', 'CARD']),
  }),
  z.strictObject({
    type: z.literal('CHOICE_SELECTED'),
    ...eventFields,
    resolutionId: resolutionIdSchema,
    playerId: playerIdSchema,
    selections: z.array(z.string().min(1).max(128)).min(1).max(64),
  }),
  z.strictObject({
    type: z.literal('RESOURCE_CHANGED'),
    ...eventFields,
    playerId: playerIdSchema,
    resource: z.string().regex(/^[a-z][a-z0-9_]{0,31}$/),
    delta: integer,
    value: integer,
  }),
  z.strictObject({
    type: z.literal('GAMBLING_REQUESTED'),
    ...eventFields,
    playerId: playerIdSchema,
    resolutionId: resolutionIdSchema,
  }),
]);

export type DomainEvent = z.infer<typeof domainEventSchema>;

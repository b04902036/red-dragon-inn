import { z } from 'zod';
import {
  matchIdSchema,
  playerIdSchema,
  cardDefinitionIdSchema,
  resolutionIdSchema,
} from '../shared/ids';
import { stateVersionSchema } from '../shared/version';
import { TURN_PHASES } from '../engine/model';
const integer = z.number().int().safe();
const sequence = integer.positive();
const players = z.array(playerIdSchema).max(4);
const cause = {
  resolutionId: resolutionIdSchema.nullable(),
  parentId: resolutionIdSchema.nullable(),
};
const base = {
  id: z.string().min(1).max(160),
  matchId: matchIdSchema,
  sequence,
  stateVersion: stateVersionSchema,
  eventIndex: integer.nonnegative(),
};
export const narrationRelationSchema = z.enum([
  'RESPONDS_TO',
  'NEGATES',
  'IGNORES',
  'MODIFIES',
  'REDIRECTS',
]);
/** Public typed history, never a raw DomainEvent or a gameplay-state authority. */
export const publicNarrationEventSchema = z
  .discriminatedUnion('type', [
    z.strictObject({
      ...base,
      ...cause,
      type: z.literal('CHALLENGE_DECIDED'),
      playerId: playerIdSchema,
      accepted: z.boolean(),
    }),
    z.strictObject({
      ...base,
      type: z.literal('MATCH_STARTED'),
      playerIds: players,
      activePlayerId: playerIdSchema,
    }),
    z.strictObject({
      ...base,
      type: z.literal('TURN_STARTED'),
      playerId: playerIdSchema,
      turnNumber: integer.positive(),
    }),
    z.strictObject({
      ...base,
      type: z.literal('PHASE_CHANGED'),
      playerId: playerIdSchema,
      phase: z.enum(TURN_PHASES),
    }),
    z.strictObject({
      ...base,
      type: z.literal('MATCH_FINISHED'),
      winnerIds: players,
    }),
    z.strictObject({
      ...base,
      type: z.literal('PLAYER_ELIMINATED'),
      playerId: playerIdSchema,
      reason: z.enum(['BROKE', 'PASSED_OUT']),
    }),
    z.strictObject({
      ...base,
      ...cause,
      type: z.literal('CHARACTER_CARDS_DRAWN'),
      playerId: playerIdSchema,
      count: integer.nonnegative().max(64),
    }),
    z.strictObject({
      ...base,
      ...cause,
      type: z.literal('CHARACTER_CARDS_DISCARDED'),
      playerId: playerIdSchema,
      count: integer.nonnegative().max(64),
    }),
    z.strictObject({
      ...base,
      ...cause,
      type: z.literal('CARD_PLAYED'),
      playerId: playerIdSchema,
      cardDefinitionId: cardDefinitionIdSchema,
      targetPlayerIds: players,
      responseRelation: narrationRelationSchema.nullable(),
    }),
    z.strictObject({
      ...base,
      type: z.literal('RESOLUTION_STARTED'),
      resolutionId: resolutionIdSchema,
      parentId: resolutionIdSchema.nullable(),
      playerId: playerIdSchema,
    }),
    z.strictObject({
      ...base,
      type: z.literal('RESOLUTION_COMPLETED'),
      resolutionId: resolutionIdSchema,
      parentId: resolutionIdSchema.nullable(),
      canceled: z.boolean(),
    }),
    z.strictObject({
      ...base,
      type: z.literal('RELATION_RESOLVED'),
      relation: narrationRelationSchema,
      sourceResolutionId: resolutionIdSchema.nullable(),
      targetResolutionId: resolutionIdSchema,
      playerId: playerIdSchema.nullable(),
    }),
    z.strictObject({
      ...base,
      ...cause,
      type: z.literal('DRINK_ORDERED'),
      playerId: playerIdSchema,
      targetPlayerId: playerIdSchema,
      count: integer.positive().max(64),
    }),
    z.strictObject({
      ...base,
      ...cause,
      type: z.literal('DRINK_DEALT'),
      playerId: playerIdSchema,
      count: integer.positive().max(64),
    }),
    z.strictObject({
      ...base,
      ...cause,
      type: z.literal('DRINK_REVEALED'),
      playerId: playerIdSchema,
      cardDefinitionId: cardDefinitionIdSchema,
      chainRole: z.enum(['BASE', 'CHASER', 'LEGACY']),
      hasChaser: z.boolean().nullable(),
      chainPosition: integer.nonnegative().max(64).nullable(),
      source: z.enum(['INN', 'DRINK_PILE']).nullable(),
    }),
    z.strictObject({
      ...base,
      ...cause,
      type: z.literal('DRINK_CHAIN_STOPPED'),
      reason: z.enum(['EMPTY_SOURCE', 'EVENT', 'LIMIT']),
    }),
    z.strictObject({
      ...base,
      ...cause,
      type: z.literal('DRINK_EMPTY'),
      playerId: playerIdSchema,
    }),
    z.strictObject({
      ...base,
      ...cause,
      type: z.literal('DRINK_MODIFIED'),
      sourceResolutionId: resolutionIdSchema.nullable(),
      alcoholDelta: integer,
      fortitudeDelta: integer,
    }),
    z.strictObject({
      ...base,
      ...cause,
      type: z.literal('EFFECT_MODIFIED'),
      sourceResolutionId: resolutionIdSchema.nullable(),
      effectIndex: integer.nonnegative().max(31),
      delta: integer,
    }),
    z.strictObject({
      ...base,
      ...cause,
      type: z.literal('DRINK_EVENT_DISCARDED'),
      playerId: playerIdSchema,
      cardDefinitionId: cardDefinitionIdSchema,
      context: z.enum(['CHASER', 'SOURCE_SELECTION']),
    }),
    z.strictObject({
      ...base,
      ...cause,
      type: z.literal('PRIORITY_PASSED'),
      playerId: playerIdSchema,
      kind: z.enum(['RESPONSE', 'PHASE_END']),
    }),
    z.strictObject({
      ...base,
      ...cause,
      type: z.literal('GOLD_REDISTRIBUTED'),
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
      ...base,
      ...cause,
      type: z.literal('GAMBLING_WINNER_PENDING'),
      playerId: playerIdSchema,
    }),
    z.strictObject({
      ...base,
      ...cause,
      type: z.literal('STAT_CHANGED'),
      playerId: playerIdSchema,
      stat: z.enum(['FORTITUDE', 'ALCOHOL', 'GOLD']),
      before: integer,
      after: integer,
      delta: integer,
    }),
    z.strictObject({
      ...base,
      ...cause,
      type: z.literal('RESOURCE_CHANGED'),
      playerId: playerIdSchema,
      resource: z.string().regex(/^[a-z][a-z0-9_]{0,31}$/),
      before: integer,
      after: integer,
      delta: integer,
    }),
    z.strictObject({
      ...base,
      ...cause,
      type: z.literal('GAMBLING_STARTED'),
      playerId: playerIdSchema,
      participants: players,
      ante: integer.positive(),
      pot: integer.nonnegative(),
    }),
    z.strictObject({
      ...base,
      ...cause,
      type: z.literal('GAMBLING_ANTE'),
      playerId: playerIdSchema,
      amount: integer.positive(),
    }),
    z.strictObject({
      ...base,
      ...cause,
      type: z.literal('GAMBLING_RAISED'),
      playerId: playerIdSchema,
      amount: integer.positive(),
    }),
    z.strictObject({
      ...base,
      ...cause,
      type: z.literal('PAYMENT_SETTLED'),
      playerId: playerIdSchema,
      recipientPlayerId: playerIdSchema.nullable(),
      destination: z.enum(['POT', 'INN', 'PLAYER']),
      amount: integer.nonnegative(),
      payerAmount: integer.nonnegative(),
      innSubstitution: integer.nonnegative(),
    }),
    z.strictObject({
      ...base,
      ...cause,
      type: z.literal('GAMBLING_CONTROL_CHANGED'),
      playerId: playerIdSchema,
      allowedControlCategories: z
        .array(z.enum(['GAMBLING', 'CHEATING']))
        .min(1)
        .max(2),
    }),
    z.strictObject({
      ...base,
      ...cause,
      type: z.literal('GAMBLING_PASSED'),
      playerId: playerIdSchema,
    }),
    z.strictObject({
      ...base,
      ...cause,
      type: z.literal('GAMBLING_PLAYER_LEFT'),
      playerId: playerIdSchema,
    }),
    z.strictObject({
      ...base,
      ...cause,
      type: z.literal('GAMBLING_PAYOUT'),
      playerId: playerIdSchema,
      amount: integer.nonnegative(),
      destination: z.enum(['WINNER', 'INN']),
    }),
    z.strictObject({
      ...base,
      ...cause,
      type: z.literal('CONTEST_ROUND_STARTED'),
      round: integer.positive().max(256),
      playerIds: players,
    }),
    z.strictObject({
      ...base,
      ...cause,
      type: z.literal('CONTEST_RESULT'),
      round: integer.positive().max(256),
      scores: z
        .array(
          z.strictObject({
            playerId: playerIdSchema,
            score: integer.nonnegative(),
          }),
        )
        .min(1)
        .max(4),
      highestScore: integer.nonnegative(),
      winnerIds: players,
    }),
    z.strictObject({
      ...base,
      ...cause,
      type: z.literal('PUBLIC_EFFECT_CHANGED'),
      operation: z.enum([
        'PASS_CURRENT_DRINK',
        'SPLIT_CURRENT_DRINK',
        'REPLACE_DRINK_ALCOHOL_WITH_FORTITUDE',
        'REPLACE_DRINK_BASE',
        'SHARE_FORTITUDE_LOSS',
        'REDIRECT_FORTITUDE_LOSS',
        'OPTIONAL_DRINK_CHALLENGE',
        'APPLY_DRINK_SPLIT_CHOICE',
        'ORDER_EXTRA_DRINKS',
        'RESTART_GAMBLING_ROUND',
        'CONTEST_WINNER',
        'CONTEST_NO_WINNER',
        'CHALLENGE_SURVIVAL',
        'POT_TO_INN',
      ]),
      playerId: playerIdSchema.nullable(),
      amount: integer,
    }),
  ])
  .refine(
    (event) => event.id === `${event.matchId}:${event.sequence}`,
    'Invalid narration identity',
  );
export type PublicNarrationEvent = z.infer<typeof publicNarrationEventSchema>;
export type NarrationRelation = z.infer<typeof narrationRelationSchema>;
export const publicTimelineBatchSchema = z
  .strictObject({
    type: z.literal('PUBLIC_TIMELINE'),
    matchId: matchIdSchema,
    firstSequence: sequence,
    lastSequence: sequence,
    mode: z.enum(['LIVE', 'HISTORY']),
    events: z.array(publicNarrationEventSchema).max(50),
  })
  .superRefine((batch, ctx) => {
    let previous = batch.firstSequence - 1;
    if (batch.lastSequence < batch.firstSequence)
      ctx.addIssue({ code: 'custom', message: 'Invalid timeline range' });
    for (const event of batch.events) {
      if (
        event.matchId !== batch.matchId ||
        event.sequence <= previous ||
        event.sequence > batch.lastSequence
      )
        ctx.addIssue({ code: 'custom', message: 'Invalid timeline ordering' });
      previous = event.sequence;
    }
  });
export type PublicTimelineBatch = z.infer<typeof publicTimelineBatchSchema>;

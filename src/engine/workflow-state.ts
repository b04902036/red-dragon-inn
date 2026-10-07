import { z } from 'zod';
import { effectSchema } from '../content/effects';
import {
  cardInstanceIdSchema,
  playerIdSchema,
  resolutionIdSchema,
} from '../shared/ids';

const player = playerIdSchema;
const positive = z.number().int().min(1).safe();
const players = z
  .array(player)
  .min(1)
  .max(4)
  .refine((ids) => new Set(ids).size === ids.length);
export const workflowTaskSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('FORCED_DRINK'), actorId: player }),
  z.strictObject({
    kind: z.literal('PAYMENT'),
    purpose: z.enum(['ANTE', 'PAYMENT', 'REFILL']),
    payer: player,
    amount: positive,
    substituted: z.number().int().nonnegative().safe(),
    prevented: z.boolean().optional(),
    preventionAllowed: z.boolean().optional(),
    canceled: z.boolean(),
    destination: z.enum(['POT', 'INN', 'PLAYER']),
    recipient: player.nullable(),
    full: z.boolean(),
  }),
  z.strictObject({ kind: z.literal('GAMBLING_READY') }),
  z.strictObject({
    kind: z.literal('CHECKPOINT'),
    afterFinalPass: z.boolean(),
    anteAvoidance: z.boolean(),
    sourceEndsRound: z.boolean(),
  }),
  z.strictObject({
    kind: z.literal('SETTLEMENT'),
    winner: player,
    toInn: z.boolean(),
    restarted: z.boolean().optional(),
  }),
  z.strictObject({
    kind: z.literal('POST_LOSS'),
    affected: player,
    amount: z.number().int().min(1).safe(),
    originalPlayer: player.nullable(),
    originalCard: cardInstanceIdSchema.nullable(),
    sourceKind: z.enum(['CARD', 'DRINK', 'DRINK_EVENT', 'SYSTEM']).optional(),
    effectIndex: z.number().int().min(0).max(31).optional(),
    playedReduction: z.boolean().optional(),
    playedIgnore: z.boolean().optional(),
  }),
  z.strictObject({
    kind: z.literal('PHASE'),
    phase: z.enum(['ORDER_DRINK', 'DRINK']),
    normalOrderComplete: z.boolean(),
  }),
  z.strictObject({
    kind: z.literal('DRINK_BATCH'),
    mode: z.enum(['SIMULTANEOUS', 'CONTEST', 'HOUSE']),
    source: z.enum(['INN', 'DRINK_PILE']).optional(),
    contestRules: z
      .strictObject({
        drinkEvents: z.literal('IGNORE'),
        scoring: z.literal('REVEALED_WITH_MODIFIERS'),
        settlement: z.literal('AFTER_CONTEST'),
      })
      .optional(),
    passedOutPlayerIds: z.array(player).max(4).optional(),
    participants: players,
    scores: z
      .array(
        z.strictObject({
          playerId: player,
          score: z.number().int().min(0).safe(),
        }),
      )
      .max(4),
    round: z.number().int().min(0).max(256),
    initialized: z.boolean(),
    deferDrinkConsumption: z.boolean().optional(),
    consumingDrinks: z.boolean().optional(),
    payForRefill: z.boolean().optional(),
    skipLeadingEvents: z.boolean().optional(),
  }),
  z.strictObject({
    kind: z.literal('CHALLENGE'),
    actorId: player,
    remaining: z.number().int().min(0).max(2),
    stage: z.enum(['DRINKS', 'SURVIVAL', 'PAYOUT']),
  }),
]);
export type WorkflowTask = z.infer<typeof workflowTaskSchema>;
export const drinkWorkSchema = z.strictObject({
  id: resolutionIdSchema,
  actorId: player,
  sourceCardIds: z.array(cardInstanceIdSchema).max(32),
  provenanceCardIds: z.array(cardInstanceIdSchema).max(32),
  kind: z.enum(['DRINK', 'DRINK_EVENT']),
  effects: z.array(effectSchema).max(32),
  score: z.number().int().min(0).safe(),
  alcoholAsFortitude: z.boolean(),
  contestScore: z.number().int().safe().optional(),
  responseComplete: z.boolean().optional(),
  canceled: z.boolean().optional(),
  ignoredPlayerIds: z.array(player).max(4).optional(),
  drinkRecipientId: player.optional(),
  afterTasks: z.array(workflowTaskSchema).max(8).optional(),
  builtInSplitAvailable: z.boolean().optional(),
  noExternalSplit: z.boolean().optional(),
  drinkBase: z
    .strictObject({
      alcohol: z.number().int().safe(),
      fortitude: z.number().int().safe(),
    })
    .optional(),
});
export type DrinkWork = z.infer<typeof drinkWorkSchema>;
export function taskEvent(task: WorkflowTask | undefined) {
  switch (task?.kind) {
    case 'PAYMENT':
      return task.purpose === 'REFILL'
        ? ('DRINK_DECK_REFILL_PAYMENT' as const)
        : task.purpose === 'ANTE'
          ? ('ANTE_REQUIRED' as const)
          : ('PAYMENT_REQUIRED' as const);
    case 'CHECKPOINT':
      return 'GAMBLING_CHECKPOINT' as const;
    case 'SETTLEMENT':
      return task.toInn || task.restarted
        ? null
        : ('GAMBLING_WIN_BEFORE_PAYOUT' as const);
    case 'POST_LOSS':
      return 'FORTITUDE_LOSS_RESOLVED' as const;
    case 'PHASE':
      return 'PHASE_OPPORTUNITY' as const;
    case 'CHALLENGE':
      return task.stage === 'SURVIVAL' ? ('CHALLENGE_SURVIVAL' as const) : null;
    default:
      return null;
  }
}

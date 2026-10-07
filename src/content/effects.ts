import { z } from 'zod';

export const resourceKeySchema = z.string().regex(/^[a-z][a-z0-9_]{0,31}$/);
export const effectTargetSchema = z.enum([
  'SELF',
  'CHOSEN_PLAYER',
  'EACH_OTHER_PLAYER',
  'ALL_PLAYERS',
  'ORIGINAL_SOURCE_PLAYER',
  'SOURCE_ACTOR',
]);
const deltaSchema = z
  .number()
  .int()
  .min(-Number.MAX_SAFE_INTEGER)
  .max(Number.MAX_SAFE_INTEGER);

// The key selects a server-owned handler; params are data, never executable code.
export const resourceAdjustmentParamsSchema = z.strictObject({
  resource: resourceKeySchema,
  delta: deltaSchema,
});
export const registeredEffectKeySchema = z.enum([
  'sample.adjust-resource',
  'core.adjust-resource',
]);
export const registeredSpecialRuleKeySchema = z.enum([
  'sample.resources',
  'core.resources',
]);

export const effectSchema = z.discriminatedUnion('op', [
  z.strictObject({
    op: z.literal('CHANGE_STAT'),
    target: effectTargetSchema,
    stat: z.enum(['FORTITUDE', 'ALCOHOL', 'GOLD']),
    delta: deltaSchema,
    allowGoldLossPrevention: z.boolean().optional(),
  }),
  z.strictObject({
    op: z.literal('DRAW_CARDS'),
    target: effectTargetSchema,
    count: z.number().int().min(1).max(64),
  }),
  z.strictObject({
    op: z.literal('IGNORE'),
    scope: z.literal('CURRENT_EFFECT'),
  }),
  z.strictObject({ op: z.literal('NEGATE'), scope: z.literal('TOP_STACK') }),
  z.strictObject({
    op: z.literal('TRANSFER_GOLD'),
    target: effectTargetSchema,
    amount: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    allowGoldLossPrevention: z.boolean().optional(),
  }),
  z.strictObject({
    op: z.literal('PAY_INN'),
    target: effectTargetSchema,
    amount: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    requireFullPayment: z.boolean().optional(),
    allowGoldLossPrevention: z.boolean().optional(),
  }),
  z.strictObject({
    op: z.literal('DISCARD_CARDS'),
    target: effectTargetSchema,
    count: z.number().int().min(1).max(64),
  }),
  z.strictObject({
    op: z.literal('OPEN_CHOICE'),
    target: effectTargetSchema,
    kind: z.literal('TARGET'),
  }),
  z.strictObject({
    op: z.literal('OPEN_OPTION'),
    target: effectTargetSchema,
    options: z
      .array(
        z.strictObject({
          id: z.string().min(1).max(128),
          label: z.string().min(1).max(500),
        }),
      )
      .min(1)
      .max(64)
      .refine(
        (options) =>
          new Set(options.map((option) => option.id)).size === options.length,
        'Duplicate option',
      ),
  }),
  z.strictObject({ op: z.literal('START_GAMBLING') }),
  z.strictObject({
    op: z.literal('TAKE_GAMBLING_CONTROL'),
    allowedNextCategories: z
      .array(z.enum(['GAMBLING', 'CHEATING']))
      .min(1)
      .max(2)
      .refine((categories) => new Set(categories).size === categories.length),
  }),
  z.strictObject({ op: z.literal('WIN_GAMBLING') }),
  z.strictObject({
    op: z.literal('LEAVE_GAMBLING'),
    target: z.literal('SELF'),
  }),
  z.strictObject({
    op: z.literal('MODIFY_PENDING_EFFECT'),
    effectIndex: z.number().int().min(0).max(31),
    delta: deltaSchema,
    allowDrinkEvents: z.boolean().optional(),
  }),
  z.strictObject({
    op: z.literal('MODIFY_DRINK'),
    alcoholDelta: deltaSchema,
    fortitudeDelta: deltaSchema,
    allowDrinkEvents: z.boolean().optional(),
  }),
  z.strictObject({
    op: z.literal('CUSTOM'),
    target: effectTargetSchema,
    effect_key: registeredEffectKeySchema,
    params: resourceAdjustmentParamsSchema,
  }),
  z.strictObject({
    op: z.literal('ANTE_ALL_ACTIVE'),
    amount: z.number().int().min(1).max(64),
  }),
  z.strictObject({
    op: z.literal('FORCE_LEAVE_GAMBLING'),
    target: z.literal('CHOSEN_PLAYER'),
    allowSelfTarget: z.boolean().optional(),
  }),
  z.strictObject({
    op: z.literal('REPLACE_GAMBLING_WINNER'),
    target: z.literal('SELF'),
    blocksRestart: z.boolean().optional(),
  }),
  z.strictObject({
    op: z.literal('END_GAMBLING'),
    potDestination: z.literal('INN'),
  }),
  z.strictObject({
    op: z.literal('TAKE_FROM_GAMBLING_POT'),
    amount: z.number().int().min(1).max(64),
  }),
  z.strictObject({
    op: z.literal('SUBSTITUTE_PAYMENT_FROM_INN'),
    amount: z.literal(1),
    scope: z.literal('CURRENT_OBLIGATION').optional(),
  }),
  z.strictObject({ op: z.literal('CANCEL_CURRENT_ANTE_FOR_SELF') }),
  z.strictObject({
    op: z.literal('COLLECT_GOLD'),
    target: effectTargetSchema,
    amount: z.number().int().min(1).max(64),
    allowGoldLossPrevention: z.boolean().optional(),
  }),
  z.strictObject({
    op: z.literal('ORDER_EXTRA_DRINKS'),
    count: z.number().int().min(1).max(8),
  }),
  z.strictObject({
    op: z.literal('DEAL_DRINKS'),
    target: effectTargetSchema,
    count: z.number().int().min(1).max(8),
  }),
  z.strictObject({ op: z.literal('FORCE_DRINK'), target: effectTargetSchema }),
  z.strictObject({
    op: z.literal('QUEUE_EXTRA_DRINK'),
    target: z.literal('SOURCE_ACTOR'),
  }),
  z.strictObject({
    op: z.literal('PASS_CURRENT_DRINK'),
    target: z.literal('CHOSEN_PLAYER'),
  }),
  z.strictObject({
    op: z.literal('SPLIT_CURRENT_DRINK'),
    target: z.literal('CHOSEN_PLAYER'),
  }),
  z.strictObject({ op: z.literal('REPLACE_DRINK_ALCOHOL_WITH_FORTITUDE') }),
  z.strictObject({
    op: z.literal('REDIRECT_FORTITUDE_LOSS'),
    target: z.literal('CHOSEN_PLAYER'),
    excludeOriginalSource: z.boolean().optional(),
    twoPlayerIgnoreFallback: z.boolean().optional(),
  }),
  z.strictObject({
    op: z.literal('FORCE_SIMULTANEOUS_DRINK'),
    targets: z.literal('ALL_PLAYERS'),
    source: z.enum(['INN', 'DRINK_PILE']).optional(),
    skipLeadingEvents: z.boolean().optional(),
  }),
  z.strictObject({
    op: z.literal('DRINKING_CONTEST'),
    rules: z
      .strictObject({
        drinkEvents: z.literal('IGNORE'),
        scoring: z.literal('REVEALED_WITH_MODIFIERS'),
        settlement: z.literal('AFTER_CONTEST'),
      })
      .optional(),
  }),
  z.strictObject({
    op: z.literal('ROUND_ON_HOUSE'),
    payForRefill: z.boolean().optional(),
  }),
  z.strictObject({
    op: z.literal('CONTEXT_BRANCH'),
    branches: z
      .array(
        z.enum([
          'CANCEL_ANTE_AND_LEAVE',
          'IGNORE_CURRENT_DRINK',
          'IGNORE_DRINK_AND_PAY_INN_1',
        ]),
      )
      .length(2)
      .refine(
        (branches) =>
          branches.includes('CANCEL_ANTE_AND_LEAVE') &&
          new Set(branches).size === 2,
        'One ante branch and one Drink branch are required',
      ),
  }),
  z.strictObject({
    op: z.literal('RESTART_GAMBLING_ROUND'),
    ante: z.number().int().min(1).max(64),
  }),
  z.strictObject({ op: z.literal('PREVENT_CURRENT_GOLD_LOSS') }),
  z.strictObject({
    op: z.literal('ORDER_EXTRA_OR_WAIVE_REFILL'),
    count: z.number().int().min(1).max(8),
  }),
  z.strictObject({
    op: z.literal('REPLACE_DRINK_BASE'),
    alcohol: deltaSchema,
    fortitude: deltaSchema,
  }),
  z.strictObject({ op: z.literal('SHARE_FORTITUDE_LOSS') }),
  z.strictObject({
    op: z.literal('OPTIONAL_DRINK_CHALLENGE'),
    target: z.literal('SELF'),
  }),
  // Server-generated choice operations, also validated when restoring a snapshot.
  z.strictObject({
    op: z.literal('DECIDE_DRINK_SPLIT'),
    target: z.literal('SELF'),
  }),
  z.strictObject({ op: z.literal('APPLY_DRINK_SPLIT_CHOICE') }),
]);

export type Effect = z.infer<typeof effectSchema>;

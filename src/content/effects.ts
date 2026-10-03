import { z } from 'zod';

export const resourceKeySchema = z.string().regex(/^[a-z][a-z0-9_]{0,31}$/);
export const effectTargetSchema = z.enum([
  'SELF',
  'CHOSEN_PLAYER',
  'EACH_OTHER_PLAYER',
  'ALL_PLAYERS',
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
export const registeredEffectKeySchema = z.enum(['sample.adjust-resource']);

export const effectSchema = z.discriminatedUnion('op', [
  z.strictObject({
    op: z.literal('CHANGE_STAT'),
    target: effectTargetSchema,
    stat: z.enum(['FORTITUDE', 'ALCOHOL', 'GOLD']),
    delta: deltaSchema,
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
  }),
  z.strictObject({
    op: z.literal('PAY_INN'),
    target: effectTargetSchema,
    amount: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
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
]);

export type Effect = z.infer<typeof effectSchema>;

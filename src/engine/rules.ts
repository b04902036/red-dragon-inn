import { z } from 'zod';

const integer = z
  .number()
  .int()
  .min(-Number.MAX_SAFE_INTEGER)
  .max(Number.MAX_SAFE_INTEGER);
const bounds = z
  .strictObject({ min: integer, max: integer })
  .refine((value) => value.min <= value.max, 'Invalid stat bounds');
export const rulesConfigSchema = z
  .strictObject({
    devCardSelection: z.literal(true).optional(),
    initialStats: z.strictObject({
      fortitude: integer,
      alcoholContent: integer,
      gold: integer.nonnegative(),
    }),
    handSize: z.number().int().min(1).max(64),
    initialDrinkCount: z.number().int().min(0).max(4),
    timing: z
      .strictObject({
        responseMs: z.number().int().min(0).max(30000),
        phaseEndMs: z.number().int().min(0).max(15000),
        // Absent in older pinned manifests: retain their original all-player deadlines.
        turnOwnerUntimed: z.boolean().optional(),
      })
      .prefault({ responseMs: 30000, phaseEndMs: 15000 }),
    drinks: z
      .strictObject({
        emptyPile: z.enum(['SOBER', 'SKIP']),
        soberAmount: z.number().int().min(1).max(1000),
        chaserSource: z.enum(['SAME_SOURCE', 'INN']),
        chaserEvent: z.enum(['DISCARD_STOP', 'DISCARD_CONTINUE']),
        maxChainCards: z.number().int().min(1).max(32),
        refillPayment: z.boolean().optional(),
      })
      .prefault({
        emptyPile: 'SOBER',
        soberAmount: 1,
        chaserSource: 'SAME_SOURCE',
        chaserEvent: 'DISCARD_STOP',
        maxChainCards: 32,
      }),
    elimination: z
      .strictObject({
        passOutGold: z.enum(['SPLIT_WITH_INN', 'ALL_TO_INN']),
        innShareRounding: z.enum(['UP', 'DOWN']),
      })
      .prefault({ passOutGold: 'SPLIT_WITH_INN', innShareRounding: 'UP' }),
    gambling: z
      .strictObject({
        anteAmount: z
          .number()
          .int()
          .min(1)
          .max(Math.floor(Number.MAX_SAFE_INTEGER / 4)),
        insufficientGold: z.enum(['EXCLUDE', 'PAY_AVAILABLE']),
        initiatorControls: z.boolean(),
        allowLeave: z.boolean(),
      })
      .prefault({
        anteAmount: 1,
        insufficientGold: 'EXCLUDE',
        initiatorControls: true,
        allowLeave: true,
      }),
    statBounds: z.strictObject({
      fortitude: bounds.nullable(),
      alcoholContent: bounds.nullable(),
      gold: bounds.nullable(),
    }),
  })
  .superRefine((rules, ctx) => {
    for (const stat of ['fortitude', 'alcoholContent', 'gold'] as const) {
      const limit = rules.statBounds[stat];
      if (
        limit &&
        (rules.initialStats[stat] < limit.min ||
          rules.initialStats[stat] > limit.max)
      )
        ctx.addIssue({
          code: 'custom',
          message: `Initial ${stat} is outside its bounds`,
        });
    }
  });
export type RulesConfig = z.infer<typeof rulesConfigSchema>;
export const DEFAULT_RULES: RulesConfig = rulesConfigSchema.parse({
  drinks: {
    emptyPile: 'SOBER',
    soberAmount: 1,
    chaserSource: 'SAME_SOURCE',
    chaserEvent: 'DISCARD_STOP',
    maxChainCards: 32,
    refillPayment: true,
  },
  timing: { responseMs: 30000, phaseEndMs: 15000, turnOwnerUntimed: true },
  initialStats: { fortitude: 20, alcoholContent: 0, gold: 10 },
  handSize: 7,
  initialDrinkCount: 1,
  statBounds: {
    fortitude: { min: 0, max: 20 },
    alcoholContent: { min: 0, max: 20 },
    gold: null,
  },
});

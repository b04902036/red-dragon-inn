import { z } from 'zod';
import {
  cardDefinitionIdSchema,
  cardInstanceIdSchema,
  characterIdSchema,
  deckIdSchema,
  playerIdSchema,
  resolutionIdSchema,
} from '../shared/ids';
import { effectSchema, resourceKeySchema } from './effects';
import { responseTriggerSchema } from './reaction-triggers';
import { cardMechanics, traitSchema } from './mechanics';

const definitionFields = {
  ...cardMechanics,
  id: cardDefinitionIdSchema,
  name: z.string().min(1).max(160),
  rulesText: z.string().max(4000),
  // Legacy provenance remains readable for pinned matches and explicit fixtures.
  source: z.enum([
    'SAMPLE',
    'PRIVATE',
    'TEST_FIXTURE',
    'USER_OWNED',
    'LICENSED',
    'PUBLIC_RULES_PARAPHRASE',
    'OFFICIAL_CATALOG_REFERENCE',
  ]),
  characterId: characterIdSchema.optional(),
  effects: z.array(effectSchema).max(32),
  negatable: z.boolean().optional(),
};
const gamblingMetadata = z.strictObject({
  allowedNextCategories: z
    .array(z.enum(['GAMBLING', 'CHEATING']))
    .min(1)
    .max(2)
    .refine((categories) => new Set(categories).size === categories.length),
  immediateWin: z.boolean(),
  canStart: z.boolean().optional(),
});

export const cardDefinitionSchema = z
  .discriminatedUnion('type', [
    z.strictObject({ ...definitionFields, type: z.literal('ACTION') }),
    z.strictObject({
      ...definitionFields,
      type: z.literal('SOMETIMES'),
      responseKind: z.enum(['SOMETIMES', 'IGNORE', 'NEGATE']),
      responseTrigger: responseTriggerSchema.optional(),
    }),
    z.strictObject({ ...definitionFields, type: z.literal('ANYTIME') }),
    z.strictObject({
      ...definitionFields,
      type: z.literal('GAMBLING'),
      gambling: gamblingMetadata.optional(),
    }),
    z.strictObject({
      ...definitionFields,
      type: z.literal('CHEATING'),
      gambling: gamblingMetadata.optional(),
    }),
    z.strictObject({
      ...definitionFields,
      type: z.literal('DRINK'),
      alcoholContent: z.number().int().min(-1000).max(1000),
      fortitudeChange: z.number().int().min(-1000).max(1000),
      chaser: z.boolean(),
      chaserSource: z.enum(['SAME_SOURCE', 'INN']).optional(),
      builtInSplit: z.literal(true).optional(),
      traitReplacements: z
        .array(
          z.strictObject({
            trait: traitSchema,
            alcoholContent: z.number().int().min(0).max(1000),
            fortitudeChange: z.number().int().min(-1000).max(1000),
          }),
        )
        .max(8)
        .optional(),
    }),
    z.strictObject({ ...definitionFields, type: z.literal('DRINK_EVENT') }),
    z.strictObject({
      ...definitionFields,
      type: z.literal('SPECIAL'),
      characterId: characterIdSchema,
      sideDeckKey: resourceKeySchema.optional(),
    }),
  ])
  .superRefine((definition, ctx) => {
    if (
      definition.counterPolicy !== undefined &&
      definition.counterFamily === undefined
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Protected counters require a family',
      });
    if (
      definition.phaseOpportunity !== undefined &&
      definition.type !== 'SOMETIMES'
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Phase opportunities require Sometimes cards',
      });
  });

export type CardDefinition = z.infer<typeof cardDefinitionSchema>;
export type ActionCardDefinition = Extract<CardDefinition, { type: 'ACTION' }>;
export type SometimesCardDefinition = Extract<
  CardDefinition,
  { type: 'SOMETIMES' }
>;
export type AnytimeCardDefinition = Extract<
  CardDefinition,
  { type: 'ANYTIME' }
>;
export type GamblingCardDefinition = Extract<
  CardDefinition,
  { type: 'GAMBLING' }
>;
export type CheatingCardDefinition = Extract<
  CardDefinition,
  { type: 'CHEATING' }
>;
export type DrinkCardDefinition = Extract<CardDefinition, { type: 'DRINK' }>;
export type DrinkEventCardDefinition = Extract<
  CardDefinition,
  { type: 'DRINK_EVENT' }
>;
export type SpecialCardDefinition = Extract<
  CardDefinition,
  { type: 'SPECIAL' }
>;

export const cardLocationSchema = z.discriminatedUnion('zone', [
  z.strictObject({ zone: z.literal('HAND'), playerId: playerIdSchema }),
  z.strictObject({
    zone: z.literal('CHARACTER_DECK'),
    playerId: playerIdSchema,
    deckId: deckIdSchema,
  }),
  z.strictObject({
    zone: z.literal('CHARACTER_DISCARD'),
    playerId: playerIdSchema,
    deckId: deckIdSchema,
  }),
  z.strictObject({ zone: z.literal('DRINK_PILE'), playerId: playerIdSchema }),
  z.strictObject({ zone: z.literal('INN_DRINK_DECK'), deckId: deckIdSchema }),
  z.strictObject({ zone: z.literal('INN_BAR_DECK'), deckId: deckIdSchema }),
  z.strictObject({
    zone: z.literal('INN_DRINK_DISCARD'),
    deckId: deckIdSchema,
  }),
  z.strictObject({
    zone: z.literal('RESOLUTION'),
    resolutionId: resolutionIdSchema,
  }),
  z.strictObject({
    zone: z.literal('SPECIAL_DECK'),
    playerId: playerIdSchema,
    deckId: deckIdSchema,
  }),
  z.strictObject({
    zone: z.literal('SPECIAL_DISCARD'),
    playerId: playerIdSchema,
    deckId: deckIdSchema,
  }),
]);

export const cardInstanceSchema = z.strictObject({
  id: cardInstanceIdSchema,
  definitionId: cardDefinitionIdSchema,
  presentationVariantId: z
    .string()
    .regex(/^[a-z][a-z0-9_]*$/)
    .max(100)
    .optional(),
  ownerId: playerIdSchema.nullable(),
  location: cardLocationSchema,
});

export type CardInstance = z.infer<typeof cardInstanceSchema>;

export const contentCatalogSchema = z.strictObject({
  schemaVersion: z.literal(1),
  cards: z
    .array(cardDefinitionSchema)
    .max(10_000)
    .refine(
      (cards) => new Set(cards.map((card) => card.id)).size === cards.length,
      'Duplicate card definition ID',
    ),
});
export type ContentCatalog = z.infer<typeof contentCatalogSchema>;

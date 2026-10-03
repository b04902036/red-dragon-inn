import { z } from 'zod';
import {
  cardDefinitionIdSchema,
  characterIdSchema,
  contentVersionIdSchema,
  playerIdSchema,
} from '../shared/ids';
import { stateVersionSchema } from '../shared/version';

export const presenceSchema = z
  .array(z.strictObject({ playerId: playerIdSchema, connected: z.boolean() }))
  .max(4);
export const characterSelectionSchema = z.strictObject({
  characterId: characterIdSchema,
  expectedStateVersion: stateVersionSchema,
});
export const presentationSchema = z.strictObject({
  schemaVersion: z.literal(1),
  locale: z.enum(['en-US', 'zh-TW']).optional(),
  contentVersionId: contentVersionIdSchema.optional(),
  products: z
    .array(
      z.strictObject({
        id: z.string(),
        name: z.string(),
        canonicalName: z.string(),
      }),
    )
    .max(32)
    .optional(),
  ruleModules: z
    .array(
      z.strictObject({
        id: z.string(),
        summary: z.string(),
        canonicalSummary: z.string(),
      }),
    )
    .max(256)
    .optional(),
  mechanics: z
    .array(z.strictObject({ id: z.string(), name: z.string() }))
    .max(8192)
    .optional(),
  choiceOptions: z
    .array(
      z.strictObject({
        cardDefinitionId: cardDefinitionIdSchema,
        optionId: z.string(),
        label: z.string(),
      }),
    )
    .max(640000)
    .optional(),
  characters: z
    .array(
      z.strictObject({
        id: characterIdSchema,
        name: z.string().min(1).max(200),
        canonicalName: z.string().optional(),
        translationStatus: z
          .enum([
            'VERIFIED',
            'COMMUNITY_REFERENCE',
            'MACHINE_DRAFT',
            'MANUAL_DRAFT',
            'MANUAL_REVIEWED',
          ])
          .optional(),
        translationSource: z.string().optional(),
      }),
    )
    .max(256),
  cards: z
    .array(
      z.strictObject({
        id: cardDefinitionIdSchema,
        name: z.string().min(1).max(200),
        canonicalName: z.string().optional(),
        canonicalRulesText: z.string().optional(),
        rulesText: z.string().max(5000),
        type: z.enum([
          'ACTION',
          'SOMETIMES',
          'ANYTIME',
          'GAMBLING',
          'CHEATING',
          'DRINK',
          'DRINK_EVENT',
          'SPECIAL',
        ]),
        responseKind: z
          .enum(['SOMETIMES', 'ANYTIME', 'IGNORE', 'NEGATE'])
          .optional(),
        requiresTarget: z.boolean(),
        affectsSelf: z.boolean(),
      }),
    )
    .max(10_000),
});
export type Presentation = z.infer<typeof presentationSchema>;
export type Presence = z.infer<typeof presenceSchema>;

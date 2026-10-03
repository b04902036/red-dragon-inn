import { z } from 'zod';
import {
  cardDefinitionIdSchema,
  characterIdSchema,
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
  characters: z
    .array(
      z.strictObject({
        id: characterIdSchema,
        name: z.string().min(1).max(200),
      }),
    )
    .max(256),
  cards: z
    .array(
      z.strictObject({
        id: cardDefinitionIdSchema,
        name: z.string().min(1).max(200),
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

import { z } from 'zod';
import { effectSchema } from './effects';
import { MATCH_LIFECYCLES, TURN_PHASES } from '../engine/model';

const relation = z.enum(['SELF', 'OTHER', 'ANY']);
const cardType = z.enum([
  'ACTION',
  'SOMETIMES',
  'ANYTIME',
  'GAMBLING',
  'CHEATING',
  'DRINK',
  'DRINK_EVENT',
  'SPECIAL',
]);
export const reactionConditionSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('SOURCE_ACTOR'), relation }),
  z.strictObject({ kind: z.literal('AFFECTS'), relation }),
  z.strictObject({
    kind: z.literal('SOURCE_TYPE'),
    types: z.array(cardType).min(1).max(8),
  }),
  z.strictObject({
    kind: z.literal('SOURCE_KIND'),
    kinds: z
      .array(z.enum(['CARD', 'DRINK', 'DRINK_EVENT', 'SYSTEM']))
      .min(1)
      .max(4),
  }),
  z.strictObject({ kind: z.literal('NEGATABLE'), value: z.boolean() }),
  z.strictObject({
    kind: z.literal('PENDING_OPERATION'),
    operations: z
      .array(
        z.enum(
          effectSchema.options.map((option) => option.shape.op.value) as [
            string,
            ...string[],
          ],
        ),
      )
      .min(1)
      .max(32),
  }),
  z.strictObject({
    kind: z.literal('PENDING_STAT'),
    stat: z.enum(['FORTITUDE', 'ALCOHOL', 'GOLD']),
    direction: z.enum(['GAIN', 'LOSS', 'ANY']),
    relation,
  }),
  z
    .strictObject({
      kind: z.literal('TARGET_COUNT'),
      min: z.number().int().min(0).max(4),
      max: z.number().int().min(0).max(4),
    })
    .refine((value) => value.min <= value.max),
  z.strictObject({
    kind: z.literal('PHASE'),
    phases: z.array(z.enum(TURN_PHASES)).min(1).max(6),
  }),
  z.strictObject({
    kind: z.literal('LIFECYCLE'),
    lifecycles: z.array(z.enum(MATCH_LIFECYCLES)).min(1).max(4),
  }),
  z.strictObject({
    kind: z.literal('NESTING'),
    relation: z.enum(['ROOT', 'CHILD']),
  }),
  z.strictObject({
    kind: z.literal('GAMBLING'),
    fact: z.enum([
      'ACTIVE',
      'ROUND',
      'SETTLING',
      'CONTROL',
      'PARTICIPANT',
      'CHEATING_ALLOWED',
    ]),
  }),
  z.strictObject({
    kind: z.literal('PLAYER_STAT'),
    stat: z.enum(['FORTITUDE', 'ALCOHOL', 'GOLD']),
    comparison: z.enum(['LT', 'LTE', 'EQ', 'GTE', 'GT']),
    value: z.number().int().safe(),
  }),
]);
export const responseTriggerSchema = z.strictObject({
  event: z.enum(['ANY', 'CARD', 'DRINK', 'DRINK_EVENT', 'SYSTEM']),
  // Alternatives are OR; each alternative's conditions are AND. Bounds prevent
  // untrusted content from creating an unbounded recursive predicate tree.
  alternatives: z
    .array(z.array(reactionConditionSchema).max(16))
    .min(1)
    .max(16),
});
export type ReactionCondition = z.infer<typeof reactionConditionSchema>;
export type ResponseTrigger = z.infer<typeof responseTriggerSchema>;

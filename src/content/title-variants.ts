import { z } from 'zod';
import { characterIdSchema, cardDefinitionIdSchema } from '../shared/ids';
import type { ContentPack } from './pack';

export const presentationVariantIdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]*$/)
  .max(100);
export const titleAssignmentsSchema = z.array(
  z.strictObject({
    characterId: characterIdSchema,
    cardDefinitionId: cardDefinitionIdSchema,
    variants: z
      .array(
        z.strictObject({
          variantId: presentationVariantIdSchema,
          quantity: z.number().int().positive().max(256),
        }),
      )
      .min(1)
      .max(256),
  }),
);
export type TitleAssignments = z.infer<typeof titleAssignmentsSchema>;

/** Validate server-owned presentation metadata before allocating physical copies. */
export function physicalTitleVariants(
  pack: ContentPack,
  assignments: TitleAssignments,
) {
  const result = new Map<string, string[]>();
  for (const assignment of assignments) {
    const decks = pack.decks.filter(
      (deck) =>
        deck.type === 'CHARACTER' &&
        deck.characterId === assignment.characterId,
    );
    const records = pack.deckCards.filter(
      (record) =>
        decks.some((deck) => deck.id === record.deckId) &&
        record.cardId === assignment.cardDefinitionId,
    );
    const key = `${assignment.characterId}:${assignment.cardDefinitionId}`;
    if (
      decks.length !== 1 ||
      records.length !== 1 ||
      result.has(key) ||
      !pack.cards.some(
        (card) =>
          card.id === assignment.cardDefinitionId &&
          card.characterId === assignment.characterId,
      )
    )
      throw new Error('Invalid presentation variant ownership.');
    if (
      new Set(assignment.variants.map((variant) => variant.variantId)).size !==
      assignment.variants.length
    )
      throw new Error('Duplicate presentation variant.');
    const variants = [...assignment.variants]
      .sort((a, b) =>
        a.variantId < b.variantId ? -1 : a.variantId > b.variantId ? 1 : 0,
      )
      .flatMap((variant) =>
        Array<string>(variant.quantity).fill(variant.variantId),
      );
    if (variants.length !== records[0]!.quantity)
      throw new Error('Presentation variant quantity mismatch.');
    result.set(key, variants);
  }
  return result;
}

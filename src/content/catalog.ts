import { z } from 'zod';
import data from '../../content/catalog/characters.json';

export const catalogCharacterSchema = z.strictObject({
  id: z.string().regex(/^character_[a-z0-9_]+$/),
  canonicalName: z.string().min(1),
  product: z.string().min(1),
  category: z.string().min(1),
  expectedPrimaryDeckCount: z.number().int().positive().nullable(),
  componentNotes: z.string(),
  translationStatus: z.enum(['UNTRANSLATED', 'VERIFIED', 'DRAFT']),
  sourceUrl: z.url(),
  provenance: z.literal('OFFICIAL_CATALOG_REFERENCE'),
});
export type CatalogCharacter = z.infer<typeof catalogCharacterSchema>;
export const releasedCatalog = z
  .array(catalogCharacterSchema)
  .length(76)
  .refine(
    (rows) =>
      new Set(rows.map((row) => row.id)).size === rows.length &&
      new Set(rows.map((row) => row.canonicalName)).size === rows.length,
    'Duplicate catalog identity',
  )
  .parse(data);

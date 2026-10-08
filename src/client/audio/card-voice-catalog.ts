import { z } from 'zod';
const safeId = z.string().regex(/^[a-z][a-z0-9_]*$/);
const schema = z.object({
  schemaVersion: z.literal(2),
  families: z.array(
    z.object({
      characterId: safeId,
      cardDefinitionId: safeId,
      variantIds: z.array(safeId).min(1),
    }),
  ),
  entries: z.array(
    z.object({
      characterId: safeId,
      cardDefinitionId: safeId,
      variantId: safeId,
      assetPath: z
        .string()
        .regex(
          /^\/audio\/cards\/[a-z][a-z0-9_]*\/[a-z][a-z0-9_]*\/[a-z][a-z0-9_]*\.mp3$/,
        ),
    }),
  ),
});
export type CardVoiceCatalog = ReadonlyMap<string, string>;
export const emptyCardVoices: CardVoiceCatalog = new Map();
export function parseCardVoices(input: unknown): CardVoiceCatalog {
  const manifest = schema.parse(input);
  const catalog = new Map<string, string>();
  const families = new Map<string, string[]>();
  for (const family of manifest.families) {
    const key = `${family.characterId}:${family.cardDefinitionId}`;
    if (
      families.has(key) ||
      new Set(family.variantIds).size !== family.variantIds.length
    )
      throw new Error('Duplicate voice family.');
    families.set(key, family.variantIds);
  }
  const paths = new Set<string>();
  for (const entry of manifest.entries) {
    const familyKey = `${entry.characterId}:${entry.cardDefinitionId}`;
    const variants = families.get(familyKey);
    const key = `${familyKey}:${entry.variantId}`;
    if (
      catalog.has(key) ||
      paths.has(entry.assetPath) ||
      !variants?.includes(entry.variantId) ||
      entry.assetPath !==
        `/audio/cards/${entry.characterId}/${entry.cardDefinitionId}/${entry.variantId}.mp3`
    )
      throw new Error('Invalid local voice association.');
    catalog.set(key, entry.assetPath);
    if (variants?.length === 1) catalog.set(familyKey, entry.assetPath);
    paths.add(entry.assetPath);
  }
  return catalog;
}

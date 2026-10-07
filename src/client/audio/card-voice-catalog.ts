import { z } from 'zod';
const safeId = z.string().regex(/^[a-z][a-z0-9_]*$/);
const schema = z.object({
  schemaVersion: z.literal(1),
  entries: z.array(
    z.object({
      characterId: safeId,
      cardDefinitionId: safeId,
      assetPath: z
        .string()
        .regex(/^\/audio\/cards\/[a-z][a-z0-9_]*\/[a-z][a-z0-9_]*\.mp3$/),
    }),
  ),
});
export type CardVoiceCatalog = ReadonlyMap<string, string>;
export const emptyCardVoices: CardVoiceCatalog = new Map();
export function parseCardVoices(input: unknown): CardVoiceCatalog {
  const manifest = schema.parse(input);
  const catalog = new Map<string, string>();
  const paths = new Set<string>();
  for (const entry of manifest.entries) {
    const key = `${entry.characterId}:${entry.cardDefinitionId}`;
    if (
      catalog.has(key) ||
      paths.has(entry.assetPath) ||
      entry.assetPath !==
        `/audio/cards/${entry.characterId}/${entry.cardDefinitionId}.mp3`
    )
      throw new Error('Invalid local voice association.');
    catalog.set(key, entry.assetPath);
    paths.add(entry.assetPath);
  }
  return catalog;
}

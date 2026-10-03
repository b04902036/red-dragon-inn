import { z } from 'zod';
import { contentPackSchema } from './pack';
import type { ContentPack } from './pack';
import {
  registeredEffectKeySchema,
  registeredSpecialRuleKeySchema,
} from './effects';

/** Adapters decode user-supplied local sources; validation and persistence remain shared. */
export interface ContentSourceAdapter {
  readonly format: string;
  decode(source: string): unknown;
}
export const jsonContentAdapter: ContentSourceAdapter = {
  format: 'json',
  decode: (source) => JSON.parse(source) as unknown,
};
export interface CompatibilityReport {
  valid: boolean;
  versionId: string | null;
  characters: number;
  decks: number;
  uniqueCards: number;
  physicalCards: number;
  unsupportedEffects: string[];
  unsupportedSpecialRules: string[];
  missingAssets: string[];
  warnings: string[];
  errors: string[];
}
export function validateContentImport(
  source: string,
  adapter: ContentSourceAdapter = jsonContentAdapter,
  availableAssets: readonly string[] = [],
) {
  const report: CompatibilityReport = {
    valid: false,
    versionId: null,
    characters: 0,
    decks: 0,
    uniqueCards: 0,
    physicalCards: 0,
    unsupportedEffects: [],
    unsupportedSpecialRules: [],
    missingAssets: [],
    warnings: [],
    errors: [],
  };
  let raw: unknown;
  try {
    raw = adapter.decode(source);
  } catch {
    report.errors.push(`Invalid ${adapter.format} source: decoding failed.`);
    return { pack: null, report };
  }
  // Report unsupported keys before the strict DSL rejects them, without executing source data.
  const candidate = z
    .object({ cards: z.array(z.object({ effects: z.array(z.unknown()) })) })
    .safeParse(raw);
  if (candidate.success) {
    for (const card of candidate.data.cards)
      for (const value of card.effects) {
        const custom = z
          .object({ op: z.literal('CUSTOM'), effect_key: z.string() })
          .safeParse(value);
        if (
          custom.success &&
          !registeredEffectKeySchema.safeParse(custom.data.effect_key).success
        )
          report.unsupportedEffects.push(custom.data.effect_key);
      }
    report.unsupportedEffects = [...new Set(report.unsupportedEffects)];
  }
  const parsed = contentPackSchema.safeParse(raw);
  const characters = z
    .object({
      characters: z.array(z.object({ specialRuleKey: z.string().nullable() })),
    })
    .safeParse(raw);
  if (characters.success)
    report.unsupportedSpecialRules = [
      ...new Set(
        characters.data.characters.flatMap((character) =>
          character.specialRuleKey !== null &&
          !registeredSpecialRuleKeySchema.safeParse(character.specialRuleKey)
            .success
            ? [character.specialRuleKey]
            : [],
        ),
      ),
    ];
  if (!parsed.success) {
    report.errors = parsed.error.issues.map(
      (issue) => `${issue.path.join('.') || 'pack'}: ${issue.message}`,
    );
    return { pack: null, report };
  }
  const pack = parsed.data;
  report.valid = true;
  report.versionId = pack.version.id;
  report.characters = pack.characters.length;
  report.decks = pack.decks.length;
  report.uniqueCards = pack.cards.length;
  report.physicalCards = pack.deckCards.reduce(
    (sum, row) => sum + row.quantity,
    0,
  );
  report.missingAssets = pack.assets
    .filter((asset) => !availableAssets.includes(asset.objectKey))
    .map((asset) => asset.objectKey);
  if (report.missingAssets.length)
    report.warnings.push(
      'Referenced asset files are unavailable; metadata can be imported without artwork.',
    );
  if (!pack.assets.length)
    report.warnings.push('No asset metadata supplied; artwork is optional.');
  return { pack, report };
}
export async function importContent(
  source: string,
  store: { saveDraft(pack: ContentPack): Promise<void> },
  options: {
    dryRun?: boolean;
    adapter?: ContentSourceAdapter;
    availableAssets?: readonly string[];
  } = {},
) {
  const result = validateContentImport(
    source,
    options.adapter,
    options.availableAssets,
  );
  if (result.pack !== null && options.dryRun === false)
    await store.saveDraft(result.pack);
  return {
    ...result.report,
    written: result.pack !== null && options.dryRun === false,
  };
}

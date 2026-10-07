import type { ContentPack } from './pack';
import { validateContentImport } from './import';
import {
  verifyContentTranslations,
  requiredTranslationFields,
} from './localization';
import { verifyProductionContent } from './production';
import { releasedCatalog } from './catalog';

/** Compare the complete edition after compilation or D1 round-trip; array order is immaterial. */
export function verifyRdi2Pack(input: unknown, expected: ContentPack) {
  const imported = validateContentImport(JSON.stringify(input));
  const pack = imported.pack;
  const errors = [...imported.report.errors];
  const canonical = (value: unknown) =>
    JSON.stringify(
      Array.isArray(value)
        ? [...value].sort((a: unknown, b: unknown) =>
            JSON.stringify(a).localeCompare(JSON.stringify(b)),
          )
        : value,
    );
  if (pack) {
    for (const key of Object.keys(expected) as (keyof ContentPack)[])
      if (canonical(pack[key]) !== canonical(expected[key]))
        errors.push(`Compiled ${key} differ from locked sources`);
    const translations = verifyContentTranslations(pack);
    errors.push(...translations.issues, ...translations.missing);
    const scoped = releasedCatalog.filter((character) =>
      expected.characters.some((c) => c.id === character.id),
    );
    if (!verifyProductionContent(pack, scoped).complete)
      errors.push('Edition-scoped production completeness failed');
    if (pack.cards.some((card) => card.source !== 'PUBLIC_RULES_PARAPHRASE'))
      errors.push('Unexpected reconstructed-source provenance');
    if (
      pack.cards.some(
        (card) => card.effects.length === 0 && !['DRINK'].includes(card.type),
      )
    )
      errors.push('Character/Event no-op');
    if (
      pack.cards.some(
        (card) =>
          card.type === 'SOMETIMES' && card.responseTrigger === undefined,
      )
    )
      errors.push('Unstructured Sometimes');
    for (const field of requiredTranslationFields(pack))
      for (const locale of ['en-US', 'zh-TW'] as const)
        if (
          !pack.translations?.some(
            (row) =>
              row.entityType === field.entityType &&
              row.entityId === field.entityId &&
              row.field === field.field &&
              row.locale === locale,
          )
        )
          errors.push(`Missing ${locale} ${field.entityId}/${field.field}`);
  }
  return {
    valid: errors.length === 0 && pack !== null,
    versionId: pack?.version.id ?? null,
    characters: pack?.characters.length ?? 0,
    decks: Object.fromEntries(
      (pack?.decks ?? []).map((deck) => [
        deck.id,
        pack!.deckCards
          .filter((row) => row.deckId === deck.id)
          .reduce((sum, row) => sum + row.quantity, 0),
      ]),
    ),
    unknownEffects: imported.report.unsupportedEffects,
    errors,
  };
}

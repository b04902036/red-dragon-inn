import { validateContentImport } from './import';
import { compileRdi1Source } from './rdi1-compiler';
import {
  requiredTranslationFields,
  verifyContentTranslations,
} from './localization';
import { releasedCatalog } from './catalog';
import { verifyProductionContent } from './production';

/** RDI1-scoped completeness; the full catalog release gate remains independent. */
export function verifyRdi1Pack(input: unknown, source: unknown) {
  const expected = compileRdi1Source(source);
  const imported = validateContentImport(JSON.stringify(input));
  const pack = imported.pack;
  const errors = [...imported.report.errors];
  const report = {
    valid: false,
    characters: pack?.characters.length ?? 0,
    characterDecks: Object.fromEntries(
      expected.characters.map((character) => [
        character.slug.replace('rdi1-', ''),
        pack?.deckCards
          .filter(
            (row) =>
              row.deckId ===
              expected.decks.find((deck) => deck.characterId === character.id)!
                .id,
          )
          .reduce((sum, row) => sum + row.quantity, 0) ?? 0,
      ]),
    ),
    characterPhysicalCards:
      pack?.deckCards
        .filter(
          (row) =>
            pack.decks.find((deck) => deck.id === row.deckId)?.type ===
            'CHARACTER',
        )
        .reduce((sum, row) => sum + row.quantity, 0) ?? 0,
    drinkPhysicalCards:
      pack?.deckCards
        .filter((row) => row.deckId === 'deck_rdi1_inn')
        .reduce((sum, row) => sum + row.quantity, 0) ?? 0,
    unknownMechanics: 0,
    unknownEffects: imported.report.unsupportedEffects.length,
    sometimesWithoutStructuredLegality:
      pack?.cards.filter(
        (card) =>
          card.type === 'SOMETIMES' && card.responseTrigger === undefined,
      ).length ?? 0,
    missingEnUS: 0,
    missingZhTW: 0,
    sampleProductionRecords:
      pack === null
        ? 0
        : [
            ...pack.products,
            ...pack.characters,
            ...pack.decks,
            ...pack.cards,
          ].filter(
            (row) =>
              /sample|fixture/i.test(row.id) || /\bsample\b/i.test(row.name),
          ).length +
          pack.cards.filter((card) => card.source !== 'PUBLIC_RULES_PARAPHRASE')
            .length,
    errors,
  };
  if (pack !== null) {
    for (const field of requiredTranslationFields(pack)) {
      for (const locale of ['en-US', 'zh-TW'] as const) {
        if (
          !pack.translations?.some(
            (row) =>
              row.entityType === field.entityType &&
              row.entityId === field.entityId &&
              row.field === field.field &&
              row.locale === locale,
          )
        ) {
          if (locale === 'en-US') report.missingEnUS++;
          else report.missingZhTW++;
        }
      }
    }
    const translations = verifyContentTranslations(pack);
    errors.push(...translations.issues, ...translations.missing);
    const production = verifyProductionContent(
      pack,
      releasedCatalog.slice(0, 4),
    );
    if (!production.complete)
      errors.push('RDI1 production completeness failed');
    // Compare each generated record to its locked-source counterpart. Ordering is irrelevant
    // after a D1 round-trip, but no missing, substituted, or extra mechanic is accepted.
    for (const key of [
      'version',
      'products',
      'characters',
      'decks',
      'cards',
      'deckCards',
      'requirements',
      'translations',
      'ruleModules',
      'assets',
    ] as const) {
      const canonical = (value: unknown) =>
        JSON.stringify(
          Array.isArray(value)
            ? [...value].sort((a: unknown, b: unknown) =>
                JSON.stringify(a).localeCompare(JSON.stringify(b)),
              )
            : value,
        );
      if (canonical(pack[key]) !== canonical(expected[key]))
        errors.push(`Compiled ${key} differ from locked RDI1 source`);
    }
    report.unknownMechanics = pack.cards.filter(
      (card) => !expected.cards.some((row) => row.id === card.id),
    ).length;
    if (
      report.sometimesWithoutStructuredLegality ||
      report.missingEnUS ||
      report.missingZhTW ||
      report.sampleProductionRecords
    )
      errors.push('RDI1 structured legality, translation, or provenance gap');
  }
  report.valid = errors.length === 0;
  return report;
}

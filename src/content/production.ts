import { z } from 'zod';
import { releasedCatalog } from './catalog';
import type { CatalogCharacter } from './catalog';
import { validateContentImport } from './import';

const candidateSchema = z.object({
  characters: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      productId: z.string(),
      specialRuleKey: z.string().nullable(),
      rules: z.object({ sideDeckKeys: z.array(z.string()) }),
    }),
  ),
  products: z.array(z.object({ id: z.string(), name: z.string() })),
  decks: z.array(
    z.object({
      id: z.string(),
      characterId: z.string().nullable(),
      type: z.string(),
    }),
  ),
  cards: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      source: z.string().optional(),
      effects: z.array(z.unknown()).optional(),
    }),
  ),
  deckCards: z.array(
    z.object({ deckId: z.string(), cardId: z.string(), quantity: z.number() }),
  ),
});

/** A truthful release report; metadata presence never implies playable official card coverage. */
export function verifyProductionContent(
  input: unknown,
  catalog: readonly CatalogCharacter[] = releasedCatalog,
) {
  const imported = validateContentImport(JSON.stringify(input));
  const parsed = candidateSchema.safeParse(input);
  const pack = parsed.success ? parsed.data : null;
  const missingCharacters = catalog
    .filter(
      (entry) =>
        !pack?.characters.some(
          (character) => character.name === entry.canonicalName,
        ),
    )
    .map((entry) => entry.canonicalName);
  const report = {
    complete: false,
    expectedCharacters: catalog.length,
    presentCharacters: catalog.length - missingCharacters.length,
    missingCharacters,
    charactersWithNoPrimaryDeck: [] as string[],
    invalidPrimaryDeckCounts: [] as string[],
    unsupportedSpecialRules: imported.report.unsupportedSpecialRules,
    uniqueCards: pack?.cards.length ?? 0,
    physicalCards:
      pack?.deckCards.reduce((sum, row) => sum + row.quantity, 0) ?? 0,
    physicalCardsByDeck: {} as Record<string, number>,
    cardsWithNoExecutableEffects: [] as string[],
    unknownEffectKeys: imported.report.unsupportedEffects,
    invalidDeckQuantities: [] as string[],
    missingRequiredSideDecks: [] as string[],
    missingRequiredComponents: [] as string[],
    unsupportedSideDecks: [] as string[],
    missingTraditionalChinese: [] as string[],
    invalidProvenance: [] as string[],
    invalidProductAssociations: [] as string[],
    errors: [...imported.report.errors],
  };
  if (pack !== null) {
    for (const deck of pack.decks) {
      const rows = pack.deckCards.filter((row) => row.deckId === deck.id);
      const count = rows.reduce((sum, row) => sum + row.quantity, 0);
      report.physicalCardsByDeck[deck.id] = count;
      if (
        count === 0 ||
        rows.some(
          (row) =>
            !Number.isSafeInteger(row.quantity) ||
            row.quantity <= 0 ||
            row.quantity > 64,
        )
      )
        report.invalidDeckQuantities.push(deck.id);
    }
    for (const character of pack.characters) {
      const primary = pack.decks.filter(
        (deck) =>
          deck.characterId === character.id && deck.type === 'CHARACTER',
      );
      if (primary.length !== 1)
        report.charactersWithNoPrimaryDeck.push(character.id);
      const entry = catalog.find((row) => row.canonicalName === character.name);
      if (entry !== undefined) {
        if (
          pack.products.find((row) => row.id === character.productId)?.name !==
          entry.product
        )
          report.invalidProductAssociations.push(character.id);
        if (
          primary.length === 1 &&
          entry.expectedPrimaryDeckCount !== null &&
          report.physicalCardsByDeck[primary[0]!.id] !==
            entry.expectedPrimaryDeckCount
        )
          report.invalidPrimaryDeckCounts.push(character.id);
        const requirement = imported.pack?.requirements?.find(
          (row) => row.characterId === character.id,
        );
        const declaredSideCounts =
          requirement?.sideDecks.map((side) => side.quantity) ?? [];
        for (const match of entry.componentNotes.matchAll(
          /(\d+)-card\s+[^;,+]+?\s+deck/gi,
        )) {
          const expectedCount = Number(match[1]);
          const declaredIndex = declaredSideCounts.indexOf(expectedCount);
          if (declaredIndex < 0)
            report.missingRequiredSideDecks.push(
              `${character.id}/expected-${expectedCount}-card-side-deck`,
            );
          else declaredSideCounts.splice(declaredIndex, 1);
        }
        if (entry.componentNotes && requirement === undefined)
          report.missingRequiredComponents.push(
            `${character.id}: ${entry.componentNotes}`,
          );
        if (requirement) {
          if (
            primary.length === 1 &&
            report.physicalCardsByDeck[primary[0]!.id] !==
              requirement.primaryDeckCount
          )
            report.invalidPrimaryDeckCounts.push(character.id);
          if (
            entry.componentNotes &&
            requirement.sideDecks.length === 0 &&
            requirement.components.length === 0
          )
            report.missingRequiredComponents.push(
              `${character.id}: ${entry.componentNotes}`,
            );
          for (const side of requirement.sideDecks) {
            if (report.physicalCardsByDeck[side.deckId] !== side.quantity)
              report.missingRequiredSideDecks.push(side.deckId);
            // Current engine has visibility extensions, but does not instantiate character side decks.
            report.unsupportedSideDecks.push(side.deckId);
          }
          for (const component of requirement.components)
            if (
              !(
                component.key in
                (imported.pack?.characters.find(
                  (row) => row.id === character.id,
                )?.rules.resources ?? {})
              )
            )
              report.missingRequiredComponents.push(
                `${character.id}/${component.key}`,
              );
        }
      }
      for (const key of character.rules.sideDeckKeys) {
        const required = imported.pack?.requirements?.find(
          (row) => row.characterId === character.id,
        );
        if (!required?.sideDecks.length)
          report.missingRequiredSideDecks.push(`${character.id}/${key}`);
      }
    }
    for (const card of pack.cards) {
      if (card.source !== 'USER_OWNED' && card.source !== 'LICENSED')
        report.invalidProvenance.push(card.id);
      if (
        !card.effects?.length &&
        !['DRINK', 'GAMBLING', 'CHEATING'].includes(card.type)
      )
        report.cardsWithNoExecutableEffects.push(card.id);
    }
    const entities = [
      ...pack.characters.map((row) => ({
        type: 'CHARACTER',
        id: row.id,
        fields: ['name'],
      })),
      ...pack.products.map((row) => ({
        type: 'PRODUCT',
        id: row.id,
        fields: ['name'],
      })),
      ...pack.cards.map((row) => ({
        type: 'CARD',
        id: row.id,
        fields: ['name', 'rulesText'],
      })),
    ];
    for (const entity of entities)
      for (const field of entity.fields)
        if (
          !imported.pack?.translations?.some(
            (row) =>
              row.entityType === entity.type &&
              row.entityId === entity.id &&
              row.field === field &&
              row.locale === 'zh-TW',
          )
        )
          report.missingTraditionalChinese.push(
            `${entity.type}/${entity.id}/${field}`,
          );
  } else
    report.errors.push(
      'No usable production pack was supplied. Place owned/licensed JSON under content-private/imports/ and configure a published production channel.',
    );
  if (
    pack &&
    (pack.characters.length < 2 ||
      pack.cards.length === 0 ||
      pack.decks.filter((deck) => deck.type === 'INN_DRINK').length !== 1)
  )
    report.errors.push('Pack cannot initialize a playable match.');
  report.complete = Object.values(report).every(
    (value) => !Array.isArray(value) || value.length === 0,
  );
  return report;
}

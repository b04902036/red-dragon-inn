import { contentPackSchema } from '../../src/content/pack';
import { sampleContentPack } from '../../src/content/sample';
import { catalogCharacterSchema } from '../../src/content/catalog';

/** Original test data exercising the owned-content path; never an official card pack. */
export function productionFixture(id = 'content_owned_test') {
  const source = structuredClone(sampleContentPack);
  const characters = source.characters.slice(0, 2).map((character) => ({
    ...character,
    specialRuleKey: character.specialRuleKey === null ? null : 'core.resources',
    rules: { ...character.rules, sideDeckKeys: [] },
  }));
  const decks = source.decks.filter(
    (deck) =>
      deck.type !== 'SPECIAL' &&
      (deck.characterId === null ||
        characters.some((character) => character.id === deck.characterId)),
  );
  const cards = source.cards
    .filter((card) => card.type !== 'SPECIAL')
    .map((card) => ({
      ...card,
      source: 'USER_OWNED',
      ...(card.type === 'DRINK_EVENT'
        ? {
            effects: [
              {
                op: 'CHANGE_STAT',
                target: 'SELF',
                stat: 'FORTITUDE',
                delta: 1,
              },
            ],
          }
        : {}),
    }));
  const translations = [
    ...characters.map((character) => ({
      entityType: 'CHARACTER',
      entityId: character.id,
      field: 'name',
    })),
    ...source.products.map((product) => ({
      entityType: 'PRODUCT',
      entityId: product.id,
      field: 'name',
    })),
    ...cards.flatMap((card) =>
      ['name', 'rulesText'].map((field) => ({
        entityType: 'CARD',
        entityId: card.id,
        field,
      })),
    ),
  ].map((row) => ({
    ...row,
    locale: 'zh-TW',
    text: '原創測試內容',
    sourceKind: 'MANUAL',
    sourceRef: null,
    status: 'MANUAL_DRAFT',
  }));
  return contentPackSchema.parse({
    ...source,
    version: { ...source.version, id },
    characters,
    decks,
    cards,
    deckCards: source.deckCards.filter((row) =>
      decks.some((deck) => deck.id === row.deckId),
    ),
    ruleModules: source.ruleModules.map((row) => ({
      ...row,
      rules: { ...row.rules, kind: 'CORE_RULES' },
    })),
    translations,
  });
}
export function fixtureCatalog() {
  const pack = productionFixture();
  return pack.characters.map((character) =>
    catalogCharacterSchema.parse({
      id: character.id,
      canonicalName: character.name,
      product: pack.products[0]!.name,
      category: 'Original test fixture',
      expectedPrimaryDeckCount: 7,
      componentNotes: '',
      translationStatus: 'DRAFT',
      sourceUrl: 'https://example.com/original-fixture',
      provenance: 'OFFICIAL_CATALOG_REFERENCE',
    }),
  );
}

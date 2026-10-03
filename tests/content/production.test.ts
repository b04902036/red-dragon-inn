import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { verifyProductionContent } from '../../src/content/production';
import { releasedCatalog } from '../../src/content/catalog';
import { validateContentImport } from '../../src/content/import';
import { contentPackSchema } from '../../src/content/pack';
import { cardDefinitionSchema } from '../../src/content/cards';
import { productionFixture, fixtureCatalog } from '../fixtures/production-pack';

const check = (pack: unknown) =>
  verifyProductionContent(pack, fixtureCatalog());

describe('production completeness without fabricated official content', () => {
  it('represents all 76 supplied characters as metadata with original names and sources', () => {
    const csv = readFileSync('reference/rdi_characters_76.csv', 'utf8');
    expect(releasedCatalog).toHaveLength(76);
    for (const character of releasedCatalog) {
      expect(csv).toContain(character.canonicalName);
      expect(csv).toContain(character.product);
      expect(character.translationStatus).toBe('UNTRANSLATED');
      expect(character.expectedPrimaryDeckCount).toBeGreaterThan(0);
    }
    expect(
      releasedCatalog.filter(
        (character) => character.expectedPrimaryDeckCount === 30,
      ),
    ).toHaveLength(1);
    expect(
      releasedCatalog.find(
        (character) => character.canonicalName === 'Baron von Vlazlo',
      )!.expectedPrimaryDeckCount,
    ).toBe(30);
  });
  it('reports every missing official character and exits readiness logically false without data', () => {
    const report = verifyProductionContent(null);
    expect(report).toMatchObject({
      complete: false,
      expectedCharacters: 76,
      presentCharacters: 0,
      uniqueCards: 0,
      physicalCards: 0,
    });
    expect(report.missingCharacters).toHaveLength(76);
    expect(report.errors.join(' ')).toContain('content-private/imports/');
  });
  it('passes a fully represented original test target, preserving shared definitions and quantities', () => {
    const report = check(productionFixture());
    expect(report).toMatchObject({
      complete: true,
      expectedCharacters: 2,
      presentCharacters: 2,
      uniqueCards: 9,
      physicalCards: 20,
    });
    expect(report.physicalCardsByDeck.deck_sample_0).toBe(7);
    expect(verifyProductionContent(productionFixture()).complete).toBe(false);
  });
  it('does not include fixture runtime imports or fixture copy in production entry/UI files', () => {
    for (const file of [
      'worker/index.ts',
      'worker/durable/game-room.ts',
      'worker/runtime-content.ts',
      'src/client/use-room.ts',
    ])
      expect(readFileSync(file, 'utf8')).not.toMatch(
        /sampleContentPack|samplePresentation|\/api\/content\/sample/,
      );
    for (const file of [
      'src/client/App.tsx',
      'src/client/RoomScreen.tsx',
      'src/client/GameTable.tsx',
    ])
      expect(readFileSync(file, 'utf8')).not.toMatch(
        /Start sample match|Sample table|Sample adventurer|Original sample cards|replace\('Sample /,
      );
    const config = readFileSync('wrangler.jsonc', 'utf8');
    expect(config).toContain('"CONTENT_MODE": "production"');
    expect(readFileSync('package.json', 'utf8')).toMatch(
      /content:verify:production/,
    );
  });
  it.each([
    'USER_OWNED',
    'LICENSED',
    'TEST_FIXTURE',
    'OFFICIAL_CATALOG_REFERENCE',
  ])(
    'supports %s provenance structurally without treating it as distribution permission',
    (source) => {
      expect(
        cardDefinitionSchema.parse({ ...productionFixture().cards[0], source })
          .source,
      ).toBe(source);
    },
  );
  it('reports unknown effect and special-rule keys instead of degrading to no-op', () => {
    const pack = productionFixture();
    Object.assign(pack.cards[0]!, {
      effects: [
        {
          op: 'CUSTOM',
          effect_key: 'unsupported.effect',
          target: 'SELF',
          params: {},
        },
      ],
    });
    Object.assign(pack.characters[0]!, {
      specialRuleKey: 'unsupported.character',
    });
    const report = check(pack);
    expect(report.complete).toBe(false);
    expect(report.unknownEffectKeys).toEqual(['unsupported.effect']);
    expect(report.unsupportedSpecialRules).toEqual(['unsupported.character']);
    expect(validateContentImport(JSON.stringify(pack)).pack).toBeNull();
  });
  it('reports empty primary decks, invalid quantities and cards with no executable representation', () => {
    const pack = productionFixture();
    pack.deckCards = pack.deckCards.filter(
      (row) => row.deckId !== 'deck_sample_0',
    );
    pack.deckCards[0]!.quantity = 0;
    pack.cards[0]!.effects = [];
    const report = check(pack);
    expect(report.complete).toBe(false);
    expect(report.invalidDeckQuantities).toContain('deck_sample_0');
    expect(report.cardsWithNoExecutableEffects).toContain(pack.cards[0]!.id);
    expect(report.invalidPrimaryDeckCounts).toContain(pack.characters[0]!.id);
  });
  it('reports absent primary decks and mismatched public product association', () => {
    const pack = productionFixture();
    pack.decks = pack.decks.filter((deck) => deck.id !== 'deck_sample_0');
    pack.products[0]!.name = 'Wrong product';
    const report = check(pack);
    expect(report.charactersWithNoPrimaryDeck).toContain('character_sample_0');
    expect(report.invalidProductAssociations).toContain('character_sample_0');
  });
  it('requires side-deck/component manifest details and rejects unsupported side-deck instantiation', () => {
    const pack = productionFixture();
    const catalog = fixtureCatalog();
    catalog[0]!.componentNotes = '12-card original side deck';
    expect(
      verifyProductionContent(pack, catalog).missingRequiredComponents,
    ).toEqual(['character_sample_0: 12-card original side deck']);
    pack.characters[0]!.rules.sideDeckKeys = ['tokens'];
    expect(check(pack).missingRequiredSideDecks).toEqual([
      'character_sample_0/tokens',
    ]);
    pack.decks.push({
      ...pack.decks[0]!,
      id: 'deck_required' as never,
      type: 'SPECIAL',
      slug: 'required',
    });
    pack.requirements = [
      {
        characterId: pack.characters[0]!.id,
        primaryDeckCount: 7,
        sideDecks: [{ deckId: 'deck_required' as never, quantity: 12 }],
        components: [],
      },
    ];
    const report = verifyProductionContent(pack, catalog);
    expect(report.missingRequiredSideDecks).toContain('deck_required');
    expect(report.unsupportedSideDecks).toContain('deck_required');
    expect(report.complete).toBe(false);
    expect(report.missingRequiredSideDecks).not.toContain(
      'character_sample_0/expected-12-card-side-deck',
    );
    pack.requirements[0]!.sideDecks[0]!.quantity = 3;
    expect(
      verifyProductionContent(pack, catalog).missingRequiredSideDecks,
    ).toContain('character_sample_0/expected-12-card-side-deck');
  });
  it('requires Traditional Chinese names/text and explicit owned/licensed provenance', () => {
    const pack = productionFixture();
    delete pack.translations;
    Object.assign(pack.cards[0]!, { source: undefined });
    const report = check(pack);
    expect(report.complete).toBe(false);
    expect(report.missingTraditionalChinese).toContain(
      'CARD/carddef_sample_shove/rulesText',
    );
    expect(report.invalidProvenance).toContain('carddef_sample_shove');
  });
  it('rejects duplicate/conflicting translations, missing entities and bad requirement ownership', () => {
    const pack = productionFixture();
    expect(
      contentPackSchema.safeParse({
        ...pack,
        translations: [pack.translations![0], pack.translations![0]],
      }).success,
    ).toBe(false);
    expect(
      contentPackSchema.safeParse({
        ...pack,
        translations: [
          { ...pack.translations![0], entityId: 'character_absent' },
        ],
      }).success,
    ).toBe(false);
    expect(
      contentPackSchema.safeParse({
        ...pack,
        requirements: [
          {
            characterId: 'character_absent',
            primaryDeckCount: 40,
            sideDecks: [],
            components: [],
          },
        ],
      }).success,
    ).toBe(false);
  });
  it('checks declared resource components, quantities and unknown expected primary counts', () => {
    const pack = productionFixture();
    pack.requirements = [
      {
        characterId: pack.characters[1]!.id,
        primaryDeckCount: 7,
        sideDecks: [],
        components: [
          {
            key: 'tokens',
            label: 'Original counter',
            mechanicKey: 'core.resources',
          },
        ],
      },
    ];
    const catalog = fixtureCatalog();
    catalog[1]!.componentNotes = 'Original resource counter';
    catalog[1]!.expectedPrimaryDeckCount = null;
    expect(verifyProductionContent(pack, catalog).complete).toBe(true);
    pack.requirements[0]!.components[0]!.key = 'missing';
    pack.requirements[0]!.primaryDeckCount = 40;
    const report = verifyProductionContent(pack, catalog);
    expect(report.complete).toBe(false);
    expect(report.missingRequiredComponents).toContain(
      'character_sample_1/missing',
    );
    expect(report.invalidPrimaryDeckCounts).toContain('character_sample_1');
  });
  it('requires a playable Inn rather than treating catalog/translation metadata as gameplay', () => {
    const pack = productionFixture();
    pack.decks = pack.decks.filter((deck) => deck.type !== 'INN_DRINK');
    expect(check(pack).errors).toContain(
      'Pack cannot initialize a playable match.',
    );
  });
});

import { describe, expect, it } from 'vitest';
import {
  assetSchema,
  contentPackSchema,
  deckSchema,
} from '../../src/content/pack';
import { sampleContentPack } from '../../src/content/sample';

function pack() {
  return structuredClone(sampleContentPack);
}
describe('versioned content pack validation', () => {
  it('contains four fictional characters and all required sample categories with repeated quantities', () => {
    expect(contentPackSchema.parse(pack())).toEqual(sampleContentPack);
    expect(sampleContentPack.characters).toHaveLength(4);
    expect(new Set(sampleContentPack.cards.map((card) => card.type))).toEqual(
      new Set([
        'ACTION',
        'SOMETIMES',
        'ANYTIME',
        'GAMBLING',
        'CHEATING',
        'DRINK',
        'DRINK_EVENT',
        'SPECIAL',
      ]),
    );
    expect(
      sampleContentPack.cards.every(
        (card) => card.source === 'SAMPLE' && card.name.startsWith('Sample '),
      ),
    ).toBe(true);
    expect(
      sampleContentPack.deckCards.some((entry) => entry.quantity > 1),
    ).toBe(true);
    expect(sampleContentPack.assets).toEqual([]);
  });
  it.each([
    'products',
    'characters',
    'decks',
    'cards',
    'ruleModules',
    'assets',
  ] as const)('rejects duplicate %s IDs', (key) => {
    const value = pack();
    value.assets.push(
      assetSchema.parse({
        id: 'asset_sample',
        ownerType: 'PRODUCT',
        ownerId: 'product_sample',
        type: 'ICON',
        objectKey: 'sample/icon.svg',
        licenseStatus: 'ORIGINAL',
      }),
    );
    const rows = value[key];
    const invalid = { ...value, [key]: [...rows, rows[0]] };
    expect(contentPackSchema.safeParse(invalid).success).toBe(false);
  });
  it.each(['products', 'characters', 'decks'] as const)(
    'rejects duplicate %s slugs independently of IDs',
    (key) => {
      const value = pack();
      const first = value[key][0]!;
      const prefix = first.id.split('_')[0];
      expect(
        contentPackSchema.safeParse({
          ...value,
          [key]: [...value[key], { ...first, id: `${prefix}_another` }],
        }).success,
      ).toBe(false);
    },
  );
  it('rejects duplicate rule keys and associations', () => {
    const value = pack();
    expect(
      contentPackSchema.safeParse({
        ...value,
        ruleModules: [
          ...value.ruleModules,
          { ...value.ruleModules[0], id: 'rule_another' },
        ],
      }).success,
    ).toBe(false);
    expect(
      contentPackSchema.safeParse({
        ...value,
        deckCards: [...value.deckCards, value.deckCards[0]],
      }).success,
    ).toBe(false);
  });
  it.each([
    { products: [] },
    { characters: [] },
    { decks: [] },
    { cards: [] },
    {
      assets: [
        {
          id: 'asset_missing',
          ownerType: 'CARD',
          ownerId: 'carddef_missing',
          type: 'ICON',
          objectKey: 'sample/icon.svg',
          licenseStatus: 'ORIGINAL',
        },
      ],
    },
  ])('rejects missing references: %j', (change) => {
    expect(contentPackSchema.safeParse({ ...pack(), ...change }).success).toBe(
      false,
    );
  });
  it('rejects mismatched character and drink associations', () => {
    const value = pack();
    const token = value.deckCards.find(
      (entry) => entry.cardId === 'carddef_sample_token',
    )!;
    expect(
      contentPackSchema.safeParse({
        ...value,
        deckCards: [{ ...token, deckId: 'deck_sample_0' }],
      }).success,
    ).toBe(false);
    expect(
      contentPackSchema.safeParse({
        ...value,
        deckCards: [{ ...token, deckId: 'deck_sample_inn' }],
      }).success,
    ).toBe(false);
    expect(
      contentPackSchema.safeParse({
        ...value,
        deckCards: [
          {
            deckId: 'deck_sample_0',
            cardId: 'carddef_sample_fizz',
            quantity: 1,
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      contentPackSchema.safeParse({
        ...value,
        deckCards: [
          {
            deckId: 'deck_sample_0',
            cardId: 'carddef_sample_toast',
            quantity: 1,
          },
        ],
      }).success,
    ).toBe(false);
  });
  it('requires correct deck ownership', () => {
    expect(
      deckSchema.safeParse({ ...pack().decks[0], characterId: null }).success,
    ).toBe(false);
    expect(
      deckSchema.safeParse({
        ...pack().decks.find((deck) => deck.type === 'INN_DRINK'),
        characterId: 'character_sample_0',
      }).success,
    ).toBe(false);
  });
  it('allows private card metadata and assets with explicit licenses, never executable effects', () => {
    const value = pack();
    const owners = [
      ['PRODUCT', 'product_sample'],
      ['CHARACTER', 'character_sample_0'],
      ['DECK', 'deck_sample_0'],
      ['CARD', 'carddef_sample_shove'],
      ['RULE_MODULE', 'rule_sample_core'],
    ];
    const assets = owners.map(([ownerType, ownerId], i) => ({
      id: `asset_${i}`,
      ownerType,
      ownerId,
      type: 'ARTWORK',
      objectKey: `licensed/${i}.png`,
      licenseStatus: i % 2 ? 'USER_OWNED' : 'LICENSED',
    }));
    expect(
      contentPackSchema.safeParse({
        ...value,
        assets,
        cards: value.cards.map((card) => ({ ...card, source: 'PRIVATE' })),
      }).success,
    ).toBe(true);
    expect(
      contentPackSchema.safeParse({
        ...value,
        cards: [
          {
            ...value.cards[0],
            effects: [{ op: 'EVAL', code: 'console.log(1)' }],
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      contentPackSchema.safeParse({
        ...value,
        assets: [{ ...assets[0], ownerType: 'CARD' }],
      }).success,
    ).toBe(false);
  });
  it.each([
    '/absolute.png',
    '../secret.png',
    'folder/../secret.png',
    'C:\\secret.png',
    'https://example.com/a.png',
  ])('rejects local paths or URLs as asset keys: %s', (objectKey) => {
    expect(
      assetSchema.safeParse({
        id: 'asset_sample',
        ownerType: 'PRODUCT',
        ownerId: 'product_sample',
        type: 'ICON',
        objectKey,
        licenseStatus: 'ORIGINAL',
      }).success,
    ).toBe(false);
  });
  it.each([0, -1, 65, 1.5, '2'])(
    'rejects invalid duplicate quantity %s',
    (quantity) => {
      expect(
        contentPackSchema.safeParse({
          ...pack(),
          deckCards: [{ ...pack().deckCards[0], quantity }],
        }).success,
      ).toBe(false);
    },
  );
});

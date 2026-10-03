import { z } from 'zod';
import { cardDefinitionSchema } from './cards';
import { resourceKeySchema, registeredSpecialRuleKeySchema } from './effects';
import {
  assetIdSchema,
  cardDefinitionIdSchema,
  characterIdSchema,
  contentVersionIdSchema,
  deckIdSchema,
  productIdSchema,
  ruleModuleIdSchema,
} from '../shared/ids';

const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(100);
const name = z.string().min(1).max(160);
export const contentVersionSchema = z.strictObject({
  id: contentVersionIdSchema,
  name,
  createdAt: z.iso.datetime(),
  publishedAt: z.iso.datetime().nullable(),
});
export type ContentVersion = z.infer<typeof contentVersionSchema>;
export const productSchema = z.strictObject({
  id: productIdSchema,
  slug,
  name,
  releaseYear: z.number().int().min(1900).max(9999).nullable(),
});
export type Product = z.infer<typeof productSchema>;
export const characterRulesSchema = z.strictObject({
  resources: z.record(
    resourceKeySchema,
    z.strictObject({
      initialValue: z.number().int(),
      visibility: z.enum(['PUBLIC', 'OWNER', 'SERVER']),
    }),
  ),
  sideDeckKeys: z.array(resourceKeySchema).max(32),
});
export const characterSchema = z.strictObject({
  id: characterIdSchema,
  productId: productIdSchema,
  slug,
  name,
  villain: z.boolean(),
  complexity: z.number().int().min(1).max(5).nullable(),
  specialRuleKey: registeredSpecialRuleKeySchema.nullable(),
  rules: characterRulesSchema,
});
export type Character = z.infer<typeof characterSchema>;
export const deckSchema = z
  .strictObject({
    id: deckIdSchema,
    characterId: characterIdSchema.nullable(),
    type: z.enum(['CHARACTER', 'INN_DRINK', 'SPECIAL']),
    slug,
    name,
  })
  .refine(
    (deck) =>
      deck.type === 'INN_DRINK'
        ? deck.characterId === null
        : deck.characterId !== null,
    'Deck ownership does not match its type',
  );
export type Deck = z.infer<typeof deckSchema>;
export const deckCardSchema = z.strictObject({
  deckId: deckIdSchema,
  cardId: cardDefinitionIdSchema,
  quantity: z.number().int().min(1).max(64),
});
export type DeckCard = z.infer<typeof deckCardSchema>;
export const ruleModuleSchema = z.strictObject({
  id: ruleModuleIdSchema,
  ruleKey: resourceKeySchema,
  summary: z.string().max(4000),
  rules: z.strictObject({
    kind: z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/),
    notes: z.string().max(4000),
  }),
});
export type RuleModule = z.infer<typeof ruleModuleSchema>;
export const assetSchema = z.strictObject({
  id: assetIdSchema,
  ownerType: z.enum(['PRODUCT', 'CHARACTER', 'DECK', 'CARD', 'RULE_MODULE']),
  ownerId: z.union([
    productIdSchema,
    characterIdSchema,
    deckIdSchema,
    cardDefinitionIdSchema,
    ruleModuleIdSchema,
  ]),
  type: z.enum(['ARTWORK', 'ICON', 'RULES_TEXT']),
  objectKey: z
    .string()
    .min(1)
    .max(500)
    .refine(
      (key) =>
        !key.startsWith('/') &&
        !key.includes('..') &&
        !key.includes('\\') &&
        !key.includes(':'),
      'Object key must be a relative storage key',
    ),
  licenseStatus: z.enum(['ORIGINAL', 'USER_OWNED', 'LICENSED']),
});
export type Asset = z.infer<typeof assetSchema>;

export const contentTranslationSchema = z.strictObject({
  entityType: z.enum([
    'PRODUCT',
    'CHARACTER',
    'CARD',
    'RULE_MODULE',
    'MECHANIC',
    'CHOICE_OPTION',
  ]),
  entityId: z.string().min(1).max(320),
  field: z.enum(['name', 'rulesText', 'summary', 'label']),
  locale: z.enum(['en-US', 'zh-TW']),
  text: z.string().min(1).max(5000),
  sourceKind: z.enum([
    'OFFICIAL',
    'AUTHORIZED',
    'COMMUNITY',
    'USER_OWNED',
    'MANUAL',
    'MACHINE',
  ]),
  sourceRef: z.string().max(1000).nullable(),
  status: z.enum([
    'VERIFIED',
    'COMMUNITY_REFERENCE',
    'MACHINE_DRAFT',
    'MANUAL_DRAFT',
    'MANUAL_REVIEWED',
  ]),
});
export const contentRequirementSchema = z.strictObject({
  characterId: characterIdSchema,
  primaryDeckCount: z.number().int().min(1).max(256),
  sideDecks: z
    .array(
      z.strictObject({
        deckId: deckIdSchema,
        quantity: z.number().int().min(1).max(256),
      }),
    )
    .max(32),
  components: z
    .array(
      z.strictObject({
        key: resourceKeySchema,
        label: name,
        mechanicKey: registeredSpecialRuleKeySchema,
      }),
    )
    .max(32),
});
export const contentMetadataSchema = z.strictObject({
  requirements: z.array(contentRequirementSchema).max(256).optional(),
  translations: z.array(contentTranslationSchema).max(50_000).optional(),
});

export const contentPackSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    version: z.strictObject({
      id: contentVersionIdSchema,
      name,
      createdAt: z.iso.datetime(),
    }),
    products: z.array(productSchema).max(32),
    characters: z.array(characterSchema).max(256),
    decks: z.array(deckSchema).max(1024),
    cards: z.array(cardDefinitionSchema).max(10_000),
    deckCards: z.array(deckCardSchema).max(20_000),
    ruleModules: z.array(ruleModuleSchema).max(256),
    assets: z.array(assetSchema).max(10_000),
    requirements: z.array(contentRequirementSchema).max(256).optional(),
    translations: z.array(contentTranslationSchema).max(50_000).optional(),
  })
  .superRefine((pack, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: 'custom', message });
    const unique = (values: readonly string[], label: string) => {
      if (new Set(values).size !== values.length) issue(`Duplicate ${label}`);
    };
    for (const [label, rows] of Object.entries({
      products: pack.products,
      characters: pack.characters,
      decks: pack.decks,
      cards: pack.cards,
      ruleModules: pack.ruleModules,
      assets: pack.assets,
    }))
      unique(
        rows.map((row) => row.id),
        `${label} ID`,
      );
    for (const [label, rows] of Object.entries({
      products: pack.products,
      characters: pack.characters,
      decks: pack.decks,
    }))
      unique(
        rows.map((row) => row.slug),
        `${label} slug`,
      );
    unique(
      pack.ruleModules.map((rule) => rule.ruleKey),
      'rule key',
    );
    unique(
      pack.cards.map((card) =>
        card.id.replace('carddef_', '').replaceAll('_', '-'),
      ),
      'derived card slug',
    );
    unique(
      pack.deckCards.map((entry) => `${entry.deckId}/${entry.cardId}`),
      'deck/card association',
    );
    const products = new Set(pack.products.map((row) => row.id));
    const characters = new Set(pack.characters.map((row) => row.id));
    const decks = new Map(pack.decks.map((row) => [row.id, row]));
    const cards = new Map(pack.cards.map((row) => [row.id, row]));
    for (const character of pack.characters)
      if (!products.has(character.productId))
        issue('Missing character product');
    for (const deck of pack.decks)
      if (deck.characterId !== null && !characters.has(deck.characterId))
        issue('Missing deck character');
    for (const card of pack.cards)
      if (card.characterId !== undefined && !characters.has(card.characterId))
        issue('Missing card character');
    for (const entry of pack.deckCards) {
      const deck = decks.get(entry.deckId);
      const card = cards.get(entry.cardId);
      if (!deck || !card) {
        issue('Missing deck/card reference');
        continue;
      }
      if (
        card.characterId !== undefined &&
        card.characterId !== deck.characterId
      )
        issue('Character-specific card in another character deck');
      const isDrink = card.type === 'DRINK' || card.type === 'DRINK_EVENT';
      if ((deck.type === 'INN_DRINK') !== isDrink)
        issue('Card category does not match deck type');
    }
    const owners = {
      PRODUCT: products,
      CHARACTER: characters,
      DECK: new Set(decks.keys()),
      CARD: new Set(cards.keys()),
      RULE_MODULE: new Set(pack.ruleModules.map((row) => row.id)),
    };
    unique(
      (pack.requirements ?? []).map((row) => row.characterId),
      'character requirement',
    );
    unique(
      (pack.translations ?? []).map(
        (row) => `${row.entityType}/${row.entityId}/${row.field}/${row.locale}`,
      ),
      'translation',
    );
    for (const requirement of pack.requirements ?? []) {
      if (!characters.has(requirement.characterId))
        issue('Missing requirement character');
      for (const side of requirement.sideDecks) {
        const deck = decks.get(side.deckId);
        if (
          !deck ||
          deck.characterId !== requirement.characterId ||
          deck.type !== 'SPECIAL'
        )
          issue('Missing required side deck');
      }
    }
    for (const translation of pack.translations ?? []) {
      if (translation.entityType === 'CHOICE_OPTION') {
        if (
          !pack.cards.some((card) =>
            card.effects.some(
              (effect) =>
                effect.op === 'OPEN_OPTION' &&
                effect.options.some(
                  (option) =>
                    `${card.id}/${option.id}` === translation.entityId,
                ),
            ),
          )
        )
          issue('Missing translation choice option');
      } else if (translation.entityType === 'MECHANIC') {
        if (
          !pack.characters.some(
            (character) => translation.entityId in character.rules.resources,
          )
        )
          issue('Missing translation mechanic');
      } else if (
        !(owners[translation.entityType] as ReadonlySet<string>).has(
          translation.entityId,
        )
      )
        issue('Missing translation entity');
    }
    for (const asset of pack.assets)
      if (!(owners[asset.ownerType] as ReadonlySet<string>).has(asset.ownerId))
        issue('Missing asset owner');
  });

export type ContentPack = z.infer<typeof contentPackSchema>;

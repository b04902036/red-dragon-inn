import { describe, expect, it } from 'vitest';
import {
  cardDefinitionSchema,
  cardInstanceSchema,
  contentCatalogSchema,
} from '../../src/content/cards';
import {
  effectSchema,
  resourceAdjustmentParamsSchema,
} from '../../src/content/effects';

const common = {
  id: 'carddef_sample',
  name: 'Sample test card',
  rulesText: 'Original test content only.',
  source: 'SAMPLE',
  effects: [],
};
const cardExamples = [
  { ...common, type: 'ACTION' },
  { ...common, type: 'SOMETIMES', responseKind: 'IGNORE' },
  { ...common, type: 'ANYTIME' },
  { ...common, type: 'GAMBLING' },
  { ...common, type: 'CHEATING' },
  {
    ...common,
    type: 'DRINK',
    alcoholContent: 2,
    fortitudeChange: -1,
    chaser: true,
  },
  { ...common, type: 'DRINK_EVENT' },
  {
    ...common,
    type: 'SPECIAL',
    characterId: 'character_sample',
    sideDeckKey: 'sample_deck',
  },
];
const effects = [
  { op: 'MODIFY_DRINK', alcoholDelta: 2, fortitudeDelta: -1 },
  {
    op: 'MODIFY_PENDING_EFFECT',
    effectIndex: 0,
    delta: 1,
    allowDrinkEvents: true,
  },
  { op: 'TAKE_GAMBLING_CONTROL', allowedNextCategories: ['CHEATING'] },
  { op: 'WIN_GAMBLING' },
  { op: 'LEAVE_GAMBLING', target: 'SELF' },
  { op: 'TRANSFER_GOLD', target: 'CHOSEN_PLAYER', amount: 3 },
  { op: 'PAY_INN', target: 'SELF', amount: 1 },
  { op: 'DISCARD_CARDS', target: 'SELF', count: 2 },
  { op: 'OPEN_CHOICE', target: 'SELF', kind: 'TARGET' },
  {
    op: 'OPEN_OPTION',
    target: 'SELF',
    options: [{ id: 'sample', label: 'Sample choice' }],
  },
  { op: 'START_GAMBLING' },
  { op: 'MODIFY_PENDING_EFFECT', effectIndex: 0, delta: -2 },
  { op: 'CHANGE_STAT', target: 'CHOSEN_PLAYER', stat: 'FORTITUDE', delta: -2 },
  { op: 'DRAW_CARDS', target: 'SELF', count: 2 },
  { op: 'IGNORE', scope: 'CURRENT_EFFECT' },
  { op: 'NEGATE', scope: 'TOP_STACK' },
  {
    op: 'CUSTOM',
    target: 'SELF',
    effect_key: 'sample.adjust-resource',
    params: { resource: 'tokens', delta: 1 },
  },
];

describe('card definition and JSON effect contracts', () => {
  it('validates Chaser source metadata only on Drink definitions', () => {
    for (const chaserSource of ['SAME_SOURCE', 'INN'])
      expect(
        cardDefinitionSchema.parse({ ...cardExamples[5], chaserSource }),
      ).toMatchObject({ chaserSource });
    for (const input of [
      { ...cardExamples[5], chaserSource: 'CLIENT_DECK' },
      { ...cardExamples[0], chaserSource: 'INN' },
      { ...cardExamples[6], chaserSource: 'INN' },
    ])
      expect(cardDefinitionSchema.safeParse(input).success).toBe(false);
  });

  it.each([
    { op: 'MODIFY_DRINK', alcoholDelta: 1 },
    { op: 'MODIFY_DRINK', alcoholDelta: 0.5, fortitudeDelta: 0 },
    {
      op: 'MODIFY_DRINK',
      alcoholDelta: 0,
      fortitudeDelta: Number.MAX_SAFE_INTEGER + 1,
    },
    {
      op: 'MODIFY_DRINK',
      alcoholDelta: 1,
      fortitudeDelta: 0,
      allowDrinkEvents: 'true',
    },
    {
      op: 'MODIFY_PENDING_EFFECT',
      effectIndex: 0,
      delta: 1,
      allowDrinkEvents: 1,
    },
    {
      op: 'MODIFY_DRINK',
      alcoholDelta: 1,
      fortitudeDelta: 0,
      script: 'eval(1)',
    },
  ])('rejects unsafe or malformed Drink modifier metadata %#', (input) => {
    expect(effectSchema.safeParse(input).success).toBe(false);
  });
  it.each(cardExamples)(
    'accepts and round-trips $type definitions',
    (example) => {
      const definition = cardDefinitionSchema.parse(example);
      expect(
        cardDefinitionSchema.parse(JSON.parse(JSON.stringify(definition))),
      ).toEqual(example);
    },
  );

  it.each(effects)('accepts the reserved $op DSL contract', (effect) => {
    expect(effectSchema.parse(effect)).toEqual(effect);
    expect(
      cardDefinitionSchema.parse({
        ...common,
        type: 'ACTION',
        effects: [effect],
      }).effects,
    ).toEqual([effect]);
  });

  it('accepts private content metadata and optional character ownership without creating instances', () => {
    const definition = cardDefinitionSchema.parse({
      ...common,
      type: 'ACTION',
      source: 'PRIVATE',
      characterId: 'character_sample',
    });
    expect(definition.source).toBe('PRIVATE');
    expect(definition.characterId).toBe('character_sample');
    expect(definition).not.toHaveProperty('location');
    expect(definition).not.toHaveProperty('ownerId');
  });

  it.each([
    { ...common, type: 'UNKNOWN' },
    { ...common, type: 'ACTION', id: 'card_sample' },
    { ...common, type: 'ACTION', source: 'SCRAPED' },
    { ...common, type: 'SPECIAL' },
    { ...common, type: 'SOMETIMES', responseKind: 'ACTION' },
    {
      ...common,
      type: 'DRINK',
      alcoholContent: '2',
      fortitudeChange: 0,
      chaser: false,
    },
    {
      ...common,
      type: 'DRINK',
      alcoholContent: -1001,
      fortitudeChange: 0,
      chaser: false,
    },
    {
      ...common,
      type: 'DRINK',
      alcoholContent: 2,
      fortitudeChange: 0,
      chaser: 'true',
    },
    { ...common, type: 'ACTION', script: 'return 1' },
    { ...common, type: 'ACTION', effects: [() => 1] },
    { ...common, type: 'ACTION', effects: ['console.log("unsafe")'] },
  ])('rejects invalid or executable definition input %#', (input) => {
    expect(cardDefinitionSchema.safeParse(input).success).toBe(false);
  });

  it.each([
    { op: 'CHANGE_STAT', target: 'SELF', stat: 'GOLD', delta: '1' },
    { op: 'CHANGE_STAT', target: 'EVERYONE', stat: 'GOLD', delta: 1 },
    { op: 'DRAW_CARDS', target: 'SELF', count: 0 },
    { op: 'TAKE_GAMBLING_CONTROL', allowedNextCategories: [] },
    {
      op: 'TAKE_GAMBLING_CONTROL',
      allowedNextCategories: ['CHEATING', 'CHEATING'],
    },
    { op: 'TAKE_GAMBLING_CONTROL', allowedNextCategories: ['ACTION'] },
    { op: 'WIN_GAMBLING', playerId: 'player_0' },
    { op: 'LEAVE_GAMBLING', target: 'ALL_PLAYERS' },
    { op: 'TRANSFER_GOLD', target: 'SELF', amount: -1 },
    { op: 'PAY_INN', target: 'SELF', amount: '1' },
    { op: 'DISCARD_CARDS', target: 'SELF', count: 65 },
    { op: 'OPEN_CHOICE', target: 'SELF', kind: 'SCRIPT' },
    {
      op: 'OPEN_OPTION',
      target: 'SELF',
      options: [
        { id: 'same', label: 'A' },
        { id: 'same', label: 'B' },
      ],
    },
    { op: 'OPEN_OPTION', target: 'SELF', options: [] },
    { op: 'START_GAMBLING', script: 'eval(1)' },
    { op: 'MODIFY_PENDING_EFFECT', effectIndex: 32, delta: 1 },
    {
      op: 'CUSTOM',
      target: 'SELF',
      effect_key: 'unregistered.handler',
      params: {},
    },
    {
      op: 'CUSTOM',
      target: 'SELF',
      effect_key: 'sample.adjust-resource',
      params: { resource: 'tokens', delta: 1, script: 'eval(1)' },
    },
    {
      op: 'CUSTOM',
      target: 'SELF',
      effect_key: 'sample.adjust-resource',
      params: { resource: 'tokens', delta: '1' },
    },
    {
      op: 'CUSTOM',
      target: 'SELF',
      effect_key: 'sample.adjust-resource',
      params: { resource: '__proto__', delta: 1 },
    },
    {
      op: 'CUSTOM',
      target: 'SELF',
      effect_key: 'sample.adjust-resource',
      params: { resource: 'tokens' },
    },
  ])('rejects invalid effect parameters %#', (input) => {
    expect(effectSchema.safeParse(input).success).toBe(false);
  });

  it('validates custom handler params independently at the handler boundary', () => {
    expect(
      resourceAdjustmentParamsSchema.parse({ resource: 'tokens', delta: -3 }),
    ).toEqual({ resource: 'tokens', delta: -3 });
    expect(
      resourceAdjustmentParamsSchema.safeParse({
        resource: 'tokens',
        delta: 0.5,
      }).success,
    ).toBe(false);
  });
  it('validates control metadata independently of card names', () => {
    const metadata = {
      allowedNextCategories: ['CHEATING'],
      immediateWin: true,
    };
    expect(
      cardDefinitionSchema.parse({
        ...common,
        type: 'GAMBLING',
        gambling: metadata,
      }),
    ).toMatchObject({ gambling: metadata });
    for (const gambling of [
      { ...metadata, allowedNextCategories: [] },
      { ...metadata, allowedNextCategories: ['CHEATING', 'CHEATING'] },
      { ...metadata, immediateWin: 'true' },
      { ...metadata, script: 'eval(1)' },
    ])
      expect(
        cardDefinitionSchema.safeParse({
          ...common,
          type: 'CHEATING',
          gambling,
        }).success,
      ).toBe(false);
  });

  it('validates versioned JSON catalogs and rejects duplicate IDs or definition/instance confusion', () => {
    const catalog = {
      schemaVersion: 1,
      cards: cardExamples.map((card, index) => ({
        ...card,
        id: `carddef_sample_${index}`,
      })),
    };
    expect(
      contentCatalogSchema.parse(JSON.parse(JSON.stringify(catalog))),
    ).toEqual(catalog);
    expect(
      contentCatalogSchema.safeParse({ schemaVersion: 2, cards: [] }).success,
    ).toBe(false);
    expect(
      contentCatalogSchema.safeParse({
        schemaVersion: 1,
        cards: [cardExamples[0], cardExamples[0]],
      }).success,
    ).toBe(false);
    expect(
      contentCatalogSchema.safeParse({
        schemaVersion: 1,
        cards: [
          {
            id: 'card_sample',
            definitionId: 'carddef_sample',
            ownerId: null,
            location: { zone: 'INN_DRINK_DECK', deckId: 'deck_inn' },
          },
        ],
      }).success,
    ).toBe(false);
  });
});

describe('card instance contracts', () => {
  const locations = [
    { zone: 'HAND', playerId: 'player_0' },
    { zone: 'CHARACTER_DECK', playerId: 'player_0', deckId: 'deck_character' },
    {
      zone: 'CHARACTER_DISCARD',
      playerId: 'player_0',
      deckId: 'deck_character',
    },
    { zone: 'DRINK_PILE', playerId: 'player_0' },
    { zone: 'INN_DRINK_DECK', deckId: 'deck_inn' },
    { zone: 'INN_DRINK_DISCARD', deckId: 'deck_inn' },
    { zone: 'RESOLUTION', resolutionId: 'resolution_sample' },
    { zone: 'SPECIAL_DECK', playerId: 'player_0', deckId: 'deck_special' },
    { zone: 'SPECIAL_DISCARD', playerId: 'player_0', deckId: 'deck_special' },
  ];

  it.each(locations)(
    'models only identity, definition reference, and $zone location metadata',
    (location) => {
      const instance = {
        id: 'card_sample',
        definitionId: 'carddef_sample',
        ownerId: null,
        location,
      };
      expect(cardInstanceSchema.parse(instance)).toEqual(instance);
      expect(
        cardInstanceSchema.safeParse({
          ...instance,
          name: 'Copied definition text',
        }).success,
      ).toBe(false);
      expect(
        cardInstanceSchema.safeParse({ ...instance, effects: [] }).success,
      ).toBe(false);
      expect(cardDefinitionSchema.safeParse(instance).success).toBe(false);
    },
  );

  it('rejects missing, mixed, or incorrectly typed runtime identities/location fields', () => {
    const instance = {
      id: 'card_sample',
      definitionId: 'carddef_sample',
      ownerId: 'player_0',
      location: { zone: 'HAND', playerId: 'player_0' },
    };
    expect(
      cardInstanceSchema.safeParse({ ...instance, id: 'carddef_sample' })
        .success,
    ).toBe(false);
    expect(
      cardInstanceSchema.safeParse({ ...instance, definitionId: 'card_sample' })
        .success,
    ).toBe(false);
    expect(
      cardInstanceSchema.safeParse({ ...instance, ownerId: 0 }).success,
    ).toBe(false);
    expect(
      cardInstanceSchema.safeParse({ ...instance, location: { zone: 'HAND' } })
        .success,
    ).toBe(false);
    expect(
      cardInstanceSchema.safeParse({
        ...instance,
        location: { zone: 'HAND', playerId: 'room_sample' },
      }).success,
    ).toBe(false);
    expect(
      cardInstanceSchema.safeParse({
        ...instance,
        location: {
          zone: 'HAND',
          playerId: 'player_0',
          deckOrder: ['card_secret'],
        },
      }).success,
    ).toBe(false);
  });
});

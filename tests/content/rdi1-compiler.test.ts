import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  compileRdi1Effect,
  compileRdi1Source,
  compileRdi1Trigger,
} from '../../src/content/rdi1-compiler';
import { verifyRdi1Pack } from '../../src/content/rdi1-pack';
import { cardDefinitionSchema } from '../../src/content/cards';
import { effectSchema } from '../../src/content/effects';
import { responseTriggerSchema } from '../../src/content/reaction-triggers';
import {
  requiredTranslationFields,
  verifyContentTranslations,
} from '../../src/content/localization';
import { importContent, validateContentImport } from '../../src/content/import';
import { rdi1SourceSchema } from '../../src/content/rdi1-source';
import { assetSchema } from '../../src/content/pack';

const source = rdi1SourceSchema.parse(
  JSON.parse(
    readFileSync('content-private/imports/rdi1/source-normalized.json', 'utf8'),
  ) as unknown,
);
const pack = compileRdi1Source(source);

describe('RDI1 private compiler and completeness', () => {
  it('compiles deterministic version-one data without mutating input or depending on source order', () => {
    const before = JSON.stringify(source);
    expect(JSON.stringify(compileRdi1Source(source))).toBe(
      JSON.stringify(pack),
    );
    const reordered = structuredClone(source);
    reordered.characters.reverse();
    reordered.mechanics.reverse();
    reordered.drinkDeck.cards.reverse();
    for (const character of reordered.characters) character.cards.reverse();
    expect(compileRdi1Source(reordered)).toEqual(pack);
    expect(JSON.stringify(source)).toBe(before);
    expect(pack.schemaVersion).toBe(1);
  });
  it('preserves all unique records, stable IDs, physical quantities, translations and structured schemas', () => {
    expect(pack.cards).toHaveLength(110);
    const ids = [
      ...pack.products,
      ...pack.characters,
      ...pack.decks,
      ...pack.cards,
    ].map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(pack.cards.every((card) => /^carddef_rdi1_/.test(card.id))).toBe(
      true,
    );
    expect(verifyRdi1Pack(pack, source)).toMatchObject({
      valid: true,
      characters: 4,
      characterDecks: { deirdre: 40, fiona: 40, gerki: 40, zot: 40 },
      characterPhysicalCards: 160,
      drinkPhysicalCards: 30,
      unknownMechanics: 0,
      unknownEffects: 0,
      sometimesWithoutStructuredLegality: 0,
      missingEnUS: 0,
      missingZhTW: 0,
      sampleProductionRecords: 0,
      errors: [],
    });
    for (const card of pack.cards) {
      expect(cardDefinitionSchema.safeParse(card).success).toBe(true);
      for (const effect of card.effects)
        expect(effectSchema.safeParse(effect).success).toBe(true);
      if (card.type === 'SOMETIMES')
        expect(
          responseTriggerSchema.safeParse(card.responseTrigger).success,
        ).toBe(true);
    }
    for (const field of requiredTranslationFields(pack))
      for (const locale of ['en-US', 'zh-TW'])
        expect(
          pack.translations!.filter(
            (row) =>
              row.entityId === field.entityId &&
              row.entityType === field.entityType &&
              row.field === field.field &&
              row.locale === locale,
          ),
        ).toHaveLength(1);
    expect(verifyContentTranslations(pack).complete).toBe(true);
    expect(pack.assets).toEqual([]);
    expect(
      pack.cards.every((card) => card.source === 'PUBLIC_RULES_PARAPHRASE'),
    ).toBe(true);
  });
  it('maps intrinsic gambling, collection direction, mandatory cost, hard counters, signed Drinks and traits explicitly', () => {
    for (const character of source.characters)
      for (const record of character.cards) {
        const card = pack.cards.find(
          (c) => c.id === `carddef_rdi1_${record.cardKey.replaceAll('.', '_')}`,
        )!;
        if (record.mechanicId === 'gambling_start_or_control')
          expect(card).toMatchObject({
            effects: [{ op: 'START_GAMBLING' }],
            gambling: { canStart: true },
          });
        if (record.mechanicId === 'gambling_raise_one')
          expect(card).toMatchObject({
            gambling: { canStart: false },
            effects: [
              {
                op: 'TAKE_GAMBLING_CONTROL',
                allowedNextCategories: ['GAMBLING', 'CHEATING'],
              },
              { op: 'ANTE_ALL_ACTIVE', amount: 1 },
            ],
          });
        if (record.mechanicId === 'negate_sometimes_counter')
          expect(card).toMatchObject({
            counterFamily: 'rdi_core_hard_no',
            counterPolicy: 'SAME_FAMILY_ONLY',
          });
        if (record.mechanicId === 'order_two_extra_drinks')
          expect(card).toMatchObject({
            mandatoryGoldCost: 1,
            effects: [{ op: 'ORDER_EXTRA_DRINKS', count: 2 }],
          });
        if (
          [
            'take_one_gold',
            'heal_other_charge_gold',
            'heal_all_and_collect',
            'collect_one_from_each_other',
          ].includes(record.mechanicId)
        )
          expect(card.effects.some((e) => e.op === 'COLLECT_GOLD')).toBe(true);
      }
    expect(pack.characters.map((c) => c.rules.traits)).toEqual([
      ['ELF'],
      ['HUMAN'],
      ['HALFLING'],
      ['HUMAN'],
    ]);
    expect(
      pack.cards.find((card) => card.id.endsWith('_cutting_off')),
    ).toMatchObject({ alcoholContent: -1 });
    expect(
      pack.cards.find((card) => card.id.endsWith('_troll_swill')),
    ).toMatchObject({
      traitReplacements: [
        { trait: 'TROLL', alcoholContent: 2, fortitudeChange: 0 },
      ],
    });
  });
  it('dry-runs the real generated pack without persistence', async () => {
    let writes = 0;
    const report = await importContent(
      JSON.stringify(pack),
      {
        saveDraft: async () => {
          writes++;
        },
      },
      { dryRun: true },
    );
    expect(report).toMatchObject({
      valid: true,
      written: false,
      uniqueCards: 110,
      physicalCards: 190,
      errors: [],
    });
    expect(writes).toBe(0);
    expect(validateContentImport(JSON.stringify(pack)).pack).toEqual(pack);
  });
  it.each([
    'quantity',
    'effect',
    'trigger',
    'en-US',
    'zh-TW',
    'provenance',
    'character',
    'extra',
    'asset',
  ] as const)('fails closed for %s corruption', (kind) => {
    const changed = structuredClone(pack);
    if (kind === 'quantity') changed.deckCards[0]!.quantity--;
    if (kind === 'effect') changed.cards[0]!.effects = [];
    if (kind === 'trigger') {
      const card = changed.cards.find((c) => c.type === 'SOMETIMES')!;
      if (card.type === 'SOMETIMES') delete card.responseTrigger;
    }
    if (kind === 'en-US' || kind === 'zh-TW')
      changed.translations = changed.translations!.filter(
        (t) => t.locale !== kind,
      );
    if (kind === 'provenance') changed.cards[0]!.source = 'SAMPLE';
    if (kind === 'character') changed.characters[0]!.rules.traits = ['ORC'];
    if (kind === 'extra') {
      changed.cards.push(
        cardDefinitionSchema.parse({
          ...changed.cards[0],
          id: 'carddef_extra',
        }),
      );
    }
    if (kind === 'asset')
      changed.assets.push(
        assetSchema.parse({
          id: 'asset_unlicensed',
          ownerType: 'PRODUCT',
          ownerId: changed.products[0]!.id,
          type: 'ARTWORK',
          objectKey: 'unlicensed.png',
          licenseStatus: 'USER_OWNED',
        }),
      );
    expect(verifyRdi1Pack(changed, source).valid).toBe(false);
  });
  it('rejects malformed packs, unknown effects, invalid source counts and unknown character identity', () => {
    expect(verifyRdi1Pack(null, source)).toMatchObject({
      valid: false,
      characters: 0,
    });
    const bad = structuredClone(pack) as unknown as {
      cards: { effects: unknown[] }[];
    };
    bad.cards[0]!.effects = [{ op: 'CUSTOM', effect_key: 'unknown-mechanic' }];
    expect(verifyRdi1Pack(bad, source)).toMatchObject({
      valid: false,
      unknownEffects: 1,
    });
    const invalid = structuredClone(source);
    invalid.characters[0]!.cards[0]!.quantity++;
    expect(() => compileRdi1Source(invalid)).toThrow('physical deck');
    const identity = structuredClone(source);
    identity.characters[0]!.canonicalName = 'Unrecognized adventurer';
    expect(() => compileRdi1Source(identity)).toThrow('identity');
  });
  it('covers explicit optional trigger facts and rejects non-response legality', () => {
    expect(
      compileRdi1Trigger({
        mode: 'SYSTEM_RESPONSE',
        trigger: { systemEvent: 'ANTE_REQUIRED', actor: 'SELF' },
      }).alternatives[0],
    ).toContainEqual({
      kind: 'PAYMENT_CONTEXT',
      payer: 'SELF',
      purpose: 'ANTE',
      minAmount: 1,
    });
    expect(
      compileRdi1Trigger({
        mode: 'SYSTEM_RESPONSE',
        trigger: {
          systemEvent: 'FORTITUDE_LOSS_RESOLVED',
          affected: 'SELF',
          sourcePlayer: 'OTHER',
        },
      }).alternatives[0],
    ).toContainEqual({
      kind: 'ACTUAL_STAT_LOSS',
      stat: 'FORTITUDE',
      relation: 'SELF',
      minAmount: 1,
    });
    for (const legality of [{ mode: 'ANYTIME' }, { modes: ['ACTION_PHASE'] }])
      expect(() =>
        compileRdi1Trigger(
          legality as Parameters<typeof compileRdi1Trigger>[0],
        ),
      ).toThrow('Sometimes legality');
    expect(compileRdi1Effect({ op: 'IGNORE_CONTEXT_FOR_SELF' })).toEqual({
      op: 'IGNORE',
      scope: 'CURRENT_EFFECT',
    });
  });
});

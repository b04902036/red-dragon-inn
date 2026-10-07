import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import {
  compileRdi2Source,
  compileRdi2Effect,
  compileRdi2Trigger,
  combineRdi1Rdi2,
} from '../../src/content/rdi2-compiler';
import { verifyRdi2Pack } from '../../src/content/rdi2-pack';
import { contentPackSchema } from '../../src/content/pack';
import { cardDefinitionSchema } from '../../src/content/cards';
import { verifyProductionContent } from '../../src/content/production';
import { verifyContentTranslations } from '../../src/content/localization';
import { rdi2CompileInput } from '../fixtures/rdi2-compile-input';
import { contentPresentation } from '../../src/content/presentation';
import { releasedCatalog } from '../../src/content/catalog';

const { source, audit } = rdi2CompileInput();
const pack = compileRdi2Source(source, audit);
const rdi1 = contentPackSchema.parse(
  JSON.parse(
    readFileSync(
      'content-private/imports/rdi1/pack-content_rdi1_mechanics_v2.json',
      'utf8',
    ),
  ) as unknown,
);
const combined = combineRdi1Rdi2(rdi1, pack);

it('deterministically compiles every audited row into unique, executable, bilingual definitions and exact physical quantities', () => {
  expect(compileRdi2Source(source, audit)).toEqual(pack);
  expect(new Set(pack.cards.map((c) => c.id)).size).toBe(pack.cards.length);
  expect(pack.characters).toHaveLength(4);
  const report = verifyRdi2Pack(pack, pack);
  expect(report).toMatchObject({
    valid: true,
    unknownEffects: [],
    errors: [],
    decks: {
      deck_rdi2_dimli: 40,
      deck_rdi2_eve: 40,
      deck_rdi2_fleck: 40,
      deck_rdi2_gog: 40,
      deck_rdi2_inn: 30,
    },
  });
  for (const card of pack.cards) {
    expect(cardDefinitionSchema.safeParse(card).success).toBe(true);
    if (card.type === 'SOMETIMES')
      expect(card.responseTrigger?.alternatives.length).toBeGreaterThan(0);
    if (card.type !== 'DRINK') expect(card.effects.length).toBeGreaterThan(0);
  }
  expect(verifyContentTranslations(pack).complete).toBe(true);
  expect(
    pack.translations!.every(
      (t) => t.sourceKind === 'MANUAL' && t.status === 'MANUAL_REVIEWED',
    ),
  ).toBe(true);
  expect(contentPresentation(pack, false, 'zh-TW').characters).toHaveLength(4);
  expect(pack.assets).toEqual([]);
});
it('combines eight playable characters while retaining every RDI1 definition, ID, quantity and translation unchanged', () => {
  expect(verifyRdi2Pack(combined, combined).valid).toBe(true);
  expect(combined.characters).toHaveLength(8);
  expect(combined.cards.slice(0, rdi1.cards.length)).toEqual(rdi1.cards);
  expect(combined.deckCards.slice(0, rdi1.deckCards.length)).toEqual(
    rdi1.deckCards,
  );
  expect(combined.translations!.slice(0, rdi1.translations!.length)).toEqual(
    rdi1.translations,
  );
  expect(
    verifyProductionContent(combined, releasedCatalog.slice(0, 8)).complete,
  ).toBe(true);
  expect(contentPresentation(combined).innDrinkDecks).toHaveLength(2);
});
it('preserves the reviewed high-risk bindings rather than treating payment effects as activation costs', () => {
  const card = (suffix: string) =>
    pack.cards.find((c) => c.id.endsWith(suffix))!;
  expect(card('gog_order_two_extra_drinks_paid')).toMatchObject({
    mandatoryGoldCost: 1,
    effects: [{ op: 'ORDER_EXTRA_DRINKS', count: 2 }],
  });
  expect(card('gog_damage_three_pay_inn_one')).not.toHaveProperty(
    'mandatoryGoldCost',
  );
  expect(card('gog_damage_three_pay_inn_one').effects).toEqual([
    {
      op: 'CHANGE_STAT',
      target: 'CHOSEN_PLAYER',
      stat: 'FORTITUDE',
      delta: -3,
    },
    { op: 'PAY_INN', target: 'SELF', amount: 1 },
  ]);
  expect(card('eve_cheat_control_and_eject')).toMatchObject({
    targetPolicy: 'ANY_LIVING_PLAYER',
    effects: [
      {
        op: 'TAKE_GAMBLING_CONTROL',
        allowedNextCategories: ['GAMBLING', 'CHEATING'],
      },
      {
        op: 'FORCE_LEAVE_GAMBLING',
        target: 'CHOSEN_PLAYER',
        allowSelfTarget: true,
      },
    ],
  });
  expect(card('dimli_force_extra_drink_during_other_drink_phase')).not.toEqual(
    card('gog_force_extra_drink_during_other_drink_phase'),
  );
  expect(card('drink_mead')).toMatchObject({
    type: 'DRINK',
    builtInSplit: true,
    alcoholContent: 3,
  });
  expect(card('drink_fine_ambrosia')).toMatchObject({
    type: 'DRINK_EVENT',
    effects: [
      { op: 'CHANGE_STAT', target: 'SELF', stat: 'ALCOHOL', delta: 1 },
      { op: 'CHANGE_STAT', target: 'SELF', stat: 'FORTITUDE', delta: 4 },
      { op: 'PAY_INN', target: 'SELF', amount: 2 },
    ],
  });
});
it('rejects mismatched source hashes, unresolved source edits and unsupported compiler bindings', () => {
  expect(() =>
    compileRdi2Source(source, {
      ...audit,
      hashes: { ...audit.hashes, normalizedSha256: '0'.repeat(64) },
    }),
  ).toThrow();
  const changed = structuredClone(source) as {
    mechanics: { effects: unknown[] }[];
  };
  changed.mechanics[0]!.effects = [{ op: 'UNKNOWN' }];
  expect(() => compileRdi2Source(changed, audit)).toThrow();
  expect(() => compileRdi2Effect({ op: 'UNKNOWN' })).toThrow('Unsupported');
  expect(() => compileRdi2Trigger('UNKNOWN', 'dimli')).toThrow('Unsupported');
  expect(() =>
    compileRdi2Trigger('force_extra_drink_during_other_drink_phase', 'eve'),
  ).toThrow('owner');
  expect(() =>
    compileRdi2Effect({
      op: 'CHANGE_STAT',
      stat: 'GOLD',
      delta: 1,
      target: 'UNKNOWN',
    }),
  ).toThrow();
});
it('rejects missing, altered, duplicated and no-op records, unknown provenance and missing translations', () => {
  expect(verifyRdi2Pack(null, pack).valid).toBe(false);
  for (const transform of [
    (p: typeof pack) => {
      p.deckCards[0]!.quantity--;
    },
    (p: typeof pack) => {
      p.cards[0]!.effects = [];
    },
    (p: typeof pack) => {
      p.cards[0]!.source = 'TEST_FIXTURE';
    },
    (p: typeof pack) => {
      p.cards.push(p.cards[0]!);
    },
    (p: typeof pack) => {
      p.translations = [];
    },
    (p: typeof pack) => {
      const c = p.cards.find((c) => c.type === 'SOMETIMES')!;
      if (c.type === 'SOMETIMES') delete c.responseTrigger;
    },
  ]) {
    const modified = structuredClone(pack);
    transform(modified);
    expect(verifyRdi2Pack(modified, pack).valid).toBe(false);
  }
});

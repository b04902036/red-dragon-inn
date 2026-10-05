import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import {
  rdi1SourceSchema,
  verifyRdi1Source,
} from '../../src/content/rdi1-source';
import { verifyRdi1Reaudit } from '../../src/content/rdi1-reaudit';
import type { Rdi1Source } from '../../src/content/rdi1-source';
import { verifyRdi1Pack } from '../../src/content/rdi1-pack';
import { createHash } from 'node:crypto';
import { rdi1PublishedV1 } from '../fixtures/rdi1-content';

const source = rdi1SourceSchema.parse(
  JSON.parse(
    readFileSync('content-private/imports/rdi1/source-normalized.json', 'utf8'),
  ),
);
const ledger: unknown = JSON.parse(
  readFileSync(
    'reference/rdi1/reaudit-2026-10-05/verification-ledger (1).json',
    'utf8',
  ),
);
const mutations: { name: string; change: (s: Rdi1Source) => void }[] = [
  {
    name: 'wrong current official reference',
    change: (s) => {
      s.sourceRefs.official_rules_current!.url =
        'https://example.com/historical.pdf';
    },
  },
  {
    name: 'missing mechanic',
    change: (s) => {
      s.mechanics.pop();
    },
  },
  {
    name: 'wrong mechanic type',
    change: (s) => {
      s.mechanics[0]!.type = 'ANYTIME';
    },
  },
  {
    name: 'unapproved summary',
    change: (s) => {
      s.mechanics[0]!.rulesSummary['en-US'] = 'Changed summary';
    },
  },
  {
    name: 'character summary mismatch',
    change: (s) => {
      s.characters[0]!.cards[0]!.rulesSummary['zh-TW'] = '錯誤摘要';
    },
  },
  {
    name: 'coarse legacy evidence',
    change: (s) => {
      s.mechanics[0]!.verification = {
        status: 'MECHANICALLY_VERIFIED',
        confidence: 'HIGH',
        basis: ['official_rules_current'],
      };
    },
  },
  {
    name: 'wrong evidence tier',
    change: (s) => {
      const v = s.mechanics[0]!.verification;
      if (v.status === 'REAUDITED')
        v.evidenceTier = 'LIMITED_PRIMARY_CARD_TEXT';
    },
  },
  {
    name: 'wrong evidence reference',
    change: (s) => {
      s.mechanics[0]!.verification.basis = ['official_rules_current'];
    },
  },
  {
    name: 'missing Drink',
    change: (s) => {
      s.drinkDeck.cards.pop();
    },
  },
  {
    name: 'wrong Drink type',
    change: (s) => {
      s.drinkDeck.cards[0]!.type = 'DRINK_EVENT';
    },
  },
  {
    name: 'wrong Alcohol',
    change: (s) => {
      s.drinkDeck.cards[0]!.alcoholContent = 9;
    },
  },
  {
    name: 'wrong Fortitude',
    change: (s) => {
      s.drinkDeck.cards[0]!.fortitudeChange = 9;
    },
  },
  {
    name: 'wrong Chaser',
    change: (s) => {
      s.drinkDeck.cards[0]!.chaser = true;
    },
  },
  {
    name: 'wrong central Drink source',
    change: (s) => {
      const e = s.mechanics.find((m) => m.id === 'all_players_drink_now')!
        .effects[0]!;
      if (e.op === 'FORCE_SIMULTANEOUS_DRINK') e.source = 'DRINK_PILE';
    },
  },
  {
    name: 'pre-Chaser timing',
    change: (s) => {
      const l = s.mechanics.find(
        (m) => m.id === 'force_extra_drink_on_reveal',
      )!.legality;
      if ('mode' in l && l.mode === 'RESPONSE')
        l.trigger.timing = 'AFTER_REVEAL_BEFORE_RESOLVE';
    },
  },
  {
    name: 'wrong counter source type',
    change: (s) => {
      const l = s.mechanics.find(
        (m) => m.id === 'negate_drink_change_card',
      )!.legality;
      if ('mode' in l && l.mode === 'RESPONSE')
        l.trigger.sourceTypes = ['ANYTIME'];
    },
  },
  {
    name: 'missing protection',
    change: (s) => {
      delete s.mechanics.find((m) => m.id === 'negate_drink_change_card')!
        .counterMetadata;
    },
  },
  {
    name: 'legacy contest policy',
    change: (s) => {
      const e = s.drinkDeck.cards.find(
        (d) => d.drinkKey === 'drinking_contest',
      )!.effectPlan![0]!;
      if (e.op === 'DRINKING_CONTEST') delete e.rules;
    },
  },
  {
    name: 'wrong House refill policy',
    change: (s) => {
      const e = s.drinkDeck.cards.find((d) => d.drinkKey === 'round_on_house')!
        .effectPlan![0]!;
      if (e.op === 'ROUND_ON_HOUSE') delete e.payForRefill;
    },
  },
];
it.each(mutations)(
  'rejects $name independently of deck totals',
  ({ change }) => {
    const changed = structuredClone(source);
    change(changed);
    expect(verifyRdi1Reaudit(changed, ledger).valid).toBe(false);
  },
);
it('rejects malformed, changed-origin and duplicate ledgers', () => {
  expect(verifyRdi1Reaudit(source, {}).valid).toBe(false);
  const changed = JSON.parse(JSON.stringify(ledger)) as {
    auditedFileSha256: string;
    characterMechanics: unknown[];
  };
  changed.auditedFileSha256 = '0'.repeat(64);
  expect(verifyRdi1Reaudit(source, changed).valid).toBe(false);
  changed.auditedFileSha256 =
    '91357d8e03180e397caf760ac0fbadac9c1260a79a89eeea81751ea5619b2156';
  changed.characterMechanics[1] = changed.characterMechanics[0];
  expect(verifyRdi1Reaudit(source, changed).valid).toBe(false);
});
it('checks every one of the 40 mechanics and 18 Drink definitions individually', () => {
  const report = verifyRdi1Reaudit(source, ledger);
  expect(report.errors).toEqual([]);
  expect(report.valid).toBe(true);
  expect(report.mechanics).toHaveLength(40);
  expect(report.drinks).toHaveLength(18);
  expect(
    [...report.mechanics, ...report.drinks].every(
      (row) => row.status === 'PASS',
    ),
  ).toBe(true);
  expect(report.drinks.reduce((sum, row) => sum + row.quantity, 0)).toBe(30);
});
it('rejects two balanced quantity changes even when all physical deck totals stay correct', () => {
  const changed = structuredClone(source);
  changed.characters[0]!.cards[0]!.quantity++;
  changed.characters[0]!.cards[1]!.quantity--;
  expect(
    verifyRdi1Reaudit(changed, ledger).errors.filter((e) =>
      e.includes('quantity mismatch'),
    ),
  ).toHaveLength(2);
  const drinks = structuredClone(source);
  drinks.drinkDeck.cards[0]!.quantity++;
  drinks.drinkDeck.cards[1]!.quantity--;
  expect(verifyRdi1Reaudit(drinks, ledger).errors).toHaveLength(2);
});
it.each(['UNKNOWN', 'TODO', 'ASSUMED', 'GUESSED'])(
  'rejects the unresolved %s marker',
  (marker) => {
    const changed = structuredClone(source);
    changed.mechanics[0]!.notes.push(marker);
    expect(
      verifyRdi1Source(changed, {
        requiredCapabilities: [
          ...new Set(
            changed.mechanics
              .flatMap((m) => m.engineRequirements)
              .concat(
                changed.drinkDeck.cards.flatMap(
                  (d) => d.engineRequirements ?? [],
                ),
              ),
          ),
        ],
      }).valid,
    ).toBe(false);
  },
);
it('retains the limited primary evidence and exactly-one-Gold substitution', () => {
  const row = source.mechanics.find(
    (m) => m.id === 'substitute_one_gold_from_inn',
  )!;
  expect(row.verification).toMatchObject({
    evidenceTier: 'LIMITED_PRIMARY_CARD_TEXT',
    quantityEvidenceTier: 'SECONDARY_COMPLETE_MATRIX',
  });
  expect(row.effects).toEqual([
    { op: 'SUBSTITUTE_PAYMENT_FROM_INN', amount: 1 },
  ]);
  const changed = structuredClone(source);
  const op = changed.mechanics.find((m) => m.id === row.id)!.effects[0]!;
  if (op.op !== 'SUBSTITUTE_PAYMENT_FROM_INN') throw new Error('Wrong fixture');
  op.amount = 2;
  expect(verifyRdi1Reaudit(changed, ledger).valid).toBe(false);
});

it('the original immutable v1 pack still verifies against its exact preserved source bytes', () => {
  const bytes = readFileSync(
    'content-private/imports/rdi1/versions/content_rdi1_mechanics_v1/content-private/imports/rdi1/source-normalized.json',
  );
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(
    '91357d8e03180e397caf760ac0fbadac9c1260a79a89eeea81751ea5619b2156',
  );
  expect(
    verifyRdi1Pack(rdi1PublishedV1, JSON.parse(bytes.toString('utf8'))).valid,
  ).toBe(true);
  expect(rdi1PublishedV1.version.id).toBe('content_rdi1_mechanics_v1');
});

it('the separate v2 artifact exactly matches the corrected source without changing the original pack file', () => {
  const artifact: unknown = JSON.parse(
    readFileSync(
      'content-private/imports/rdi1/pack-content_rdi1_mechanics_v2.json',
      'utf8',
    ),
  );
  expect(verifyRdi1Pack(artifact, source).valid).toBe(true);
  expect(readFileSync('content-private/imports/rdi1/pack.json')).toEqual(
    readFileSync(
      'content-private/imports/rdi1/versions/content_rdi1_mechanics_v1/pack.json',
    ),
  );
});

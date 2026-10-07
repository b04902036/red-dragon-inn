import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { m15Effects, m15Trigger } from '../fixtures/rdi2-m15-project';

const source = JSON.parse(
  readFileSync('content-private/imports/rdi2/source-candidate.json', 'utf8'),
);
const ledger = JSON.parse(
  readFileSync('content-private/imports/rdi2/verification-ledger.json', 'utf8'),
);
const mechanic = source.mechanics[14],
  entry = ledger.characterMechanics[14];

it('records complete project authority while preserving publisher examples and unavailable original Gog wording', () => {
  const override = mechanic.projectRulesetOverrides;
  expect(override).toMatchObject({
    label: 'M15 USER OVERRIDE',
    provenance: 'PROJECT_RULE_OVERRIDE',
    officialSourceVerified: false,
  });
  const origin = source.sources[override.sourceId];
  expect(
    createHash('sha256').update(readFileSync(origin.path)).digest('hex'),
  ).toBe(origin.sha256);
  expect(entry.characterVerification.gog).toMatchObject({
    exactCardText: 'UNAVAILABLE',
    normalizedSemantics: 'PROJECT_RULE_OVERRIDE',
    officialSourceVerified: false,
  });
  expect(
    entry.review.evidence.find(
      (e: { id: string }) => e.id === 'official-m15-gog-example',
    ).sourceId,
  ).toBe('official_m15_adonis_example');
  expect(source.sources.official_m15_adonis_example.kind).toBe(
    'OFFICIAL_RULES_EXAMPLE',
  );
  expect(entry.reviewHistory[0].status).toBe('BLOCKED_MISSING_EVIDENCE');
  expect(
    entry.review.checks.every((c: { result: string }) => c.result === 'PASS'),
  ).toBe(true);
  expect(entry.status).toBe('VERIFIED_FOR_PROJECT_RULESET');
});

it('binds the verified source plan to the existing generic trigger and self-only Ignore operation', () => {
  expect(mechanic.sharedImplementation).toEqual({
    responseTrigger: m15Trigger,
    effects: m15Effects,
  });
  expect(mechanic.effects).toEqual([{ op: 'IGNORE_CURRENT_EFFECT_FOR_SELF' }]);
  expect(entry.review.sharedImplementation).toEqual(
    mechanic.sharedImplementation,
  );
});

it('expands exactly two physical Gog copies from one identical normalized mechanic', () => {
  const gog = source.characters.find((c: { id: string }) => c.id === 'gog');
  const rows = gog.cards.filter(
    (c: { mechanicId: string }) => c.mechanicId === mechanic.id,
  );
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    quantity: 2,
    type: 'SOMETIMES',
    canonicalCardTitle: 'Stop poking Gog',
    projectRuleOverride: mechanic.projectRulesetOverrides,
  });
  const copies = rows.flatMap((row: { quantity: number }) =>
    Array.from({ length: row.quantity }, () => ({ row, mechanic })),
  );
  expect(copies).toHaveLength(2);
  expect(copies[0]).toEqual(copies[1]);
  expect(
    gog.cards.reduce((n: number, c: { quantity: number }) => n + c.quantity, 0),
  ).toBe(40);
  expect(entry.counts).toEqual({ dimli: 1, eve: 0, fleck: 0, gog: 2 });
});

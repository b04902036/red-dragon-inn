import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { verifyRdi2Source } from '../../src/content/rdi2-source';
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const s = read('content-private/imports/rdi2/source-candidate.json'),
  l = read('content-private/imports/rdi2/verification-ledger.json');
const m = s.mechanics[23],
  e = l.characterMechanics[23];
const matrix = readFileSync('reference/rdi2/rdi2-mechanics-matrix.csv', 'utf8');
const hashes = {
  normalizedSha256: 'a'.repeat(64),
  ledgerSha256: 'b'.repeat(64),
  matrixSha256: 'c'.repeat(64),
};
it('locks the single original Dimli conversion, self timing, other effects and official Alcohol-versus-effect clarification', () => {
  expect(e.status).toBe('VERIFIED');
  expect(e.counts).toEqual({ dimli: 1, eve: 0, fleck: 0, gog: 0 });
  expect(e.review.checks).toHaveLength(7);
  expect(
    e.review.checks.every((c: { result: string }) => c.result === 'PASS'),
  ).toBe(true);
  const r = e.review.evidence.find(
    (r: { physicalCopy?: number }) => r.physicalCopy === 1,
  );
  expect(r.canonicalTitle).toBe('Uuurp! That hit the spot!');
  expect(r.canonicalRecordSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(r.sourceFileSha256).toBe(
    read('reference/rdi2/the-inn-crosscheck.json').characters.dimli.sha256,
  );
  expect(m.drinkSemantics).toEqual({
    scope: 'WHOLE_CURRENT_DRINK_INCLUDING_CHASERS',
    inspectBeforeChoice: true,
    drinkEvents: false,
    otherEffects: 'PRESERVED',
    conversion: 'ALCOHOL_AMOUNT_TO_FORTITUDE',
    changesDrinkEffects: true,
    contestComparison: 'ALCOHOL_CONTENT_UNCHANGED',
  });
  expect(s.sources.official_m24_conversion_clarification.authority).toBe(
    'PRIMARY',
  );
  expect(s.sources.the_inn_m24_original_dimli.authority).toBe('SECONDARY');
  expect(m.projectRulesetOverrides).toBeUndefined();
  expect(
    verifyRdi2Source(s, l, matrix, null, hashes).errors.join('\n'),
  ).not.toContain('Unverified ledger item M24');
});
it.each(['drinkSemantics', 'engineAudit'] as const)(
  'rejects unreviewed M24 %s drift',
  (field) => {
    const edited = structuredClone(s);
    edited.mechanics[23][field] = {
      wrong: 'self conversion replaced whole Drink',
    };
    expect(
      verifyRdi2Source(edited, l, matrix, null, hashes).errors.join('\n'),
    ).toContain('Reviewed mechanic changed M24');
  },
);

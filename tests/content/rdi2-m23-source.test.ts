import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { verifyRdi2Source } from '../../src/content/rdi2-source';
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const s = read('content-private/imports/rdi2/source-candidate.json'),
  l = read('content-private/imports/rdi2/verification-ledger.json');
const m = s.mechanics[22],
  e = l.characterMechanics[22];
const matrix = readFileSync('reference/rdi2/rdi2-mechanics-matrix.csv', 'utf8');
const hashes = {
  normalizedSha256: 'a'.repeat(64),
  ledgerSha256: 'b'.repeat(64),
  matrixSha256: 'c'.repeat(64),
};
it('verifies one Dimli and both Fleck physical records individually with original hashes and no user override', () => {
  const records = e.review.evidence.filter(
    (r: { physicalCopy?: number }) => r.physicalCopy !== undefined,
  );
  expect(records.map((r: { id: string }) => r.id)).toEqual([
    'original-m23-dimli-1',
    'original-m23-fleck-1',
    'original-m23-fleck-2',
  ]);
  for (const r of records) {
    expect(r.canonicalRecordSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(r.sourceFileSha256).toBe(
      read('reference/rdi2/the-inn-crosscheck.json').characters[
        r.id.includes('dimli') ? 'dimli' : 'fleck'
      ].sha256,
    );
  }
  expect(e.counts).toEqual({ dimli: 1, eve: 0, fleck: 2, gog: 0 });
  expect(e.status).toBe('VERIFIED');
  expect(
    e.review.checks.every((c: { result: string }) => c.result === 'PASS'),
  ).toBe(true);
  expect(m.projectRulesetOverrides).toBeUndefined();
});
it('locks current combined rounding, independent halves, Mead exclusion and preserved Contest comparison', () => {
  expect(m.drinkSemantics).toEqual({
    combineChasersBeforeRounding: true,
    rounding: 'CEIL_EACH_COMBINED_NUMERIC_EFFECT',
    independentHalves: true,
    inspectBeforeChoice: true,
    preSplitChanges: 'INCLUDED',
    postSplitChanges: 'ONE_HALF',
    drinkEvents: false,
    meadExternalSplit: false,
    contestComparison: 'ORIGINAL_REVEALER_UNCHANGED',
    changesDrinkEffects: true,
  });
  expect(m.legality.requires).toEqual({ drinkAllowsExternalSplit: true });
  expect(m.engineAudit.missingCapabilities).toContain(
    'drink.external-split-prohibition',
  );
  expect(e.review.engineAudit).toEqual(m.engineAudit);
  expect(
    verifyRdi2Source(s, l, matrix, null, hashes).errors.join('\n'),
  ).not.toContain('Unverified ledger item M23');
});
it.each(['legality', 'effects'] as const)(
  'rejects drift in the reviewed M23 %s',
  (field) => {
    const edited = structuredClone(s);
    edited.mechanics[22][field] =
      field === 'effects'
        ? [{ op: 'PASS_CURRENT_DRINK', target: 'CHOSEN_PLAYER' }]
        : {
            mode: 'RESPONSE',
            trigger: { event: 'DRINK_PENDING', affects: 'OTHER' },
            target: 'SELF',
          };
    expect(
      verifyRdi2Source(edited, l, matrix, null, hashes).errors.join('\n'),
    ).toContain('Reviewed mechanic changed M23');
  },
);

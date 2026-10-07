import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { verifyRdi2Source } from '../../src/content/rdi2-source';
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const s = read('content-private/imports/rdi2/source-candidate.json'),
  l = read('content-private/imports/rdi2/verification-ledger.json'),
  m = s.mechanics[24],
  e = l.characterMechanics[24];
const matrix = readFileSync('reference/rdi2/rdi2-mechanics-matrix.csv', 'utf8'),
  hashes = {
    normalizedSha256: 'a'.repeat(64),
    ledgerSha256: 'b'.repeat(64),
    matrixSha256: 'c'.repeat(64),
  };
it('individually verifies both original two-Alcohol modifiers and the exact own-or-other Drink trigger', () => {
  const records = e.review.evidence.filter(
    (r: { physicalCopy?: number }) => r.physicalCopy !== undefined,
  );
  expect(records.map((r: { physicalCopy: number }) => r.physicalCopy)).toEqual([
    1, 2,
  ]);
  for (const r of records) {
    expect(r.canonicalTitle).toBe('Spike it with Firewater');
    expect(r.sourceFileSha256).toBe(
      read('reference/rdi2/the-inn-crosscheck.json').characters.dimli.sha256,
    );
    expect(r.canonicalRecordSha256).toMatch(/^[a-f0-9]{64}$/);
  }
  expect(e.counts).toEqual({ dimli: 2, eve: 0, fleck: 0, gog: 0 });
  expect(e.status).toBe('VERIFIED');
  expect(
    e.review.checks.every((c: { result: string }) => c.result === 'PASS'),
  ).toBe(true);
  expect(m.effects).toEqual([
    {
      op: 'MODIFY_DRINK',
      alcoholDelta: 2,
      fortitudeDelta: 0,
      allowDrinkEvents: false,
    },
  ]);
  expect(m.drinkSemantics).toMatchObject({
    ownOrOtherDrink: true,
    directlyChangesPlayerAlcohol: false,
    contestComparison: 'MODIFIED_DRINK_ALCOHOL',
  });
  expect(m.legality.trigger).not.toHaveProperty('affects');
  expect(m.projectRulesetOverrides).toBeUndefined();
  expect(
    verifyRdi2Source(s, l, matrix, null, hashes).errors.join('\n'),
  ).not.toContain('Unverified ledger item M25');
});
it.each(['effects', 'legality', 'drinkSemantics'] as const)(
  'rejects unreviewed M25 %s drift',
  (field) => {
    const edited = structuredClone(s);
    edited.mechanics[24][field] =
      field === 'effects'
        ? [{ op: 'MODIFY_DRINK', alcoholDelta: 3 }]
        : { wrong: 'self-only modifier' };
    expect(
      verifyRdi2Source(edited, l, matrix, null, hashes).errors.join('\n'),
    ).toContain('Reviewed mechanic changed M25');
  },
);

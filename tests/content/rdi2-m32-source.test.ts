import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { verifyRdi2Source } from '../../src/content/rdi2-source';
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const s = read('content-private/imports/rdi2/source-candidate.json'),
  l = read('content-private/imports/rdi2/verification-ledger.json'),
  m = s.mechanics[31],
  e = l.characterMechanics[31];
const matrix = readFileSync('reference/rdi2/rdi2-mechanics-matrix.csv', 'utf8'),
  hashes = {
    normalizedSha256: 'a'.repeat(64),
    ledgerSha256: 'b'.repeat(64),
    matrixSha256: 'c'.repeat(64),
  };
it('verifies both Eve fire originals and current publisher three-damage erratum separately from M31 identity authorization', () => {
  expect(e.status).toBe('VERIFIED');
  expect(e.counts).toEqual({ dimli: 0, eve: 2, fleck: 0, gog: 0 });
  const records = e.review.evidence.filter(
    (r: { physicalCopy?: number }) => r.physicalCopy !== undefined,
  );
  expect(records).toHaveLength(2);
  for (const r of records) {
    expect(r.canonicalTitle).toBe("Whoa! Careful! That's real fire!");
    expect(r.sourceFileSha256).toBe(
      read('reference/rdi2/the-inn-crosscheck.json').characters.eve.sha256,
    );
    expect(r.canonicalRecordSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(s.sources[r.sourceId].authority).toBe('SECONDARY');
  }
  expect(s.sources.official_eve_errata.authority).toBe('PRIMARY');
  expect(m.verification.characterVerification.eve.fortitudeLoss).toBe(
    'VERIFIED_PUBLISHER_CURRENT_ERRATA_THREE',
  );
  expect(m.effects).toEqual([
    {
      op: 'CHANGE_STAT',
      target: 'CHOSEN_PLAYER',
      stat: 'FORTITUDE',
      delta: -3,
    },
  ]);
  expect(m.legality).toEqual({ mode: 'ACTION_PHASE', target: 'OTHER_PLAYER' });
  expect(m.projectRulesetOverrides).toBeUndefined();
  expect(m.physicalIdentityNormalizationOverride).toBeUndefined();
  expect(e.review.engineAudit).toEqual(m.engineAudit);
  expect(
    e.review.checks.every((c: { result: string }) => c.result === 'PASS'),
  ).toBe(true);
  expect(
    verifyRdi2Source(s, l, matrix, null, hashes).errors.join('\n'),
  ).not.toContain('M32');
});
it.each(['legality', 'effects', 'engineAudit'] as const)(
  'rejects M32 %s drift and legacy two-damage data',
  (field) => {
    const edited = structuredClone(s);
    edited.mechanics[31][field] =
      field === 'effects'
        ? [
            {
              op: 'CHANGE_STAT',
              target: 'CHOSEN_PLAYER',
              stat: 'FORTITUDE',
              delta: -2,
            },
          ]
        : { wrong: 'borrowed M31 or self target' };
    expect(
      verifyRdi2Source(edited, l, matrix, null, hashes).errors.join('\n'),
    ).toContain('Reviewed mechanic changed M32');
  },
);

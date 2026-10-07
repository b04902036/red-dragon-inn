import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { verifyRdi2Source } from '../../src/content/rdi2-source';
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const s = read('content-private/imports/rdi2/source-candidate.json'),
  l = read('content-private/imports/rdi2/verification-ledger.json'),
  m = s.mechanics[35],
  e = l.characterMechanics[35];
const matrix = readFileSync('reference/rdi2/rdi2-mechanics-matrix.csv', 'utf8'),
  hashes = {
    normalizedSha256: 'a'.repeat(64),
    ledgerSha256: 'b'.repeat(64),
    matrixSha256: 'c'.repeat(64),
  };
it('verifies both original Fleck records and their ordered Fortitude/Alcohol/resolving-payment effects without an M33 override', () => {
  expect(e.status).toBe('VERIFIED');
  expect(e.counts).toEqual({ dimli: 0, eve: 0, fleck: 2, gog: 0 });
  expect(m.canonicalCardTitle).toBe('How about a rowdy drinking song?');
  expect(m.cardType).toBe('ACTION');
  expect(m.effects).toEqual([
    {
      op: 'CHANGE_STAT',
      target: 'EACH_OTHER_PLAYER',
      stat: 'FORTITUDE',
      delta: -1,
    },
    { op: 'CHANGE_STAT', target: 'ALL_PLAYERS', stat: 'ALCOHOL', delta: 1 },
    { op: 'PAY_INN', target: 'SELF', amount: 1, asEffectNotCost: true },
  ]);
  const originals = e.review.evidence.filter(
    (r: { physicalCopy?: number }) => r.physicalCopy !== undefined,
  );
  expect(originals).toHaveLength(2);
  for (const r of originals) {
    expect(r.sourceFileSha256).toBe(
      read('reference/rdi2/the-inn-crosscheck.json').characters.fleck.sha256,
    );
    expect(r.canonicalRecordSha256).toMatch(/^[a-f0-9]{64}$/);
  }
  expect(m.projectRulesetOverrides).toBeUndefined();
  expect(
    verifyRdi2Source(s, l, matrix, null, hashes).errors.join('\n'),
  ).not.toContain('M36');
});
it.each(['effects', 'legality', 'engineAudit'] as const)(
  'rejects M36 %s drift',
  (field) => {
    const edited = structuredClone(s);
    edited.mechanics[35][field] =
      field === 'effects'
        ? [
            {
              op: 'PAY_INN',
              target: 'SELF',
              amount: 1,
              requireFullPayment: true,
            },
          ]
        : { wrong: 'upfront cost or excludes owner Alcohol' };
    expect(
      verifyRdi2Source(edited, l, matrix, null, hashes).errors.join('\n'),
    ).toContain('Reviewed mechanic changed M36');
  },
);

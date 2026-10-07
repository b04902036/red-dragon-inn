import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { verifyRdi2Source } from '../../src/content/rdi2-source';
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const s = read('content-private/imports/rdi2/source-candidate.json'),
  l = read('content-private/imports/rdi2/verification-ledger.json'),
  m = s.mechanics[33],
  e = l.characterMechanics[33];
const matrix = readFileSync('reference/rdi2/rdi2-mechanics-matrix.csv', 'utf8'),
  hashes = {
    normalizedSha256: 'a'.repeat(64),
    ledgerSha256: 'b'.repeat(64),
    matrixSha256: 'c'.repeat(64),
  };
it('verifies the one Gog four-damage physical Action against its publisher named example independently of M33', () => {
  expect(e.status).toBe('VERIFIED');
  expect(e.counts).toEqual({ dimli: 0, eve: 0, fleck: 0, gog: 1 });
  expect(m.canonicalCardTitle).toBe('Dance with Gog!');
  expect(m.cardType).toBe('ACTION');
  expect(m.legality).toEqual({ mode: 'ACTION_PHASE', target: 'OTHER_PLAYER' });
  expect(m.effects).toEqual([
    {
      op: 'CHANGE_STAT',
      target: 'CHOSEN_PLAYER',
      stat: 'FORTITUDE',
      delta: -4,
    },
  ]);
  expect(m.engineAudit.supportedBinding).toEqual({ effects: m.effects });
  expect(m.projectRulesetOverrides).toBeUndefined();
  expect(e.characterVerification.gog.physicalImagePublisherHosted).toBe(false);
  expect(
    e.review.evidence.some(
      (r: { id: string }) => r.id === 'official-m34-named-example',
    ),
  ).toBe(true);
  expect(
    verifyRdi2Source(s, l, matrix, null, hashes).errors.join('\n'),
  ).not.toContain('M34');
});
it.each(['effects', 'legality', 'engineAudit'] as const)(
  'rejects M34 %s drift',
  (field) => {
    const edited = structuredClone(s);
    edited.mechanics[33][field] =
      field === 'effects'
        ? [{ op: 'PAY_INN', target: 'SELF', amount: 1 }]
        : { incorrect: 'M33 payment or self target' };
    expect(
      verifyRdi2Source(edited, l, matrix, null, hashes).errors.join('\n'),
    ).toContain('Reviewed mechanic changed M34');
  },
);

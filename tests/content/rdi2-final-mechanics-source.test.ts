import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { verifyRdi2Source } from '../../src/content/rdi2-source';
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const source = read('content-private/imports/rdi2/source-candidate.json');
const ledger = read('content-private/imports/rdi2/verification-ledger.json');
const matrix = readFileSync('reference/rdi2/rdi2-mechanics-matrix.csv', 'utf8');
const hashes = {
  normalizedSha256: 'a'.repeat(64),
  ledgerSha256: 'b'.repeat(64),
  matrixSha256: 'c'.repeat(64),
};
it('M42 preserves both original Anytime records and permits self targeting', () => {
  const m = source.mechanics[41],
    e = ledger.characterMechanics[41];
  expect(e.status).toBe('VERIFIED');
  expect(e.counts).toEqual({ dimli: 0, eve: 2, fleck: 0, gog: 0 });
  expect(m.cardType).toBe('ANYTIME');
  expect(m.legality).toEqual({ mode: 'ANYTIME', target: 'ANY_LIVING_PLAYER' });
  expect(m.effects).toEqual([
    { op: 'TRANSFER_GOLD', from: 'CHOSEN_PLAYER', to: 'SELF', amount: 1 },
  ]);
  expect(
    e.review.evidence.filter((r: { id: string }) =>
      r.id.startsWith('original-m42'),
    ),
  ).toHaveLength(2);
  expect(
    e.review.checks.every((r: { result: string }) => r.result === 'PASS'),
  ).toBe(true);
});
it.each(['type', 'target', 'amount'])(
  'rejects M42 source drift: %s',
  (change) => {
    const s = structuredClone(source),
      m = s.mechanics[41];
    if (change === 'type') m.cardType = 'ACTION';
    if (change === 'target') m.legality.target = 'ANY_OTHER_PLAYER';
    if (change === 'amount') m.effects[0].amount = 2;
    expect(
      verifyRdi2Source(s, ledger, matrix, null, hashes).errors.join('\n'),
    ).toContain('M42');
  },
);
it('M43 retains Action timing and the original chosen-player two-Gold payment', () => {
  const m = source.mechanics[42],
    e = ledger.characterMechanics[42];
  expect(e.status).toBe('VERIFIED');
  expect(e.counts).toEqual({ dimli: 0, eve: 0, fleck: 1, gog: 0 });
  expect(m.cardType).toBe('ACTION');
  expect(m.legality).toEqual({
    mode: 'ACTION_PHASE',
    target: 'ANY_LIVING_PLAYER',
  });
  expect(m.effects).toEqual([
    { op: 'TRANSFER_GOLD', from: 'CHOSEN_PLAYER', to: 'SELF', amount: 2 },
  ]);
  expect(m.engineAudit.supportedBinding.effects).toEqual([
    { op: 'COLLECT_GOLD', target: 'CHOSEN_PLAYER', amount: 2 },
  ]);
  expect(
    e.review.checks.every((r: { result: string }) => r.result === 'PASS'),
  ).toBe(true);
});
it('M44 retains publisher standard semantics with user-only Gog provenance', () => {
  const e = ledger.characterMechanics[43],
    m = source.mechanics[43];
  expect(e.status).toBe('VERIFIED_FOR_PROJECT_RULESET');
  expect(e.characterVerification.gog.quantity).toBe(
    'VERIFIED_SECONDARY_MATRIX',
  );
  expect(e.characterVerification.gog.standardMechanic).toBe(
    'PUBLISHER_VERIFIED',
  );
  expect(e.characterVerification.gog.officialPhysicalProvenanceVerified).toBe(
    false,
  );
  expect(e.previousBlockedReview.missingEvidence).toHaveLength(1);
  expect(m.physicalCopyProvenanceOverride.label).toBe(
    'M44 USER OVERRIDE — provenance only',
  );
  expect(
    e.review.evidence.filter((r: { id: string }) =>
      r.id.startsWith('original-m44'),
    ),
  ).toHaveLength(3);
  expect(m.cardType).toBe('ANYTIME');
  expect(m.effects).toEqual([
    { op: 'PAY_INN', target: 'CHOSEN_PLAYER', amount: 1 },
  ]);
  expect(m.projectRulesetOverrides).toBeUndefined();
});

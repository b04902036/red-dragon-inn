import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { verifyRdi2Source } from '../../src/content/rdi2-source';
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const s = read('content-private/imports/rdi2/source-candidate.json'),
  l = read('content-private/imports/rdi2/verification-ledger.json'),
  m = s.mechanics[32],
  e = l.characterMechanics[32];
const matrix = readFileSync('reference/rdi2/rdi2-mechanics-matrix.csv', 'utf8'),
  hashes = {
    normalizedSha256: 'a'.repeat(64),
    ledgerSha256: 'b'.repeat(64),
    matrixSha256: 'c'.repeat(64),
  };
const verify = (source = s, ledger = l) =>
  verifyRdi2Source(source, ledger, matrix, null, hashes);
it('H: verifies one Gog physical Action and all forty-card distributions, without an M33 override or speculative printed title', () => {
  expect(e.status).toBe('VERIFIED');
  expect(e.completionStatus).toBe('COMPLETE');
  expect(e.counts).toEqual({ dimli: 0, eve: 0, fleck: 0, gog: 1 });
  const cards = s.characters
    .find((c: { id: string }) => c.id === 'gog')
    .cards.filter((c: { mechanicId: string }) => c.mechanicId === m.id);
  expect(cards).toHaveLength(1);
  expect(cards[0]).toMatchObject({
    quantity: 1,
    type: 'ACTION',
    canonicalCardTitle: 'Sorry, Gog not see you sitting there...',
  });
  expect(cards[0].display['en-US']).toBe(cards[0].canonicalCardTitle);
  expect(m.legality).toEqual({ mode: 'ACTION_PHASE', target: 'OTHER_PLAYER' });
  expect(m.effects).toEqual([
    {
      op: 'CHANGE_STAT',
      target: 'CHOSEN_PLAYER',
      stat: 'FORTITUDE',
      delta: -3,
    },
    { op: 'PAY_INN', target: 'SELF', amount: 1, asEffectNotCost: true },
  ]);
  expect(m.engineAudit.supportedBinding).toEqual({
    effects: [
      {
        op: 'CHANGE_STAT',
        target: 'CHOSEN_PLAYER',
        stat: 'FORTITUDE',
        delta: -3,
      },
      { op: 'PAY_INN', target: 'SELF', amount: 1 },
    ],
  });
  expect(m.projectRulesetOverrides).toBeUndefined();
  expect(m.physicalIdentityNormalizationOverride).toBeUndefined();
  expect(m.engineAudit.productionRdi2CardCompiled).toBe(false);
  expect(e.review.missingEvidence).toEqual([]);
  expect(
    e.review.checks.every((c: { result: string }) => c.result === 'PASS'),
  ).toBe(true);
  for (const c of s.characters)
    expect(
      c.cards.reduce((n: number, r: { quantity: number }) => n + r.quantity, 0),
    ).toBe(40);
  expect(verify().errors.join('\n')).not.toContain('M33');
});
it('separates directly inspected physical text on a third-party host, secondary inventory and publisher rules, preserving input hash', () => {
  expect(s.sources.physical_gog_review_photo_2015).toMatchObject({
    kind: 'DIRECT_PHYSICAL_CARD_PHOTO',
    authority: 'SECONDARY',
    publisherHosted: false,
  });
  expect(e.characterVerification.gog).toMatchObject({
    quantity: 'VERIFIED_SECONDARY_MATRIX',
    exactCardText: 'VERIFIED_DIRECT_PHYSICAL_CARD_PHOTO',
    officialSourceVerified: false,
    paymentSemanticsPublisherVerified: true,
    physicalImagePublisherHosted: false,
  });
  expect(s.sources.official_m33_payment_rules_rdi9.authority).toBe('PRIMARY');
  expect(s.sources.official_m33_cost_rules_rdi6.authority).toBe('PRIMARY');
  const input = s.sources.user_m33_verified_evidence_2026_10_06;
  expect(input.authority).toBe('USER_PROVIDED');
  expect(
    createHash('sha256').update(readFileSync(input.path)).digest('hex'),
  ).toBe(input.sha256);
  expect(e.review.previousBlockedReview.status).toBe(
    'BLOCKED_MISSING_PRIMARY_CARD_TEXT',
  );
});
it.each([
  'effect order',
  'cost classification',
  'upfront cost binding',
  'self target',
  'amount',
  'invented title',
  'publisher host',
  'override',
])('rejects M33 %s corruption', (kind) => {
  const source = structuredClone(s),
    ledger = structuredClone(l),
    row = source.mechanics[32];
  if (kind === 'effect order') row.effects.reverse();
  if (kind === 'cost classification') row.effects[1].asEffectNotCost = false;
  if (kind === 'upfront cost binding')
    row.engineAudit.supportedBinding.mandatoryGoldCost = 1;
  if (kind === 'self target') row.legality.target = 'ANY_LIVING_PLAYER';
  if (kind === 'amount') row.effects[1].amount = 2;
  if (kind === 'invented title') row.display['en-US'] = 'Reckless Smash';
  if (kind === 'publisher host')
    source.sources.physical_gog_review_photo_2015.publisherHosted = true;
  if (kind === 'override') row.projectRulesetOverrides = { unrelated: 'M31' };
  expect(verify(source, ledger).errors.join('\n')).toContain('M33 must');
});

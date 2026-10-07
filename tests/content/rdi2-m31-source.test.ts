import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { verifyRdi2Source } from '../../src/content/rdi2-source';
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const s = read('content-private/imports/rdi2/source-candidate.json'),
  l = read('content-private/imports/rdi2/verification-ledger.json'),
  m = s.mechanics[30],
  e = l.characterMechanics[30];
const matrix = readFileSync('reference/rdi2/rdi2-mechanics-matrix.csv', 'utf8'),
  hashes = {
    normalizedSha256: 'a'.repeat(64),
    ledgerSha256: 'b'.repeat(64),
    matrixSha256: 'c'.repeat(64),
  };
const verify = (source = s, ledger = l) =>
  verifyRdi2Source(source, ledger, matrix, null, hashes);
it('A/B/G/H: completes one quantity-five Gog Action family with no manufactured printed titles and all decks forty', () => {
  expect(e.status).toBe('VERIFIED_FOR_PROJECT_RULESET');
  expect(e.completionStatus).toBe('COMPLETE');
  expect(e.counts).toEqual({ dimli: 5, eve: 0, fleck: 2, gog: 5 });
  const gog = s.characters.find((c: { id: string }) => c.id === 'gog'),
    cards = gog.cards.filter(
      (c: { mechanicId: string }) => c.mechanicId === 'damage_two',
    );
  expect(cards).toHaveLength(1);
  expect(cards[0]).toMatchObject({ quantity: 5, type: 'ACTION' });
  expect(cards[0].canonicalCardTitle).toBeUndefined();
  expect(cards[0].canonicalCardTitles).toBeUndefined();
  expect(cards[0].projectRuleOverride).toEqual(
    m.physicalIdentityNormalizationOverride,
  );
  expect(e.physicalIdentityNormalizationOverride).toEqual(
    m.physicalIdentityNormalizationOverride,
  );
  expect(
    s.mechanics.filter((r: { id: string }) => r.id === 'damage_two'),
  ).toHaveLength(1);
  for (const c of s.characters)
    expect(
      c.cards.reduce((n: number, r: { quantity: number }) => n + r.quantity, 0),
    ).toBe(40);
  expect(e.review.missingEvidence).toEqual([]);
  expect(
    e.review.checks.every((c: { result: string }) => c.result === 'PASS'),
  ).toBe(true);
  expect(m.legality).toEqual({ mode: 'ACTION_PHASE', target: 'OTHER_PLAYER' });
  expect(m.effects).toEqual([
    {
      op: 'CHANGE_STAT',
      target: 'CHOSEN_PLAYER',
      stat: 'FORTITUDE',
      delta: -2,
    },
  ]);
  expect(e.review.engineAudit).toEqual(m.engineAudit);
  expect(m.engineAudit.supportedBinding).toEqual({ effects: m.effects });
  expect(m.engineAudit.productionRdi2CardCompiled).toBe(false);
  expect(verify().errors.join('\n')).not.toContain(
    'Unverified ledger item M31',
  );
  expect(verify().errors.join('\n')).not.toContain('M31 must');
});
it('separates publisher standard/example, secondary five-copy quantity and the scoped identity waiver', () => {
  expect(e.characterVerification.gog).toMatchObject({
    quantity: 'VERIFIED_SECONDARY_MATRIX',
    mechanicFamily: 'VERIFIED_SECONDARY_MATRIX',
    namedPublisherTemplate: 'Why you laugh at Gog?',
    publisherUnidentifiedPhysicalCopies: 4,
    allFiveSameMechanic: 'M31 USER OVERRIDE — physical identity normalization',
    officialSourceVerifiedForAllFiveCopies: false,
    unknownPrintedTitleRequirement: 'WAIVED_BY_M31_USER_OVERRIDE',
  });
  expect(m.mechanicVerification.classification).toBe(
    'PUBLISHER_VERIFIED_STANDARD_M31',
  );
  expect(s.sources.official_rdi2_9e.authority).toBe('PRIMARY');
  const original = e.review.evidence.filter(
    (r: { physicalCopy?: number }) => r.physicalCopy !== undefined,
  );
  expect(original).toHaveLength(7);
  for (const r of original) {
    expect(r.canonicalRecordSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(r.sourceId).not.toContain('gog');
  }
  const source = s.sources.user_m31_physical_identity_normalization_2026_10_06;
  expect(source.authority).toBe('PROJECT_RULE_OVERRIDE');
  expect(source.sha256).toBe(
    createHash('sha256').update(readFileSync(source.path)).digest('hex'),
  );
  expect(e.review.previousBlockedReview.status).toBe('PARTIAL_SOURCE_REVIEW');
  expect(m.projectRulesetOverrides).toBeUndefined();
  expect(verify().valid).toBe(false);
  expect(verify().counts?.verifiedMechanics).toBe(44);
  expect(verify().counts?.verifiedDrinks).toBe(23);
  expect(verify().errors.join('\n')).not.toContain(
    'Unverified ledger item M41',
  );
  expect(s.mechanics[20].engineAcceptance.pendingRequiredTests).toEqual(['J']);
});
it.each([
  'legality',
  'effects',
  'engineAudit',
  'cardType',
  'mechanicVerification',
  'physicalIdentityNormalizationOverride',
  'counterMetadata',
] as const)('rejects M31 %s drift', (field) => {
  const edited = structuredClone(s);
  edited.mechanics[30][field] =
    field === 'effects'
      ? [{ op: 'PAY_INN', target: 'SELF', amount: 1 }]
      : field === 'cardType'
        ? 'SOMETIMES'
        : { wrong: 'extra cost or invented restriction' };
  expect(verify(edited).errors.join('\n')).toContain('M31 must preserve');
});
it.each([
  'quantity',
  'title',
  'titles',
  'duplicate',
  'gog evidence',
  'ledger override',
  'source',
  'gameplay override',
])('rejects M31 %s corruption', (kind) => {
  const source = structuredClone(s),
    ledger = structuredClone(l),
    gog = source.characters.find((c: { id: string }) => c.id === 'gog'),
    card = gog.cards.find(
      (c: { mechanicId: string }) => c.mechanicId === 'damage_two',
    );
  if (kind === 'quantity') card.quantity = 4;
  if (kind === 'title') card.canonicalCardTitle = 'Why you laugh at Gog?';
  if (kind === 'titles') card.canonicalCardTitles = ['Invented Gog title'];
  if (kind === 'duplicate')
    gog.cards.push({ ...card, cardKey: 'invented-m31-copy' });
  if (kind === 'gog evidence')
    source.mechanics[30].verification.characterVerification.gog.officialSourceVerifiedForAllFiveCopies = true;
  if (kind === 'ledger override')
    ledger.characterMechanics[30].physicalIdentityNormalizationOverride = {};
  if (kind === 'source')
    source.sources.user_m31_physical_identity_normalization_2026_10_06.authority =
      'PRIMARY';
  if (kind === 'gameplay override')
    source.mechanics[30].projectRulesetOverrides = { unrelated: 'M27' };
  expect(verify(source, ledger).errors.join('\n')).toContain('M31 must');
});

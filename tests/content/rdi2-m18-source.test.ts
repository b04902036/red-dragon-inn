import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import {
  m18Effects,
  m18Metadata,
  m18Trigger,
} from '../fixtures/rdi2-m18-project';
const s = JSON.parse(
  readFileSync('content-private/imports/rdi2/source-candidate.json', 'utf8'),
);
const l = JSON.parse(
  readFileSync('content-private/imports/rdi2/verification-ledger.json', 'utf8'),
);
const m = s.mechanics[17],
  e = l.characterMechanics[17];
it('preserves independent, hashed M18 authority for only Gog ownership, quantity and standard-copy assignment', () => {
  const origin = s.sources.project_m18_gog_override_2026_10_06;
  expect(origin).toMatchObject({
    kind: 'PROJECT_RULE_OVERRIDE',
    authority: 'USER_SPECIFIED',
    label: 'M18 USER OVERRIDE',
    scope: 'GOG_OWNERSHIP_QUANTITY_AND_TWO_STANDARD_COPIES_ONLY',
    officialSourceVerified: false,
  });
  expect(origin.sha256).toBe(
    createHash('sha256').update(readFileSync(origin.path)).digest('hex'),
  );
  expect(e.characterVerification.gog).toMatchObject({
    ownership: 'PROJECT_RULE_OVERRIDE',
    quantity: 'PROJECT_RULE_OVERRIDE',
    copiesUseStandardMechanic: 'PROJECT_RULE_OVERRIDE',
    gogSpecificProvenancePublisherVerified: false,
    standardCardMechanic: 'VERIFIED_PUBLISHER_STANDARD_CARD',
    mechanicPublisherSupported: true,
  });
  expect(m.projectRulesetOverrides).toEqual(e.review.projectRulesetOverrides);
  expect(e.reviewHistory[0].status).toBe('BLOCKED_MISSING_EVIDENCE');
  expect(e.status).toBe('VERIFIED_FOR_PROJECT_RULESET');
});
it('keeps publisher standard effect evidence separate from Gog physical-card provenance', () => {
  expect(s.sources.official_m18_standard_card).toMatchObject({
    kind: 'OFFICIAL_PRINT_AND_PLAY_CARD',
    authority: 'PRIMARY',
    officialHost: true,
    url: 'https://slugfestgames.com/wp-content/uploads/2016/12/RedDragonInn6DaarekaPrintAndPlay.pdf',
  });
  expect(s.sources.official_m18_standard_card.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(e.fieldVerification).toMatchObject({
    cardType: 'VERIFIED_PUBLISHER_STANDARD_CARD',
    paymentAmountRecipient: 'VERIFIED_PUBLISHER_STANDARD_CARD',
    extraDrinkCount: 'VERIFIED_PUBLISHER_STANDARD_CARD',
    faceDownOtherPlayerDistribution: 'VERIFIED_CURRENT_OFFICIAL_RULES',
  });
  expect(m.sharedImplementation).toEqual({
    phaseOpportunity: m18Metadata.phaseOpportunity,
    mandatoryGoldCost: 1,
    responseTrigger: m18Trigger,
    effects: m18Effects,
  });
  expect(m.effects).toEqual([
    { op: 'PAY_INN', target: 'SELF', amount: 1 },
    { op: 'ORDER_EXTRA_DRINKS', count: 2, targets: 'OTHER_PLAYERS' },
  ]);
});
it.each(['dimli-1', 'dimli-2', 'eve-1', 'eve-2'])(
  'retains independently checked original physical record %s',
  (id) => {
    const r = e.review.evidence.find(
      (x: { id: string }) => x.id === 'original-m18-' + id,
    );
    expect(r.sourceFileSha256).toBe(s.sources[r.sourceId].sha256);
    expect(r.canonicalRecordSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(r.physicalCopy).toBe(Number(id.at(-1)));
  },
);
it('binds exactly two Gog physical copies to identical standard mechanic data with separate override evidence', () => {
  const rows = s.characters
    .find((c: { id: string }) => c.id === 'gog')
    .cards.filter((r: { mechanicId: string }) => r.mechanicId === m.id);
  const copies = rows.flatMap((r: { quantity: number }) =>
    Array.from({ length: r.quantity }, () => r),
  );
  expect(copies).toHaveLength(2);
  for (const c of copies)
    expect(c).toMatchObject({
      type: 'SOMETIMES',
      canonicalCardTitle: 'Wench, bring some drinks for my friends!',
      projectRuleOverride: m.projectRulesetOverrides,
    });
  expect(
    e.review.evidence
      .filter((r: { id: string }) => r.id.startsWith('project-m18-gog-'))
      .map((r: { physicalCopy: number }) => r.physicalCopy),
  ).toEqual([1, 2]);
  expect(
    e.review.checks.every((c: { result: string }) => c.result === 'PASS'),
  ).toBe(true);
});

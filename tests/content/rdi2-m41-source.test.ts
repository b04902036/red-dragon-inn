import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
it('resolves M41 with its scoped override and preserves the original evidence limits', () => {
  const s = read('content-private/imports/rdi2/source-candidate.json'),
    l = read('content-private/imports/rdi2/verification-ledger.json');
  const e = l.characterMechanics[40],
    m = s.mechanics[40];
  expect(e.status).toBe('VERIFIED_FOR_PROJECT_RULESET');
  expect(e.counts).toEqual({ dimli: 1, eve: 1, fleck: 1, gog: 1 });
  for (const c of ['dimli', 'eve', 'fleck'])
    expect(e.characterVerification[c].exactSourceRecords).toBe(
      'VERIFIED_ORIGINAL_JSON',
    );
  expect(e.characterVerification.gog.exactCardText).toBe('UNAVAILABLE');
  expect(e.characterVerification.gog.officialSourceVerified).toBe(false);
  expect(m.projectRulesetOverrides.label).toBe(
    'M41 USER OVERRIDE — Gog physical identity and normalized mechanic',
  );
  expect(
    e.review.evidence.filter((r: { id: string }) =>
      r.id.startsWith('original-m41-'),
    ),
  ).toHaveLength(3);
  expect(e.previousBlockedReview.missingEvidence[0]).toContain(
    'M40 and earlier overrides do not apply',
  );
  expect(
    l.characterMechanics
      .slice(41)
      .every((r: { status: string }) =>
        ['VERIFIED', 'VERIFIED_FOR_PROJECT_RULESET'].includes(r.status),
      ),
  ).toBe(true);
  expect(
    l.drinks.every(
      (r: { status: string }) =>
        r.status !== 'PENDING_STEP_24A_ITEM_BY_ITEM_VERIFICATION',
    ),
  ).toBe(true);
});

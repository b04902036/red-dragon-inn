import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { m17Trigger, m17Effects } from '../fixtures/rdi2-m17-source';
const s = JSON.parse(
  readFileSync('content-private/imports/rdi2/source-candidate.json', 'utf8'),
);
const l = JSON.parse(
  readFileSync('content-private/imports/rdi2/verification-ledger.json', 'utf8'),
);
const m = s.mechanics[16],
  e = l.characterMechanics[16];
it.each(['dimli-1', 'dimli-2', 'eve-1', 'eve-2', 'fleck-1', 'fleck-2'])(
  'retains independently inspected original physical record %s',
  (id) => {
    const record = e.review.evidence.find(
      (r: { id: string }) => r.id === 'original-m17-' + id,
    );
    expect(record.sourceFileSha256).toBe(s.sources[record.sourceId].sha256);
    expect(record.canonicalRecordSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(record.physicalCopy).toBe(Number(id.at(-1)));
    expect(record.canonicalTitle).toBeTruthy();
  },
);
it('preserves direct publisher evidence for both Gog copies and the sequential retry example', () => {
  expect(s.sources.official_m17_gog_cards).toMatchObject({
    kind: 'OFFICIAL_CARD_IMAGE',
    authority: 'PRIMARY',
    officialHost: true,
    publisherPage:
      'https://slugfestgames.com/rulesfest-the-second-rule-of-sometimes/',
  });
  expect(s.sources.official_m17_gog_cards.sha256).toMatch(/^[a-f0-9]{64}$/);
  const records = e.review.evidence.filter((r: { id: string }) =>
    r.id.startsWith('official-m17-gog-'),
  );
  expect(
    records.map((r: { imagePosition: string }) => r.imagePosition),
  ).toEqual(['LEFT', 'RIGHT']);
  expect(e.characterVerification.gog.exactCardText).toBe(
    'VERIFIED_OFFICIAL_CARD_IMAGE_BOTH_COPIES',
  );
  expect(m.projectRulesetOverrides).toBeUndefined();
  expect(e.status).toBe('VERIFIED');
});
it('retains two physical cards for every character and the shared whole-Drink Ignore binding', () => {
  expect(e.counts).toEqual({ dimli: 2, eve: 2, fleck: 2, gog: 2 });
  for (const c of s.characters) {
    const row = c.cards.find(
      (r: { mechanicId: string }) => r.mechanicId === m.id,
    );
    expect(row.quantity).toBe(2);
    expect(row.canonicalCardTitles).toHaveLength(2);
  }
  expect(m.sharedImplementation).toEqual({
    responseTrigger: m17Trigger,
    effects: m17Effects,
  });
  expect(
    e.review.checks.every((c: { result: string }) => c.result === 'PASS'),
  ).toBe(true);
});

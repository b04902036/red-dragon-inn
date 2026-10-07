import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import {
  m16Effects,
  m16Trigger,
  m16Metadata,
} from '../fixtures/rdi2-m16-source';
const source = JSON.parse(
  readFileSync('content-private/imports/rdi2/source-candidate.json', 'utf8'),
);
const ledger = JSON.parse(
  readFileSync('content-private/imports/rdi2/verification-ledger.json', 'utf8'),
);
const m = source.mechanics[15],
  e = ledger.characterMechanics[15];
it('records each original counter independently using nested data.type and original record hashes', () => {
  const records = e.review.evidence.filter((x: { id: string }) =>
    x.id.startsWith('original-m16-'),
  );
  expect(records).toHaveLength(3);
  expect(
    records.map((x: { canonicalTitle: string }) => x.canonicalTitle),
  ).toEqual(["I don't think so!", "I don't think so.", "I don't think so!"]);
  for (const r of records) {
    expect(r.sourceFileSha256).toBe(source.sources[r.sourceId].sha256);
    expect(r.canonicalRecordSha256).toMatch(/^[a-f0-9]{64}$/);
  }
  expect(e.counts).toEqual({ dimli: 1, eve: 1, fleck: 1, gog: 1 });
});
it('verifies Gog from a complete publisher-printed card without extending M15 authority', () => {
  expect(source.sources.official_m16_gog_card).toMatchObject({
    kind: 'OFFICIAL_RULES_PRINTED_CARD',
    authority: 'PRIMARY',
    officialHost: true,
  });
  expect(source.sources.official_m16_gog_card.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(e.characterVerification.gog.exactCardText).toBe(
    'VERIFIED_OFFICIAL_RULES_PRINTED_CARD',
  );
  expect(e.status).toBe('VERIFIED');
  expect(m.projectRulesetOverrides).toBeUndefined();
  expect(
    source.characters
      .find((c: { id: string }) => c.id === 'gog')
      .cards.find((r: { mechanicId: string }) => r.mechanicId === m.id),
  ).toMatchObject({ quantity: 1, canonicalCardTitle: 'Gog not think so!' });
  expect(
    e.review.checks.every((c: { result: string }) => c.result === 'PASS'),
  ).toBe(true);
});
it('uses generic bidirectional family metadata and immediate-parent Negate', () => {
  expect(m.sharedImplementation).toEqual({
    responseTrigger: m16Trigger,
    effects: m16Effects,
    ...m16Metadata,
  });
  expect(e.review.sharedImplementation).toEqual(m.sharedImplementation);
  expect(m.effects).toEqual([{ op: 'NEGATE_CURRENT_SOURCE' }]);
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = JSON.parse(
  readFileSync('content-private/imports/rdi2/source-candidate.json', 'utf8'),
);
const ledger = JSON.parse(
  readFileSync('content-private/imports/rdi2/verification-ledger.json', 'utf8'),
);
const mechanic = source.mechanics[13],
  entry = ledger.characterMechanics[13];

describe('M14 direct evidence is independent of the authorized Gog gambling overrides', () => {
  it('retains both separately identified Eve records and the current official revised card image', () => {
    const records = entry.review.evidence.filter((e: { id: string }) =>
      e.id.startsWith('original-m14-eve-'),
    );
    expect(records).toHaveLength(2);
    expect(
      records.map((r: { canonicalTitle: string }) => r.canonicalTitle),
    ).toEqual([
      "Ha! That's just an illusion. I'm actually over here!",
      'I attempt to disbelieve.',
    ]);
    expect(records[0].canonicalRecordSha256).not.toBe(
      records[1].canonicalRecordSha256,
    );
    expect(source.sources.official_m14_eve_card).toMatchObject({
      kind: 'OFFICIAL_CARD_IMAGE',
      authority: 'PRIMARY',
      publisherPage: 'https://slugfestgames.com/the-new-eve/',
    });
  });
  it('retains readable Gog photograph provenance without claiming publisher hosting or inferring from Eve', () => {
    expect(entry.characterVerification.gog).toMatchObject({
      exactCardText: 'VERIFIED_READABLE_PRINTED_CARD_PHOTO',
      officialHost: false,
    });
    expect(source.sources.gog_m14_printed_card_photo).toMatchObject({
      kind: 'READABLE_PRINTED_CARD_PHOTO',
      authority: 'PRIMARY_CARD_ARTIFACT_SECONDARY_HOST',
      officialHost: false,
    });
    expect(source.sources.gog_m14_printed_card_photo.sha256).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(mechanic.projectRulesetOverrides).toBeUndefined();
    expect(entry.counts).toEqual({ dimli: 0, eve: 2, fleck: 0, gog: 1 });
  });
  it('preserves the pending direct-stat trigger, printed categories and current own-payment rule', () => {
    expect(mechanic.legality.trigger).toEqual({
      event: 'CARD_PENDING',
      sourceCardTypes: ['ACTION', 'SOMETIMES', 'ANYTIME'],
      directlyAffectsSelfAny: ['FORTITUDE', 'ALCOHOL', 'GOLD'],
      excludeRoundOfGambling: true,
      excludeOwnCardGoldPayment: true,
    });
    expect(mechanic.effects).toEqual([
      { op: 'IGNORE_CURRENT_EFFECT_FOR_SELF' },
    ]);
    expect(entry.status).toBe('VERIFIED');
    expect(entry.review.checks).toHaveLength(7);
    expect(
      entry.review.checks.every((c: { result: string }) => c.result === 'PASS'),
    ).toBe(true);
  });
});

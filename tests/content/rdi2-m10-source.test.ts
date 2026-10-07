import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = JSON.parse(
  readFileSync('content-private/imports/rdi2/source-candidate.json', 'utf8'),
) as {
  mechanics: {
    id: string;
    legality: {
      trigger: { covers: string[]; actor: string; pending: boolean };
    };
    effects: Record<string, unknown>[];
    verification: { status: string };
  }[];
};
const coin = source.mechanics.find((m) => m.id === 'illusionary_payment')!;

describe('M10 source acceptance (not runtime implementation)', () => {
  it.each([
    'PAY_TO_INN',
    'PAY_TO_PLAYER',
    'ANTE_TO_POT',
    'GOLD_TAKEN_BY_OTHER_PLAYER',
  ])('prevents the current %s without transferring Gold', (kind) => {
    expect(coin.legality.trigger).toMatchObject({
      actor: 'SELF',
      pending: true,
    });
    expect(coin.legality.trigger.covers).toContain(kind);
    expect(coin.effects).toEqual([
      {
        op: 'PREVENT_CURRENT_GOLD_LOSS',
        goldMovement: 'NONE',
        anteCountsAsSatisfied: true,
        scope: 'CURRENT_PAYMENT_OR_GOLD_LOSS_CONTEXT',
      },
    ]);
  });
  it('preserves the distinction from M09 Inn substitution', () => {
    const substitution = source.mechanics.find(
      (m) => m.id === 'substitute_payment_from_inn',
    )!;
    expect(substitution.effects[0]).toMatchObject({
      source: 'INN',
      destination: 'ORIGINAL_DESTINATION',
    });
    expect(coin.effects[0]).not.toHaveProperty('source');
    expect(coin.effects[0]).not.toHaveProperty('destination');
    expect(coin.effects[0]).not.toHaveProperty('fixedAmount');
    expect(coin.verification.status).toBe('VERIFIED');
  });
  it('records both original Eve physical records and direct official no-transfer/ante evidence', () => {
    const ledger = JSON.parse(
      readFileSync(
        'content-private/imports/rdi2/verification-ledger.json',
        'utf8',
      ),
    ) as {
      characterMechanics: {
        ledgerId: string;
        counts: Record<string, number>;
        review: {
          evidence: {
            id: string;
            physicalRecords?: {
              canonicalTitle: string;
              declaredCardType: string;
              recordCanonicalSha256: string;
            }[];
          }[];
        };
      }[];
    };
    const review = ledger.characterMechanics.find((m) => m.ledgerId === 'M10')!;
    expect(review.counts).toEqual({ dimli: 0, eve: 2, fleck: 0, gog: 0 });
    const original = review.review.evidence.find(
      (e) => e.id === 'original-m10-eve',
    )!;
    expect(original.physicalRecords).toHaveLength(2);
    for (const record of original.physicalRecords!) {
      expect(record).toMatchObject({
        canonicalTitle: 'Illusionary Coin',
        declaredCardType: 'Sometimes',
      });
      expect(record.recordCanonicalSha256).toMatch(/^[a-f0-9]{64}$/);
    }
    expect(
      review.review.evidence.some((e) => e.id === 'official-no-transfer-m10'),
    ).toBe(true);
  });
});

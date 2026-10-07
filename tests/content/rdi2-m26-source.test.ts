import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { verifyRdi2Source } from '../../src/content/rdi2-source';
import { effectSchema } from '../../src/content/effects';
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const s = read('content-private/imports/rdi2/source-candidate.json'),
  l = read('content-private/imports/rdi2/verification-ledger.json'),
  m = s.mechanics[25],
  e = l.characterMechanics[25];
const matrix = readFileSync('reference/rdi2/rdi2-mechanics-matrix.csv', 'utf8'),
  hashes = {
    normalizedSha256: 'a'.repeat(64),
    ledgerSha256: 'b'.repeat(64),
    matrixSha256: 'c'.repeat(64),
  };
it('verifies the one original Eve Sometimes record with quantity, hash, source-revealer timing and corrected all-modifier preservation', () => {
  const r = e.review.evidence.find(
    (r: { physicalCopy?: number }) => r.physicalCopy === 1,
  );
  expect(r.canonicalTitle).toBe("Actually, that's Dragon Breath Ale.");
  expect(r.sourceFileSha256).toBe(
    read('reference/rdi2/the-inn-crosscheck.json').characters.eve.sha256,
  );
  expect(r.canonicalRecordSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(e.counts).toEqual({ dimli: 0, eve: 1, fleck: 0, gog: 0 });
  expect(e.status).toBe('VERIFIED');
  expect(
    e.review.checks.every((c: { result: string }) => c.result === 'PASS'),
  ).toBe(true);
  expect(m.legality.trigger).toEqual({
    event: 'DRINK_PENDING',
    sourceCardType: 'DRINK',
    sourceActor: 'OTHER',
    chasersComplete: true,
  });
  expect(m.effects).toEqual([
    {
      op: 'REPLACE_CURRENT_DRINK_BASE_EFFECTS',
      alcohol: 4,
      fortitude: 0,
      preserveExistingNonDrinkModifiers: true,
      preserveFutureNonDrinkModifiers: true,
    },
  ]);
  expect(m.drinkSemantics).toMatchObject({
    originalDrinkEffects: 'REPLACED_INCLUDING_CHASERS',
    existingNonDrinkModifiers: 'PRESERVED',
    futureNonDrinkModifiers: 'PRESERVED',
  });
  expect(m.projectRulesetOverrides).toBeUndefined();
  expect(s.sources.the_inn_m26_original_eve.authority).toBe('SECONDARY');
  expect(s.sources.official_m26_chaser_clarification.authority).toBe('PRIMARY');
  expect(
    verifyRdi2Source(s, l, matrix, null, hashes).errors.join('\n'),
  ).not.toContain('Unverified ledger item M26');
});
it('retains the real shared-capability gap rather than approximate replacement as add-four or claim a supported runtime binding', () => {
  expect(m.engineAudit).toMatchObject({
    status: 'REQUIRES_SHARED_ENGINE_CAPABILITY',
    supportedBinding: null,
    missingCapabilities: ['drink.replace-base-effects'],
  });
  expect(effectSchema.safeParse(m.effects[0]).success).toBe(false);
  expect(e.review.engineAudit).toEqual(m.engineAudit);
});
it.each(['legality', 'effects', 'drinkSemantics', 'engineAudit'] as const)(
  'rejects M26 unreviewed %s drift',
  (field) => {
    const edited = structuredClone(s);
    edited.mechanics[25][field] =
      field === 'effects'
        ? [{ op: 'MODIFY_DRINK', alcoholDelta: 4 }]
        : { wrong: 'replacement loses prior modifiers' };
    expect(
      verifyRdi2Source(edited, l, matrix, null, hashes).errors.join('\n'),
    ).toContain('Reviewed mechanic changed M26');
  },
);

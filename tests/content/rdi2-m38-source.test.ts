import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { verifyRdi2Source } from '../../src/content/rdi2-source';
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const s = read('content-private/imports/rdi2/source-candidate.json'),
  l = read('content-private/imports/rdi2/verification-ledger.json'),
  m = s.mechanics[37],
  e = l.characterMechanics[37];
const matrix = readFileSync('reference/rdi2/rdi2-mechanics-matrix.csv', 'utf8'),
  hashes = {
    normalizedSha256: 'a'.repeat(64),
    ledgerSha256: 'b'.repeat(64),
    matrixSha256: 'c'.repeat(64),
  };
it('preserves one original Eve copy, ceil split and publisher-supported responder-only restriction without inventing a runtime binding', () => {
  expect(e.status).toBe('VERIFIED');
  expect(e.counts).toEqual({ dimli: 0, eve: 1, fleck: 0, gog: 0 });
  expect(m.canonicalCardTitle).toBe(
    "I've been working on a new spell. It's called Share Pain!",
  );
  expect(m.effects).toEqual([
    {
      op: 'SPLIT_PENDING_FORTITUDE_LOSS_WITH_SOURCE',
      rounding: 'CEIL',
      lockResponderFurtherSelfMitigation: true,
    },
  ]);
  expect(s.sources.official_m38_erin_rules.authority).toBe('PRIMARY');
  expect(
    e.review.checks.every((c: { result: string }) => c.result === 'PASS'),
  ).toBe(true);
  expect(m.engineAudit.missingCapabilities).toEqual([
    'damage.split-with-source',
    'reaction.self-mitigation-lock',
  ]);
  expect(m.engineAudit.supportedBinding).toBeNull();
  expect(m.projectRulesetOverrides).toBeUndefined();
  expect(
    verifyRdi2Source(s, l, matrix, null, hashes).errors.join('\n'),
  ).not.toContain('M38');
});
it.each(['effects', 'legality', 'engineAudit'])(
  'rejects M38 %s drift',
  (field) => {
    const changed = structuredClone(s);
    changed.mechanics[37][field] =
      field === 'effects'
        ? [
            {
              op: 'SPLIT_PENDING_FORTITUDE_LOSS_WITH_SOURCE',
              rounding: 'CEIL',
              lockAffectedPlayersFurtherSelfMitigation: true,
            },
          ]
        : { incorrect: 'both-player lock or fixed damage' };
    expect(
      verifyRdi2Source(changed, l, matrix, null, hashes).errors.join('\n'),
    ).toContain('M38');
  },
);

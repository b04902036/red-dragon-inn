import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { verifyRdi2Source } from '../../src/content/rdi2-source';
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8')),
  s = read('content-private/imports/rdi2/source-candidate.json'),
  l = read('content-private/imports/rdi2/verification-ledger.json'),
  m = s.mechanics[38],
  e = l.characterMechanics[38];
const matrix = readFileSync('reference/rdi2/rdi2-mechanics-matrix.csv', 'utf8'),
  hashes = {
    normalizedSha256: 'a'.repeat(64),
    ledgerSha256: 'b'.repeat(64),
    matrixSha256: 'c'.repeat(64),
  };
it('verifies the exact Eve record and publisher redirect rules, preserving both distinct branches', () => {
  expect(e.status).toBe('VERIFIED');
  expect(e.counts).toEqual({ dimli: 0, eve: 1, fleck: 0, gog: 0 });
  expect(m.canonicalCardTitle).toBe("I'm not Eve! She's over there!");
  expect(m.legality.alternatives[0].trigger.sourcePlayer).toBe('ANY_PLAYER');
  expect(m.legality.alternatives[1]).toEqual({
    mode: 'TWO_PLAYER_IGNORE',
    livingPlayerCount: 2,
    trigger: {
      event: 'CARD_PENDING',
      sourceType: ['ACTION', 'SOMETIMES', 'ANYTIME'],
      directlyAffects: 'SELF.FORTITUDE',
    },
  });
  expect(m.effects[0]).toMatchObject({
    exclude: 'ORIGINAL_SOURCE_PLAYER',
    preserveOriginalSource: true,
  });
  expect(
    e.review.checks.every((c: { result: string }) => c.result === 'PASS'),
  ).toBe(true);
  expect(m.engineAudit.supportedBinding).toBeNull();
  expect(
    verifyRdi2Source(s, l, matrix, null, hashes).errors.join('\n'),
  ).not.toContain('M39');
});
it.each(['effects', 'legality', 'engineAudit'])(
  'rejects M39 %s drift',
  (field) => {
    const changed = structuredClone(s);
    changed.mechanics[38][field] =
      field === 'effects'
        ? [{ op: 'REDIRECT_PENDING_FORTITUDE_LOSS', target: 'ALL_PLAYERS' }]
        : { incorrect: 'same unconditional branch' };
    expect(
      verifyRdi2Source(changed, l, matrix, null, hashes).errors.join('\n'),
    ).toContain('M39');
  },
);

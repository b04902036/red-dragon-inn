import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { verifyRdi2Source } from '../../src/content/rdi2-source';
import { effectSchema } from '../../src/content/effects';
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const s = read('content-private/imports/rdi2/source-candidate.json'),
  l = read('content-private/imports/rdi2/verification-ledger.json'),
  m = s.mechanics[27],
  e = l.characterMechanics[27];
const matrix = readFileSync('reference/rdi2/rdi2-mechanics-matrix.csv', 'utf8'),
  hashes = {
    normalizedSha256: 'a'.repeat(64),
    ledgerSha256: 'b'.repeat(64),
    matrixSha256: 'c'.repeat(64),
  };
it('verifies the single original Fleck Action independently and retains primary zero-Alcohol payment evidence', () => {
  expect(e.status).toBe('VERIFIED');
  expect(e.counts).toEqual({ dimli: 0, eve: 0, fleck: 1, gog: 0 });
  const r = e.review.evidence[0];
  expect(r.canonicalTitle).toBe(
    "And now I'm going to play something really sad.",
  );
  expect(r.sourceFileSha256).toBe(
    read('reference/rdi2/the-inn-crosscheck.json').characters.fleck.sha256,
  );
  expect(r.canonicalRecordSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(s.sources[r.sourceId].authority).toBe('SECONDARY');
  expect(s.sources.official_rdi2_9e.authority).toBe('PRIMARY');
  expect(
    e.review.checks.every((c: { result: string }) => c.result === 'PASS'),
  ).toBe(true);
  expect(m.legality).toEqual({ mode: 'ACTION_PHASE', actor: 'SELF' });
  expect(m.effects).toEqual([
    { op: 'CHANGE_STAT', target: 'ALL_PLAYERS', stat: 'ALCOHOL', delta: -1 },
    { op: 'TRANSFER_GOLD', from: 'EACH_OTHER_PLAYER', to: 'SELF', amount: 1 },
  ]);
  expect(e.review.engineAudit).toEqual(m.engineAudit);
  expect(
    m.engineAudit.supportedBinding.effects.every(
      (effect: unknown) => effectSchema.safeParse(effect).success,
    ),
  ).toBe(true);
  expect(m.projectRulesetOverrides).toBeUndefined();
  expect(
    verifyRdi2Source(s, l, matrix, null, hashes).errors.join('\n'),
  ).not.toContain('M28');
});
it.each(['legality', 'effects', 'engineAudit'] as const)(
  'rejects unreviewed M28 %s changes',
  (field) => {
    const edited = structuredClone(s);
    edited.mechanics[27][field] =
      field === 'effects'
        ? [{ op: 'CHANGE_STAT', target: 'SELF', stat: 'ALCOHOL', delta: -2 }]
        : { wrong: 'self payment or optional zero-Alcohol payment' };
    expect(
      verifyRdi2Source(edited, l, matrix, null, hashes).errors.join('\n'),
    ).toContain('Reviewed mechanic changed M28');
  },
);

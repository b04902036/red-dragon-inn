import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { verifyRdi2Source } from '../../src/content/rdi2-source';
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const s = read('content-private/imports/rdi2/source-candidate.json'),
  l = read('content-private/imports/rdi2/verification-ledger.json'),
  m = s.mechanics[29],
  e = l.characterMechanics[29];
const matrix = readFileSync('reference/rdi2/rdi2-mechanics-matrix.csv', 'utf8'),
  hashes = {
    normalizedSha256: 'a'.repeat(64),
    ledgerSha256: 'b'.repeat(64),
    matrixSha256: 'c'.repeat(64),
  };
it('retains all four independently inspected physical records and their character quantities without broadening Eve fire errata', () => {
  expect(e.status).toBe('VERIFIED');
  expect(e.counts).toEqual({ dimli: 1, eve: 2, fleck: 1, gog: 0 });
  const records = e.review.evidence.filter(
    (r: { physicalCopy?: number }) => r.physicalCopy !== undefined,
  );
  expect(records).toHaveLength(4);
  const expected = {
    dimli: 'Stop using my head as a table!',
    eve: "That's odd. Illusions aren't supposed to actually hurt.",
    fleck: "Excuse me... I think you're sitting on my tuning fork.",
  };
  for (const [c, title] of Object.entries(expected)) {
    const own = records.filter((r: { sourceId: string }) =>
      r.sourceId.endsWith(c),
    );
    expect(own).toHaveLength(e.counts[c]);
    for (const r of own) {
      expect(r.canonicalTitle).toBe(title);
      expect(r.sourceFileSha256).toBe(
        read('reference/rdi2/the-inn-crosscheck.json').characters[c].sha256,
      );
      expect(r.canonicalRecordSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(s.sources[r.sourceId].authority).toBe('SECONDARY');
    }
  }
  expect(m.effects).toEqual([
    {
      op: 'CHANGE_STAT',
      target: 'CHOSEN_PLAYER',
      stat: 'FORTITUDE',
      delta: -1,
    },
  ]);
  expect(m.legality).toEqual({ mode: 'ACTION_PHASE', target: 'OTHER_PLAYER' });
  expect(e.review.engineAudit).toEqual(m.engineAudit);
  expect(
    e.review.checks.every((c: { result: string }) => c.result === 'PASS'),
  ).toBe(true);
  expect(
    verifyRdi2Source(s, l, matrix, null, hashes).errors.join('\n'),
  ).not.toContain('M30');
});
it.each(['legality', 'effects', 'engineAudit'] as const)(
  'rejects M30 %s drift',
  (field) => {
    const edited = structuredClone(s);
    edited.mechanics[29][field] =
      field === 'effects'
        ? [
            {
              op: 'CHANGE_STAT',
              target: 'CHOSEN_PLAYER',
              stat: 'FORTITUDE',
              delta: -3,
            },
          ]
        : { wrong: 'self-target or borrowed erratum' };
    expect(
      verifyRdi2Source(edited, l, matrix, null, hashes).errors.join('\n'),
    ).toContain('Reviewed mechanic changed M30');
  },
);

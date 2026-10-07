import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { verifyRdi2Source } from '../../src/content/rdi2-source';
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const s = read('content-private/imports/rdi2/source-candidate.json'),
  l = read('content-private/imports/rdi2/verification-ledger.json'),
  m = s.mechanics[34],
  e = l.characterMechanics[34];
const matrix = readFileSync('reference/rdi2/rdi2-mechanics-matrix.csv', 'utf8'),
  hashes = {
    normalizedSha256: 'a'.repeat(64),
    ledgerSha256: 'b'.repeat(64),
    matrixSha256: 'c'.repeat(64),
  };
it('one separately photographed Gog Action hits each other player for one, confirmed by publisher Ignore example', () => {
  expect(e.status).toBe('VERIFIED');
  expect(e.counts).toEqual({ dimli: 0, eve: 0, fleck: 0, gog: 1 });
  expect(m.canonicalCardTitle).toBe('Gog loves everyone!');
  expect(m.cardType).toBe('ACTION');
  expect(m.legality).toEqual({ mode: 'ACTION_PHASE' });
  expect(m.effects).toEqual([
    {
      op: 'CHANGE_STAT',
      target: 'EACH_OTHER_PLAYER',
      stat: 'FORTITUDE',
      delta: -1,
    },
  ]);
  expect(m.engineAudit.supportedBinding).toEqual({ effects: m.effects });
  expect(m.projectRulesetOverrides).toBeUndefined();
  expect(s.sources.physical_gog_review_photo_2_2015.publisherHosted).toBe(
    false,
  );
  expect(
    e.review.evidence.some(
      (r: { id: string }) => r.id === 'official-m35-ignore-example',
    ),
  ).toBe(true);
  expect(
    verifyRdi2Source(s, l, matrix, null, hashes).errors.join('\n'),
  ).not.toContain('M35');
});
it.each(['effects', 'legality', 'engineAudit'] as const)(
  'rejects M35 %s drift',
  (field) => {
    const edited = structuredClone(s);
    edited.mechanics[34][field] =
      field === 'effects'
        ? [
            {
              op: 'CHANGE_STAT',
              target: 'ALL_PLAYERS',
              stat: 'FORTITUDE',
              delta: -1,
            },
          ]
        : { wrong: 'single chosen target' };
    expect(
      verifyRdi2Source(edited, l, matrix, null, hashes).errors.join('\n'),
    ).toContain('Reviewed mechanic changed M35');
  },
);

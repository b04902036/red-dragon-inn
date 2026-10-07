import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { verifyRdi2Source } from '../../src/content/rdi2-source';
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const s = read('content-private/imports/rdi2/source-candidate.json'),
  l = read('content-private/imports/rdi2/verification-ledger.json'),
  m = s.mechanics[36],
  e = l.characterMechanics[36];
const matrix = readFileSync('reference/rdi2/rdi2-mechanics-matrix.csv', 'utf8'),
  hashes = {
    normalizedSha256: 'a'.repeat(64),
    ledgerSha256: 'b'.repeat(64),
    matrixSha256: 'c'.repeat(64),
  };
it('records the scoped Gog override without claiming printed text and preserves exact quantities and originals', () => {
  expect(e.status).toBe('VERIFIED_FOR_PROJECT_RULESET');
  expect(e.completionStatus).toBe('COMPLETE');
  expect(e.counts).toEqual({ dimli: 1, eve: 0, fleck: 1, gog: 1 });
  expect(
    e.review.checks.every((c: { result: string }) => c.result === 'PASS'),
  ).toBe(true);
  expect(e.characterVerification.gog).toMatchObject({
    exactCardText: 'UNAVAILABLE',
    normalizedSemantics: 'PROJECT_RULE_OVERRIDE',
    officialSourceVerified: false,
  });
  for (const c of ['dimli', 'fleck'])
    expect(e.characterVerification[c].printedReductionExclusion).toBe(
      'ANY_PLAYED_CARD_TO_REDUCE_OR_IGNORE_NOT_ONLY_ZERO_LOSS',
    );
  expect(
    s.characters.map((c: { cards: { quantity: number }[] }) =>
      c.cards.reduce((n, card) => n + card.quantity, 0),
    ),
  ).toEqual([40, 40, 40, 40]);
  expect(m.engineAudit.productionRdi2CardCompiled).toBe(false);
  const source = s.sources[m.projectRulesetOverrides.sourceId];
  expect(
    createHash('sha256').update(readFileSync(source.path)).digest('hex'),
  ).toBe(source.sha256);
  const result = verifyRdi2Source(s, l, matrix, null, hashes);
  expect(result.counts?.verifiedMechanics).toBe(44);
  expect(result.counts?.verifiedDrinks).toBe(23);
  expect(result.errors.join('\n')).not.toContain('M37');
  expect(result.valid).toBe(false);
});
it.each(['zero-only', 'amount', 'source', 'override', 'quantity', 'publisher'])(
  'rejects M37 drift: %s',
  (change) => {
    const source = structuredClone(s),
      ledger = structuredClone(l),
      r = source.mechanics[36];
    if (change === 'zero-only')
      delete r.engineAudit.supportedBinding.responseTrigger.alternatives[0][1]
        .excludeMitigationCardsPlayed;
    if (change === 'amount') r.effects[0].delta = -3;
    if (change === 'source') r.legality.trigger.sourceCardRequired = false;
    if (change === 'override') r.projectRulesetOverrides.scope = 'GOG_M15';
    if (change === 'quantity')
      source.characters[3].cards.find(
        (c: { mechanicId: string }) => c.mechanicId === r.id,
      ).quantity = 2;
    if (change === 'publisher')
      r.verification.characterVerification.gog.officialSourceVerified = true;
    expect(
      verifyRdi2Source(source, ledger, matrix, null, hashes).errors.join('\n'),
    ).toContain('M37');
  },
);

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { verifyRdi2Source } from '../../src/content/rdi2-source';
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const s = read('content-private/imports/rdi2/source-candidate.json'),
  l = read('content-private/imports/rdi2/verification-ledger.json');
const matrix = readFileSync('reference/rdi2/rdi2-mechanics-matrix.csv', 'utf8');
const hashes = {
  normalizedSha256: 'a'.repeat(64),
  ledgerSha256: 'b'.repeat(64),
  matrixSha256: 'c'.repeat(64),
};
it('M40 completes the scoped override with one Anytime copy, shared semantics and explicit fallback title', () => {
  const m = s.mechanics[39],
    e = l.characterMechanics[39];
  expect(e.status).toBe('VERIFIED_FOR_PROJECT_RULESET');
  expect(e.completionStatus).toBe('COMPLETE');
  expect(e.counts).toEqual({ dimli: 0, eve: 0, fleck: 1, gog: 1 });
  expect(
    e.review.checks.every((c: { result: string }) => c.result === 'PASS'),
  ).toBe(true);
  expect(m.cardType).toBe('ANYTIME');
  expect(m.effects).toEqual([
    { op: 'CHANGE_STAT', target: 'SELF', stat: 'FORTITUDE', delta: 2 },
  ]);
  expect(m.legality).toEqual({ mode: 'ANYTIME' });
  const gog = s.characters[3].cards.filter(
    (c: { mechanicId: string }) => c.mechanicId === m.id,
  );
  expect(gog).toHaveLength(1);
  expect(gog[0].quantity).toBe(1);
  expect(gog[0].canonicalCardTitle).toBeUndefined();
  expect(gog[0].displayLabelProvenance).toBe(
    'NORMALIZED_FALLBACK_NOT_PHYSICAL_TITLE',
  );
  expect(e.characterVerification.gog).toMatchObject({
    exactCardText: 'UNAVAILABLE',
    normalizedSemantics: 'PROJECT_RULE_OVERRIDE',
    officialSourceVerified: false,
  });
  const authority = s.sources[m.projectRulesetOverrides.sourceId];
  expect(
    createHash('sha256').update(readFileSync(authority.path)).digest('hex'),
  ).toBe(authority.sha256);
  expect(
    s.characters.map((c: { cards: { quantity: number }[] }) =>
      c.cards.reduce((n, card) => n + card.quantity, 0),
    ),
  ).toEqual([40, 40, 40, 40]);
  expect(s.mechanics.filter((r: { id: string }) => r.id === m.id)).toHaveLength(
    1,
  );
  expect(m.engineAudit.productionRdi2CardCompiled).toBe(false);
  const result = verifyRdi2Source(s, l, matrix, null, hashes);
  expect(result.counts?.verifiedMechanics).toBe(44);
  expect(result.counts?.verifiedDrinks).toBe(23);
  expect(result.errors.filter((error) => error.startsWith('M40'))).toEqual([]);
  expect(result.errors.join('\n')).not.toContain('Unverified ledger item M41');
});
it.each([
  'amount',
  'target',
  'cost',
  'trigger',
  'type',
  'title',
  'quantity',
  'override',
  'publisher',
  'binding',
])('rejects M40 drift: %s', (change) => {
  const source = structuredClone(s),
    ledger = structuredClone(l),
    m = source.mechanics[39];
  const card = source.characters[3].cards.find(
    (c: { mechanicId: string }) => c.mechanicId === m.id,
  );
  if (change === 'amount') m.effects[0].delta = 3;
  if (change === 'target') m.effects[0].target = 'CHOSEN_PLAYER';
  if (change === 'cost')
    m.effects.push({ op: 'PAY_INN', target: 'SELF', amount: 1 });
  if (change === 'trigger') m.legality.trigger = { phase: 'ACTION' };
  if (change === 'type') m.cardType = 'SOMETIMES';
  if (change === 'title') card.canonicalCardTitle = 'Speculative fixture title';
  if (change === 'quantity') card.quantity = 2;
  if (change === 'override')
    m.projectRulesetOverrides.scope = 'GOG_M37_RETALIATION';
  if (change === 'publisher')
    m.verification.characterVerification.gog.officialSourceVerified = true;
  if (change === 'binding') delete m.engineAudit;
  expect(
    verifyRdi2Source(source, ledger, matrix, null, hashes).errors.join('\n'),
  ).toContain('M40');
});

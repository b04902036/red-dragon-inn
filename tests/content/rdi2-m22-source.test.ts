import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { verifyRdi2Source } from '../../src/content/rdi2-source';
import { m22Effects, m22Trigger } from '../fixtures/rdi2-m22-source';
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const source = read('content-private/imports/rdi2/source-candidate.json');
const ledger = read('content-private/imports/rdi2/verification-ledger.json');
const matrix = readFileSync('reference/rdi2/rdi2-mechanics-matrix.csv', 'utf8');
const m = source.mechanics[21],
  e = ledger.characterMechanics[21];
const hashes = {
  normalizedSha256: 'a'.repeat(64),
  ledgerSha256: 'b'.repeat(64),
  matrixSha256: 'c'.repeat(64),
};
it('records both individually inspected original Sometimes copies and four separate quantities', () => {
  const records = e.review.evidence.filter((r: { id: string }) =>
    r.id.startsWith('original-m22-dimli-'),
  );
  expect(records.map((r: { physicalCopy: number }) => r.physicalCopy)).toEqual([
    1, 2,
  ]);
  for (const r of records) {
    expect(r.canonicalTitle).toBe(
      "You have this. I'm waiting for the good stuff!",
    );
    expect(r.canonicalRecordSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(r.sourceFileSha256).toBe(
      read('reference/rdi2/the-inn-crosscheck.json').characters.dimli.sha256,
    );
  }
  expect(e.counts).toEqual({ dimli: 2, eve: 0, fleck: 0, gog: 0 });
  expect(e.status).toBe('VERIFIED');
  expect(
    e.review.checks.every((c: { result: string }) => c.result === 'PASS'),
  ).toBe(true);
  expect(m.projectRulesetOverrides).toBeUndefined();
  expect(source.sources.the_inn_m22_original_dimli.authority).toBe('SECONDARY');
});
it('matches the tested generic whole-Drink binding while keeping pending team/immune-target capabilities honest', () => {
  expect(m.engineAudit.supportedBinding).toEqual({
    responseTrigger: m22Trigger,
    effects: m22Effects,
  });
  expect(m.engineAudit.missingCapabilities).toEqual([
    'team.variant-runtime-and-other-player-targeting',
    'reaction.ignore-source-target-restriction',
  ]);
  expect(e.review.legality).toEqual(m.legality);
  expect(e.review.drinkSemantics).toEqual(m.drinkSemantics);
  expect(ledger.characterMechanics[20].completionStatus).toBe(
    'SOURCE_REVIEW_COMPLETE',
  );
  const result = verifyRdi2Source(source, ledger, matrix, null, hashes);
  expect(result.errors.join('\n')).not.toContain('Unverified ledger item M22');
  expect(result.errors.join('\n')).not.toContain('M22 must');
  expect(result.errors.join('\n')).not.toContain(
    'M21 required team acceptance J remains pending',
  );
});
it.each([
  ['legality', 'target', 'SELF'],
  ['drinkSemantics', 'scope', 'BASE_DRINK_ONLY'],
  ['drinkSemantics', 'drinkEvents', true],
  ['drinkSemantics', 'negate', true],
  ['drinkSemantics', 'ignore', true],
  ['drinkSemantics', 'contestComparison', 'RECIPIENT'],
  ['drinkSemantics', 'targetRestrictions', 'NONE'],
] as const)(
  'rejects a jointly altered source/review %s.%s',
  (field, key, value) => {
    const s = structuredClone(source),
      l = structuredClone(ledger);
    s.mechanics[21][field][key] = value;
    l.characterMechanics[21].review[field][key] = value;
    expect(
      verifyRdi2Source(s, l, matrix, null, hashes).errors.join('\n'),
    ).toContain('M22 must preserve');
  },
);
it('rejects changing both source and reviewed effects to a split', () => {
  const s = structuredClone(source),
    l = structuredClone(ledger);
  s.mechanics[21].effects = [
    { op: 'SPLIT_CURRENT_DRINK', target: 'CHOSEN_PLAYER' },
  ];
  l.characterMechanics[21].review.effects = s.mechanics[21].effects;
  expect(
    verifyRdi2Source(s, l, matrix, null, hashes).errors.join('\n'),
  ).toContain('M22 must preserve');
});
it.each(['SOURCE', 'OVERRIDE'] as const)(
  'rejects false M22 provenance %s',
  (mode) => {
    const s = structuredClone(source);
    if (mode === 'SOURCE')
      s.sources.the_inn_m22_original_dimli.authority = 'PRIMARY';
    else s.mechanics[21].projectRulesetOverrides = { authority: 'USER' };
    expect(
      verifyRdi2Source(s, ledger, matrix, null, hashes).errors.join('\n'),
    ).toContain('M22 must retain original');
  },
);

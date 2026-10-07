import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { verifyRdi2Source } from '../../src/content/rdi2-source';
import {
  m27Trigger,
  m27Effects,
  m27Metadata,
} from '../fixtures/rdi2-m27-source';
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const s = read('content-private/imports/rdi2/source-candidate.json'),
  l = read('content-private/imports/rdi2/verification-ledger.json'),
  m = s.mechanics[26],
  e = l.characterMechanics[26];
const matrix = readFileSync('reference/rdi2/rdi2-mechanics-matrix.csv', 'utf8'),
  hashes = {
    normalizedSha256: 'a'.repeat(64),
    ledgerSha256: 'b'.repeat(64),
    matrixSha256: 'c'.repeat(64),
  };
const verify = (source = s, ledger = l) =>
  verifyRdi2Source(source, ledger, matrix, null, hashes);
it('completes M27 with user-only Gog provenance and retains publisher mechanic authority', () => {
  expect(e.status).toBe('VERIFIED_FOR_PROJECT_RULESET');
  expect(e.completionStatus).toBe('COMPLETE');
  expect(e.mechanicVerification).toEqual(m.mechanicVerification);
  expect(m.mechanicVerification).toMatchObject({
    status: 'COMPLETE',
    classification: 'PUBLISHER_VERIFIED',
    officialSourceVerified: true,
    incomingCounterRestriction: 'VERIFIED_PUBLISHER',
    directEffectRule: 'VERIFIED_PUBLISHER',
  });
  expect(e.characterVerification.gog).toMatchObject({
    quantity: 'VERIFIED_SECONDARY_MATRIX',
    mechanicFamily: 'VERIFIED_SECONDARY_MATRIX',
    physicalCopyProvenance: 'M27 USER OVERRIDE — Gog physical-copy provenance',
    publisherDirectOwnership: 'NOT_CLAIMED',
    semantics: 'VERIFIED_PUBLISHER',
    incomingCounterRestriction: 'VERIFIED_PUBLISHER',
  });
  expect(m.projectRulesetOverrides).toBeUndefined();
  expect(e.review.candidateCorrectionPending).toBeUndefined();
  expect(e.review.missingEvidence).toEqual([]);
  expect(
    e.review.checks.every((c: { result: string }) => c.result === 'PASS'),
  ).toBe(true);
  expect(e.review.engineAcceptance).toMatchObject({
    status: 'FOCUSED_PASS',
    requiredTests: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'],
    protectionTestK: 'PASS',
    directEffectIndependentTestI: 'PASS',
    pendingRequiredTests: [],
  });
});
it('retains all four quantities and three individually hashed original records without inventing a Gog record', () => {
  expect(e.counts).toEqual({ dimli: 1, eve: 1, fleck: 1, gog: 1 });
  const records = e.review.evidence.filter(
    (r: { physicalCopy?: number }) => r.physicalCopy !== undefined,
  );
  expect(records).toHaveLength(3);
  for (const r of records) {
    expect(r.canonicalRecordSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(r.canonicalTitle).toBe(
      'The Wench thinks you should stop playing with the drinks.',
    );
    expect(s.sources[r.sourceId].authority).toBe('SECONDARY');
  }
  expect(e.characterVerification.gog.exactPhysicalCard).toBe('UNAVAILABLE');
});
it('preserves the supplied evidence instruction byte for byte as an instruction rather than a semantic override', () => {
  const p = 'codex-prompts/step-24a-m27-official-evidence-unblock.md',
    source = s.sources.user_m27_official_evidence_unblock_2026_10_06;
  expect(source.kind).toBe('USER_EVIDENCE_INSTRUCTION');
  expect(source.sha256).toBe(
    createHash('sha256').update(readFileSync(p)).digest('hex'),
  );
  for (const id of [
    'official_rdi2_9e',
    'official_m27_direct_effect_clarification',
    'official_m27_special_reserve_exclusion',
  ])
    expect(s.sources[id].authority).toBe('PRIMARY');
});
it('records the generic tested predicate, Negate operation and both existing equivalent hard-counter families', () => {
  expect(m.legality.trigger).toMatchObject({
    sourceCardType: 'SOMETIMES',
    sourceCapability: 'CHANGES_DRINK_EFFECT',
    direct: true,
    affectedObject: 'DRINK_NOT_DRINK_EVENT',
  });
  expect(m.legality.sameCounterTarget).toBe(false);
  expect(m.counterMetadata).toMatchObject({
    incomingRestriction: 'ONLY_IDONTTHINKSO_FAMILY',
    provenance: 'PUBLISHER_VERIFIED',
  });
  expect(m.engineAudit.supportedBinding).toEqual({
    responseKind: 'NEGATE',
    responseTrigger: m27Trigger,
    effects: m27Effects,
    ...m27Metadata,
  });
  expect(m.engineAudit.missingCapabilities).toEqual([]);
  expect(verify().errors.join('\n')).not.toContain('M27 must preserve');
});
it.each([
  'legality',
  'effects',
  'counterMetadata',
  'engineAudit',
  'mechanicVerification',
] as const)(
  'rejects unreviewed M27 %s changes despite the provenance-only override',
  (field) => {
    const source = structuredClone(s);
    source.mechanics[26][field] =
      field === 'effects'
        ? [{ op: 'IGNORE_CURRENT_DRINK' }]
        : { wrong: 'unprotected or indirect counter' };
    expect(verify(source).errors.join('\n')).toContain('M27 must preserve');
  },
);
it('rejects relabeling the publisher mechanic as a project override', () => {
  const source = structuredClone(s);
  source.mechanics[26].projectRulesetOverrides = {
    provenance: 'PROJECT_RULE_OVERRIDE',
  };
  expect(verify(source).errors.join('\n')).toContain('M27 must preserve');
});
it('rejects secondary authority for either new publisher clarification', () => {
  for (const id of [
    'official_m27_direct_effect_clarification',
    'official_m27_special_reserve_exclusion',
  ]) {
    const source = structuredClone(s);
    source.sources[id].authority = 'SECONDARY';
    expect(verify(source).errors.join('\n')).toContain(
      `M27 publisher mechanic evidence requires primary source ${id}`,
    );
  }
});
it('rejects removal of the explicit provenance authorization and a false publisher Gog claim', () => {
  const source = structuredClone(s),
    ledger = structuredClone(l);
  delete source.mechanics[26].physicalCopyProvenanceOverride;
  expect(verify(source, ledger).errors.join('\n')).toContain(
    'M27 requires the scoped Gog one-copy provenance override',
  );
  source.mechanics[26].verification.characterVerification.gog.physicalCopyProvenance =
    'VERIFIED_PUBLISHER';
  expect(verify(source, ledger).errors.join('\n')).toContain(
    'M27 must separate publisher mechanic evidence',
  );
});
it('preserves M21/J as a non-blocking team TODO while counting the qualified M27 row', () => {
  expect(l.characterMechanics[20].completionStatus).toBe(
    'SOURCE_REVIEW_COMPLETE',
  );
  expect(s.mechanics[20].engineAcceptance.pendingRequiredTests).toEqual(['J']);
  expect(
    l.characterMechanics
      .slice(41)
      .every((r: { status: string }) =>
        ['VERIFIED', 'VERIFIED_FOR_PROJECT_RULESET'].includes(r.status),
      ),
  ).toBe(true);
  const result = verify();
  expect(result.counts?.verifiedMechanics).toBe(44);
  expect(result.counts?.verifiedDrinks).toBe(23);
  expect(result.valid).toBe(false);
  expect(result.errors.join('\n')).not.toContain('Unverified ledger item M27');
  expect(result.errors.join('\n')).not.toContain('M27 requires');
  expect(result.errors.join('\n')).not.toContain('Unverified ledger item M41');
});
it('binds exactly one Gog physical copy to the unchanged shared standard mechanic and keeps all decks at forty', () => {
  const gog = s.characters.find((c: { id: string }) => c.id === 'gog');
  const cards = gog.cards.filter(
    (c: { mechanicId: string }) => c.mechanicId === m.id,
  );
  expect(cards).toHaveLength(1);
  expect(cards[0]).toMatchObject({
    quantity: 1,
    type: 'SOMETIMES',
    canonicalCardTitle:
      'The Wench thinks you should stop playing with the drinks.',
  });
  expect(cards[0].projectRuleOverride).toEqual(
    m.physicalCopyProvenanceOverride,
  );
  expect(e.physicalCopyProvenanceOverride).toEqual(
    m.physicalCopyProvenanceOverride,
  );
  expect(e.review.physicalCopyProvenanceOverride).toEqual(
    m.physicalCopyProvenanceOverride,
  );
  expect(s.mechanics.filter((r: { id: string }) => r.id === m.id)).toHaveLength(
    1,
  );
  expect(
    s.mechanics.some((r: { id: string }) =>
      /gog.*negate_drink_change|negate_drink_change.*gog/.test(r.id),
    ),
  ).toBe(false);
  for (const c of s.characters) {
    expect(
      c.cards.reduce((n: number, r: { quantity: number }) => n + r.quantity, 0),
    ).toBe(40);
    expect(
      c.cards
        .filter((r: { mechanicId: string }) => r.mechanicId === m.id)
        .map((r: { quantity: number }) => r.quantity),
    ).toEqual([1]);
  }
  const p = 'codex-prompts/step-24a-m27-gog-provenance-override.md';
  expect(s.sources.user_m27_gog_physical_provenance_2026_10_06.sha256).toBe(
    createHash('sha256').update(readFileSync(p)).digest('hex'),
  );
});
it.each([
  'quantity',
  'owner',
  'scope',
  'gameplayChanged',
  'publisherDirectOwnership',
  'extraGameplayRule',
])('rejects provenance override broadening through %s', (field) => {
  const source = structuredClone(s);
  source.mechanics[26].physicalCopyProvenanceOverride[field] = 'unauthorized';
  expect(verify(source).errors.join('\n')).toContain(
    'M27 requires the scoped Gog one-copy provenance override',
  );
});
it.each(['duplicate', 'quantity', 'title', 'binding', 'ledger', 'source'])(
  'rejects M27 physical-copy %s corruption',
  (field) => {
    const source = structuredClone(s),
      ledger = structuredClone(l);
    const gog = source.characters.find((c: { id: string }) => c.id === 'gog');
    const card = gog.cards.find(
      (r: { mechanicId: string }) => r.mechanicId === m.id,
    );
    if (field === 'duplicate')
      gog.cards.push({ ...card, cardKey: 'duplicate-m27' });
    if (field === 'quantity') card.quantity = 2;
    if (field === 'title')
      card.canonicalCardTitle = 'Unverified alternate card';
    if (field === 'binding') card.projectRuleOverride = {};
    if (field === 'ledger')
      ledger.characterMechanics[26].physicalCopyProvenanceOverride = {};
    if (field === 'source')
      source.sources.user_m27_gog_physical_provenance_2026_10_06.authority =
        'PRIMARY';
    expect(verify(source, ledger).errors.join('\n')).toContain(
      'M27 requires the scoped Gog one-copy provenance override',
    );
  },
);

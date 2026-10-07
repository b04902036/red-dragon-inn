import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { verifyRdi2Source } from '../../src/content/rdi2-source';
import { m21Effects, m21Trigger } from '../fixtures/rdi2-m21-project';
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const source = read('content-private/imports/rdi2/source-candidate.json');
const ledger = read('content-private/imports/rdi2/verification-ledger.json');
const mechanic = source.mechanics[20],
  entry = ledger.characterMechanics[20];
const matrix = readFileSync('reference/rdi2/rdi2-mechanics-matrix.csv', 'utf8');
const hashes = {
  normalizedSha256: 'a'.repeat(64),
  ledgerSha256: 'b'.repeat(64),
  matrixSha256: 'c'.repeat(64),
};
it('checks each physical summary against its reviewed character template rather than the combined family description', () => {
  const result = verifyRdi2Source(source, ledger, matrix, null, hashes);
  expect(
    result.errors.filter((e) => e.startsWith('Card type/summary mismatch')),
  ).toEqual([]);
  const changed = structuredClone(source);
  changed.characters[0].cards.find(
    (c: { mechanicId: string }) => c.mechanicId === mechanic.id,
  ).rulesSummary = changed.characters[3].cards.find(
    (c: { mechanicId: string }) => c.mechanicId === mechanic.id,
  ).rulesSummary;
  expect(
    verifyRdi2Source(changed, ledger, matrix, null, hashes).errors.join('\n'),
  ).toContain('Card type/summary mismatch rdi2.dimli');
  changed.mechanics[20].characterRulesSummary.dimli = {
    'en-US': 'unsupported timing',
    'zh-TW': '未經驗證的時機',
  };
  expect(
    verifyRdi2Source(changed, ledger, matrix, null, hashes).errors.join('\n'),
  ).toContain('Reviewed mechanic changed M21');
});
it('preserves the exact separately scoped user instruction hash and does not claim reconstructed physical wording is official', () => {
  const origin = source.sources[mechanic.projectRulesetOverrides.sourceId];
  expect(origin).toMatchObject({
    kind: 'PROJECT_RULE_OVERRIDE',
    authority: 'USER_SPECIFIED',
    label: 'M21 USER OVERRIDE',
    scope: 'GOG_M21_TWO_COPIES_ONLY',
    officialSourceVerified: false,
  });
  expect(origin.sha256).toBe(
    createHash('sha256').update(readFileSync(origin.path)).digest('hex'),
  );
  expect(entry.characterVerification.gog).toMatchObject({
    cardIdentity: 'VERIFIED_OFFICIAL_NAMED_EXAMPLE',
    exactCardText: 'UNAVAILABLE',
    normalizedSemantics: 'PROJECT_RULE_OVERRIDE',
    identicalCopies: 'PROJECT_RULE_OVERRIDE',
    officialSourceVerified: false,
  });
  expect(entry.review.projectRulesetOverrides).toEqual(
    mechanic.projectRulesetOverrides,
  );
  expect(entry.fieldVerification.gog).toEqual({
    trigger: 'PROJECT_RULE_OVERRIDE',
    contestTrigger: 'PROJECT_RULE_OVERRIDE',
    source: 'PROJECT_RULE_OVERRIDE',
    amount: 'PROJECT_RULE_OVERRIDE',
    target: 'PROJECT_RULE_OVERRIDE',
    independentDrink: 'PROJECT_RULE_OVERRIDE',
    contestEntry: 'PROJECT_RULE_OVERRIDE',
    quantityAndIdenticalCopies: 'PROJECT_RULE_OVERRIDE',
  });
});
it('I: keeps exactly two identical Gog physical copies and the original independent Dimli phase template', () => {
  const gog = source.characters.find((c: { id: string }) => c.id === 'gog');
  const copies = gog.cards.filter(
    (c: { mechanicId: string }) => c.mechanicId === mechanic.id,
  );
  expect(copies).toHaveLength(1);
  expect(copies[0]).toMatchObject({
    quantity: 2,
    type: 'SOMETIMES',
    canonicalCardTitle: 'Gog say you drink MORE!',
    projectRuleOverride: mechanic.projectRulesetOverrides,
  });
  expect(mechanic.characterTemplates.dimli).toEqual({
    legality: {
      mode: 'PHASE_OPPORTUNITY',
      phase: 'DRINK',
      phaseOwner: 'OTHER',
    },
    effects: [
      {
        op: 'QUEUE_EXTRA_DRINK',
        target: 'PHASE_OWNER',
        source: 'DRINK_ME_PILE',
        separateDrink: true,
      },
    ],
  });
  expect(entry.characterVerification.dimli.semantics).toBe(
    'VERIFIED_ORIGINAL_JSON_AND_OFFICIAL_RULES',
  );
  for (const c of source.characters)
    expect(
      c.cards.reduce(
        (total: number, row: { quantity: number }) => total + row.quantity,
        0,
      ),
    ).toBe(40);
});
it('binds the tested shared reveal/queue implementation to an actual other-player Drink, any valid reveal context and independent own-pile count one', () => {
  const gog = mechanic.characterTemplates.gog;
  expect(gog.sharedImplementation).toEqual({
    responseTrigger: m21Trigger,
    effects: m21Effects,
  });
  expect(gog.legality.trigger).toEqual({
    event: 'DRINK_REVEALED',
    sourceActor: 'OTHER_PLAYER',
    sourceCardType: 'DRINK',
    chasersComplete: true,
    includesDrinkingContest: true,
  });
  expect(gog.effects).toEqual([
    {
      op: 'FORCE_EXTRA_DRINK_FROM_TARGET_DRINK_ME',
      target: 'SOURCE_ACTOR',
      source: 'TARGET_OWN_DRINK_ME_PILE',
      count: 1,
      independentDrink: true,
      contestEntry: false,
    },
  ]);
  expect(entry.review.characterTemplates).toEqual(mechanic.characterTemplates);
  expect(
    entry.review.checks.every((c: { result: string }) => c.result === 'PASS'),
  ).toBe(true);
});
it('preserves original-record and primary example evidence separately from the user-supplied secondary quotation', () => {
  const record = entry.review.evidence.find(
    (r: { id: string }) => r.id === 'original-m21-dimli-1',
  );
  expect(record.sourceFileSha256).toBe(
    read('reference/rdi2/the-inn-crosscheck.json').characters.dimli.sha256,
  );
  expect(record.canonicalRecordSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(source.sources.the_inn_m21_original_dimli.authority).toBe('SECONDARY');
  expect(source.sources.official_m21_gog_rdi8_example).toMatchObject({
    authority: 'PRIMARY',
    kind: 'OFFICIAL_RULES_NAMED_CARD_EXAMPLE',
  });
  expect(source.sources.official_m21_shared_drink_team_rules.authority).toBe(
    'PRIMARY',
  );
  expect(
    entry.review.evidence.find(
      (r: { id: string }) => r.id === 'secondary-m21-reveal-wording',
    ),
  ).toMatchObject({
    authority: 'SECONDARY',
    transcriptionProvidedBy: 'USER',
    directRemoteInspection: false,
  });
  expect(entry.review.previousBlockedReview.status).toBe(
    'BLOCKED_MISSING_EVIDENCE',
  );
});
it('keeps real team acceptance J pending as a non-blocking TODO under the new user decision', () => {
  expect(entry.completionStatus).toBe('SOURCE_REVIEW_COMPLETE');
  expect(mechanic.engineAcceptance).toMatchObject({
    passedRequiredTests: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
    pendingRequiredTests: ['J'],
    missingCapabilities: ['team.variant-runtime-and-other-player-targeting'],
  });
  expect(mechanic.engineAudit).toMatchObject({
    teamRuntimeImplemented: false,
    teamAcceptance: 'NOT_EXECUTABLE_WITH_CURRENT_ENGINE',
  });
  expect(
    ledger.characterMechanics
      .slice(41)
      .every((r: { status: string }) =>
        ['VERIFIED', 'VERIFIED_FOR_PROJECT_RULESET'].includes(r.status),
      ),
  ).toBe(true);
  const result = verifyRdi2Source(source, ledger, matrix, null, hashes);
  expect(result.valid).toBe(false);
  expect(result.counts?.verifiedMechanics).toBe(44);
  expect(result.errors.join('\n')).not.toContain(
    'M21 required team acceptance J remains pending',
  );
  expect(result.errors.join('\n')).not.toContain('Unverified ledger item M21');
  expect(result.errors.join('\n')).not.toContain(
    'Reviewed mechanic changed M21',
  );
  expect(result.errors.join('\n')).not.toContain(
    'Missing structured Sometimes trigger',
  );
});
const mutations: Array<
  [string, (s: typeof source, l: typeof ledger) => void, string]
> = [
  [
    'malformed character triggers',
    (s) => {
      s.mechanics[20].legality.templates = 1;
    },
    'Missing structured Sometimes trigger',
  ],
  [
    'empty character triggers',
    (s) => {
      s.mechanics[20].legality.templates = {};
    },
    'Missing structured Sometimes trigger',
  ],
  [
    'missing Gog leaf trigger',
    (s) => {
      s.mechanics[20].legality.templates.gog.trigger = {};
    },
    'Missing structured Sometimes trigger',
  ],
  [
    'missing Dimli leaf phase',
    (s) => {
      s.mechanics[20].legality.templates.dimli.phase = '';
    },
    'Missing structured Sometimes trigger',
  ],
  [
    'false primary example provenance',
    (s) => {
      s.sources.official_m21_gog_rdi8_example.authority = 'USER_SPECIFIED';
    },
    'M21 must preserve its Gog-only',
  ],
  [
    'missing shared primary rules',
    (s) => {
      delete s.sources.official_m21_shared_drink_team_rules;
    },
    'M21 must preserve its Gog-only',
  ],
  [
    'Dimli field-authority broadening',
    (s) => {
      s.mechanics[20].verification.characterVerification.dimli.semantics =
        'PROJECT_RULE_OVERRIDE';
    },
    'M21 must preserve its Gog-only',
  ],
  [
    'publisher-transcription claim',
    (s) => {
      s.sources[
        s.mechanics[20].projectRulesetOverrides.sourceId
      ].officialSourceVerified = true;
    },
    'M21 must preserve its Gog-only',
  ],
  [
    'borrowed override authority',
    (s) => {
      s.mechanics[20].projectRulesetOverrides.sourceId =
        'project_m18_gog_override_2026_10_06';
    },
    'M21 must preserve its Gog-only',
  ],
  [
    'false full wording verification',
    (s) => {
      s.mechanics[20].verification.characterVerification.gog.exactCardText =
        'VERIFIED';
    },
    'M21 must preserve its Gog-only',
  ],
  [
    'false official trigger',
    (s) => {
      s.mechanics[20].verification.fieldVerification.gog.trigger =
        'VERIFIED_OFFICIAL_RULES';
    },
    'M21 must preserve its Gog-only',
  ],
  [
    'phase-only Gog trigger',
    (s) => {
      s.mechanics[20].characterTemplates.gog.legality.trigger.event =
        'PHASE_ENTRY';
    },
    'M21 must preserve Dimli original',
  ],
  [
    'contest exclusion',
    (s) => {
      s.mechanics[20].characterTemplates.gog.legality.trigger.includesDrinkingContest = false;
    },
    'M21 must preserve Dimli original',
  ],
  [
    'unfinished Chaser window',
    (s) => {
      s.mechanics[20].characterTemplates.gog.legality.trigger.chasersComplete = false;
    },
    'M21 must preserve Dimli original',
  ],
  [
    'self target',
    (s) => {
      s.mechanics[20].characterTemplates.gog.legality.selfTarget = 'ALLOWED';
    },
    'M21 must preserve Dimli original',
  ],
  [
    'wrong Drink source',
    (s) => {
      s.mechanics[20].characterTemplates.gog.effects[0].source = 'INN';
    },
    'M21 must preserve Dimli original',
  ],
  [
    'two extra Drinks',
    (s) => {
      s.mechanics[20].characterTemplates.gog.effects[0].count = 2;
    },
    'M21 must preserve Dimli original',
  ],
  [
    'merged Drink',
    (s) => {
      s.mechanics[20].characterTemplates.gog.effects[0].independentDrink = false;
    },
    'M21 must preserve Dimli original',
  ],
  [
    'extra contest entry',
    (s) => {
      s.mechanics[20].characterTemplates.gog.effects[0].contestEntry = true;
    },
    'M21 must preserve Dimli original',
  ],
  [
    'Dimli broadening',
    (s) => {
      s.mechanics[20].characterTemplates.dimli.legality.phase = 'ANY';
    },
    'M21 must preserve Dimli original',
  ],
  [
    'empty-pile trigger',
    (s) => {
      s.mechanics[20].characterTemplates.gog.sharedImplementation.responseTrigger.alternatives[0].pop();
    },
    'M21 must preserve Dimli original',
  ],
  [
    'fake team runtime',
    (s) => {
      s.mechanics[20].engineAudit.teamRuntimeImplemented = true;
    },
    'M21 must retain incomplete team',
  ],
  [
    'fake team test',
    (s) => {
      s.mechanics[20].engineAcceptance.pendingRequiredTests = [];
    },
    'M21 must retain incomplete team',
  ],
  [
    'false COMPLETE',
    (_, l) => {
      l.characterMechanics[20].completionStatus = 'COMPLETE';
    },
    'M21 must retain incomplete team',
  ],
  [
    'missing shared queue',
    (s) => {
      s.mechanics[20].engineAudit.supportedGogBinding.effects = [];
    },
    'M21 must retain incomplete team',
  ],
  [
    'wrong physical copy type',
    (s) => {
      s.characters
        .find((c: { id: string }) => c.id === 'gog')
        .cards.find(
          (r: { mechanicId: string }) => r.mechanicId === s.mechanics[20].id,
        ).type = 'ACTION';
    },
    'M21 must retain one original',
  ],
  [
    'Dimli override spillover',
    (s) => {
      s.characters
        .find((c: { id: string }) => c.id === 'dimli')
        .cards.find(
          (r: { mechanicId: string }) => r.mechanicId === s.mechanics[20].id,
        ).projectRuleOverride = s.mechanics[20].projectRulesetOverrides;
    },
    'M21 must retain one original',
  ],
];
it.each(mutations)('rejects %s', (_, mutate, message) => {
  const s = structuredClone(source),
    l = structuredClone(ledger);
  mutate(s, l);
  expect(
    verifyRdi2Source(s, l, matrix, null, hashes).errors.join('\n'),
  ).toContain(message);
});

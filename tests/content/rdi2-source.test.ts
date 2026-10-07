import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyRdi2Source } from '../../src/content/rdi2-source';

const matrix = readFileSync('reference/rdi2/rdi2-mechanics-matrix.csv', 'utf8');
const hashes = {
  normalizedSha256: 'a'.repeat(64),
  ledgerSha256: 'b'.repeat(64),
  matrixSha256: 'c'.repeat(64),
};
const mechanicChecks = [
  'quantity per character',
  'card type/timing',
  'numeric values',
  'targets',
  'response trigger if Sometimes/Anytime',
  'special restrictions/edge cases',
  'current errata override if applicable',
];
const drinkChecks = [
  'quantity',
  'Drink vs Drink Event classification',
  'numeric effects',
  'Chaser/event rules',
  'current-edition overrides',
];
const ids = ['dimli', 'eve', 'fleck', 'gog'] as const;

// Synthetic plans and reviews only. No production ledger is bulk-marked VERIFIED.
function fixture() {
  const rows = matrix
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split(','));
  const provenance = {
    sourceId: 'fixture',
    provenance: 'PROJECT_RULE_OVERRIDE' as const,
    date: '2026-10-05',
    target: 'ANY_ACTIVE_GAMBLER' as const,
    selfTarget: 'ALLOWED' as const,
    officialSourceVerified: false as const,
  };
  const mechanics = rows.map((row) => {
    const id = row[0]!;
    const legality: Record<string, unknown> = {
      mode: 'RESPONSE',
      trigger: { event: 'UNIT_TEST_CONTEXT' },
    };
    const effects: Record<string, unknown>[] = [{ op: 'UNIT_TEST_EFFECT' }];
    if (id === 'give_two_alcohol')
      effects[0] = { op: 'CHANGE_STAT', stat: 'ALCOHOL', delta: 2 };
    if (id === 'damage_three')
      effects[0] = { op: 'CHANGE_STAT', stat: 'FORTITUDE', delta: -3 };
    if (id === 'illusionary_payment')
      effects[0] = {
        op: 'PREVENT_CURRENT_GOLD_LOSS',
        goldMovement: 'NONE',
        anteCountsAsSatisfied: true,
        scope: 'CURRENT_PAYMENT_OR_GOLD_LOSS_CONTEXT',
      };
    if (id === 'ignore_card_all_stats')
      legality.trigger = {
        event: 'CARD_PENDING',
        directlyAffectsSelfAny: ['FORTITUDE', 'ALCOHOL', 'GOLD'],
      };
    if (id === 'cheat_control_and_eject')
      Object.assign(legality, {
        target: 'ANY_ACTIVE_GAMBLER',
        selfTarget: 'ALLOWED',
      });
    return {
      id,
      cardType: row[1]!,
      display: { 'en-US': row[2]!, 'zh-TW': row[3]! },
      rulesSummary: { 'en-US': 'Synthetic test plan', 'zh-TW': '原創測試計畫' },
      legality,
      effects,
      verification: { status: 'VERIFIED', basis: ['fixture'] },
      projectRuleOverride:
        id === 'cheat_control_and_eject' ? provenance : undefined,
    };
  });
  const source = {
    sources: { fixture: { kind: 'TEST_FIXTURE' } },
    mechanics,
    characters: ids.map((id, i) => ({
      id,
      display: { 'en-US': 'Synthetic character', 'zh-TW': '原創測試角色' },
      primaryDeckPhysicalCount: 40,
      cards: mechanics
        .filter((_, index) => Number(rows[index]![i + 4]) > 0)
        .map((m) => ({
          cardKey: `fixture.${id}.${m.id}`,
          mechanicId: m.id,
          quantity: Number(rows[mechanics.indexOf(m)]![i + 4]),
          type: m.cardType,
          display: m.display,
          rulesSummary: m.rulesSummary,
        })),
    })),
    drinkDeck: {
      physicalCount: 30,
      cards: [
        {
          id: 'synthetic_drink',
          quantity: 30,
          kind: 'DRINK',
          display: { 'en-US': 'Synthetic drink', 'zh-TW': '原創測試飲料' },
          effects: [{ op: 'UNIT_TEST_EFFECT' }],
          verification: { status: 'VERIFIED', basis: ['fixture'] },
        },
      ],
    },
    candidateValidation: { knownHardBlockers: [] as string[] },
  };
  const checks = (names: string[]) =>
    names.map((check) => ({
      check,
      result: 'PASS',
      finding: 'Synthetic regression evidence',
      evidence: ['fixture-evidence'],
    }));
  const evidence = [{ id: 'fixture-evidence', sourceId: 'fixture' }];
  const ledger = {
    characterMechanics: mechanics.map((m, i) => ({
      ledgerId: `M${String(i + 1).padStart(2, '0')}`,
      mechanicId: m.id,
      counts: Object.fromEntries(
        ids.map((id, index) => [id, Number(rows[i]![index + 4])]),
      ),
      candidateType: m.cardType,
      status: 'VERIFIED',
      review: {
        legality: m.legality,
        effects: m.effects,
        counts: Object.fromEntries(
          ids.map((id, index) => [id, Number(rows[i]![index + 4])]),
        ),
        cardType: m.cardType,
        evidence: structuredClone(evidence),
        checks: checks(mechanicChecks),
      } as Record<string, unknown>,
    })),
    drinks: [
      {
        ledgerId: 'D01',
        drinkId: 'synthetic_drink',
        quantity: 30,
        candidateKind: 'DRINK',
        status: 'VERIFIED',
        review: {
          evidence: structuredClone(evidence),
          checks: checks(drinkChecks),
        } as Record<string, unknown>,
      },
    ],
  };
  const lock = {
    ...hashes,
    date: '2026-10-05',
    sourceVersionIdentifiers: ['TEST_FIXTURE_ONLY'],
    verifiedMechanicRows: 44,
    characterPhysicalCards: 160,
    drinkPhysicalCards: 30,
    unresolvedCount: 0,
  };
  return { source, ledger, matrix, lock };
}
type Fixture = ReturnType<typeof fixture>;
function verify(f: Fixture) {
  return verifyRdi2Source(f.source, f.ledger, f.matrix, f.lock, hashes);
}
function projectFixture() {
  const f = fixture();
  const fields = {
    quantity: 'VERIFIED',
    cardIdentity: 'VERIFIED',
    antiCheatClassification: 'VERIFIED',
    forcedLeaveResponseTiming: 'VERIFIED',
    winRoundEffect: 'VERIFIED',
    negatesCheatingCardRule: 'PROJECT_RULE_OVERRIDE',
    requiresActiveParticipation: 'PROJECT_RULE_OVERRIDE',
  };
  const project = {
    sourceId: 'm06-project',
    date: '2026-10-05',
    negatesCheatingCardRule: 'PROJECT_RULE_OVERRIDE',
    requiresActiveParticipation: 'PROJECT_RULE_OVERRIDE',
    officialSourceVerified: false,
  };
  const mechanic = {
    ...f.source.mechanics[5]!,
    legality: {
      mode: 'RESPONSE',
      trigger: {
        event: 'CARD_PENDING',
        sourceCardType: 'CHEATING',
        gamblingActive: true,
        selfStillParticipating: true,
      },
    } as Record<string, unknown>,
    effects: [
      { op: 'NEGATE_CURRENT_SOURCE' },
      { op: 'WIN_GAMBLING', winner: 'SELF' },
    ] as Record<string, unknown>[],
    projectRulesetOverrides: project,
    verification: {
      status: 'VERIFIED_FOR_PROJECT_RULESET',
      basis: ['m06-project'],
      fieldVerification: fields,
    },
  };
  const entry = {
    ...f.ledger.characterMechanics[5]!,
    status: 'VERIFIED_FOR_PROJECT_RULESET',
    fieldVerification: fields,
    review: {
      ...f.ledger.characterMechanics[5]!.review,
      legality: mechanic.legality,
      effects: mechanic.effects,
      projectRulesetOverrides: structuredClone(project),
      fieldVerification: structuredClone(fields),
    } as Record<string, unknown>,
  };
  f.source.mechanics[5] = mechanic;
  f.ledger.characterMechanics[5] = entry;
  const origin = {
    kind: 'PROJECT_RULE_OVERRIDE',
    officialSourceVerified: false,
  };
  Object.assign(f.source.sources, { 'm06-project': origin });
  return { ...f, projectMechanic: mechanic, projectLedger: entry, origin };
}

function paymentFixture() {
  const f = fixture();
  const source = JSON.parse(
    readFileSync('content-private/imports/rdi2/source-candidate.json', 'utf8'),
  ) as {
    sources: Record<string, unknown>;
    mechanics: (Fixture['source']['mechanics'][number] & {
      projectRulesetOverrides: Record<string, unknown>;
      verification: {
        status: string;
        basis: string[];
        characterVerification: Record<string, Record<string, string | boolean>>;
        fieldVerification: Record<string, string>;
      };
    })[];
  };
  const ledger = JSON.parse(
    readFileSync(
      'content-private/imports/rdi2/verification-ledger.json',
      'utf8',
    ),
  ) as {
    characterMechanics: (Fixture['ledger']['characterMechanics'][number] & {
      characterVerification: Record<string, Record<string, string | boolean>>;
      fieldVerification: Record<string, string>;
    })[];
  };
  const m = source.mechanics[8]!,
    entry = ledger.characterMechanics[8]!;
  f.source.mechanics[8] = m;
  f.ledger.characterMechanics[8] = entry;
  for (const c of f.source.characters)
    for (const card of c.cards)
      if (card.mechanicId === m.id) card.rulesSummary = m.rulesSummary;
  const origin = {
    kind: 'PROJECT_RULE_OVERRIDE',
    officialSourceVerified: false,
  };
  Object.assign(f.source.sources, source.sources, {
    [m.projectRulesetOverrides.sourceId as string]: origin,
  });
  return { ...f, paymentMechanic: m, paymentLedger: entry, origin };
}

function anteFixture() {
  const f = fixture();
  const actual = JSON.parse(
    readFileSync('content-private/imports/rdi2/source-candidate.json', 'utf8'),
  ) as {
    sources: Record<string, unknown>;
    mechanics: (Fixture['source']['mechanics'][number] & {
      projectRulesetOverrides: Record<string, unknown> & {
        templates: { A: Record<string, unknown>; B: Record<string, unknown> };
      };
      verification: {
        status: string;
        basis: string[];
        characterVerification: Record<string, Record<string, string | boolean>>;
        fieldVerification: Record<string, string>;
      };
    })[];
    characters: Fixture['source']['characters'];
  };
  const ledger = JSON.parse(
    readFileSync(
      'content-private/imports/rdi2/verification-ledger.json',
      'utf8',
    ),
  ) as {
    characterMechanics: (Fixture['ledger']['characterMechanics'][number] & {
      characterVerification: Record<string, Record<string, string | boolean>>;
      fieldVerification: Record<string, string>;
    })[];
  };
  const mechanic = actual.mechanics[11]!,
    entry = ledger.characterMechanics[11]!;
  f.source.mechanics[11] = mechanic;
  f.ledger.characterMechanics[11] = entry;
  for (const character of f.source.characters) {
    const original = actual.characters.find((c) => c.id === character.id)!;
    for (const card of character.cards)
      if (
        card.mechanicId === mechanic.id ||
        (character.id === 'gog' &&
          card.mechanicId === 'avoid_ante_leave_or_ignore_drink')
      )
        Object.assign(
          card,
          original.cards.find((c) => c.mechanicId === card.mechanicId)!,
        );
  }
  const origin = actual.sources[
    'project_m12_gog_override_2026_10_05'
  ] as Record<string, unknown>;
  Object.assign(f.source.sources, actual.sources);
  const dual = f.source.characters
    .find((c) => c.id === 'gog')!
    .cards.find(
      (c) => c.mechanicId === 'avoid_ante_leave_or_ignore_drink',
    )! as Fixture['source']['characters'][number]['cards'][number] & {
    projectRuleOverride: Record<string, unknown>;
  };
  dual.rulesSummary = f.source.mechanics[12]!.rulesSummary;
  return { ...f, mechanic, entry, origin, dual };
}

describe('M12 separately authorized ante-avoidance source rules', () => {
  it('accepts M12 qualification without broadening M09 or changing the original quantity distribution', () => {
    const result = verify(anteFixture());
    expect(result.errors).toEqual([]);
    expect(result).toMatchObject({
      valid: true,
      counts: { verifiedMechanics: 44 },
    });
  });
  it.each([
    [
      'official wording claim',
      (f: ReturnType<typeof anteFixture>) => {
        f.mechanic.projectRulesetOverrides.officialSourceVerified = true;
      },
    ],
    [
      'reuse M09 source',
      (f: ReturnType<typeof anteFixture>) => {
        f.mechanic.projectRulesetOverrides.sourceId =
          'project_m09_gog_override_2026_10_05';
      },
    ],
    [
      'missing M12 label',
      (f: ReturnType<typeof anteFixture>) => {
        f.mechanic.projectRulesetOverrides.label = 'PROJECT_RULE_OVERRIDE';
      },
    ],
    [
      'later ante relabeled official',
      (f: ReturnType<typeof anteFixture>) => {
        f.mechanic.projectRulesetOverrides.laterAnteResponseRule = 'VERIFIED';
      },
    ],
    [
      'Gog exact original text claim',
      (f: ReturnType<typeof anteFixture>) => {
        f.mechanic.verification.characterVerification.gog!.exactCardText =
          'VERIFIED';
      },
    ],
    [
      'lost original Dimli verification',
      (f: ReturnType<typeof anteFixture>) => {
        f.entry.characterVerification.dimli!.exactSourceRecords = 'UNAVAILABLE';
      },
    ],
    [
      'ledger field provenance mismatch',
      (f: ReturnType<typeof anteFixture>) => {
        f.entry.fieldVerification.gogSecondTemplateRule = 'VERIFIED';
      },
    ],
    [
      'project source relabeled official',
      (f: ReturnType<typeof anteFixture>) => {
        f.origin.kind = 'OFFICIAL_RULES';
      },
    ],
    [
      'missing origin',
      (f: ReturnType<typeof anteFixture>) => {
        Reflect.deleteProperty(
          f.source.sources,
          'project_m12_gog_override_2026_10_05',
        );
      },
    ],
    [
      'lost review',
      (f: ReturnType<typeof anteFixture>) => {
        f.entry.review = {};
      },
    ],
    [
      'candidate qualification removed',
      (f: ReturnType<typeof anteFixture>) => {
        f.mechanic.verification.status = 'VERIFIED';
      },
    ],
    [
      'ledger qualification removed',
      (f: ReturnType<typeof anteFixture>) => {
        f.entry.status = 'VERIFIED';
      },
    ],
    [
      'both qualifications and override removed',
      (f: ReturnType<typeof anteFixture>) => {
        f.mechanic.verification.status = 'VERIFIED';
        f.entry.status = 'VERIFIED';
        Reflect.deleteProperty(f.mechanic, 'projectRulesetOverrides');
        Reflect.deleteProperty(f.entry.review, 'projectRulesetOverrides');
      },
    ],
  ] as const)('rejects %s', (_name, change) => {
    const f = anteFixture();
    change(f);
    expect(verify(f).errors.join(' ')).toContain(
      'M12 must preserve its separate',
    );
  });
  it.each([
    [
      'initial-only trigger',
      (f: ReturnType<typeof anteFixture>) => {
        (f.mechanic.legality.trigger as Record<string, unknown>).anteOrigin =
          'INITIAL_ANTE';
      },
    ],
    [
      'nonparticipant allowed',
      (f: ReturnType<typeof anteFixture>) => {
        (
          f.mechanic.legality.trigger as Record<string, unknown>
        ).selfStillParticipating = false;
      },
    ],
    [
      'wrong payer',
      (f: ReturnType<typeof anteFixture>) => {
        (f.mechanic.legality.trigger as Record<string, unknown>).actor =
          'OTHER';
      },
    ],
    [
      'not pending',
      (f: ReturnType<typeof anteFixture>) => {
        (f.mechanic.legality.trigger as Record<string, unknown>).pending =
          false;
      },
    ],
    [
      'source response prohibition removed',
      (f: ReturnType<typeof anteFixture>) => {
        (f.mechanic.legality.trigger as Record<string, unknown>).excludeIfAny =
          [];
      },
    ],
    [
      'refund previous Gold',
      (f: ReturnType<typeof anteFixture>) => {
        f.mechanic.effects.push({ op: 'REFUND_ANTES' });
      },
    ],
    [
      'leave effect removed',
      (f: ReturnType<typeof anteFixture>) => {
        f.mechanic.effects.pop();
      },
    ],
    [
      'Template B Ignore alternative removed',
      (f: ReturnType<typeof anteFixture>) => {
        f.mechanic.projectRulesetOverrides.templates.B.effects = [];
      },
    ],
    [
      'Template B executes both branches',
      (f: ReturnType<typeof anteFixture>) => {
        f.mechanic.projectRulesetOverrides.templates.B.effects = [
          { op: 'IGNORE_CURRENT_DRINK' },
          ...f.mechanic.effects,
        ];
      },
    ],
    [
      'Template B charged Inn payment',
      (f: ReturnType<typeof anteFixture>) => {
        f.mechanic.projectRulesetOverrides.templates.B.effects = [
          {
            op: 'CONTEXT_BRANCH',
            branches: ['CANCEL_ANTE_AND_LEAVE', 'IGNORE_DRINK_AND_PAY_INN_1'],
          },
        ];
      },
    ],
  ] as const)('rejects %s', (_name, change) => {
    const f = anteFixture();
    change(f);
    expect(verify(f).errors.join(' ')).toContain(
      'M12 must preserve initial/later',
    );
  });
  it.each([
    'missing binding',
    'wrong source',
    'reassigned quantities',
    'missing Gog',
  ])('fails closed for %s', (kind) => {
    const f = anteFixture();
    if (kind === 'missing binding')
      Reflect.deleteProperty(f.dual, 'projectRuleOverride');
    if (kind === 'wrong source')
      f.dual.projectRuleOverride.sourceId =
        'project_m09_gog_override_2026_10_05';
    if (kind === 'reassigned quantities') f.dual.quantity = 2;
    if (kind === 'missing Gog')
      f.source.characters = f.source.characters.filter((c) => c.id !== 'gog');
    expect(verify(f).errors.join(' ')).toContain(
      'M12 Gog templates must retain',
    );
  });
});

function dualAnteFixture() {
  const f = anteFixture();
  const actual = JSON.parse(
    readFileSync('content-private/imports/rdi2/source-candidate.json', 'utf8'),
  ) as typeof f.source;
  const ledger = JSON.parse(
    readFileSync(
      'content-private/imports/rdi2/verification-ledger.json',
      'utf8',
    ),
  ) as typeof f.ledger;
  const mechanic = actual.mechanics[12]! as Omit<
      typeof f.mechanic,
      'projectRulesetOverrides'
    > & { projectRulesetOverrides: Record<string, unknown> },
    entry = ledger.characterMechanics[12]! as typeof f.entry;
  f.source.mechanics[12] = mechanic;
  f.ledger.characterMechanics[12] = entry;
  for (const c of f.source.characters) {
    const row = c.cards.find((x) => x.mechanicId === mechanic.id)!;
    Object.assign(
      row,
      actual.characters
        .find((x) => x.id === c.id)!
        .cards.find((x) => x.mechanicId === mechanic.id)!,
    );
  }
  return { ...f, mechanic, entry };
}

describe('M13 source verification with existing M12 Template B authority', () => {
  it('accepts three separately verified original records and the explicitly authorized Gog template', () => {
    expect(verify(dualAnteFixture()).errors).toEqual([]);
  });
  it.each([
    'reuse M09',
    'official Gog wording',
    'qualified status removed',
    'ledger status removed',
    'missing review',
    'missing authority',
    'M12 qualification removed',
    'review override missing',
    'lost Eve source',
    'lost field provenance',
    'lost original Gog distinction',
  ])('rejects provenance change: %s', (kind) => {
    const f = dualAnteFixture();
    if (kind === 'reuse M09')
      f.mechanic.projectRulesetOverrides.sourceId =
        'project_m09_gog_override_2026_10_05';
    if (kind === 'official Gog wording')
      f.mechanic.projectRulesetOverrides.officialSourceVerified = true;
    if (kind === 'qualified status removed')
      f.mechanic.verification.status = 'VERIFIED';
    if (kind === 'ledger status removed') f.entry.status = 'VERIFIED';
    if (kind === 'missing review') f.entry.review = {};
    if (kind === 'missing authority')
      Reflect.deleteProperty(
        f.source.sources,
        'project_m12_gog_override_2026_10_05',
      );
    if (kind === 'M12 qualification removed')
      f.source.mechanics[11]!.verification.status = 'VERIFIED';
    if (kind === 'review override missing')
      Reflect.deleteProperty(f.entry.review, 'projectRulesetOverrides');
    if (kind === 'lost Eve source')
      f.mechanic.verification.characterVerification.eve!.exactSourceRecords =
        'UNAVAILABLE';
    if (kind === 'lost field provenance')
      f.entry.fieldVerification.gogSemantics = 'VERIFIED';
    if (kind === 'lost original Gog distinction')
      f.mechanic.verification.characterVerification.gog!.exactCardText =
        'VERIFIED';
    expect(verify(f).errors.join(' ')).toContain('M13 must preserve original');
  });
  it.each([
    'initial-only',
    'nonparticipant',
    'wrong Drink target',
    'Drink Event',
    'no Chasers',
    'refund',
    'both branches',
    'payment',
  ])('rejects semantic change: %s', (kind) => {
    const f = dualAnteFixture();
    const triggers = f.mechanic.legality.triggers as Record<string, unknown>[];
    if (kind === 'initial-only') triggers[0]!.anteOrigin = 'INITIAL_ANTE';
    if (kind === 'nonparticipant') triggers[0]!.selfStillParticipating = false;
    if (kind === 'wrong Drink target') triggers[1]!.affects = 'OTHER';
    if (kind === 'Drink Event') triggers[1]!.kind = 'DRINK_EVENT';
    if (kind === 'no Chasers') triggers[1]!.wholeDrinkWithChasers = false;
    if (kind === 'refund') f.mechanic.effects.push({ op: 'REFUND_ANTES' });
    if (kind === 'both branches')
      f.mechanic.effects = [
        { op: 'LEAVE_GAMBLING' },
        { op: 'IGNORE_CURRENT_DRINK' },
      ];
    if (kind === 'payment')
      f.mechanic.effects.push({ op: 'PAY_TO_INN', amount: 1 });
    expect(verify(f).errors.join(' ')).toContain(
      'M13 must preserve context-exclusive',
    );
  });
});

function fortitudeDefenseFixture() {
  const f = dualAnteFixture();
  const actual = JSON.parse(
    readFileSync('content-private/imports/rdi2/source-candidate.json', 'utf8'),
  ) as typeof f.source;
  const ledger = JSON.parse(
    readFileSync(
      'content-private/imports/rdi2/verification-ledger.json',
      'utf8',
    ),
  ) as typeof f.ledger;
  const mechanic = actual.mechanics[14]! as typeof f.mechanic,
    entry = ledger.characterMechanics[14]! as typeof f.entry;
  f.source.mechanics[14] = mechanic;
  f.ledger.characterMechanics[14] = entry;
  Object.assign(f.source.sources, actual.sources);
  for (const c of f.source.characters)
    for (const row of c.cards.filter((x) => x.mechanicId === mechanic.id))
      Object.assign(
        row,
        actual.characters
          .find((x) => x.id === c.id)!
          .cards.find((x) => x.mechanicId === mechanic.id)!,
      );
  return { ...f, mechanic, entry };
}
describe('M15 USER OVERRIDE source guard', () => {
  it('accepts the specifically authorized Gog template with partial official evidence separate', () => {
    expect(verify(fortitudeDefenseFixture()).errors).toEqual([]);
  });
  it.each([
    'wrong override',
    'publisher wording',
    'unqualified status',
    'lost field distinction',
    'missing authority',
    'official authority',
    'missing review',
    'changed Dimli',
  ])('rejects provenance change: %s', (kind) => {
    const f = fortitudeDefenseFixture();
    if (kind === 'wrong override')
      f.mechanic.projectRulesetOverrides.sourceId =
        'project_m12_gog_override_2026_10_05';
    if (kind === 'publisher wording')
      f.mechanic.verification.characterVerification.gog!.exactCardText =
        'VERIFIED_PUBLISHER_TEXT';
    if (kind === 'unqualified status') f.entry.status = 'VERIFIED';
    if (kind === 'lost field distinction')
      f.entry.fieldVerification.gogExactTemplate = 'VERIFIED_OFFICIAL_CARD';
    if (kind === 'missing authority')
      Reflect.deleteProperty(
        f.source.sources,
        'project_m15_gog_override_2026_10_06',
      );
    if (kind === 'official authority')
      (
        f.source.sources as unknown as Record<
          string,
          { officialSourceVerified: boolean }
        >
      ).project_m15_gog_override_2026_10_06!.officialSourceVerified = true;
    if (kind === 'missing review') f.entry.review = {};
    if (kind === 'changed Dimli')
      f.mechanic.verification.characterVerification.dimli!.semantics =
        'PROJECT_RULE_OVERRIDE';
    expect(verify(f).errors.join(' ')).toContain(
      'M15 must preserve its separately authorized',
    );
  });
  it.each([
    'Drink',
    'Event',
    'Gambling',
    'indirect',
    'other player',
    'Negate',
    'global Ignore',
    'runtime trigger',
    'runtime resolution',
  ])('rejects broadened semantics: %s', (kind) => {
    const f = fortitudeDefenseFixture();
    const trigger = f.mechanic.legality.trigger as Record<string, unknown>;
    if (kind === 'Drink') trigger.sourceCardTypes = ['DRINK'];
    if (kind === 'Event') trigger.sourceCardTypes = ['DRINK_EVENT'];
    if (kind === 'Gambling') trigger.sourceCardTypes = ['GAMBLING'];
    if (kind === 'indirect') trigger.directlyAffectsSelf = 'INDIRECT_FORTITUDE';
    if (kind === 'other player')
      trigger.directlyAffectsSelf = 'OTHER_FORTITUDE';
    if (kind === 'Negate')
      f.mechanic.effects = [{ op: 'NEGATE_CURRENT_SOURCE' }];
    if (kind === 'global Ignore')
      f.mechanic.effects = [{ op: 'IGNORE_CURRENT_SOURCE_FOR_ALL' }];
    if (kind === 'runtime trigger') f.entry.review.sharedImplementation = {};
    if (kind === 'runtime resolution')
      Reflect.deleteProperty(f.mechanic, 'sharedImplementation');
    expect(verify(f).errors.join(' ')).toContain(
      'M15 must preserve direct SELF',
    );
  });
  it.each(['quantity', 'title', 'binding'])(
    'rejects incorrect physical-copy %s',
    (kind) => {
      const f = fortitudeDefenseFixture();
      const row = f.source.characters
        .find((c) => c.id === 'gog')!
        .cards.find((c) => c.mechanicId === f.mechanic.id)!;
      if (kind === 'quantity') row.quantity = 1;
      if (kind === 'title')
        Object.assign(row, { canonicalCardTitle: 'Wrong fixture card' });
      if (kind === 'binding')
        Reflect.deleteProperty(row, 'projectRuleOverride');
      expect(verify(f).errors.join(' ')).toContain(
        'M15 Gog must retain exactly two identical',
      );
    },
  );
});

function protectedCounterFixture() {
  const f = fortitudeDefenseFixture();
  const actual = JSON.parse(
    readFileSync('content-private/imports/rdi2/source-candidate.json', 'utf8'),
  ) as typeof f.source;
  const ledger = JSON.parse(
    readFileSync(
      'content-private/imports/rdi2/verification-ledger.json',
      'utf8',
    ),
  ) as typeof f.ledger;
  const mechanic = actual.mechanics[15]! as typeof f.mechanic,
    entry = ledger.characterMechanics[15]! as typeof f.entry;
  f.source.mechanics[15] = mechanic;
  f.ledger.characterMechanics[15] = entry;
  Object.assign(f.source.sources, actual.sources);
  for (const c of f.source.characters)
    for (const row of c.cards.filter((x) => x.mechanicId === mechanic.id))
      Object.assign(
        row,
        actual.characters
          .find((x) => x.id === c.id)!
          .cards.find((x) => x.mechanicId === mechanic.id)!,
      );
  return { ...f, mechanic, entry };
}
describe('M16 exact protected-counter source guard', () => {
  it('accepts individually reviewed originals and complete official Gog wording', () => {
    expect(verify(protectedCounterFixture()).errors).toEqual([]);
  });
  it.each([
    'lost original',
    'Gog unavailable',
    'override injected',
    'missing official card',
    'secondary claim',
    'missing review',
    'wrong status',
  ])('rejects evidence change: %s', (kind) => {
    const f = protectedCounterFixture();
    if (kind === 'lost original')
      f.entry.characterVerification.eve!.exactSourceRecord = 'UNAVAILABLE';
    if (kind === 'Gog unavailable')
      f.mechanic.verification.characterVerification.gog!.exactCardText =
        'UNAVAILABLE';
    if (kind === 'override injected')
      f.mechanic.projectRulesetOverrides = {
        sourceId: 'project_m15_gog_override_2026_10_06',
      };
    if (kind === 'missing official card')
      Reflect.deleteProperty(f.source.sources, 'official_m16_gog_card');
    if (kind === 'secondary claim')
      Object.assign(
        (f.source.sources as Record<string, unknown>)
          .official_m16_gog_card as object,
        { authority: 'SECONDARY' },
      );
    if (kind === 'missing review') f.entry.review = {};
    if (kind === 'wrong status')
      f.entry.status = 'VERIFIED_FOR_PROJECT_RULESET';
    expect(verify(f).errors.join(' ')).toContain(
      'M16 must retain separately verified',
    );
  });
  it.each([
    'Action',
    'compatibility removed',
    'Ignore',
    'lost incoming protection',
    'wrong family',
    'lost outgoing binding',
    'wrong runtime Negate',
  ])('rejects semantic change: %s', (kind) => {
    const f = protectedCounterFixture(),
      trigger = f.mechanic.legality.trigger as Record<string, unknown>;
    if (kind === 'Action') trigger.sourceCardType = 'ACTION';
    if (kind === 'compatibility removed')
      trigger.compatibleCounterTarget = false;
    if (kind === 'Ignore')
      f.mechanic.effects = [{ op: 'IGNORE_CURRENT_EFFECT_FOR_SELF' }];
    if (kind === 'lost incoming protection')
      Object.assign(f.mechanic, { counterPolicy: 'UNPROTECTED' });
    if (kind === 'wrong family')
      Object.assign(f.entry.review, { counterFamily: 'test.unrelated' });
    if (kind === 'lost outgoing binding')
      Reflect.deleteProperty(f.mechanic, 'sharedImplementation');
    if (kind === 'wrong runtime Negate')
      f.entry.review.sharedImplementation = {
        effects: [{ op: 'NEGATE_ALL_ANCESTORS' }],
      };
    expect(verify(f).errors.join(' ')).toContain(
      'M16 must preserve pending compatible',
    );
  });
});

function drinkDefenseFixture() {
  const f = protectedCounterFixture();
  const actual = JSON.parse(
    readFileSync('content-private/imports/rdi2/source-candidate.json', 'utf8'),
  ) as typeof f.source;
  const ledger = JSON.parse(
    readFileSync(
      'content-private/imports/rdi2/verification-ledger.json',
      'utf8',
    ),
  ) as typeof f.ledger;
  const mechanic = actual.mechanics[16]! as typeof f.mechanic,
    entry = ledger.characterMechanics[16]! as typeof f.entry;
  f.source.mechanics[16] = mechanic;
  f.ledger.characterMechanics[16] = entry;
  Object.assign(f.source.sources, actual.sources);
  for (const c of f.source.characters)
    for (const row of c.cards.filter((x) => x.mechanicId === mechanic.id))
      Object.assign(
        row,
        actual.characters
          .find((x) => x.id === c.id)!
          .cards.find((x) => x.mechanicId === mechanic.id)!,
      );
  return { ...f, mechanic, entry };
}
describe('M17 whole-Drink source guard', () => {
  it('accepts all eight independently checked cards and complete publisher Gog images', () => {
    expect(verify(drinkDefenseFixture()).errors).toEqual([]);
  });
  it.each([
    'missing original',
    'Gog unavailable',
    'override',
    'missing image',
    'wrong artifact',
    'missing review',
  ])('rejects evidence change %s', (kind) => {
    const f = drinkDefenseFixture();
    if (kind === 'missing original')
      f.entry.characterVerification.fleck!.exactSourceRecords = 'UNAVAILABLE';
    if (kind === 'Gog unavailable')
      f.mechanic.verification.characterVerification.gog!.exactCardText =
        'UNAVAILABLE';
    if (kind === 'override')
      f.mechanic.projectRulesetOverrides = {
        sourceId: 'project_m15_gog_override_2026_10_06',
      };
    if (kind === 'missing image')
      Reflect.deleteProperty(f.source.sources, 'official_m17_gog_cards');
    if (kind === 'wrong artifact')
      Object.assign(
        (f.source.sources as Record<string, unknown>)
          .official_m17_gog_cards as object,
        { authority: 'SECONDARY' },
      );
    if (kind === 'missing review') f.entry.review = {};
    expect(verify(f).errors.join(' ')).toContain(
      'M17 must retain six original',
    );
  });
  it.each([
    'Event',
    'others',
    'Chasers',
    'Negate',
    'payment',
    'runtime source',
    'runtime self',
  ])('rejects altered semantics %s', (kind) => {
    const f = drinkDefenseFixture(),
      trigger = f.mechanic.legality.trigger as Record<string, unknown>;
    if (kind === 'Event') trigger.event = 'DRINK_EVENT_PENDING';
    if (kind === 'others') trigger.affects = 'ANY';
    if (kind === 'Chasers') trigger.chasersComplete = false;
    if (kind === 'Negate')
      f.mechanic.effects = [{ op: 'NEGATE_CURRENT_SOURCE' }];
    if (kind === 'payment')
      f.mechanic.effects.push({ op: 'PAY_INN', amount: 1 });
    if (kind === 'runtime source')
      Reflect.deleteProperty(f.mechanic, 'sharedImplementation');
    if (kind === 'runtime self')
      f.entry.review.sharedImplementation = {
        responseTrigger: { event: 'ANY' },
        effects: [{ op: 'IGNORE_ALL' }],
      };
    expect(verify(f).errors.join(' ')).toContain(
      'M17 must preserve own pending',
    );
  });
});

function toastFixture() {
  const f = protectedCounterFixture();
  const actual = JSON.parse(
    readFileSync('content-private/imports/rdi2/source-candidate.json', 'utf8'),
  ) as typeof f.source;
  const ledger = JSON.parse(
    readFileSync(
      'content-private/imports/rdi2/verification-ledger.json',
      'utf8',
    ),
  ) as typeof f.ledger;
  const mechanic = actual.mechanics[19]! as typeof f.mechanic,
    entry = ledger.characterMechanics[19]! as typeof f.entry;
  f.source.mechanics[19] = mechanic;
  f.ledger.characterMechanics[19] = entry;
  Object.assign(f.source.sources, actual.sources);
  for (const c of f.source.characters)
    for (const row of c.cards.filter((r) => r.mechanicId === mechanic.id))
      Object.assign(
        row,
        actual.characters
          .find((x) => x.id === c.id)!
          .cards.find((r) => r.mechanicId === mechanic.id)!,
      );
  return { ...f, mechanic, entry };
}
describe('M20 separate simultaneous Inn Drink source guard', () => {
  it('accepts the complete original Fleck Action and accurately partial engine audit', () => {
    expect(verify(toastFixture()).errors).toEqual([]);
  });
  it.each([
    'missing original',
    'publisher claim',
    'wrong hash',
    'override',
    'missing review',
    'missing record',
  ])('rejects provenance change %s', (kind) => {
    const f = toastFixture();
    if (kind === 'missing original')
      Reflect.deleteProperty(f.source.sources, 'the_inn_m20_original_fleck');
    if (kind === 'publisher claim')
      Object.assign(
        (f.source.sources as Record<string, unknown>)
          .the_inn_m20_original_fleck as object,
        { authority: 'PRIMARY' },
      );
    if (kind === 'wrong hash')
      Object.assign(
        (f.source.sources as Record<string, unknown>)
          .the_inn_m20_original_fleck as object,
        { sha256: 'a'.repeat(64) },
      );
    if (kind === 'override')
      f.mechanic.projectRulesetOverrides = {
        sourceId: 'project_m18_gog_override_2026_10_06',
      };
    if (kind === 'missing review') f.entry.review = {};
    if (kind === 'missing record')
      f.entry.characterVerification.fleck!.exactSourceRecord = 'UNAVAILABLE';
    expect(verify(f).errors.join(' ')).toContain(
      'M20 must retain the complete original Fleck',
    );
  });
  it.each([
    'phase',
    'other owner',
    'exclude actor',
    'Drink pile',
    'single copy',
    'Event resolve',
    'Chaser search',
    'global response',
    'early consumption',
    'contest',
  ])('rejects altered semantics %s', (kind) => {
    const f = toastFixture(),
      semantics = (
        f.mechanic as unknown as { drinkSemantics: Record<string, unknown> }
      ).drinkSemantics;
    if (kind === 'phase') f.mechanic.legality.mode = 'ANYTIME';
    if (kind === 'other owner') f.mechanic.legality.actor = 'OTHER';
    if (kind === 'exclude actor') semantics.recipients = 'OTHER_PLAYERS';
    if (kind === 'Drink pile') semantics.source = 'DRINK_ME_PILE';
    if (kind === 'single copy') semantics.copiesSingleDrink = true;
    if (kind === 'Event resolve')
      f.mechanic.effects[0]!.skipDrinkEvents = false;
    if (kind === 'Chaser search')
      semantics.chasers = 'CONTINUE_AFTER_EVENT_CHASER';
    if (kind === 'global response') semantics.responses = 'ONE_GLOBAL_DRINK';
    if (kind === 'early consumption')
      semantics.settlement = 'SEQUENTIAL_DURING_RESPONSES';
    if (kind === 'contest') semantics.contest = true;
    expect(verify(f).errors.join(' ')).toContain(
      'M20 must preserve own Action',
    );
  });
  it.each(['fully supported', 'missing gap', 'wrong binding'])(
    'rejects misleading engine audit %s',
    (kind) => {
      const f = toastFixture(),
        audit = (
          f.mechanic as unknown as { engineAudit: Record<string, unknown> }
        ).engineAudit;
      if (kind === 'fully supported') audit.status = 'SUPPORTED_SHARED_ENGINE';
      if (kind === 'missing gap') audit.missingCapabilities = [];
      if (kind === 'wrong binding')
        f.entry.review.engineAudit = {
          status: 'PARTIAL_SHARED_ENGINE_SUPPORT',
          missingCapabilities: [
            'drink.simultaneous-from-inn-leading-event-skip',
          ],
          supportedBinding: { effects: [{ op: 'ROUND_ON_HOUSE' }] },
        };
      expect(verify(f).errors.join(' ')).toContain(
        'M20 engine audit must retain',
      );
    },
  );
  it.each(['quantity', 'type', 'title', 'missing row'])(
    'rejects changed physical copy %s',
    (kind) => {
      const f = toastFixture(),
        c = f.source.characters.find((c) => c.id === 'fleck')!,
        row = c.cards.find((r) => r.mechanicId === f.mechanic.id)!;
      if (kind === 'quantity') row.quantity = 2;
      if (kind === 'type') row.type = 'SOMETIMES';
      if (kind === 'title')
        Object.assign(row, {
          canonicalCardTitle: 'Original wrong fixture identity',
        });
      if (kind === 'missing row') c.cards = c.cards.filter((r) => r !== row);
      expect(verify(f).errors.join(' ')).toContain(
        'M20 must retain exactly one',
      );
    },
  );
});

function freeDrinksFixture() {
  const f = protectedCounterFixture();
  const actual = JSON.parse(
    readFileSync('content-private/imports/rdi2/source-candidate.json', 'utf8'),
  ) as typeof f.source;
  const ledger = JSON.parse(
    readFileSync(
      'content-private/imports/rdi2/verification-ledger.json',
      'utf8',
    ),
  ) as typeof f.ledger;
  const mechanic = actual.mechanics[18]! as typeof f.mechanic,
    entry = ledger.characterMechanics[18]! as typeof f.entry;
  f.source.mechanics[18] = mechanic;
  f.ledger.characterMechanics[18] = entry;
  Object.assign(f.source.sources, actual.sources);
  for (const c of f.source.characters)
    for (const row of c.cards.filter((r) => r.mechanicId === mechanic.id))
      Object.assign(
        row,
        actual.characters
          .find((x) => x.id === c.id)!
          .cards.find((r) => r.mechanicId === mechanic.id)!,
      );
  return { ...f, mechanic, entry };
}
describe('M19 original Fleck dual-context source guard', () => {
  it('accepts individually verified original records with current shared rules', () => {
    expect(verify(freeDrinksFixture()).errors).toEqual([]);
  });
  it.each([
    'missing original',
    'publisher card claim',
    'hash',
    'override',
    'wrong status',
    'missing review',
    'missing copy evidence',
    'other owner provenance',
  ])('rejects changed provenance: %s', (kind) => {
    const f = freeDrinksFixture();
    if (kind === 'missing original')
      Reflect.deleteProperty(f.source.sources, 'the_inn_m19_original_fleck');
    if (kind === 'publisher card claim')
      Object.assign(
        (f.source.sources as Record<string, unknown>)
          .the_inn_m19_original_fleck as object,
        { authority: 'PRIMARY' },
      );
    if (kind === 'hash')
      Object.assign(
        (f.source.sources as Record<string, unknown>)
          .the_inn_m19_original_fleck as object,
        { sha256: 'a'.repeat(64) },
      );
    if (kind === 'override')
      f.mechanic.projectRulesetOverrides = {
        sourceId: 'project_m18_gog_override_2026_10_06',
      };
    if (kind === 'wrong status')
      f.entry.status = 'VERIFIED_FOR_PROJECT_RULESET';
    if (kind === 'missing review') f.entry.review = {};
    if (kind === 'missing copy evidence')
      f.entry.characterVerification.fleck!.exactSourceRecords = 'UNAVAILABLE';
    if (kind === 'other owner provenance')
      f.mechanic.verification.characterVerification.gog!.quantity =
        'VERIFIED_ORIGINAL_JSON';
    expect(verify(f).errors.join(' ')).toContain(
      'M19 must retain two original Fleck',
    );
  });
  it.each([
    'wrong phase',
    'other turn',
    'generic shuffle',
    'other payer',
    'already paid',
    'wrong fee',
    'wrong recipient',
    'three drinks',
    'self order',
    'face up',
    'order fee',
    'refund',
    'global waiver',
    'future waiver',
    'both branches',
    'review mutation',
  ])('rejects altered branch semantics: %s', (kind) => {
    const f = freeDrinksFixture(),
      triggers = f.mechanic.legality.triggers as Record<string, unknown>[];
    const branches = f.mechanic.effects[0]!.branches as {
      when: string;
      effects: Record<string, unknown>[];
    }[];
    if (kind === 'wrong phase') triggers[0]!.phase = 'ACTION';
    if (kind === 'other turn') triggers[0]!.actor = 'OTHER';
    if (kind === 'generic shuffle') triggers[1]!.systemEvent = 'DECK_SHUFFLED';
    if (kind === 'other payer') triggers[1]!.actor = 'ANY';
    if (kind === 'already paid') triggers[1]!.pending = false;
    if (kind === 'wrong fee') triggers[1]!.paymentAmount = 2;
    if (kind === 'wrong recipient') triggers[1]!.paymentRecipient = 'PLAYER';
    if (kind === 'three drinks') branches[0]!.effects[0]!.count = 3;
    if (kind === 'self order') branches[0]!.effects[0]!.targets = 'ANY_PLAYER';
    if (kind === 'face up') branches[0]!.effects[0]!.faceDown = false;
    if (kind === 'order fee') branches[0]!.effects[0]!.payment = 1;
    if (kind === 'refund') branches[1]!.effects[0]!.op = 'REFUND_GOLD';
    if (kind === 'global waiver')
      branches[1]!.effects[0]!.target = 'ALL_PLAYERS';
    if (kind === 'future waiver')
      branches[1]!.effects[0]!.scope = 'ALL_FUTURE_REFILLS';
    if (kind === 'both branches')
      f.mechanic.effects = [...branches[0]!.effects, ...branches[1]!.effects];
    if (kind === 'review mutation')
      f.entry.review.effects = [{ op: 'WAIVE_ALL_PAYMENTS' }];
    expect(verify(f).errors.join(' ')).toContain(
      'M19 must preserve alternative own-phase',
    );
  });
  it.each(['quantity', 'type', 'title', 'missing row'])(
    'rejects changed physical copy %s',
    (kind) => {
      const f = freeDrinksFixture(),
        c = f.source.characters.find((c) => c.id === 'fleck')!,
        row = c.cards.find((r) => r.mechanicId === f.mechanic.id)!;
      if (kind === 'quantity') row.quantity = 1;
      if (kind === 'type') row.type = 'ACTION';
      if (kind === 'title')
        Object.assign(row, {
          canonicalCardTitles: ['Synthetic wrong identity'],
        });
      if (kind === 'missing row') c.cards = c.cards.filter((r) => r !== row);
      expect(verify(f).errors.join(' ')).toContain(
        'M19 must retain exactly two',
      );
    },
  );
});

function extraDrinksFixture() {
  const f = protectedCounterFixture();
  const actual = JSON.parse(
    readFileSync('content-private/imports/rdi2/source-candidate.json', 'utf8'),
  ) as typeof f.source;
  const ledger = JSON.parse(
    readFileSync(
      'content-private/imports/rdi2/verification-ledger.json',
      'utf8',
    ),
  ) as typeof f.ledger;
  const mechanic = actual.mechanics[17]! as typeof f.mechanic;
  const entry = ledger.characterMechanics[17]! as typeof f.entry;
  f.source.mechanics[17] = mechanic;
  f.ledger.characterMechanics[17] = entry;
  Object.assign(f.source.sources, actual.sources);
  for (const c of f.source.characters)
    for (const row of c.cards.filter((x) => x.mechanicId === mechanic.id))
      Object.assign(
        row,
        actual.characters
          .find((x) => x.id === c.id)!
          .cards.find((x) => x.mechanicId === mechanic.id)!,
      );
  return { ...f, mechanic, entry };
}
describe('M18 independently authorized standard-copy source guard', () => {
  it('accepts only Gog provenance override while preserving publisher standard mechanics', () => {
    expect(verify(extraDrinksFixture()).errors).toEqual([]);
  });
  it.each([
    'M09',
    'M12',
    'M15',
    'publisher ownership',
    'publisher quantity',
    'publisher copies',
    'inferred effect',
    'lost original',
    'missing override',
    'wrong scope',
    'wrong label',
    'missing card',
    'wrong card authority',
    'wrong card URL',
    'unqualified source',
    'unqualified ledger',
    'missing review',
  ])('rejects provenance change %s', (kind) => {
    const f = extraDrinksFixture();
    if (['M09', 'M12', 'M15'].includes(kind))
      f.mechanic.projectRulesetOverrides.sourceId = `project_${kind.toLowerCase()}_gog_override_2026_10_06`;
    if (kind === 'publisher ownership')
      f.mechanic.verification.characterVerification.gog!.ownership =
        'VERIFIED_PUBLISHER';
    if (kind === 'publisher quantity')
      f.entry.characterVerification.gog!.quantity = 'VERIFIED_PUBLISHER';
    if (kind === 'publisher copies')
      (
        f.entry.review.characterVerification as Record<
          string,
          Record<string, unknown>
        >
      ).gog!.copiesUseStandardMechanic = 'VERIFIED_PUBLISHER';
    if (kind === 'inferred effect')
      f.entry.fieldVerification.cardType = 'PROJECT_RULE_OVERRIDE';
    if (kind === 'lost original')
      f.mechanic.verification.characterVerification.eve!.exactSourceRecords =
        'UNAVAILABLE';
    if (kind === 'missing override')
      Reflect.deleteProperty(
        f.source.sources,
        'project_m18_gog_override_2026_10_06',
      );
    if (['wrong scope', 'wrong label'].includes(kind))
      Object.assign(
        (f.source.sources as Record<string, unknown>)
          .project_m18_gog_override_2026_10_06 as object,
        kind === 'wrong scope'
          ? { scope: 'ALL_GOG_CARDS' }
          : { label: 'M15 USER OVERRIDE' },
      );
    if (kind === 'missing card')
      Reflect.deleteProperty(f.source.sources, 'official_m18_standard_card');
    if (['wrong card authority', 'wrong card URL'].includes(kind))
      Object.assign(
        (f.source.sources as Record<string, unknown>)
          .official_m18_standard_card as object,
        kind === 'wrong card authority'
          ? { authority: 'SECONDARY' }
          : { url: 'https://example.com/unverified.pdf' },
      );
    if (kind === 'unqualified source')
      f.mechanic.verification.status = 'VERIFIED';
    if (kind === 'unqualified ledger') f.entry.status = 'VERIFIED';
    if (kind === 'missing review') f.entry.review = {};
    expect(verify(f).errors.join(' ')).toContain(
      'M18 must preserve its ownership/quantity/identical-copy',
    );
  });
  it.each([
    'phase',
    'actor',
    'cost',
    'recipient',
    'count',
    'self order',
    'reversed effects',
    'runtime cost',
    'runtime count',
    'runtime trigger',
    'runtime binding',
  ])('rejects changed standard mechanic %s', (kind) => {
    const f = extraDrinksFixture();
    if (kind === 'phase') f.mechanic.legality.phase = 'DRINK';
    if (kind === 'actor') f.mechanic.legality.actor = 'ANY';
    if (kind === 'cost') f.mechanic.effects[0]!.amount = 2;
    if (kind === 'recipient') f.mechanic.effects[0]!.target = 'OTHER_PLAYERS';
    if (kind === 'count') f.mechanic.effects[1]!.count = 3;
    if (kind === 'self order')
      f.mechanic.effects[1]!.targets = 'ANY_LIVING_PLAYER';
    if (kind === 'reversed effects') f.mechanic.effects.reverse();
    if (kind === 'runtime cost')
      f.entry.review.sharedImplementation = { mandatoryGoldCost: 0 };
    if (kind === 'runtime count')
      Object.assign(f.mechanic, {
        sharedImplementation: {
          effects: [{ op: 'ORDER_EXTRA_DRINKS', count: 3 }],
        },
      });
    if (kind === 'runtime trigger')
      f.entry.review.sharedImplementation = {
        responseTrigger: { event: 'ANY' },
      };
    if (kind === 'runtime binding')
      Reflect.deleteProperty(f.mechanic, 'sharedImplementation');
    expect(verify(f).errors.join(' ')).toContain(
      'M18 must preserve own Order a Drink phase',
    );
  });
  it.each(['quantity', 'type', 'title', 'binding', 'missing row'])(
    'rejects wrong Gog standard-copy %s',
    (kind) => {
      const f = extraDrinksFixture(),
        row = f.source.characters
          .find((c) => c.id === 'gog')!
          .cards.find((r) => r.mechanicId === f.mechanic.id)!;
      if (kind === 'quantity') row.quantity = 1;
      if (kind === 'type') row.type = 'ANYTIME';
      if (kind === 'title')
        Object.assign(row, { canonicalCardTitle: 'Wrong synthetic card' });
      if (kind === 'binding')
        Reflect.deleteProperty(row, 'projectRuleOverride');
      if (kind === 'missing row') row.mechanicId = 'fixture.missing';
      expect(verify(f).errors.join(' ')).toContain(
        'M18 Gog must retain exactly two identical standard copies',
      );
    },
  );
});

function broadDefenseFixture() {
  const f = dualAnteFixture();
  const actual = JSON.parse(
    readFileSync('content-private/imports/rdi2/source-candidate.json', 'utf8'),
  ) as typeof f.source;
  const ledger = JSON.parse(
    readFileSync(
      'content-private/imports/rdi2/verification-ledger.json',
      'utf8',
    ),
  ) as typeof f.ledger;
  const mechanic = actual.mechanics[13]! as typeof f.mechanic,
    entry = ledger.characterMechanics[13]! as typeof f.entry;
  f.source.mechanics[13] = mechanic;
  f.ledger.characterMechanics[13] = entry;
  Object.assign(f.source.sources, actual.sources);
  for (const c of f.source.characters)
    for (const row of c.cards.filter((x) => x.mechanicId === mechanic.id))
      Object.assign(
        row,
        actual.characters
          .find((x) => x.id === c.id)!
          .cards.find((x) => x.mechanicId === mechanic.id)!,
      );
  return { ...f, mechanic, entry };
}

describe('M14 direct-card evidence and current defensive rules', () => {
  it('accepts individually verified original/card-image evidence without a project override', () => {
    expect(verify(broadDefenseFixture()).errors).toEqual([]);
  });
  it.each([
    'wrong type',
    'indirect stat',
    'other player',
    'gambling allowed',
    'own cost allowed',
    'non-card source',
    'Negate',
    'ignore everyone',
  ])('rejects semantic change: %s', (kind) => {
    const f = broadDefenseFixture();
    const trigger = f.mechanic.legality.trigger as Record<string, unknown>;
    if (kind === 'wrong type') f.mechanic.legality.mode = 'PHASE_OPPORTUNITY';
    if (kind === 'indirect stat')
      trigger.directlyAffectsSelfAny = ['INDIRECT_GOLD'];
    if (kind === 'other player')
      trigger.directlyAffectsSelfAny = ['OTHER_FORTITUDE'];
    if (kind === 'gambling allowed') trigger.excludeRoundOfGambling = false;
    if (kind === 'own cost allowed') trigger.excludeOwnCardGoldPayment = false;
    if (kind === 'non-card source') trigger.sourceCardTypes = ['DRINK_EVENT'];
    if (kind === 'Negate')
      f.mechanic.effects = [{ op: 'NEGATE_CURRENT_SOURCE' }];
    if (kind === 'ignore everyone')
      f.mechanic.effects = [{ op: 'IGNORE_CURRENT_SOURCE_FOR_ALL' }];
    expect(verify(f).errors.join(' ')).toContain('M14 must retain direct SELF');
  });
  it.each([
    'Gog inferred',
    'Gog publisher claim',
    'Eve stale',
    'review missing',
    'photo missing',
    'photo misclassified',
    'override injected',
  ])('rejects evidence change: %s', (kind) => {
    const f = broadDefenseFixture();
    if (kind === 'Gog inferred')
      f.mechanic.verification.characterVerification.gog!.exactCardText =
        'INFERRED_FROM_EVE';
    if (kind === 'Gog publisher claim')
      f.entry.characterVerification.gog!.officialHost = true;
    if (kind === 'Eve stale')
      f.mechanic.verification.characterVerification.eve!.semantics =
        'VERIFIED_OLD_PRINT';
    if (kind === 'review missing') f.entry.review = {};
    if (kind === 'photo missing')
      Reflect.deleteProperty(f.source.sources, 'gog_m14_printed_card_photo');
    if (kind === 'photo misclassified')
      (
        f.source.sources as Record<string, { kind: string }>
      ).gog_m14_printed_card_photo!.kind = 'OFFICIAL_CARD_IMAGE';
    if (kind === 'override injected')
      f.mechanic.projectRulesetOverrides = {
        sourceId: 'project_m12_gog_override_2026_10_05',
      };
    expect(verify(f).errors.join(' ')).toContain(
      'M14 must retain separately verified',
    );
  });
});

describe('M09 qualified payment source verification', () => {
  it('accepts verified Dimli/Fleck records and the separately qualified Gog semantics', () => {
    expect(verify(paymentFixture())).toMatchObject({
      valid: true,
      counts: { verifiedMechanics: 44 },
    });
  });
  it.each([
    [
      'Gog official-source claim',
      (f: ReturnType<typeof paymentFixture>) => {
        f.paymentMechanic.projectRulesetOverrides.officialSourceVerified = true;
      },
    ],
    [
      'Gog semantics relabeled verified',
      (f: ReturnType<typeof paymentFixture>) => {
        f.paymentMechanic.projectRulesetOverrides.gogSemanticRule = 'VERIFIED';
      },
    ],
    [
      'additional card-specific restrictions',
      (f: ReturnType<typeof paymentFixture>) => {
        f.paymentMechanic.projectRulesetOverrides.noAdditionalCardSpecificRestrictions = false;
      },
    ],
    [
      'incorrect comparison family',
      (f: ReturnType<typeof paymentFixture>) => {
        f.paymentMechanic.projectRulesetOverrides.sameNormalizedSemanticsAs = [
          'eve',
        ];
      },
    ],
    [
      'source provenance',
      (f: ReturnType<typeof paymentFixture>) => {
        f.origin.kind = 'OFFICIAL_RULES';
      },
    ],
    [
      'missing override source',
      (f: ReturnType<typeof paymentFixture>) => {
        f.paymentMechanic.projectRulesetOverrides.sourceId = 'absent';
      },
    ],
    [
      'invalid review',
      (f: ReturnType<typeof paymentFixture>) => {
        f.paymentLedger.review = {};
      },
    ],
    [
      'candidate qualification mismatch',
      (f: ReturnType<typeof paymentFixture>) => {
        f.paymentMechanic.verification.status = 'VERIFIED';
      },
    ],
    [
      'ledger qualification mismatch',
      (f: ReturnType<typeof paymentFixture>) => {
        f.paymentLedger.status = 'VERIFIED';
      },
    ],
    [
      'both statuses relabeled official',
      (f: ReturnType<typeof paymentFixture>) => {
        f.paymentMechanic.verification.status = 'VERIFIED';
        f.paymentLedger.status = 'VERIFIED';
      },
    ],
    [
      'qualification and override removed together',
      (f: ReturnType<typeof paymentFixture>) => {
        f.paymentMechanic.verification.status = 'VERIFIED';
        f.paymentLedger.status = 'VERIFIED';
        Reflect.deleteProperty(f.paymentMechanic, 'projectRulesetOverrides');
        Reflect.deleteProperty(
          f.paymentLedger.review,
          'projectRulesetOverrides',
        );
      },
    ],
    [
      'Gog exact text claim',
      (f: ReturnType<typeof paymentFixture>) => {
        f.paymentMechanic.verification.characterVerification.gog!.exactCardText =
          'VERIFIED_ORIGINAL_JSON';
      },
    ],
    [
      'ledger Gog semantics claim',
      (f: ReturnType<typeof paymentFixture>) => {
        f.paymentLedger.characterVerification.gog!.normalizedSemantics =
          'VERIFIED';
      },
    ],
    [
      'lost original Dimli records',
      (f: ReturnType<typeof paymentFixture>) => {
        f.paymentLedger.characterVerification.dimli!.exactSourceRecords =
          'UNAVAILABLE';
      },
    ],
    [
      'missing common field status',
      (f: ReturnType<typeof paymentFixture>) => {
        delete f.paymentMechanic.verification.fieldVerification
          .recipientPreservation;
      },
    ],
    [
      'changed reviewed provenance',
      (f: ReturnType<typeof paymentFixture>) => {
        f.paymentLedger.review.projectRulesetOverrides = {};
      },
    ],
  ] as const)('rejects %s', (_name, mutate) => {
    const f = paymentFixture();
    mutate(f);
    expect(verify(f).valid).toBe(false);
    expect(verify(f).errors.join(' ')).toContain('M09 must preserve');
  });
  it.each([
    [
      'ante-only trigger',
      (f: ReturnType<typeof paymentFixture>) => {
        f.paymentMechanic.legality.trigger = {
          systemEvent: 'ANTE_REQUIRED',
          actor: 'SELF',
        };
      },
    ],
    [
      'no pending requirement',
      (f: ReturnType<typeof paymentFixture>) => {
        const trigger = f.paymentMechanic.legality.trigger as Record<
          string,
          unknown
        >;
        delete trigger.pending;
      },
    ],
    [
      'one-Gold cap',
      (f: ReturnType<typeof paymentFixture>) => {
        f.paymentMechanic.effects[0]!.amount = 1;
      },
    ],
    [
      'changed recipient',
      (f: ReturnType<typeof paymentFixture>) => {
        f.paymentMechanic.effects[0]!.destination = 'SELF';
      },
    ],
    [
      'own-card payment prohibited',
      (f: ReturnType<typeof paymentFixture>) => {
        f.paymentMechanic.legality.allowsOwnCardPayment = false;
      },
    ],
    [
      'future payment substitution',
      (f: ReturnType<typeof paymentFixture>) => {
        f.paymentMechanic.effects[0]!.scope = 'ALL_FUTURE_PAYMENTS';
      },
    ],
    [
      'ignored source restrictions',
      (f: ReturnType<typeof paymentFixture>) => {
        f.paymentMechanic.legality.respectSourceSpecificPaymentRules = false;
      },
    ],
    [
      'missing exclusion',
      (f: ReturnType<typeof paymentFixture>) => {
        const trigger = f.paymentMechanic.legality.trigger as Record<
          string,
          unknown
        >;
        trigger.excludeIfAny = [];
      },
    ],
    [
      'payer gain from Inn payment',
      (f: ReturnType<typeof paymentFixture>) => {
        f.paymentMechanic.effects[0]!.payerReceivesGold = true;
      },
    ],
  ] as const)('rejects %s in normalized semantics', (_name, mutate) => {
    const f = paymentFixture();
    mutate(f);
    expect(verify(f).errors.join(' ')).toContain(
      'M09 trigger/effects must preserve',
    );
  });
  it.each(['mechanic', 'ledger'])(
    'fails closed when the M09 %s is missing',
    (kind) => {
      const f = paymentFixture();
      if (kind === 'mechanic') f.source.mechanics.splice(8, 1);
      else f.ledger.characterMechanics.splice(8, 1);
      expect(verify(f).valid).toBe(false);
    },
  );
});

describe('M06 qualified project verification', () => {
  it('accepts the qualified status only with explicit project provenance and matching reviewed rules', () => {
    const f = projectFixture();
    expect(verify(f)).toMatchObject({
      valid: true,
      counts: { verifiedMechanics: 44 },
    });
  });
  it.each([
    [
      'official-source claim',
      (f: ReturnType<typeof projectFixture>) => {
        f.projectMechanic.projectRulesetOverrides.officialSourceVerified = true;
      },
    ],
    [
      'negate provenance',
      (f: ReturnType<typeof projectFixture>) => {
        f.projectMechanic.projectRulesetOverrides.negatesCheatingCardRule =
          'VERIFIED';
      },
    ],
    [
      'participation provenance',
      (f: ReturnType<typeof projectFixture>) => {
        f.projectMechanic.projectRulesetOverrides.requiresActiveParticipation =
          'VERIFIED';
      },
    ],
    [
      'source provenance',
      (f: ReturnType<typeof projectFixture>) => {
        f.origin.kind = 'OFFICIAL_RULES';
      },
    ],
    [
      'ledger qualification mismatch',
      (f: ReturnType<typeof projectFixture>) => {
        f.projectLedger.status = 'VERIFIED';
      },
    ],
    [
      'candidate qualification mismatch',
      (f: ReturnType<typeof projectFixture>) => {
        f.projectMechanic.verification.status = 'VERIFIED';
      },
    ],
    [
      'both statuses relabeled as official verification',
      (f: ReturnType<typeof projectFixture>) => {
        f.projectLedger.status = 'VERIFIED';
        f.projectMechanic.verification.status = 'VERIFIED';
      },
    ],
    [
      'missing override source',
      (f: ReturnType<typeof projectFixture>) => {
        f.projectMechanic.projectRulesetOverrides.sourceId = 'absent';
      },
    ],
    [
      'invalid review',
      (f: ReturnType<typeof projectFixture>) => {
        f.projectLedger.review = {};
      },
    ],
    [
      'claimed official negate wording',
      (f: ReturnType<typeof projectFixture>) => {
        f.projectLedger.fieldVerification.negatesCheatingCardRule = 'VERIFIED';
      },
    ],
    [
      'changed reviewed provenance',
      (f: ReturnType<typeof projectFixture>) => {
        f.projectLedger.review.projectRulesetOverrides = {};
      },
    ],
  ] as const)('rejects %s', (_name, mutate) => {
    const f = projectFixture();
    mutate(f);
    expect(verify(f).valid).toBe(false);
    expect(verify(f).errors.join(' ')).toContain(
      'M06 project ruleset must preserve',
    );
  });
  it.each([
    [
      'missing active Round',
      (f: ReturnType<typeof projectFixture>) => {
        f.projectMechanic.legality.trigger = {
          event: 'CARD_PENDING',
          sourceCardType: 'CHEATING',
          selfStillParticipating: true,
        };
      },
    ],
    [
      'missing participation',
      (f: ReturnType<typeof projectFixture>) => {
        f.projectMechanic.legality.trigger = {
          event: 'CARD_PENDING',
          sourceCardType: 'CHEATING',
          gamblingActive: true,
        };
      },
    ],
    [
      'wrong source',
      (f: ReturnType<typeof projectFixture>) => {
        f.projectMechanic.legality.trigger = {
          event: 'CARD_PENDING',
          sourceCardType: 'GAMBLING',
          gamblingActive: true,
          selfStillParticipating: true,
        };
      },
    ],
    [
      'wrong effects',
      (f: ReturnType<typeof projectFixture>) => {
        f.projectMechanic.effects = [{ op: 'WIN_GAMBLING', winner: 'SELF' }];
      },
    ],
  ] as const)('rejects %s in project legality/effects', (_name, mutate) => {
    const f = projectFixture();
    mutate(f);
    expect(verify(f).errors.join(' ')).toContain(
      'M06 project trigger/effects differ',
    );
  });
  it('does not allow other rows or Drinks to claim project-qualified verification', () => {
    const f = projectFixture();
    f.source.mechanics[6]!.verification.status = 'VERIFIED_FOR_PROJECT_RULESET';
    f.ledger.characterMechanics[6]!.status = 'VERIFIED_FOR_PROJECT_RULESET';
    f.ledger.drinks[0]!.status = 'VERIFIED_FOR_PROJECT_RULESET';
    expect(verify(f).errors.join(' ')).toContain('Unverified ledger item M07');
    expect(verify(f).errors.join(' ')).toContain('Unverified ledger item D01');
  });
});

describe('M10 official current Gold-loss clarification', () => {
  it.each([
    { goldMovement: 'INN_TO_RECIPIENT' },
    { anteCountsAsSatisfied: false },
    { scope: 'ALL_FUTURE_PAYMENTS' },
    { fixedAmount: 1 },
    { op: 'SUBSTITUTE_CURRENT_GOLD_LOSS_FROM_INN' },
  ])('rejects changing the verified Coin semantics: %j', (change) => {
    const f = fixture();
    const coin = f.source.mechanics.find(
      (m) => m.id === 'illusionary_payment',
    )!;
    Object.assign(coin.effects[0]!, change);
    expect(
      verifyRdi2Source(f.source, f.ledger, matrix, f.lock, hashes).errors,
    ).toContain(
      'Illusionary Coin must move no Gold and still satisfy the current ante',
    );
  });
  it('rejects a missing Coin row', () => {
    const f = fixture();
    f.source.mechanics = f.source.mechanics.filter(
      (m) => m.id !== 'illusionary_payment',
    );
    expect(
      verifyRdi2Source(f.source, f.ledger, matrix, f.lock, hashes).errors,
    ).toContain(
      'Illusionary Coin must move no Gold and still satisfy the current ante',
    );
  });
});

describe('RDI2 source gate', () => {
  it('accepts a synthetic complete source and does not mutate it', () => {
    const f = fixture(),
      before = JSON.stringify(f);
    expect(verify(f)).toMatchObject({
      valid: true,
      errors: [],
      counts: {
        characters: { dimli: 40, eve: 40, fleck: 40, gog: 40 },
        characterPhysical: 160,
        drinkPhysical: 30,
        mechanics: 44,
        verifiedMechanics: 44,
        verifiedDrinks: 1,
      },
    });
    expect(JSON.stringify(f)).toBe(before);
  });
  it.each([
    [
      'wrong quantity',
      (f: Fixture) => {
        f.source.characters[0]!.cards[0]!.quantity--;
      },
      'Wrong physical deck',
    ],
    [
      'wrong declared deck',
      (f: Fixture) => {
        f.source.characters[0]!.primaryDeckPhysicalCount--;
      },
      'Wrong physical deck',
    ],
    [
      'wrong Drink total',
      (f: Fixture) => {
        f.source.drinkDeck.cards[0]!.quantity--;
      },
      'Wrong Drink physical',
    ],
    [
      'wrong declared Drink total',
      (f: Fixture) => {
        f.source.drinkDeck.physicalCount--;
      },
      'Wrong Drink physical',
    ],
    [
      'wrong card type',
      (f: Fixture) => {
        f.source.characters[0]!.cards[0]!.type = 'ACTION';
      },
      'Card type/summary mismatch',
    ],
    [
      'wrong row type',
      (f: Fixture) => {
        f.source.mechanics[0]!.cardType = 'ACTION';
      },
      'Wrong card type',
    ],
    [
      'stale Eve alcohol',
      (f: Fixture) => {
        f.source.mechanics.find(
          (m) => m.id === 'give_two_alcohol',
        )!.effects[0]!.delta = 1;
      },
      'Stale Eve numeric',
    ],
    [
      'stale Eve fire',
      (f: Fixture) => {
        f.source.mechanics.find(
          (m) => m.id === 'damage_three',
        )!.effects[0]!.delta = -2;
      },
      'Stale Eve numeric',
    ],
    [
      'stale Eve defense',
      (f: Fixture) => {
        f.source.mechanics.find(
          (m) => m.id === 'ignore_card_all_stats',
        )!.legality.trigger = {
          event: 'CARD_PENDING',
          directlyAffectsSelfAny: ['FORTITUDE'],
        };
      },
      'Stale Eve defensive',
    ],
    [
      'missing trigger',
      (f: Fixture) => {
        f.source.mechanics[5]!.legality = { mode: 'RESPONSE' };
      },
      'Missing structured Sometimes trigger',
    ],
    [
      'empty trigger',
      (f: Fixture) => {
        f.source.mechanics[5]!.legality = { mode: 'RESPONSE', trigger: {} };
      },
      'Missing structured Sometimes trigger',
    ],
    [
      'unresolved conflict',
      (f: Fixture) => {
        f.source.candidateValidation.knownHardBlockers.push('fixture.conflict');
      },
      'Unresolved source conflicts',
    ],
    [
      'unverified ledger',
      (f: Fixture) => {
        f.ledger.characterMechanics[5]!.status = 'PENDING';
      },
      'Unverified ledger item M06',
    ],
    [
      'unverified mechanic',
      (f: Fixture) => {
        f.source.mechanics[5]!.verification.status = 'PENDING';
      },
      'Unverified mechanic',
    ],
    [
      'unverified Drink ledger',
      (f: Fixture) => {
        f.ledger.drinks[0]!.status = 'PENDING';
      },
      'Unverified ledger item D01',
    ],
    [
      'unverified Drink',
      (f: Fixture) => {
        f.source.drinkDeck.cards[0]!.verification.status = 'PENDING';
      },
      'Unverified Drink',
    ],
    [
      'duplicate mechanic',
      (f: Fixture) => {
        f.source.mechanics.push(structuredClone(f.source.mechanics[0]!));
      },
      'Duplicate mechanic ID',
    ],
    [
      'missing translation',
      (f: Fixture) => {
        f.source.mechanics[0]!.display['zh-TW'] = '';
      },
      'missing bilingual presentation',
    ],
    [
      'hash mismatch',
      (f: Fixture) => {
        f.lock.normalizedSha256 = 'd'.repeat(64);
      },
      'Source lock hash mismatch',
    ],
    [
      'ledger hash mismatch',
      (f: Fixture) => {
        f.lock.ledgerSha256 = 'd'.repeat(64);
      },
      'Source lock hash mismatch',
    ],
    [
      'balanced but wrong row distribution',
      (f: Fixture) => {
        f.source.characters[0]!.cards[0]!.quantity++;
        f.source.characters[0]!.cards[1]!.quantity--;
      },
      'Wrong row distribution dimli/',
    ],
    [
      'duplicate character',
      (f: Fixture) => {
        f.source.characters[3] = structuredClone(f.source.characters[0]!);
      },
      'Duplicate character ID',
    ],
    [
      'duplicate card',
      (f: Fixture) => {
        f.source.characters[0]!.cards[1]!.cardKey =
          f.source.characters[0]!.cards[0]!.cardKey;
      },
      'Duplicate card key',
    ],
    [
      'duplicate character mechanic',
      (f: Fixture) => {
        f.source.characters[0]!.cards[1]!.mechanicId =
          f.source.characters[0]!.cards[0]!.mechanicId;
      },
      'Duplicate character mechanic',
    ],
    [
      'duplicate Drink',
      (f: Fixture) => {
        f.source.drinkDeck.cards.push(
          structuredClone(f.source.drinkDeck.cards[0]!),
        );
      },
      'Duplicate Drink ID',
    ],
    [
      'duplicate matrix row',
      (f: Fixture) => {
        const lines = f.matrix.trim().split(/\r?\n/);
        lines[2] = lines[1]!;
        f.matrix = lines.join('\n');
      },
      'Duplicate matrix mechanic ID',
    ],
    [
      'duplicate ledger ID',
      (f: Fixture) => {
        f.ledger.drinks[0]!.ledgerId = 'M01';
      },
      'Duplicate ledger ID',
    ],
    [
      'duplicate ledger mechanic',
      (f: Fixture) => {
        f.ledger.characterMechanics[1]!.mechanicId =
          f.ledger.characterMechanics[0]!.mechanicId;
      },
      'Duplicate ledger mechanic ID',
    ],
    [
      'duplicate ledger Drink',
      (f: Fixture) => {
        f.ledger.drinks.push(structuredClone(f.ledger.drinks[0]!));
      },
      'Duplicate ledger Drink ID',
    ],
    [
      'missing mechanic',
      (f: Fixture) => {
        f.source.mechanics.pop();
      },
      'Missing mechanic',
    ],
    [
      'missing ledger mechanic',
      (f: Fixture) => {
        f.ledger.characterMechanics.pop();
      },
      'Missing matrix/ledger mechanic',
    ],
    [
      'missing ledger Drink',
      (f: Fixture) => {
        f.ledger.drinks = [];
      },
      'Missing Drink ledger',
    ],
    [
      'missing Drink',
      (f: Fixture) => {
        f.source.drinkDeck.cards = [];
      },
      'Missing Drink synthetic_drink',
    ],
    [
      'wrong Drink kind',
      (f: Fixture) => {
        f.ledger.drinks[0]!.candidateKind = 'DRINK_EVENT';
      },
      'Drink quantity/type mismatch',
    ],
    [
      'wrong presentation',
      (f: Fixture) => {
        f.source.mechanics[0]!.display['en-US'] = 'Different';
      },
      'Matrix presentation mismatch',
    ],
    [
      'incomplete review',
      (f: Fixture) => {
        f.ledger.characterMechanics[0]!.review = {};
      },
      'Missing complete review',
    ],
    [
      'omitted check',
      (f: Fixture) => {
        (f.ledger.characterMechanics[0]!.review.checks as unknown[]).pop();
      },
      'Incomplete per-item checks',
    ],
    [
      'missing source',
      (f: Fixture) => {
        (
          f.ledger.characterMechanics[0]!.review.evidence as {
            sourceId: string;
          }[]
        )[0]!.sourceId = 'constructor';
      },
      'Missing evidence source constructor',
    ],
    [
      'missing check evidence',
      (f: Fixture) => {
        (
          f.ledger.characterMechanics[0]!.review.checks as {
            evidence: string[];
          }[]
        )[0]!.evidence = ['absent'];
      },
      'Missing check evidence',
    ],
    [
      'changed effect after review',
      (f: Fixture) => {
        f.source.mechanics[0]!.effects = [{ op: 'CHANGED' }];
      },
      'Reviewed mechanic changed',
    ],
    [
      'lost M05 override',
      (f: Fixture) => {
        f.source.mechanics[4]!.projectRuleOverride = undefined;
      },
      'PROJECT_RULE_OVERRIDE',
    ],
    [
      'wrong M05 target',
      (f: Fixture) => {
        f.source.mechanics[4]!.legality.target = 'OTHER_ACTIVE_GAMBLER';
      },
      'PROJECT_RULE_OVERRIDE',
    ],
    [
      'wrong M05 self-target',
      (f: Fixture) => {
        f.source.mechanics[4]!.legality.selfTarget = 'FORBIDDEN';
      },
      'PROJECT_RULE_OVERRIDE',
    ],
    [
      'missing M05 override source',
      (f: Fixture) => {
        f.source.mechanics[4]!.projectRuleOverride!.sourceId = 'absent';
      },
      'PROJECT_RULE_OVERRIDE',
    ],
  ] as const)('rejects %s', (_name, mutate, message) => {
    const f = fixture();
    mutate(f);
    expect(verify(f).valid).toBe(false);
    expect(verify(f).errors.join('\n')).toContain(message);
  });
  it.each(['UNKNOWN', 'TODO', 'ASSUMED', 'GUESSED'])(
    'rejects %s markers',
    (marker) => {
      const f = fixture();
      f.source.mechanics[0]!.rulesSummary['en-US'] = marker;
      expect(verify(f).errors.join('\n')).toContain('Forbidden');
    },
  );
  it('rejects null schema, absent lock, false official override and absent evidence review without throwing', () => {
    const f = fixture();
    expect(verifyRdi2Source(null, null, matrix, null, hashes).valid).toBe(
      false,
    );
    expect(
      verifyRdi2Source(f.source, f.ledger, matrix, null, hashes).errors.join(
        ' ',
      ),
    ).toContain('Source lock missing');
    f.ledger.characterMechanics[0]!.review = null as unknown as Record<
      string,
      unknown
    >;
    expect(verify(f).errors.join(' ')).toContain('Missing complete review');
    const eject = f.source.mechanics[4]!;
    expect(
      verifyRdi2Source(
        {
          ...f.source,
          mechanics: [
            {
              ...eject,
              projectRuleOverride: {
                ...eject.projectRuleOverride,
                officialSourceVerified: true,
              },
            },
          ],
        },
        f.ledger,
        matrix,
        f.lock,
        hashes,
      ).valid,
    ).toBe(false);
  });
  it.each([
    { mode: 'MULTI_TRIGGER', triggers: [{ systemEvent: 'TEST' }] },
    { mode: 'GAMBLING_CHECKPOINT', requires: { gamblingActive: true } },
    { mode: 'PHASE_OPPORTUNITY', phase: 'DRINK' },
  ])('accepts structured Sometimes contexts: %o', (legality) => {
    const f = fixture();
    f.source.mechanics[5]!.legality = legality;
    f.ledger.characterMechanics[5]!.review.legality = legality;
    expect(verify(f).valid).toBe(true);
  });
  it.each([
    { mode: 'RESPONSE', trigger: null },
    { mode: 'MULTI_TRIGGER', triggers: [] },
    { mode: 'MULTI_TRIGGER', triggers: [{}] },
    { mode: 'GAMBLING_CHECKPOINT', requires: {} },
    { mode: 'PHASE_OPPORTUNITY', phase: '' },
    { mode: 'PHASE_OPPORTUNITY' },
  ])('rejects empty Sometimes contexts: %o', (legality) => {
    const f = fixture();
    f.source.mechanics[5]!.legality = legality;
    expect(verify(f).errors.join(' ')).toContain(
      'Missing structured Sometimes trigger',
    );
  });
  it.each([
    'bad,header',
    matrix.trim().split(/\r?\n/).slice(0, 44).join('\n'),
    matrix.replace('6,6,6,6', 'x,6,6,6'),
    matrix.replace('Join the Game', '"Join the Game"'),
  ])('rejects malformed matrix input', (csv) => {
    const f = fixture();
    f.matrix = csv;
    expect(verify(f).valid).toBe(false);
    expect(verify(f).counts).toBeNull();
  });
  it('accepts BOM and CRLF matrix without changing quantities', () => {
    const f = fixture();
    f.matrix = '\uFEFF' + matrix.replace(/\r?\n/g, '\r\n');
    expect(verify(f).valid).toBe(true);
  });
});

describe('Step 24A individually reviewed audit boundary', () => {
  it('preserves M05 original records and independently reproduces their canonical hashes', () => {
    const records = JSON.parse(
      readFileSync(
        'reference/rdi2/m05-eve-fleck-control-eject-original-records.json',
        'utf8',
      ),
    ) as {
      cards: Record<string, { record: unknown; recordCanonicalSha256: string }>;
    };
    function canonical(value: unknown): unknown {
      if (Array.isArray(value)) return value.map(canonical);
      if (value !== null && typeof value === 'object')
        return Object.fromEntries(
          Object.entries(value)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([key, item]) => [key, canonical(item)]),
        );
      return value;
    }
    for (const id of ['eve', 'fleck'])
      expect(
        createHash('sha256')
          .update(JSON.stringify(canonical(records.cards[id]!.record)))
          .digest('hex'),
      ).toBe(records.cards[id]!.recordCanonicalSha256);
  });
  it('keeps M05 provenance and accepts M06 only for the project ruleset while the package remains unlocked', () => {
    const source = JSON.parse(
      readFileSync(
        'content-private/imports/rdi2/source-candidate.json',
        'utf8',
      ),
    ) as Fixture['source'];
    const ledger = JSON.parse(
      readFileSync(
        'content-private/imports/rdi2/verification-ledger.json',
        'utf8',
      ),
    ) as Fixture['ledger'];
    expect(source.mechanics[4]).toMatchObject({
      cardType: 'CHEATING',
      legality: { target: 'ANY_ACTIVE_GAMBLER', selfTarget: 'ALLOWED' },
      verification: { status: 'VERIFIED' },
      projectRuleOverride: {
        provenance: 'PROJECT_RULE_OVERRIDE',
        officialSourceVerified: false,
      },
    });
    expect(source.mechanics[4]!.effects).toEqual([
      { op: 'TAKE_GAMBLING_CONTROL', category: 'CHEATING' },
      {
        op: 'FORCE_LEAVE_GAMBLING',
        target: 'CHOSEN_PLAYER',
        responseBeforeLeave: true,
        responseBeforeRoundWin: true,
        postLeaveForbiddenCardTypes: ['GAMBLING', 'CHEATING'],
        restrictionScope: 'CURRENT_ROUND',
        alreadyAntedGold: 'REMAINS_IN_POT',
      },
    ]);
    expect(ledger.characterMechanics[4]!.status).toBe('VERIFIED');
    expect(ledger.characterMechanics[4]!.review.projectRuleOverride).toEqual(
      source.mechanics[4]!.projectRuleOverride,
    );
    expect(ledger.characterMechanics[5]!.status).toBe(
      'VERIFIED_FOR_PROJECT_RULESET',
    );
    expect(source.mechanics[5]).toMatchObject({
      verification: {
        status: 'VERIFIED_FOR_PROJECT_RULESET',
        fieldVerification: {
          negatesCheatingCardRule: 'PROJECT_RULE_OVERRIDE',
          requiresActiveParticipation: 'PROJECT_RULE_OVERRIDE',
        },
      },
      projectRulesetOverrides: { officialSourceVerified: false },
    });
    expect(source.mechanics[6]).toMatchObject({
      cardType: 'SOMETIMES',
      legality: {
        mode: 'GAMBLING_CHECKPOINT',
        allowIfLeftRound: true,
        requires: {
          gamblingActive: true,
          roundNotEnded: true,
          notAnteResponse: true,
          sourceWillNotEndRound: true,
        },
      },
      effects: [{ op: 'END_GAMBLING', potDestination: 'INN' }],
      verification: { status: 'VERIFIED' },
    });
    expect(ledger.characterMechanics[6]!.status).toBe('VERIFIED');
    expect(ledger.characterMechanics[6]!.counts).toEqual({
      dimli: 1,
      eve: 1,
      fleck: 1,
      gog: 1,
    });
    expect(source.mechanics[7]).toMatchObject({
      cardType: 'SOMETIMES',
      canonicalCardTitle: 'Best two out of three?',
      legality: {
        mode: 'SYSTEM_RESPONSE',
        trigger: {
          systemEvent: 'GAMBLING_WIN_BEFORE_PAYOUT',
          winner: 'OTHER',
          selfStillInRound: true,
          prohibitedPriorCard: {
            canonicalTitle: 'Um… I know you think you won, but…',
          },
        },
      },
      verification: { status: 'VERIFIED' },
    });
    expect(source.mechanics[7]!.legality.trigger).not.toHaveProperty(
      'winnerNotAlreadyReplaced',
    );
    expect(source.mechanics[7]!.effects).toEqual([
      {
        op: 'RESTART_GAMBLING_ROUND',
        keepPot: true,
        ante: 1,
        controller: 'SELF',
        continueFrom: 'LEFT_OF_SELF',
      },
    ]);
    expect(ledger.characterMechanics[7]!.status).toBe('VERIFIED');
    expect(ledger.characterMechanics[7]!.counts).toEqual({
      dimli: 1,
      eve: 0,
      fleck: 0,
      gog: 0,
    });
    expect(ledger.characterMechanics[8]!.status).toBe(
      'VERIFIED_FOR_PROJECT_RULESET',
    );
    expect(ledger.characterMechanics[20]!).toMatchObject({
      ledgerId: 'M21',
      status: 'VERIFIED_FOR_PROJECT_RULESET',
      completionStatus: 'SOURCE_REVIEW_COMPLETE',
      characterVerification: {
        dimli: { semantics: 'VERIFIED_ORIGINAL_JSON_AND_OFFICIAL_RULES' },
        gog: {
          cardIdentity: 'VERIFIED_OFFICIAL_NAMED_EXAMPLE',
          exactCardText: 'UNAVAILABLE',
          normalizedSemantics: 'PROJECT_RULE_OVERRIDE',
          officialSourceVerified: false,
          projectRuleOverrideAuthorized: true,
        },
      },
    });
    expect(source.mechanics[20]!.verification.status).toBe(
      'VERIFIED_FOR_PROJECT_RULESET',
    );
    expect(
      ledger.characterMechanics
        .slice(41)
        .every(
          (entry) =>
            entry.status !== 'PENDING_STEP_24A_ITEM_BY_ITEM_VERIFICATION',
        ),
    ).toBe(true);
    expect(
      ledger.drinks.every(
        (entry) =>
          entry.status !== 'PENDING_STEP_24A_ITEM_BY_ITEM_VERIFICATION',
      ),
    ).toBe(true);
    const result = verifyRdi2Source(source, ledger, matrix, null, hashes);
    expect(result.valid).toBe(false);
    expect(result.counts).toMatchObject({
      verifiedMechanics: ledger.characterMechanics.filter((entry) =>
        ['VERIFIED', 'VERIFIED_FOR_PROJECT_RULESET'].includes(entry.status),
      ).length,
      verifiedDrinks: 23,
    });
    expect(result.errors.join('\n')).not.toContain(
      'Unverified ledger item M06',
    );
    expect(result.errors.join('\n')).not.toContain(
      'M06 project ruleset must preserve',
    );
    expect(result.errors.join('\n')).not.toContain(
      'Reviewed mechanic changed M05',
    );
    expect(result.errors.join('\n')).not.toContain(
      'Unverified ledger item M09',
    );
    expect(result.errors.join('\n')).not.toContain('M09 must preserve');
    expect(ledger.characterMechanics[9]!.status).toBe('VERIFIED');
    expect(source.mechanics[9]!.effects).toEqual([
      {
        op: 'PREVENT_CURRENT_GOLD_LOSS',
        goldMovement: 'NONE',
        anteCountsAsSatisfied: true,
        scope: 'CURRENT_PAYMENT_OR_GOLD_LOSS_CONTEXT',
      },
    ]);
    expect(result.errors.join('\n')).not.toContain(
      'Unverified ledger item M10',
    );
    expect(ledger.characterMechanics[10]!.status).toBe('VERIFIED');
    expect(source.mechanics[10]).toMatchObject({
      canonicalCardTitle: 'Sleight of hand...',
      cardType: 'SOMETIMES',
      legality: {
        mode: 'GAMBLING_CHECKPOINT',
        requires: { gamblingActive: true, potMin: 1 },
        allowIfLeftRound: true,
      },
      effects: [
        {
          op: 'TAKE_FROM_GAMBLING_POT',
          amount: 1,
          recipient: 'SELF',
          otherRoundEffect: 'NONE',
        },
      ],
    });
    expect(ledger.characterMechanics[10]!.counts).toEqual({
      dimli: 0,
      eve: 1,
      fleck: 0,
      gog: 0,
    });
    expect(result.errors.join('\n')).not.toContain(
      'Unverified ledger item M11',
    );
    expect(result.errors.join('\n')).not.toContain(
      'Unverified ledger item M12',
    );
    expect(ledger.characterMechanics[11]!.status).toBe(
      'VERIFIED_FOR_PROJECT_RULESET',
    );
    expect(source.mechanics[11]!.verification).toMatchObject({
      status: 'VERIFIED_FOR_PROJECT_RULESET',
      ledgerId: 'M12',
    });
    expect(result.errors.join('\n')).not.toContain('M12 must preserve');
    expect(result.errors.join('\n')).not.toContain(
      'Unverified ledger item M13',
    );
    expect(ledger.characterMechanics[12]!.status).toBe(
      'VERIFIED_FOR_PROJECT_RULESET',
    );
    expect(result.errors.join('\n')).not.toContain('M13 must preserve');
    expect(result.errors.join('\n')).not.toContain(
      'Unverified ledger item M14',
    );
    expect(ledger.characterMechanics[13]!.status).toBe('VERIFIED');
    expect(result.errors.join('\n')).not.toContain('M14 must retain');
    expect(result.errors.join('\n')).not.toContain(
      'Unverified ledger item M15',
    );
    expect(ledger.characterMechanics[14]!.status).toBe(
      'VERIFIED_FOR_PROJECT_RULESET',
    );
    expect(source.mechanics[14]!.verification).toMatchObject({
      status: 'VERIFIED_FOR_PROJECT_RULESET',
      characterVerification: {
        gog: {
          exactCardText: 'UNAVAILABLE',
          normalizedSemantics: 'PROJECT_RULE_OVERRIDE',
          officialSourceVerified: false,
        },
      },
    });
    expect(result.counts?.verifiedMechanics).toBe(44);
    expect(result.errors.join('\n')).not.toContain('M15 must preserve');
    expect(result.errors.join('\n')).not.toContain('M15 Gog (2 copies)');
    expect(ledger.characterMechanics[15]!.status).toBe('VERIFIED');
    expect(result.errors.join('\n')).not.toContain(
      'Unverified ledger item M16',
    );
    expect(result.errors.join('\n')).not.toContain('M16 must preserve');
    expect(ledger.characterMechanics[16]!.status).toBe('VERIFIED');
    expect(result.errors.join('\n')).not.toContain(
      'Unverified ledger item M17',
    );
    expect(result.errors.join('\n')).not.toContain('M17 must preserve');
    expect(result.errors.join('\n')).not.toContain(
      'Unverified ledger item M18',
    );
    expect(ledger.characterMechanics[17]!.status).toBe(
      'VERIFIED_FOR_PROJECT_RULESET',
    );
    expect(source.mechanics[17]!.verification).toMatchObject({
      ledgerId: 'M18',
      status: 'VERIFIED_FOR_PROJECT_RULESET',
      characterVerification: {
        gog: {
          exactGogCardProvenance: 'UNAVAILABLE',
          normalizedSemantics:
            'VERIFIED_PUBLISHER_STANDARD_CARD_AND_CURRENT_RULES',
          gogSpecificProvenancePublisherVerified: false,
          mechanicPublisherSupported: true,
          ownership: 'PROJECT_RULE_OVERRIDE',
          quantity: 'PROJECT_RULE_OVERRIDE',
        },
      },
    });
    expect(result.errors.join('\n')).not.toContain('M18 Gog (2 copies)');
    expect(result.errors.join('\n')).not.toContain('M18 must preserve');
    expect(ledger.characterMechanics[18]!.status).toBe('VERIFIED');
    expect(result.errors.join('\n')).not.toContain(
      'Unverified ledger item M19',
    );
    expect(result.errors.join('\n')).not.toContain('M19 must preserve');
    expect(ledger.characterMechanics[19]!.status).toBe('VERIFIED');
    expect(result.errors.join('\n')).not.toContain(
      'Unverified ledger item M20',
    );
    expect(result.errors.join('\n')).not.toContain('M20 must preserve');
    expect(result.errors.join('\n')).not.toContain('M20 engine audit');
    expect(ledger.characterMechanics[21]!.status).toBe('VERIFIED');
    expect(result.errors.join('\n')).not.toContain(
      'Unverified ledger item M22',
    );
    expect(ledger.characterMechanics[22]!.status).toBe('VERIFIED');
    expect(result.errors.join('\n')).not.toContain(
      'Unverified ledger item M23',
    );
    expect(ledger.characterMechanics[23]!.status).toBe('VERIFIED');
    expect(result.errors.join('\n')).not.toContain(
      'Unverified ledger item M24',
    );
    expect(ledger.characterMechanics[24]!.status).toBe('VERIFIED');
    expect(result.errors.join('\n')).not.toContain(
      'Unverified ledger item M25',
    );
    expect(ledger.characterMechanics[25]!.status).toBe('VERIFIED');
    expect(result.errors.join('\n')).not.toContain(
      'Unverified ledger item M26',
    );
    expect(result.errors.join('\n')).not.toContain(
      'Unverified ledger item M27',
    );
    expect(result.errors.join('\n')).not.toContain(
      'M21 required team acceptance J remains pending',
    );
  });
});

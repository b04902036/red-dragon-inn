import { z } from 'zod';

// Source descriptions only. Runtime capabilities remain a Step 24B task.
export const finalResolutionSourceId =
  'user_step24a_final_resolution_2026_10_07';
export const finalResolutionPath =
  'codex-prompts/step-24a-final-source-lock-resolution.md';
export const finalResolutionSha256 =
  '0e350c803247046aacb5bcdd5928583449bc59bbc38acdcbe588991fcbd4c19a';
export const challengeSemantics = {
  choice: ['ACCEPT', 'DECLINE'],
  decline: { draw: 0, drinks: 0, payout: 0, penalty: 0, eventEnds: true },
  source: 'INN_DRINK_DECK',
  ordered: false,
  baseDrinks: 2,
  leadingEvents: 'DISCARD_WITHOUT_RESOLVING_AND_CONTINUE_BASE_SEARCH',
  chaserEvent: 'DISCARD_WITHOUT_EFFECT_AND_END_CHAIN_NO_BASE_SEARCH',
  independentDrinks: true,
  sequenceEachDrink: [
    'REVEAL_COMPLETE_CHASER_CHAIN',
    'NORMAL_LEGAL_RESPONSES',
    'RESOLVE',
  ],
  eventResponse: 'NORMAL_BEFORE_EVENT_BEGINS',
  ignoredOrNegatedBeforeBegin: 'NO_CHALLENGE_FOR_AFFECTED_PLAYER',
  retroactiveEventIgnore: false,
  drinkResponseFamily: 'SHARED',
  survivalCheckpoint: 'AFTER_BOTH_DRINKS_AND_RESPONSES_INCLUDING_LEGAL_RESCUES',
  success: 'CHALLENGER_REMAINS_IN_GAME',
  failure: 'CHALLENGER_ELIMINATED',
  successfulPayout: {
    from: 'EACH_OTHER_APPLICABLE_PLAYER',
    to: 'CHALLENGER',
    amount: 1,
    pipeline: 'SHARED_GOLD_PAYMENT',
  },
  failedPayout: 0,
  payoutBeforeDrinks: false,
  payoutOnAcceptance: false,
};
const numeric = (alcohol: number, fortitude: number) => [
  ...(alcohol
    ? [
        {
          op: 'CHANGE_STAT',
          target: 'DRINKER',
          stat: 'ALCOHOL',
          delta: alcohol,
        },
      ]
    : []),
  ...(fortitude
    ? [
        {
          op: 'CHANGE_STAT',
          target: 'DRINKER',
          stat: 'FORTITUDE',
          delta: fortitude,
        },
      ]
    : []),
];
const replacement = (traits: string[], alcohol: number) => ({
  ifAnyTrait: traits,
  replaceEntireNumericEffectWith: { alcohol, fortitude: 0 },
});
export const finalDrinkResolutions = [
  {
    ledgerId: 'D03',
    id: 'dirty_dishwater',
    title: 'Dirty Dishwater',
    kind: 'DRINK',
    effects: numeric(0, -1),
  },
  {
    ledgerId: 'D14',
    id: 'ogre_brew',
    title: 'Ogre Brew',
    kind: 'DRINK',
    effects: numeric(2, -1),
    traitReplacement: replacement(['OGRE', 'HALF_OGRE'], 3),
  },
  {
    ledgerId: 'D15',
    id: 'orcish_rotgut',
    title: 'Orcish Rotgut',
    kind: 'DRINK',
    effects: numeric(0, -2),
    traitReplacement: replacement(['ORC'], 2),
  },
  {
    ledgerId: 'D17',
    id: 'the_challenge',
    title: 'The Challenge!',
    kind: 'DRINK_EVENT',
    effects: [
      {
        op: 'OPTIONAL_CHALLENGE',
        onAccept: {
          revealCompleteNonEventDrinks: 2,
          resolveBoth: true,
          ifSurvivesThen: { eachOtherPlayerPaysSelf: 1 },
        },
      },
    ],
    drinkSemantics: challengeSemantics,
  },
  {
    ledgerId: 'D18',
    id: 'troll_swill',
    title: 'Troll Swill',
    kind: 'DRINK',
    effects: numeric(1, -1),
    traitReplacement: replacement(['TROLL'], 2),
  },
  {
    ledgerId: 'D19',
    id: 'water',
    title: 'Water',
    kind: 'DRINK',
    effects: numeric(0, 0),
  },
  {
    ledgerId: 'D20',
    id: 'cutting_off',
    title: "We're Cutting You Off!",
    kind: 'DRINK',
    effects: numeric(-1, 0),
  },
  {
    ledgerId: 'D23',
    id: 'wizards_brew',
    title: "Wizard's Brew",
    kind: 'DRINK',
    effects: numeric(2, 2),
  },
] as const;

export const m41Resolution = {
  label: 'M41 USER OVERRIDE — Gog physical identity and normalized mechanic',
  provenance: 'PROJECT_RULE_OVERRIDE',
  sourceId: finalResolutionSourceId,
  scope: 'GOG_M41_ONLY',
  owner: 'gog',
  quantity: 1,
  officialSourceVerified: false,
  printedTitleRequired: false,
  displayLabel: 'NORMALIZED_FALLBACK_NOT_PHYSICAL_TITLE',
  noAdditionalRestrictions: true,
};
export const m44Resolution = {
  label: 'M44 USER OVERRIDE — provenance only',
  classification: 'PROJECT_RULE_OVERRIDE',
  sourceId: finalResolutionSourceId,
  scope: 'GOG_M44_PHYSICAL_COPY_PROVENANCE_ONLY',
  owner: 'gog',
  quantity: 1,
  canonicalCardTitle: 'Tip the Wench.',
  mechanicId: 'tip_wench',
  publisherDirectOwnership: false,
  gameplayChanged: false,
};
export const drinkResolution = (ledgerId: string) => ({
  label: `${ledgerId} USER OVERRIDE`,
  provenance: 'PROJECT_RULE_OVERRIDE',
  sourceId: finalResolutionSourceId,
  scope: `${ledgerId}_ONLY`,
  officialSourceVerified: false,
  noAdditionalRestrictions: true,
});

export function drinkEvidenceClassification(
  ledgerId: string,
): Record<string, string> {
  const result: Record<string, string> = {
    quantity: 'MATRIX_SECONDARY_WITH_EXPLICIT_USER_CONFIRMATION',
    completeCardDetails: `${ledgerId} USER OVERRIDE`,
    sharedRules: 'PUBLISHER_GENERIC_SHARED_RULES',
  };
  if (ledgerId === 'D15') result.ordinaryFortitudeLoss = 'PUBLISHER_DIRECT';
  if (ledgerId === 'D18') result.ordinaryNumericEffects = 'PUBLISHER_DIRECT';
  if (ledgerId === 'D19') result.printedAlcoholZero = 'PUBLISHER_DIRECT';
  if (ledgerId === 'D20') result.negativeDrinkContestFloor = 'PUBLISHER_DIRECT';
  if (ledgerId === 'D17') {
    result.acceptTwoSeparateChaserDrinksAndSuccessfulPayout =
      'PUBLISHER_DIRECT';
    result.completeChaserResponseTiming = 'PUBLISHER_GENERIC_SHARED_RULES';
    result.legacySearchDeclineSurvivalBoundaries = 'D17 USER OVERRIDE';
  }
  return result;
}

const record = z.record(z.string(), z.unknown());
const records = z.array(record);
const object = (value: unknown) => record.safeParse(value).data ?? {};
const array = (value: unknown) => records.safeParse(value).data ?? [];
const same = (a: unknown, b: unknown): boolean => {
  if (Array.isArray(a) && Array.isArray(b))
    return (
      a.length === b.length && a.every((value, index) => same(value, b[index]))
    );
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const left = object(a),
      right = object(b);
    return (
      Object.keys(left).length === Object.keys(right).length &&
      Object.keys(left).every((key) => same(left[key], right[key]))
    );
  }
  return a === b;
};

export const teamModeTodo = {
  classification: 'USER_WORKFLOW_DECISION',
  sourceId: 'user_team_mode_nonblocking_todo_2026_10_07',
  scope: 'TEAM_MODE_NONBLOCKING_ALL_STEPS',
  pendingAcceptance: ['M21/J'],
  blocking: false,
  teamRuntimeImplemented: false,
  teamTestPassed: false,
  mechanicsChanged: false,
};
export function teamModeDeferralAuthorized(
  sourceInput: unknown,
  entryInput: unknown,
): boolean {
  const source = object(sourceInput),
    entry = object(entryInput);
  const m = array(source.mechanics).find(
    (m) => m.id === 'force_extra_drink_during_other_drink_phase',
  );
  const evidence = object(object(source.sources)[teamModeTodo.sourceId]);
  return (
    same(m?.teamModeTodo, teamModeTodo) &&
    same(entry.teamModeTodo, teamModeTodo) &&
    same(object(entry.review).teamModeTodo, teamModeTodo) &&
    evidence.authority === 'USER_SPECIFIED' &&
    evidence.officialSourceVerified === false &&
    evidence.path === 'codex-prompts/step-24a-team-mode-nonblocking-todo.md' &&
    evidence.sha256 ===
      'd66b934628d2fe1fb3955f8bf8136a44b1bee9fae7c11f95e5af8dc69ede4d7c' &&
    same(source.nonBlockingTodos, [
      {
        id: 'team-mode',
        decision: teamModeTodo,
        status: 'PENDING_IMPLEMENTATION_AND_REAL_TEAM_TEST',
      },
    ])
  );
}

export function verifyFinalResolutions(
  sourceInput: unknown,
  ledgerInput: unknown,
): string[] {
  const source = object(sourceInput),
    ledger = object(ledgerInput),
    errors: string[] = [];
  const mechanics = array(source.mechanics),
    entries = array(ledger.characterMechanics);
  const drinks = array(object(source.drinkDeck).cards),
    drinkEntries = array(ledger.drinks);
  const cards = array(
    array(source.characters).find((c) => c.id === 'gog')?.cards,
  );
  const active =
    source.schemaVersion === 'rdi2-source-candidate-v1' ||
    source.schemaVersion === 'rdi2-source-normalized-v1' ||
    mechanics.some((item) => object(item.verification).ledgerId === 'M41');
  if (!active) return errors;
  const knownOps = new Set([
    'START_OR_TAKE_GAMBLING_CONTROL',
    'TAKE_GAMBLING_CONTROL',
    'ANTE_ALL_ACTIVE',
    'FORCE_LEAVE_GAMBLING',
    'NEGATE_CURRENT_SOURCE',
    'WIN_GAMBLING',
    'END_GAMBLING',
    'RESTART_GAMBLING_ROUND',
    'SUBSTITUTE_CURRENT_GOLD_LOSS_FROM_INN',
    'PREVENT_CURRENT_GOLD_LOSS',
    'TAKE_FROM_GAMBLING_POT',
    'CANCEL_CURRENT_ANTE_FOR_SELF',
    'LEAVE_GAMBLING',
    'CONTEXT_BRANCH',
    'IGNORE_CURRENT_EFFECT_FOR_SELF',
    'IGNORE',
    'NEGATE',
    'IGNORE_CURRENT_DRINK',
    'PAY_INN',
    'ORDER_EXTRA_DRINKS',
    'WAIVE_CURRENT_REFILL_PAYMENT',
    'FORCE_SIMULTANEOUS_DRINK_FROM_INN',
    'FORCE_SIMULTANEOUS_DRINK',
    'CHARACTER_TEMPLATE',
    'QUEUE_EXTRA_DRINK',
    'FORCE_EXTRA_DRINK_FROM_TARGET_DRINK_ME',
    'PASS_CURRENT_DRINK',
    'SPLIT_CURRENT_DRINK',
    'REPLACE_DRINK_ALCOHOL_WITH_FORTITUDE',
    'MODIFY_DRINK',
    'REPLACE_CURRENT_DRINK_BASE_EFFECTS',
    'CHANGE_STAT',
    'TRANSFER_GOLD',
    'COLLECT_GOLD',
    'SPLIT_PENDING_FORTITUDE_LOSS_WITH_SOURCE',
    'REDIRECT_PENDING_FORTITUDE_LOSS',
    'IGNORE_CURRENT_SOURCE',
    'ADD_CHASER',
    'DRINKING_CONTEST',
    'ROUND_ON_HOUSE',
    'OPTIONAL_CHALLENGE',
  ]);
  const mechanicIds = new Set(mechanics.map((m) => m.id));
  function walk(value: unknown, path: string) {
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, `${path}.${i}`));
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, field] of Object.entries(object(value))) {
      if (key === 'op' && !knownOps.has(String(field)))
        errors.push(`Unrecognized source operation ${path}: ${String(field)}`);
      if (
        ['mechanicId', 'specialMechanicId', 'mechanicRef'].includes(key) &&
        !mechanicIds.has(field)
      )
        errors.push(
          `Unresolved mechanic reference ${path}.${key}: ${String(field)}`,
        );
      walk(field, `${path}.${key}`);
    }
  }
  [...mechanics, ...drinks].forEach((item) => walk(item, String(item.id)));
  if (drinks.length !== 23 || drinkEntries.length !== 23)
    errors.push(
      'Final source lock requires all 23 individually reviewed Drinks',
    );
  const evidenceSource = object(
    object(source.sources)[finalResolutionSourceId],
  );
  if (
    evidenceSource.authority !== 'PROJECT_RULE_OVERRIDE' ||
    evidenceSource.officialSourceVerified !== false ||
    evidenceSource.path !== finalResolutionPath ||
    evidenceSource.sha256 !== finalResolutionSha256
  )
    errors.push(
      'Final resolution must retain explicit user authority, prompt path and SHA256; no publisher attribution',
    );

  for (const [id, ledgerId, type, legality, effects, overrideKey, decision] of [
    [
      'collect_one_from_each_other',
      'M41',
      'ACTION',
      { mode: 'ACTION_PHASE' },
      [
        {
          op: 'TRANSFER_GOLD',
          from: 'EACH_OTHER_PLAYER',
          to: 'SELF',
          amount: 1,
        },
      ],
      'projectRulesetOverrides',
      m41Resolution,
    ],
    [
      'tip_wench',
      'M44',
      'ANYTIME',
      { mode: 'ANYTIME', target: 'ANY_LIVING_PLAYER' },
      [{ op: 'PAY_INN', target: 'CHOSEN_PLAYER', amount: 1 }],
      'physicalCopyProvenanceOverride',
      m44Resolution,
    ],
  ] as const) {
    const m = mechanics.find((m) => m.id === id),
      e = entries.find((e) => e.ledgerId === ledgerId);
    const gogCards = cards.filter((c) => c.mechanicId === id),
      gog = gogCards[0];
    if (
      !m ||
      !e ||
      m.cardType !== type ||
      !same(m.legality, legality) ||
      !same(m.effects, effects) ||
      object(m.verification).status !== 'VERIFIED_FOR_PROJECT_RULESET' ||
      e.status !== 'VERIFIED_FOR_PROJECT_RULESET' ||
      !same(m[overrideKey], decision) ||
      !same(e[overrideKey], decision) ||
      !same(object(e.review)[overrideKey], decision) ||
      gogCards.length !== 1 ||
      gog?.quantity !== 1 ||
      !same(gog.projectRuleOverride, decision)
    )
      errors.push(
        `${ledgerId} must retain the exact scoped override, standard shared mechanic and one Gog copy`,
      );
    const cv = object(object(m?.verification).characterVerification),
      g = object(cv.gog);
    if (!same(cv, e?.characterVerification))
      errors.push(`${ledgerId} source/ledger provenance mismatch`);
    if (ledgerId === 'M41') {
      if (
        g.printedCardIdentity !== 'UNAVAILABLE_WAIVED_BY_M41_USER_OVERRIDE' ||
        g.exactCardText !== 'UNAVAILABLE' ||
        g.normalizedSemantics !== 'PROJECT_RULE_OVERRIDE' ||
        g.officialSourceVerified !== false ||
        gog?.canonicalCardTitle !== undefined ||
        gog?.canonicalCardTitles !== undefined ||
        gog?.displayLabelProvenance !==
          'NORMALIZED_FALLBACK_NOT_PHYSICAL_TITLE' ||
        object(gog.display)['en-US'] !== 'Gog the Half-Ogre — Impress the Table'
      )
        errors.push(
          'M41 must keep Gog title non-physical and wording unavailable; no invented publisher evidence',
        );
      if (
        !same(object(m?.engineAudit).supportedBinding, {
          type: 'ACTION',
          effects: [
            { op: 'COLLECT_GOLD', target: 'EACH_OTHER_PLAYER', amount: 1 },
          ],
        })
      )
        errors.push('M41 must bind to shared incoming Gold collection');
    } else if (
      g.standardMechanic !== 'PUBLISHER_VERIFIED' ||
      g.officialPhysicalProvenanceVerified !== false ||
      g.physicalCopyProvenance !== m44Resolution.label ||
      gog?.canonicalCardTitle !== 'Tip the Wench.' ||
      m?.projectRulesetOverrides !== undefined
    )
      errors.push(
        'M44 must separate publisher gameplay from user-only Gog provenance',
      );
  }
  for (const expected of finalDrinkResolutions) {
    const d = drinks.find((d) => d.id === expected.id),
      e = drinkEntries.find((e) => e.ledgerId === expected.ledgerId);
    const decision = drinkResolution(expected.ledgerId);
    if (
      !d ||
      !e ||
      d.quantity !== 1 ||
      d.kind !== expected.kind ||
      d.canonicalCardTitle !== expected.title ||
      object(d.display)['en-US'] !== expected.title ||
      d.hasChaser !== false ||
      d.noAdditionalPrintedEffects !== true ||
      !same(d.effects, expected.effects) ||
      !same(
        d.traitReplacement,
        'traitReplacement' in expected ? expected.traitReplacement : undefined,
      ) ||
      !same(
        d.drinkSemantics,
        'drinkSemantics' in expected ? expected.drinkSemantics : undefined,
      ) ||
      d.builtInSplit !== undefined ||
      !same(d.projectRulesetOverride, decision) ||
      !same(object(e.review).projectRulesetOverride, decision) ||
      object(d.verification).status !== 'VERIFIED_FOR_PROJECT_RULESET' ||
      e.status !== 'VERIFIED_FOR_PROJECT_RULESET' ||
      object(d.verification).mechanicAuthority !==
        'EXPLICIT_USER_OVERRIDE_WITH_SEPARATE_PUBLISHER_SUPPORT'
    )
      errors.push(
        `${expected.ledgerId} must preserve its exact user-authorized record, replacement and response boundaries`,
      );
    if (
      !same(
        object(e?.review).evidenceClassification,
        object(d?.verification).evidenceClassification,
      ) ||
      !same(
        object(d?.verification).evidenceClassification,
        drinkEvidenceClassification(expected.ledgerId),
      )
    )
      errors.push(`${expected.ledgerId} evidence classification mismatch`);
  }
  return errors;
}

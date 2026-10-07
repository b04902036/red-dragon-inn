import { z } from 'zod';
import {
  teamModeDeferralAuthorized,
  verifyFinalResolutions,
} from './rdi2-final-resolution';

const text = z.string().trim().min(1);
const display = z.object({ 'en-US': text, 'zh-TW': text });
const types = z.enum([
  'ACTION',
  'SOMETIMES',
  'ANYTIME',
  'GAMBLING',
  'CHEATING',
]);
const counts = z.object({
  dimli: z.number().int().nonnegative(),
  eve: z.number().int().nonnegative(),
  fleck: z.number().int().nonnegative(),
  gog: z.number().int().nonnegative(),
});
const plan = z.array(z.looseObject({ op: text })).min(1);
const verification = z.looseObject({
  status: text,
  basis: z.array(text).min(1),
});
const override = z.object({
  sourceId: text,
  provenance: z.literal('PROJECT_RULE_OVERRIDE'),
  date: text,
  target: z.literal('ANY_ACTIVE_GAMBLER'),
  selfTarget: z.literal('ALLOWED'),
  officialSourceVerified: z.literal(false),
});
const m06OverridesSchema = z.object({
  sourceId: text,
  date: text,
  negatesCheatingCardRule: z.literal('PROJECT_RULE_OVERRIDE'),
  requiresActiveParticipation: z.literal('PROJECT_RULE_OVERRIDE'),
  officialSourceVerified: z.literal(false),
});
const m06FieldVerification = {
  quantity: 'VERIFIED',
  cardIdentity: 'VERIFIED',
  antiCheatClassification: 'VERIFIED',
  forcedLeaveResponseTiming: 'VERIFIED',
  winRoundEffect: 'VERIFIED',
  negatesCheatingCardRule: 'PROJECT_RULE_OVERRIDE',
  requiresActiveParticipation: 'PROJECT_RULE_OVERRIDE',
};
const m09OverridesSchema = z.object({
  sourceId: text,
  date: text,
  gogSemanticRule: z.literal('PROJECT_RULE_OVERRIDE'),
  appliesTo: z.literal('GOG_M09_TWO_CARDS'),
  sameNormalizedSemanticsAs: z.tuple([z.literal('dimli'), z.literal('fleck')]),
  noAdditionalCardSpecificRestrictions: z.literal(true),
  officialSourceVerified: z.literal(false),
});
const m09CharacterVerification = {
  dimli: {
    quantity: 'VERIFIED',
    exactSourceRecords: 'VERIFIED_ORIGINAL_JSON',
    semantics: 'VERIFIED',
  },
  fleck: {
    quantity: 'VERIFIED',
    exactSourceRecords: 'VERIFIED_ORIGINAL_JSON',
    semantics: 'VERIFIED',
  },
  gog: {
    quantity: 'VERIFIED',
    mechanicFamily: 'VERIFIED_SECONDARY_MATRIX',
    exactCardText: 'UNAVAILABLE',
    normalizedSemantics: 'PROJECT_RULE_OVERRIDE',
    officialSourceVerified: false,
  },
};
const m09FieldVerification = {
  trigger: 'VERIFIED',
  amountCurrentLossScope: 'VERIFIED_GENERIC_RULES',
  recipientPreservation: 'VERIFIED_GENERIC_RULES',
  anteBehavior: 'VERIFIED',
  theftTakeBehavior: 'VERIFIED_FROM_DIMLI_FLECK_SOURCE',
  ownCardPaymentLegality: 'VERIFIED_OFFICIAL_RULES',
  separatePaymentScope: 'VERIFIED_OFFICIAL_RULES',
};
const m09Legality = {
  mode: 'SYSTEM_RESPONSE',
  trigger: {
    systemEvent: 'GOLD_LOSS_REQUIRED',
    actor: 'SELF',
    covers: [
      'PAY_TO_INN',
      'PAY_TO_PLAYER',
      'ANTE_TO_POT',
      'GOLD_TAKEN_BY_OTHER_PLAYER',
    ],
    pending: true,
    timing: 'BEFORE_CURRENT_GOLD_TRANSFER_OR_ANTE_RESOLVES',
    excludeIfAny: [
      'GOLD_LOSS_UNAVOIDABLE',
      'PAYMENT_NON_SUBSTITUTABLE',
      'INN_PAYMENT_FORBIDDEN',
      'GOLD_LOSS_UNMITIGABLE',
    ],
  },
  allowsOwnCardPayment: true,
  respectSourceSpecificPaymentRules: true,
};
const m09Effects = [
  {
    op: 'SUBSTITUTE_CURRENT_GOLD_LOSS_FROM_INN',
    amount: 'ENTIRE_CURRENT_GOLD_LOSS_INSTANCE',
    source: 'INN',
    destination: 'ORIGINAL_DESTINATION',
    payerStashLoss: 0,
    scope: 'CURRENT_PAYMENT_OR_GOLD_LOSS_CONTEXT',
    satisfiesAnte: true,
    payerReceivesGold: false,
    innToInn: 'NO_NET_TRANSFER',
  },
];
const m12OverridesSchema = z.object({
  sourceId: z.literal('project_m12_gog_override_2026_10_05'),
  date: text,
  label: z.literal('M12 USER OVERRIDE'),
  provenance: z.literal('PROJECT_RULE_OVERRIDE'),
  scope: z.literal('GOG_ANTE_AVOIDANCE_TEMPLATES'),
  gogSecondTemplateRule: z.literal('PROJECT_RULE_OVERRIDE'),
  laterAnteResponseRule: z.literal('PROJECT_RULE_OVERRIDE'),
  officialSourceVerified: z.literal(false),
  templates: z.unknown(),
});
const m12CharacterVerification = {
  dimli: {
    quantity: 'VERIFIED',
    exactSourceRecords: 'VERIFIED_ORIGINAL_JSON',
    semantics: 'VERIFIED',
  },
  fleck: {
    quantity: 'VERIFIED',
    exactSourceRecords: 'VERIFIED_ORIGINAL_JSON',
    semantics: 'VERIFIED',
  },
  gog: {
    quantity: 'VERIFIED_SECONDARY_MATRIX',
    mechanicFamily: 'VERIFIED_SECONDARY_MATRIX',
    exactCardText: 'UNAVAILABLE',
    normalizedSemantics: 'PROJECT_RULE_OVERRIDE',
    officialSourceVerified: false,
  },
};
const m12FieldVerification = {
  quantity: 'VERIFIED_SECONDARY_MATRIX',
  initialAnteAvoidance: 'VERIFIED_OFFICIAL_EXAMPLE',
  gogSecondTemplateRule: 'PROJECT_RULE_OVERRIDE',
  laterAnteResponseRule: 'PROJECT_RULE_OVERRIDE',
  currentAnteOnly: 'VERIFIED_ORIGINAL_JSON_AND_USER_OVERRIDE',
  noPreviousAnteRefund: 'VERIFIED_OFFICIAL_RULES',
  postLeaveCardRestrictions: 'VERIFIED_OFFICIAL_RULES',
  futureAntesAfterLeaving: 'VERIFIED_OFFICIAL_RULES',
};
const m12Legality = {
  mode: 'SYSTEM_RESPONSE',
  trigger: {
    systemEvent: 'ANTE_REQUIRED',
    actor: 'SELF',
    pending: true,
    gamblingActive: true,
    selfStillParticipating: true,
    anteOrigin: 'ANY_ACTUAL_ANTE',
    excludeIfAny: ['ANTE_RESPONSES_FORBIDDEN'],
  },
};
const m12Effects = [
  { op: 'CANCEL_CURRENT_ANTE_FOR_SELF' },
  { op: 'LEAVE_GAMBLING', target: 'SELF' },
];
const m12Templates = {
  A: {
    mechanicId: 'avoid_ante_leave',
    cardKey: 'rdi2.gog.avoid_ante_leave',
    quantity: 2,
    type: 'SOMETIMES',
    legality: {
      mode: 'SYSTEM_RESPONSE',
      trigger: {
        systemEvent: 'ANTE_REQUIRED',
        actor: 'SELF',
        pending: true,
        gamblingActive: true,
        selfStillParticipating: true,
        anteOrigin: 'ANY_ACTUAL_ANTE',
        excludeIfAny: ['ANTE_RESPONSES_FORBIDDEN'],
      },
    },
    responseTrigger: {
      event: 'SYSTEM',
      alternatives: [
        [
          { kind: 'SYSTEM_EVENT', events: ['ANTE_REQUIRED'] },
          {
            kind: 'PAYMENT_CONTEXT',
            payer: 'SELF',
            purpose: 'ANTE',
            minAmount: 1,
          },
          { kind: 'GAMBLING', fact: 'PARTICIPANT' },
        ],
      ],
    },
    effects: [
      { op: 'CANCEL_CURRENT_ANTE_FOR_SELF' },
      { op: 'LEAVE_GAMBLING', target: 'SELF' },
    ],
  },
  B: {
    mechanicId: 'avoid_ante_leave_or_ignore_drink',
    cardKey: 'rdi2.gog.avoid_ante_leave_or_ignore_drink',
    quantity: 1,
    type: 'SOMETIMES',
    legality: {
      mode: 'MULTI_TRIGGER',
      triggers: [
        {
          systemEvent: 'ANTE_REQUIRED',
          actor: 'SELF',
          pending: true,
          gamblingActive: true,
          selfStillParticipating: true,
          anteOrigin: 'ANY_ACTUAL_ANTE',
          excludeIfAny: ['ANTE_RESPONSES_FORBIDDEN'],
        },
        {
          event: 'DRINK_PENDING',
          affects: 'SELF',
          kind: 'DRINK',
          wholeDrinkWithChasers: true,
        },
      ],
    },
    responseTrigger: {
      event: 'ANY',
      alternatives: [
        [
          { kind: 'SYSTEM_EVENT', events: ['ANTE_REQUIRED'] },
          {
            kind: 'PAYMENT_CONTEXT',
            payer: 'SELF',
            purpose: 'ANTE',
            minAmount: 1,
          },
          { kind: 'GAMBLING', fact: 'PARTICIPANT' },
        ],
        [
          { kind: 'SOURCE_KIND', kinds: ['DRINK'] },
          { kind: 'AFFECTS', relation: 'SELF' },
        ],
      ],
    },
    effects: [
      {
        op: 'CONTEXT_BRANCH',
        branches: ['CANCEL_ANTE_AND_LEAVE', 'IGNORE_CURRENT_DRINK'],
      },
    ],
  },
};
const m13CharacterVerification = {
  dimli: {
    quantity: 'VERIFIED',
    exactSourceRecords: 'VERIFIED_ORIGINAL_JSON',
    semantics: 'VERIFIED',
  },
  eve: {
    quantity: 'VERIFIED',
    exactSourceRecords: 'VERIFIED_ORIGINAL_JSON',
    semantics: 'VERIFIED',
  },
  fleck: {
    quantity: 'VERIFIED',
    exactSourceRecords: 'VERIFIED_ORIGINAL_JSON',
    semantics: 'VERIFIED',
  },
  gog: {
    quantity: 'VERIFIED_SECONDARY_MATRIX',
    mechanicFamily: 'VERIFIED_SECONDARY_MATRIX',
    exactCardText: 'UNAVAILABLE',
    normalizedSemantics: 'PROJECT_RULE_OVERRIDE',
    officialSourceVerified: false,
  },
};
const m13FieldVerification = {
  quantity: 'VERIFIED_SECONDARY_MATRIX',
  anteTrigger: 'VERIFIED_ORIGINAL_JSON_AND_USER_OVERRIDE',
  currentAnteOnly: 'VERIFIED_ORIGINAL_JSON_AND_USER_OVERRIDE',
  noPreviousAnteRefund: 'VERIFIED_OFFICIAL_RULES',
  drinkBranch: 'VERIFIED_ORIGINAL_JSON_AND_USER_OVERRIDE',
  wholeDrinkWithChasers: 'VERIFIED_OFFICIAL_RULES',
  affectedSelfOnly: 'VERIFIED_OFFICIAL_RULES',
  postLeaveRestrictions: 'VERIFIED_OFFICIAL_RULES',
  gogSemantics: 'PROJECT_RULE_OVERRIDE',
};
const m13Override = {
  sourceId: 'project_m12_gog_override_2026_10_05',
  label: 'M12 USER OVERRIDE',
  provenance: 'PROJECT_RULE_OVERRIDE',
  appliesTo: 'GOG_M13_ONE_CARD',
  template: 'B',
  officialSourceVerified: false,
};
const m14Legality = {
  mode: 'RESPONSE',
  trigger: {
    event: 'CARD_PENDING',
    sourceCardTypes: ['ACTION', 'SOMETIMES', 'ANYTIME'],
    directlyAffectsSelfAny: ['FORTITUDE', 'ALCOHOL', 'GOLD'],
    excludeRoundOfGambling: true,
    excludeOwnCardGoldPayment: true,
  },
};
const m15Override = {
  sourceId: 'project_m15_gog_override_2026_10_06',
  date: '2026-10-06',
  label: 'M15 USER OVERRIDE',
  provenance: 'PROJECT_RULE_OVERRIDE',
  appliesTo: 'GOG_M15_TWO_IDENTICAL_CARDS',
  normalizedSemantics: 'PROJECT_RULE_OVERRIDE',
  officialSourceVerified: false,
};
const m15Characters = {
  dimli: {
    quantity: 'VERIFIED_ORIGINAL_JSON',
    exactSourceRecord: 'VERIFIED_ORIGINAL_JSON',
    semantics: 'VERIFIED_ORIGINAL_JSON_AND_OFFICIAL_RULES',
  },
  eve: { quantity: 'VERIFIED_ABSENT_MATRIX' },
  fleck: { quantity: 'VERIFIED_ABSENT_MATRIX' },
  gog: {
    quantity: 'VERIFIED_USER_OVERRIDE_AND_SECONDARY_MATRIX',
    mechanicFamily: 'VERIFIED_SECONDARY_MATRIX_AND_OFFICIAL_EXAMPLE',
    cardIdentity: 'VERIFIED_OFFICIAL_EXAMPLE',
    exactCardText: 'UNAVAILABLE',
    normalizedSemantics: 'PROJECT_RULE_OVERRIDE',
    officialSourceVerified: false,
  },
};
const m15Legality = {
  mode: 'RESPONSE',
  trigger: {
    event: 'CARD_PENDING',
    sourceCardTypes: ['ACTION', 'SOMETIMES', 'ANYTIME'],
    directlyAffectsSelf: 'FORTITUDE',
  },
};
const m15Binding = {
  responseTrigger: {
    event: 'CARD',
    alternatives: [
      [
        { kind: 'SOURCE_TYPE', types: ['ACTION', 'SOMETIMES', 'ANYTIME'] },
        {
          kind: 'PENDING_STAT',
          stat: 'FORTITUDE',
          direction: 'ANY',
          relation: 'SELF',
        },
      ],
    ],
  },
  effects: [{ op: 'IGNORE', scope: 'CURRENT_EFFECT' }],
};
const m15Fields = {
  quantity: 'VERIFIED_PER_CHARACTER',
  dimliExactTemplate: 'VERIFIED_ORIGINAL_JSON_AND_OFFICIAL_RULES',
  gogExactTemplate: 'PROJECT_RULE_OVERRIDE',
  sourceCategories: 'VERIFIED_DIMLI_AND_PROJECT_RULE_OVERRIDE_GOG',
  directSelfFortitude: 'VERIFIED_SHARED_RULES_AND_PROJECT_RULE_OVERRIDE',
  ignoreAllSourceEffectsOnSelf: 'VERIFIED_OFFICIAL_IGNORE_RULES',
  otherTargetsResolve: 'VERIFIED_OFFICIAL_IGNORE_RULES',
  negatableResponse: 'VERIFIED_OFFICIAL_EXAMPLE',
  bothGogCopiesIdentical: 'PROJECT_RULE_OVERRIDE',
};
const m16Binding = {
  responseTrigger: {
    event: 'CARD',
    alternatives: [
      [
        { kind: 'SOURCE_TYPE', types: ['SOMETIMES'] },
        { kind: 'NEGATABLE', value: true },
      ],
    ],
  },
  effects: [{ op: 'NEGATE', scope: 'TOP_STACK' }],
  counterFamily: 'rdi.negate_sometimes',
  counterPolicy: 'SAME_FAMILY_ONLY',
};
const m18Override = {
  sourceId: 'project_m18_gog_override_2026_10_06',
  date: '2026-10-06',
  label: 'M18 USER OVERRIDE',
  provenance: 'PROJECT_RULE_OVERRIDE',
  appliesTo: 'GOG_M18_TWO_STANDARD_COPIES',
  gogOwnership: 'PROJECT_RULE_OVERRIDE',
  gogQuantity: 'PROJECT_RULE_OVERRIDE',
  bothGogCopiesUseStandardMechanic: 'PROJECT_RULE_OVERRIDE',
  officialSourceVerified: false,
};
const m18Characters = {
  dimli: {
    quantity: 'VERIFIED_ORIGINAL_JSON',
    exactSourceRecords: 'VERIFIED_ORIGINAL_JSON',
    semantics: 'VERIFIED_ORIGINAL_JSON_AND_OFFICIAL_RULES',
  },
  eve: {
    quantity: 'VERIFIED_ORIGINAL_JSON',
    exactSourceRecords: 'VERIFIED_ORIGINAL_JSON',
    semantics: 'VERIFIED_ORIGINAL_JSON_AND_OFFICIAL_RULES',
  },
  fleck: { quantity: 'VERIFIED_ABSENT_MATRIX' },
  gog: {
    ownership: 'PROJECT_RULE_OVERRIDE',
    quantity: 'PROJECT_RULE_OVERRIDE',
    copiesUseStandardMechanic: 'PROJECT_RULE_OVERRIDE',
    exactGogCardProvenance: 'UNAVAILABLE',
    standardCardMechanic: 'VERIFIED_PUBLISHER_STANDARD_CARD',
    normalizedSemantics: 'VERIFIED_PUBLISHER_STANDARD_CARD_AND_CURRENT_RULES',
    gogSpecificProvenancePublisherVerified: false,
    mechanicPublisherSupported: true,
  },
};
const m18Fields = {
  cardType: 'VERIFIED_PUBLISHER_STANDARD_CARD',
  phaseTiming: 'VERIFIED_PUBLISHER_STANDARD_CARD_AND_CURRENT_RULES',
  paymentAmountRecipient: 'VERIFIED_PUBLISHER_STANDARD_CARD',
  extraDrinkCount: 'VERIFIED_PUBLISHER_STANDARD_CARD',
  faceDownOtherPlayerDistribution: 'VERIFIED_CURRENT_OFFICIAL_RULES',
  gogOwnership: 'PROJECT_RULE_OVERRIDE',
  gogQuantity: 'PROJECT_RULE_OVERRIDE',
  bothGogCopiesUseStandardMechanic: 'PROJECT_RULE_OVERRIDE',
};
const m18Legality = {
  mode: 'PHASE_OPPORTUNITY',
  phase: 'ORDER_DRINK',
  actor: 'SELF',
};
const m18Effects = [
  { op: 'PAY_INN', target: 'SELF', amount: 1 },
  { op: 'ORDER_EXTRA_DRINKS', count: 2, targets: 'OTHER_PLAYERS' },
];
const m18Binding = {
  phaseOpportunity: 'ORDER_DRINK',
  mandatoryGoldCost: 1,
  responseTrigger: {
    event: 'SYSTEM',
    alternatives: [
      [
        { kind: 'SYSTEM_EVENT', events: ['PHASE_OPPORTUNITY'] },
        { kind: 'PHASE_OPPORTUNITY', phase: 'ORDER_DRINK', actor: 'SELF' },
      ],
    ],
  },
  effects: [{ op: 'ORDER_EXTRA_DRINKS', count: 2 }],
};
const m19Legality = {
  mode: 'MULTI_TRIGGER',
  triggers: [
    { context: 'ORDER_TWO_EXTRA_FREE', phase: 'ORDER_DRINK', actor: 'SELF' },
    {
      context: 'WAIVE_SELF_REFILL_PAYMENT',
      systemEvent: 'DRINK_DECK_REFILL_PAYMENT',
      actor: 'SELF',
      pending: true,
      timing: 'BEFORE_SELF_REFILL_PAYMENT',
      paymentAmount: 1,
      paymentRecipient: 'INN',
    },
  ],
};
const m19Effects = [
  {
    op: 'CONTEXT_BRANCH',
    branches: [
      {
        when: 'ORDER_TWO_EXTRA_FREE',
        effects: [
          {
            op: 'ORDER_EXTRA_DRINKS',
            count: 2,
            targets: 'OTHER_PLAYERS',
            faceDown: true,
            payment: 0,
          },
        ],
      },
      {
        when: 'WAIVE_SELF_REFILL_PAYMENT',
        effects: [
          {
            op: 'WAIVE_CURRENT_REFILL_PAYMENT',
            target: 'SELF',
            amount: 1,
            recipient: 'INN',
            scope: 'CURRENT_REFILL_PAYMENT',
          },
        ],
      },
    ],
  },
];
const m19Characters = {
  dimli: { quantity: 'VERIFIED_ABSENT_ORIGINAL_JSON_AND_MATRIX' },
  eve: { quantity: 'VERIFIED_ABSENT_ORIGINAL_JSON_AND_MATRIX' },
  fleck: {
    quantity: 'VERIFIED_ORIGINAL_JSON',
    exactSourceRecords: 'VERIFIED_ORIGINAL_JSON',
    semantics: 'VERIFIED_ORIGINAL_JSON_AND_OFFICIAL_RULES',
  },
  gog: { quantity: 'VERIFIED_ABSENT_MATRIX' },
};
const m20Characters = {
  dimli: { quantity: 'VERIFIED_ABSENT_ORIGINAL_JSON_AND_MATRIX' },
  eve: { quantity: 'VERIFIED_ABSENT_ORIGINAL_JSON_AND_MATRIX' },
  fleck: {
    quantity: 'VERIFIED_ORIGINAL_JSON',
    exactSourceRecord: 'VERIFIED_ORIGINAL_JSON',
    semantics: 'VERIFIED_ORIGINAL_JSON_AND_OFFICIAL_RULES',
  },
  gog: { quantity: 'VERIFIED_ABSENT_MATRIX' },
};
const m20Semantics = {
  recipients: 'ALL_LIVING_PLAYERS_INCLUDING_SELF',
  source: 'INN_DRINK_DECK',
  drawMode: 'SEPARATE_DRINK_PER_PLAYER',
  skipLeadingDrinkEvents: true,
  chasers: 'STANDARD_SAME_SOURCE_COMPLETE_BEFORE_RESPONSES',
  responses: 'INDEPENDENT_PER_DRINK',
  settlement: 'SIMULTANEOUS_AFTER_ALL_RESPONSES',
  contest: false,
  copiesSingleDrink: false,
};
const m21Override = {
  sourceId: 'project_m21_gog_override_2026_10_06',
  provenance: 'PROJECT_RULE_OVERRIDE',
  label: 'M21 USER OVERRIDE',
  scope: 'GOG_M21_TWO_COPIES_ONLY',
  date: '2026-10-06',
  officialSourceVerified: false,
};
const m21DimliLegality = {
  mode: 'PHASE_OPPORTUNITY',
  phase: 'DRINK',
  phaseOwner: 'OTHER',
};
const m21DimliEffects = [
  {
    op: 'QUEUE_EXTRA_DRINK',
    target: 'PHASE_OWNER',
    source: 'DRINK_ME_PILE',
    separateDrink: true,
  },
];
const m21GogLegality = {
  mode: 'RESPONSE',
  trigger: {
    event: 'DRINK_REVEALED',
    sourceActor: 'OTHER_PLAYER',
    sourceCardType: 'DRINK',
    chasersComplete: true,
    includesDrinkingContest: true,
  },
  target: 'SOURCE_ACTOR',
  selfTarget: 'FORBIDDEN',
  teamTargeting: 'SHARED_ANOTHER_PLAYER_RULE',
};
const m21GogEffects = [
  {
    op: 'FORCE_EXTRA_DRINK_FROM_TARGET_DRINK_ME',
    target: 'SOURCE_ACTOR',
    source: 'TARGET_OWN_DRINK_ME_PILE',
    count: 1,
    independentDrink: true,
    contestEntry: false,
  },
];
const m21GogBinding = {
  responseTrigger: {
    event: 'DRINK',
    alternatives: [
      [
        { kind: 'SOURCE_ACTOR', relation: 'OTHER' },
        { kind: 'SOURCE_TYPE', types: ['DRINK'] },
      ],
    ],
  },
  effects: [{ op: 'QUEUE_EXTRA_DRINK', target: 'SOURCE_ACTOR' }],
};
const m21Templates = {
  dimli: { legality: m21DimliLegality, effects: m21DimliEffects },
  gog: {
    legality: m21GogLegality,
    effects: m21GogEffects,
    sharedImplementation: m21GogBinding,
  },
};
const m21Fields = {
  cardIdentity: 'VERIFIED_OFFICIAL_NAMED_EXAMPLE',
  chosenPlayerDrinksAgain: 'VERIFIED_OFFICIAL_NAMED_EXAMPLE',
  teamExampleAffectsOnlyChosenPlayer: 'VERIFIED_OFFICIAL_NAMED_EXAMPLE',
  sharedDrinkChaserEmptyPileAndCounterRules: 'VERIFIED_OFFICIAL_RULES',
  teamTargeting: 'VERIFIED_OFFICIAL_RULES',
  gog: {
    trigger: 'PROJECT_RULE_OVERRIDE',
    contestTrigger: 'PROJECT_RULE_OVERRIDE',
    source: 'PROJECT_RULE_OVERRIDE',
    amount: 'PROJECT_RULE_OVERRIDE',
    target: 'PROJECT_RULE_OVERRIDE',
    independentDrink: 'PROJECT_RULE_OVERRIDE',
    contestEntry: 'PROJECT_RULE_OVERRIDE',
    quantityAndIdenticalCopies: 'PROJECT_RULE_OVERRIDE',
  },
};
function verifiedStatus(item: {
  status: string;
  mechanicId?: string;
  id?: string;
  drinkId?: string;
}) {
  return (
    item.status === 'VERIFIED' ||
    (item.status === 'VERIFIED_FOR_PROJECT_RULESET' &&
      [
        'anti_cheat_win_round',
        'substitute_payment_from_inn',
        'avoid_ante_leave',
        'avoid_ante_leave_or_ignore_drink',
        'ignore_card_fortitude',
        'order_two_extra_drinks_paid',
        'force_extra_drink_during_other_drink_phase',
        'negate_drink_change_card',
        'damage_two',
        'hit_back_two_after_loss',
        'gain_two_fortitude',
        'collect_one_from_each_other',
        'tip_wench',
      ].includes(item.mechanicId ?? item.id ?? '')) ||
    (item.status === 'VERIFIED_FOR_PROJECT_RULESET' &&
      [
        'fine_ambrosia',
        'dirty_dishwater',
        'ogre_brew',
        'orcish_rotgut',
        'the_challenge',
        'troll_swill',
        'water',
        'cutting_off',
        'wizards_brew',
      ].includes(item.drinkId ?? item.id ?? ''))
  );
}
export const rdi2SourceSchema = z.looseObject({
  sources: z.record(z.string(), z.unknown()),
  characters: z.array(
    z.looseObject({
      id: z.enum(['dimli', 'eve', 'fleck', 'gog']),
      display,
      primaryDeckPhysicalCount: z.number().int(),
      cards: z.array(
        z.object({
          cardKey: text,
          mechanicId: text,
          canonicalCardTitle: text.optional(),
          canonicalCardTitles: z.array(text).min(1).optional(),
          displayLabelProvenance: text.optional(),
          quantity: z.number().int().positive(),
          type: types,
          display,
          rulesSummary: display,
          projectRuleOverride: z.unknown().optional(),
        }),
      ),
    }),
  ),
  mechanics: z.array(
    z.looseObject({
      id: text,
      cardType: types,
      display,
      rulesSummary: display,
      legality: z.record(z.string(), z.unknown()),
      effects: plan,
      verification,
      projectRuleOverride: override.optional(),
    }),
  ),
  drinkDeck: z.object({
    physicalCount: z.number().int(),
    cards: z.array(
      z.looseObject({
        id: text,
        quantity: z.number().int().positive(),
        kind: z.enum(['DRINK', 'DRINK_EVENT']),
        display,
        effects: z.array(z.looseObject({ op: text })),
        verification,
      }),
    ),
  }),
  candidateValidation: z.looseObject({ knownHardBlockers: z.array(text) }),
});
const sourceSchema = rdi2SourceSchema;
const reviewSchema = z.looseObject({
  evidence: z.array(z.looseObject({ id: text, sourceId: text })).min(1),
  checks: z.array(
    z.object({
      check: text,
      result: z.literal('PASS'),
      finding: text,
      evidence: z.array(text).min(1),
    }),
  ),
});
const ledgerSchema = z.object({
  characterMechanics: z.array(
    z.looseObject({
      ledgerId: text,
      mechanicId: text,
      counts,
      candidateType: types,
      status: text,
      review: z.unknown().optional(),
    }),
  ),
  drinks: z.array(
    z.looseObject({
      ledgerId: text,
      drinkId: text,
      quantity: z.number().int().positive(),
      candidateKind: z.enum(['DRINK', 'DRINK_EVENT']),
      status: text,
      review: z.unknown().optional(),
    }),
  ),
});
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
const lockSchema = z.object({
  normalizedSha256: z.string().regex(/^[a-f0-9]{64}$/),
  ledgerSha256: z.string().regex(/^[a-f0-9]{64}$/),
  matrixSha256: z.string().regex(/^[a-f0-9]{64}$/),
  date: text,
  sourceVersionIdentifiers: z.array(text).min(1),
  verifiedMechanicRows: z.literal(44),
  characterPhysicalCards: z.literal(160),
  drinkPhysicalCards: z.literal(30),
  unresolvedCount: z.literal(0),
});

/** Read the supplied, unquoted nine-column matrix; fail closed on other formats. */
function matrixRows(csv: string) {
  const rows = csv
    .replace(/^\uFEFF/, '')
    .trim()
    .split(/\r?\n/)
    .map((row) => row.split(','));
  const header = [
    'mechanic_id',
    'type',
    'en-US',
    'zh-TW',
    'dimli',
    'eve',
    'fleck',
    'gog',
    'verification_basis',
  ];
  if (
    JSON.stringify(rows.shift()) !== JSON.stringify(header) ||
    rows.length !== 44 ||
    rows.some(
      (row) => row.length !== 9 || row.some((cell) => cell.includes('"')),
    )
  )
    throw new Error('Invalid RDI2 matrix header, row count or format');
  return rows.map((row) => ({
    id: row[0]!,
    type: row[1]!,
    display: { 'en-US': row[2]!, 'zh-TW': row[3]! },
    counts: Object.fromEntries(
      ['dimli', 'eve', 'fleck', 'gog'].map((id, i) => {
        const quantity = row[i + 4]!;
        if (!/^\d+$/.test(quantity))
          throw new Error('Invalid RDI2 matrix quantity');
        return [id, Number(quantity)];
      }),
    ),
  }));
}

/** A source gate only: never repairs, verifies an item, writes a lock, or imports content. */
export function verifyRdi2Source(
  input: unknown,
  ledgerInput: unknown,
  matrix: string,
  lockInput: unknown,
  hashes: {
    normalizedSha256: string;
    ledgerSha256: string;
    matrixSha256: string;
  },
) {
  const errors: string[] = [];
  const parsed = sourceSchema.safeParse(input);
  const parsedLedger = ledgerSchema.safeParse(ledgerInput);
  if (!parsed.success || !parsedLedger.success)
    return {
      valid: false,
      errors: [
        'Invalid RDI2 source/ledger schema or missing bilingual presentation',
        ...(!parsed.success
          ? parsed.error.issues.map(
              (issue) => `source.${issue.path.join('.')}: ${issue.message}`,
            )
          : []),
        ...(!parsedLedger.success
          ? parsedLedger.error.issues.map(
              (issue) => `ledger.${issue.path.join('.')}: ${issue.message}`,
            )
          : []),
      ],
      counts: null,
    };
  const source = parsed.data,
    ledger = parsedLedger.data;
  errors.push(...verifyFinalResolutions(input, ledgerInput));
  let rows: ReturnType<typeof matrixRows>;
  try {
    rows = matrixRows(matrix);
  } catch (error) {
    return { valid: false, errors: [(error as Error).message], counts: null };
  }
  const unique = (ids: string[], label: string) => {
    if (new Set(ids).size !== ids.length) errors.push(`Duplicate ${label}`);
  };
  unique(
    source.mechanics.map((m) => m.id),
    'mechanic ID',
  );
  unique(
    source.characters.map((c) => c.id),
    'character ID',
  );
  unique(
    source.characters.flatMap((c) => c.cards.map((card) => card.cardKey)),
    'card key',
  );
  unique(
    source.drinkDeck.cards.map((d) => d.id),
    'Drink ID',
  );
  unique(
    rows.map((row) => row.id),
    'matrix mechanic ID',
  );
  unique(
    [...ledger.characterMechanics, ...ledger.drinks].map((e) => e.ledgerId),
    'ledger ID',
  );
  unique(
    ledger.characterMechanics.map((e) => e.mechanicId),
    'ledger mechanic ID',
  );
  unique(
    ledger.drinks.map((e) => e.drinkId),
    'ledger Drink ID',
  );
  if (source.mechanics.length !== 44 || ledger.characterMechanics.length !== 44)
    errors.push('Exactly 44 mechanic rows required');
  const characterTotals = Object.fromEntries(
    source.characters.map((c) => [
      c.id,
      c.cards.reduce((total, card) => total + card.quantity, 0),
    ]),
  );
  const characterPhysical = Object.values(characterTotals).reduce(
    (sum, n) => sum + n,
    0,
  );
  if (source.characters.length !== 4 || characterPhysical !== 160)
    errors.push('Exactly four characters and 160 physical cards required');
  for (const c of source.characters) {
    if (characterTotals[c.id] !== 40 || c.primaryDeckPhysicalCount !== 40)
      errors.push(`Wrong physical deck quantity ${c.id}`);
    unique(
      c.cards.map((card) => card.mechanicId),
      `character mechanic ${c.id}`,
    );
    for (const card of c.cards) {
      const mechanic = source.mechanics.find((m) => m.id === card.mechanicId);
      if (!mechanic) errors.push(`Missing mechanic ${card.mechanicId}`);
      else if (
        card.type !== mechanic.cardType ||
        JSON.stringify(card.rulesSummary) !==
          JSON.stringify(
            z.record(text, display).safeParse(mechanic.characterRulesSummary)
              .data?.[c.id] ?? mechanic.rulesSummary,
          )
      )
        errors.push(`Card type/summary mismatch ${card.cardKey}`);
    }
  }
  const drinkPhysical = source.drinkDeck.cards.reduce(
    (sum, d) => sum + d.quantity,
    0,
  );
  if (drinkPhysical !== 30 || source.drinkDeck.physicalCount !== 30)
    errors.push('Wrong Drink physical quantity; expected 30');
  if (source.candidateValidation.knownHardBlockers.length)
    errors.push(
      `Unresolved source conflicts: ${source.candidateValidation.knownHardBlockers.join(', ')}`,
    );
  if (
    /\b(?:UNKNOWN|TODO|ASSUMED|GUESSED)\b/.test(
      JSON.stringify([input, ledgerInput]),
    )
  )
    errors.push('Forbidden unknown/TODO/ASSUMED/GUESSED marker');

  function review(
    entry: {
      ledgerId: string;
      status: string;
      mechanicId?: string;
      drinkId?: string;
      review?: unknown;
    },
    required: string[],
  ) {
    if (!verifiedStatus(entry)) {
      errors.push(`Unverified ledger item ${entry.ledgerId}: ${entry.status}`);
      return;
    }
    const checked = reviewSchema.safeParse(entry.review);
    if (!checked.success) {
      errors.push(`Missing complete review ${entry.ledgerId}`);
      return;
    }
    const r = checked.data;
    if (
      JSON.stringify(r.checks.map((check) => check.check)) !==
      JSON.stringify(required)
    )
      errors.push(`Incomplete per-item checks ${entry.ledgerId}`);
    for (const evidence of r.evidence)
      if (!Object.hasOwn(source.sources, evidence.sourceId))
        errors.push(`Missing evidence source ${evidence.sourceId}`);
    for (const check of r.checks)
      if (check.evidence.some((id) => !r.evidence.some((e) => e.id === id)))
        errors.push(`Missing check evidence ${entry.ledgerId}`);
  }
  for (const m of source.mechanics) {
    const row = rows.find((r) => r.id === m.id);
    const entry = ledger.characterMechanics.find((e) => e.mechanicId === m.id);
    if (!row || !entry) {
      errors.push(`Missing matrix/ledger mechanic ${m.id}`);
      continue;
    }
    if (row.type !== m.cardType || entry.candidateType !== m.cardType)
      errors.push(`Wrong card type ${m.id}`);
    if (
      JSON.stringify(row.display) !==
      JSON.stringify(m.matrixDisplay ?? m.display)
    )
      errors.push(`Matrix presentation mismatch ${m.id}`);
    if (
      m.matrixDisplay !== undefined &&
      (typeof m.canonicalCardTitle !== 'string' ||
        m.display['en-US'] !== m.canonicalCardTitle)
    )
      errors.push(`Canonical card title presentation mismatch ${m.id}`);
    for (const id of ['dimli', 'eve', 'fleck', 'gog'] as const) {
      const quantity =
        source.characters
          .find((c) => c.id === id)
          ?.cards.find((card) => card.mechanicId === m.id)?.quantity ?? 0;
      if (quantity !== row.counts[id] || quantity !== entry.counts[id])
        errors.push(`Wrong row distribution ${id}/${m.id}`);
    }
    review(entry, mechanicChecks);
    if (!verifiedStatus({ id: m.id, status: m.verification.status }))
      errors.push(`Unverified mechanic ${m.id}`);
    if (
      verifiedStatus(entry) &&
      entry.review !== null &&
      typeof entry.review === 'object'
    ) {
      const r = entry.review as {
        legality?: unknown;
        effects?: unknown;
        counts?: unknown;
        cardType?: unknown;
        drinkSemantics?: unknown;
        engineAudit?: unknown;
        characterRulesSummary?: unknown;
      };
      if (
        JSON.stringify(r.legality) !== JSON.stringify(m.legality) ||
        JSON.stringify(r.effects) !== JSON.stringify(m.effects) ||
        JSON.stringify(r.counts) !== JSON.stringify(entry.counts) ||
        r.cardType !== m.cardType ||
        JSON.stringify(r.drinkSemantics) !== JSON.stringify(m.drinkSemantics) ||
        JSON.stringify(r.engineAudit) !== JSON.stringify(m.engineAudit) ||
        JSON.stringify(r.characterRulesSummary) !==
          JSON.stringify(m.characterRulesSummary)
      )
        errors.push(`Reviewed mechanic changed ${entry.ledgerId}`);
    }
    if (m.cardType === 'SOMETIMES') {
      const legality = m.legality;
      const populated = (value: unknown) =>
        value !== null &&
        typeof value === 'object' &&
        Object.keys(value).length > 0;
      const structured = (value: Record<string, unknown>) =>
        populated(value.trigger) ||
        (Array.isArray(value.triggers) &&
          value.triggers.length > 0 &&
          value.triggers.every(populated)) ||
        (value.mode === 'GAMBLING_CHECKPOINT' && populated(value.requires)) ||
        (value.mode === 'PHASE_OPPORTUNITY' &&
          typeof value.phase === 'string' &&
          value.phase.length > 0);
      const templates = z
        .record(text, z.record(text, z.unknown()))
        .safeParse(legality.templates);
      const alternatives = z
        .array(z.record(text, z.unknown()))
        .min(1)
        .safeParse(legality.alternatives);
      if (
        !structured(legality) &&
        !(alternatives.success && alternatives.data.every(structured)) &&
        !(
          legality.mode === 'CHARACTER_TEMPLATES' &&
          templates.success &&
          Object.keys(templates.data).length > 0 &&
          Object.values(templates.data).every(structured)
        )
      )
        errors.push(`Missing structured Sometimes trigger ${m.id}`);
    }
  }
  for (const entry of ledger.drinks) {
    const drink = source.drinkDeck.cards.find((d) => d.id === entry.drinkId);
    if (!drink) {
      errors.push(`Missing Drink ${entry.drinkId}`);
      continue;
    }
    if (drink.quantity !== entry.quantity || drink.kind !== entry.candidateKind)
      errors.push(`Drink quantity/type mismatch ${entry.drinkId}`);
    review(entry, drinkChecks);
    if (
      !verifiedStatus({ drinkId: drink.id, status: drink.verification.status })
    )
      errors.push(`Unverified Drink ${drink.id}`);
    if (verifiedStatus(entry) && drink.verification.ledgerId !== undefined) {
      const r = entry.review as Record<string, unknown> | undefined;
      for (const key of [
        'quantity',
        'kind',
        'effects',
        'traitReplacement',
        'builtInSplit',
        'drinkSemantics',
      ] as const)
        if (JSON.stringify(r?.[key]) !== JSON.stringify(drink[key]))
          errors.push(`Reviewed Drink changed ${entry.ledgerId}/${key}`);
    }
  }
  for (const drink of source.drinkDeck.cards)
    if (!ledger.drinks.some((e) => e.drinkId === drink.id))
      errors.push(`Missing Drink ledger ${drink.id}`);

  const effect = (id: string, stat: string, delta: number) =>
    source.mechanics
      .find((m) => m.id === id)
      ?.effects.some(
        (e) => e.op === 'CHANGE_STAT' && e.stat === stat && e.delta === delta,
      );
  if (
    !effect('give_two_alcohol', 'ALCOHOL', 2) ||
    !effect('damage_three', 'FORTITUDE', -3)
  )
    errors.push('Stale Eve numeric values');
  const defense = source.mechanics.find((m) => m.id === 'ignore_card_all_stats')
    ?.legality.trigger as { directlyAffectsSelfAny?: unknown } | undefined;
  if (
    JSON.stringify(defense?.directlyAffectsSelfAny) !==
    JSON.stringify(['FORTITUDE', 'ALCOHOL', 'GOLD'])
  )
    errors.push('Stale Eve defensive illusion');
  const coin = source.mechanics.find((m) => m.id === 'illusionary_payment');
  if (
    JSON.stringify(coin?.effects) !==
    JSON.stringify([
      {
        op: 'PREVENT_CURRENT_GOLD_LOSS',
        goldMovement: 'NONE',
        anteCountsAsSatisfied: true,
        scope: 'CURRENT_PAYMENT_OR_GOLD_LOSS_CONTEXT',
      },
    ])
  )
    errors.push(
      'Illusionary Coin must move no Gold and still satisfy the current ante',
    );
  const eject = source.mechanics.find(
    (m) => m.id === 'cheat_control_and_eject',
  );
  if (
    eject &&
    (eject.legality.target !== 'ANY_ACTIVE_GAMBLER' ||
      eject.legality.selfTarget !== 'ALLOWED' ||
      !eject.projectRuleOverride ||
      !Object.hasOwn(source.sources, eject.projectRuleOverride.sourceId))
  )
    errors.push(
      'M05 self-target must preserve explicit PROJECT_RULE_OVERRIDE provenance',
    );
  const antiCheat = source.mechanics.find(
    (m) => m.id === 'anti_cheat_win_round',
  );
  const antiEntry = ledger.characterMechanics.find(
    (e) => e.mechanicId === 'anti_cheat_win_round',
  );
  if (
    antiCheat &&
    antiEntry &&
    (antiCheat.verification.status === 'VERIFIED_FOR_PROJECT_RULESET' ||
      antiEntry.status === 'VERIFIED_FOR_PROJECT_RULESET' ||
      antiCheat.projectRulesetOverrides !== undefined)
  ) {
    const project = m06OverridesSchema.safeParse(
      antiCheat.projectRulesetOverrides,
    );
    const r = z.record(z.string(), z.unknown()).safeParse(antiEntry.review);
    const evidenceSource = project.success
      ? source.sources[project.data.sourceId]
      : undefined;
    const origin = z
      .object({
        kind: z.literal('PROJECT_RULE_OVERRIDE'),
        officialSourceVerified: z.literal(false),
      })
      .safeParse(evidenceSource);
    if (
      antiCheat.verification.status !== 'VERIFIED_FOR_PROJECT_RULESET' ||
      antiEntry.status !== 'VERIFIED_FOR_PROJECT_RULESET' ||
      !project.success ||
      !r.success ||
      !origin.success ||
      JSON.stringify(antiCheat.projectRulesetOverrides) !==
        JSON.stringify(r.data.projectRulesetOverrides) ||
      [
        antiCheat.verification.fieldVerification,
        antiEntry.fieldVerification,
        r.data.fieldVerification,
      ].some(
        (value) =>
          JSON.stringify(value) !== JSON.stringify(m06FieldVerification),
      )
    )
      errors.push(
        'M06 project ruleset must preserve both exact-wording PROJECT_RULE_OVERRIDE fields and matching review/source provenance',
      );
    if (
      JSON.stringify(antiCheat.legality) !==
        JSON.stringify({
          mode: 'RESPONSE',
          trigger: {
            event: 'CARD_PENDING',
            sourceCardType: 'CHEATING',
            gamblingActive: true,
            selfStillParticipating: true,
          },
        }) ||
      JSON.stringify(antiCheat.effects) !==
        JSON.stringify([
          { op: 'NEGATE_CURRENT_SOURCE' },
          { op: 'WIN_GAMBLING', winner: 'SELF' },
        ])
    )
      errors.push(
        'M06 project trigger/effects differ from the explicit project ruleset',
      );
  }
  const payment = source.mechanics.find(
    (m) => m.id === 'substitute_payment_from_inn',
  );
  const paymentEntry = ledger.characterMechanics.find(
    (e) => e.mechanicId === 'substitute_payment_from_inn',
  );
  if (
    payment &&
    paymentEntry &&
    (payment.verification.status === 'VERIFIED_FOR_PROJECT_RULESET' ||
      paymentEntry.status === 'VERIFIED_FOR_PROJECT_RULESET' ||
      payment.projectRulesetOverrides !== undefined ||
      payment.verification.characterVerification !== undefined ||
      paymentEntry.characterVerification !== undefined)
  ) {
    const project = m09OverridesSchema.safeParse(
      payment.projectRulesetOverrides,
    );
    const r = z.record(z.string(), z.unknown()).safeParse(paymentEntry.review);
    const origin = z
      .object({
        kind: z.literal('PROJECT_RULE_OVERRIDE'),
        officialSourceVerified: z.literal(false),
      })
      .safeParse(
        project.success ? source.sources[project.data.sourceId] : undefined,
      );
    if (
      payment.verification.status !== 'VERIFIED_FOR_PROJECT_RULESET' ||
      paymentEntry.status !== 'VERIFIED_FOR_PROJECT_RULESET' ||
      !project.success ||
      !r.success ||
      !origin.success ||
      JSON.stringify(payment.projectRulesetOverrides) !==
        JSON.stringify(r.data.projectRulesetOverrides) ||
      [payment.verification, paymentEntry, r.data].some(
        (item) =>
          JSON.stringify(item.characterVerification) !==
            JSON.stringify(m09CharacterVerification) ||
          JSON.stringify(item.fieldVerification) !==
            JSON.stringify(m09FieldVerification),
      )
    )
      errors.push(
        'M09 must preserve original Dimli/Fleck verification and explicit Gog PROJECT_RULE_OVERRIDE provenance; Gog exact text remains UNAVAILABLE',
      );
    if (
      JSON.stringify(payment.legality) !== JSON.stringify(m09Legality) ||
      JSON.stringify(payment.effects) !== JSON.stringify(m09Effects)
    )
      errors.push(
        'M09 trigger/effects must preserve current-loss scope, whole instance amount, original destination, own-card legality and source restrictions',
      );
  }
  const anteAvoidance = source.mechanics.find(
    (m) => m.id === 'avoid_ante_leave',
  );
  const anteEntry = ledger.characterMechanics.find(
    (e) => e.mechanicId === 'avoid_ante_leave',
  );
  if (
    anteAvoidance &&
    anteEntry &&
    (anteAvoidance.verification.status === 'VERIFIED_FOR_PROJECT_RULESET' ||
      anteEntry.status === 'VERIFIED_FOR_PROJECT_RULESET' ||
      anteAvoidance.projectRulesetOverrides !== undefined ||
      anteAvoidance.verification.characterVerification !== undefined ||
      anteEntry.characterVerification !== undefined)
  ) {
    const project = m12OverridesSchema.safeParse(
      anteAvoidance.projectRulesetOverrides,
    );
    const review = z
      .record(z.string(), z.unknown())
      .safeParse(anteEntry.review);
    const origin = z
      .object({
        kind: z.literal('PROJECT_RULE_OVERRIDE'),
        authority: z.literal('USER_SPECIFIED'),
        label: z.literal('M12 USER OVERRIDE'),
        officialSourceVerified: z.literal(false),
      })
      .safeParse(
        project.success ? source.sources[project.data.sourceId] : undefined,
      );
    if (
      anteAvoidance.verification.status !== 'VERIFIED_FOR_PROJECT_RULESET' ||
      anteEntry.status !== 'VERIFIED_FOR_PROJECT_RULESET' ||
      !project.success ||
      !review.success ||
      !origin.success ||
      JSON.stringify(anteAvoidance.projectRulesetOverrides) !==
        JSON.stringify(review.data.projectRulesetOverrides) ||
      [anteAvoidance.verification, anteEntry, review.data].some(
        (item) =>
          JSON.stringify(item.characterVerification) !==
            JSON.stringify(m12CharacterVerification) ||
          JSON.stringify(item.fieldVerification) !==
            JSON.stringify(m12FieldVerification),
      )
    )
      errors.push(
        'M12 must preserve its separate M12 USER OVERRIDE provenance; Gog exact text remains UNAVAILABLE',
      );
    if (
      !project.success ||
      JSON.stringify(project.data.templates) !== JSON.stringify(m12Templates) ||
      JSON.stringify(anteAvoidance.legality) !== JSON.stringify(m12Legality) ||
      JSON.stringify(anteAvoidance.effects) !== JSON.stringify(m12Effects)
    )
      errors.push(
        'M12 must preserve initial/later current SELF ante avoidance, participation, no refund and context-exclusive Ignore Drink template',
      );
    const gog = source.characters.find((c) => c.id === 'gog');
    const a = gog?.cards.find((c) => c.mechanicId === 'avoid_ante_leave');
    const b = gog?.cards.find(
      (c) => c.mechanicId === 'avoid_ante_leave_or_ignore_drink',
    );
    if (
      a?.cardKey !== m12Templates.A.cardKey ||
      a.quantity !== 2 ||
      b?.cardKey !== m12Templates.B.cardKey ||
      b.quantity !== 1 ||
      JSON.stringify(b.projectRuleOverride) !==
        JSON.stringify({
          sourceId: 'project_m12_gog_override_2026_10_05',
          label: 'M12 USER OVERRIDE',
          template: 'B',
          provenance: 'PROJECT_RULE_OVERRIDE',
          officialSourceVerified: false,
        })
    )
      errors.push(
        'M12 Gog templates must retain two pure-mode and one existing dual-mode copy with separate M12 binding provenance',
      );
  }
  const dualAvoidance = source.mechanics.find(
    (m) => m.id === 'avoid_ante_leave_or_ignore_drink',
  );
  const dualEntry = ledger.characterMechanics.find(
    (e) => e.mechanicId === 'avoid_ante_leave_or_ignore_drink',
  );
  if (
    dualAvoidance &&
    dualEntry &&
    (dualAvoidance.verification.status === 'VERIFIED_FOR_PROJECT_RULESET' ||
      dualEntry.status === 'VERIFIED_FOR_PROJECT_RULESET' ||
      dualAvoidance.projectRulesetOverrides !== undefined ||
      dualAvoidance.verification.characterVerification !== undefined ||
      dualEntry.characterVerification !== undefined)
  ) {
    const review = z
      .record(z.string(), z.unknown())
      .safeParse(dualEntry.review);
    const origin = z
      .object({
        kind: z.literal('PROJECT_RULE_OVERRIDE'),
        authority: z.literal('USER_SPECIFIED'),
        label: z.literal('M12 USER OVERRIDE'),
        officialSourceVerified: z.literal(false),
      })
      .safeParse(source.sources[m13Override.sourceId]);
    if (
      dualAvoidance.verification.status !== 'VERIFIED_FOR_PROJECT_RULESET' ||
      dualEntry.status !== 'VERIFIED_FOR_PROJECT_RULESET' ||
      !review.success ||
      !origin.success ||
      anteAvoidance?.verification.status !== 'VERIFIED_FOR_PROJECT_RULESET' ||
      JSON.stringify(dualAvoidance.projectRulesetOverrides) !==
        JSON.stringify(m13Override) ||
      JSON.stringify(review.data.projectRulesetOverrides) !==
        JSON.stringify(m13Override) ||
      [dualAvoidance.verification, dualEntry, review.data].some(
        (item) =>
          JSON.stringify(item.characterVerification) !==
            JSON.stringify(m13CharacterVerification) ||
          JSON.stringify(item.fieldVerification) !==
            JSON.stringify(m13FieldVerification),
      )
    )
      errors.push(
        'M13 must preserve original Dimli/Eve/Fleck verification and the existing M12 Template B override for Gog; exact Gog text remains UNAVAILABLE',
      );
    if (
      JSON.stringify(dualAvoidance.legality) !==
        JSON.stringify(m12Templates.B.legality) ||
      JSON.stringify(dualAvoidance.effects) !==
        JSON.stringify(m12Templates.B.effects)
    )
      errors.push(
        'M13 must preserve context-exclusive current SELF ante/leave or whole affected Drink Ignore semantics',
      );
  }
  const broadDefense = source.mechanics.find(
    (m) => m.id === 'ignore_card_all_stats',
  );
  const broadEntry = ledger.characterMechanics.find(
    (e) => e.mechanicId === 'ignore_card_all_stats',
  );
  if (
    broadDefense &&
    broadEntry &&
    (broadDefense.verification.ledgerId === 'M14' ||
      broadDefense.verification.characterVerification !== undefined ||
      broadEntry.characterVerification !== undefined)
  ) {
    const character = z.object({
      eve: z.object({
        quantity: z.literal('VERIFIED_ORIGINAL_JSON'),
        exactSourceRecords: z.literal(
          'VERIFIED_ORIGINAL_JSON_AND_OFFICIAL_CARD_IMAGE',
        ),
        semantics: z.literal('VERIFIED_CURRENT_OFFICIAL_UPDATE'),
      }),
      gog: z.object({
        quantity: z.literal('VERIFIED_SECONDARY_MATRIX'),
        exactCardText: z.literal('VERIFIED_READABLE_PRINTED_CARD_PHOTO'),
        officialHost: z.literal(false),
        semantics: z.literal('VERIFIED_CARD_PHOTO_AND_CURRENT_OFFICIAL_RULES'),
      }),
    });
    const review = z
      .record(z.string(), z.unknown())
      .safeParse(broadEntry.review);
    const photo = z
      .object({
        kind: z.literal('READABLE_PRINTED_CARD_PHOTO'),
        authority: z.literal('PRIMARY_CARD_ARTIFACT_SECONDARY_HOST'),
        officialHost: z.literal(false),
      })
      .safeParse(source.sources.gog_m14_printed_card_photo);
    if (
      broadDefense.verification.status !== 'VERIFIED' ||
      broadEntry.status !== 'VERIFIED' ||
      broadDefense.projectRulesetOverrides !== undefined ||
      !review.success ||
      !photo.success ||
      [broadDefense.verification, broadEntry, review.data].some(
        (item) => !character.safeParse(item.characterVerification).success,
      ) ||
      JSON.stringify(broadDefense.verification.fieldVerification) !==
        JSON.stringify(broadEntry.fieldVerification) ||
      JSON.stringify(broadEntry.fieldVerification) !==
        JSON.stringify(review.data.fieldVerification)
    )
      errors.push(
        'M14 must retain separately verified Eve originals/current update and Gog printed-card photograph provenance without a user override or publisher-host claim',
      );
    if (
      JSON.stringify(broadDefense.legality) !== JSON.stringify(m14Legality) ||
      JSON.stringify(broadDefense.effects) !==
        JSON.stringify([{ op: 'IGNORE_CURRENT_EFFECT_FOR_SELF' }])
    )
      errors.push(
        'M14 must retain direct SELF stat relation, printed card categories, gambling/own-payment exclusions and self-only Ignore',
      );
  }
  const fortitudeDefense = source.mechanics.find(
    (m) => m.id === 'ignore_card_fortitude',
  );
  const fortitudeEntry = ledger.characterMechanics.find(
    (e) => e.mechanicId === 'ignore_card_fortitude',
  );
  if (
    fortitudeDefense &&
    fortitudeEntry &&
    (fortitudeDefense.verification.ledgerId === 'M15' ||
      fortitudeDefense.verification.status === 'VERIFIED_FOR_PROJECT_RULESET' ||
      fortitudeEntry.status === 'VERIFIED_FOR_PROJECT_RULESET' ||
      fortitudeDefense.projectRulesetOverrides !== undefined)
  ) {
    const review = z
      .record(z.string(), z.unknown())
      .safeParse(fortitudeEntry.review);
    const origin = z
      .object({
        kind: z.literal('PROJECT_RULE_OVERRIDE'),
        authority: z.literal('USER_SPECIFIED'),
        label: z.literal('M15 USER OVERRIDE'),
        officialSourceVerified: z.literal(false),
        path: z.literal('codex-prompts/step-24a-m15-user-override.md'),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .safeParse(source.sources[m15Override.sourceId]);
    if (
      fortitudeDefense.verification.status !== 'VERIFIED_FOR_PROJECT_RULESET' ||
      fortitudeEntry.status !== 'VERIFIED_FOR_PROJECT_RULESET' ||
      !review.success ||
      !origin.success ||
      [fortitudeDefense, ...(review.success ? [review.data] : [])].some(
        (item) =>
          JSON.stringify(item.projectRulesetOverrides) !==
          JSON.stringify(m15Override),
      ) ||
      [
        fortitudeDefense.verification,
        fortitudeEntry,
        ...(review.success ? [review.data] : []),
      ].some(
        (item) =>
          JSON.stringify(item.characterVerification) !==
            JSON.stringify(m15Characters) ||
          JSON.stringify(item.fieldVerification) !== JSON.stringify(m15Fields),
      )
    )
      errors.push(
        'M15 must preserve its separately authorized M15 USER OVERRIDE and original Dimli evidence; complete Gog physical wording remains UNAVAILABLE and not publisher-verified',
      );
    if (
      JSON.stringify(fortitudeDefense.legality) !==
        JSON.stringify(m15Legality) ||
      JSON.stringify(fortitudeDefense.effects) !==
        JSON.stringify([{ op: 'IGNORE_CURRENT_EFFECT_FOR_SELF' }]) ||
      [fortitudeDefense, ...(review.success ? [review.data] : [])].some(
        (item) =>
          JSON.stringify(item.sharedImplementation) !==
          JSON.stringify(m15Binding),
      )
    )
      errors.push(
        'M15 must preserve direct SELF Fortitude Action/Sometimes/Anytime legality and shared self-only whole-card Ignore without global Negate',
      );
    const row = source.characters
      .find((c) => c.id === 'gog')
      ?.cards.find((c) => c.mechanicId === fortitudeDefense.id);
    if (
      !row ||
      row.quantity !== 2 ||
      row.type !== 'SOMETIMES' ||
      row.canonicalCardTitle !== 'Stop poking Gog' ||
      JSON.stringify(row.projectRuleOverride) !== JSON.stringify(m15Override)
    )
      errors.push(
        'M15 Gog must retain exactly two identical Sometimes copies bound to its explicit override',
      );
  }
  const protectedCounter = source.mechanics.find(
    (m) => m.id === 'negate_sometimes_counter',
  );
  const protectedEntry = ledger.characterMechanics.find(
    (e) => e.mechanicId === 'negate_sometimes_counter',
  );
  if (
    protectedCounter &&
    protectedEntry &&
    protectedCounter.verification.ledgerId === 'M16'
  ) {
    const review = z
      .record(z.string(), z.unknown())
      .safeParse(protectedEntry.review);
    const original = z.object({
      quantity: z.literal('VERIFIED_ORIGINAL_JSON'),
      exactSourceRecord: z.literal('VERIFIED_ORIGINAL_JSON'),
      semantics: z.literal('VERIFIED_ORIGINAL_JSON_AND_OFFICIAL_RULES'),
    });
    const characters = z.object({
      dimli: original,
      eve: original,
      fleck: original,
      gog: z.object({
        quantity: z.literal('VERIFIED_SECONDARY_MATRIX'),
        exactCardText: z.literal('VERIFIED_OFFICIAL_RULES_PRINTED_CARD'),
        semantics: z.literal('VERIFIED_CURRENT_OFFICIAL_RULES'),
      }),
    });
    const artifact = z
      .object({
        kind: z.literal('OFFICIAL_RULES_PRINTED_CARD'),
        authority: z.literal('PRIMARY'),
        officialHost: z.literal(true),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .safeParse(source.sources.official_m16_gog_card);
    if (
      protectedCounter.verification.status !== 'VERIFIED' ||
      protectedEntry.status !== 'VERIFIED' ||
      protectedCounter.projectRulesetOverrides !== undefined ||
      !review.success ||
      !artifact.success ||
      [
        protectedCounter.verification,
        protectedEntry,
        ...(review.success ? [review.data] : []),
      ].some(
        (item) => !characters.safeParse(item.characterVerification).success,
      )
    )
      errors.push(
        'M16 must retain separately verified original Dimli/Eve/Fleck records and complete official Gog printed-card evidence without a project override',
      );
    const expectedLegality = {
      mode: 'RESPONSE',
      trigger: {
        event: 'CARD_PENDING',
        sourceCardType: 'SOMETIMES',
        compatibleCounterTarget: true,
      },
    };
    if (
      JSON.stringify(protectedCounter.legality) !==
        JSON.stringify(expectedLegality) ||
      JSON.stringify(protectedCounter.effects) !==
        JSON.stringify([{ op: 'NEGATE_CURRENT_SOURCE' }]) ||
      [protectedCounter, ...(review.success ? [review.data] : [])].some(
        (item) =>
          item.counterFamily !== m16Binding.counterFamily ||
          item.counterPolicy !== m16Binding.counterPolicy ||
          JSON.stringify(item.sharedImplementation) !==
            JSON.stringify(m16Binding),
      )
    )
      errors.push(
        'M16 must preserve pending compatible Sometimes Negate and bidirectional standard-counter family protection',
      );
  }
  const drinkDefense = source.mechanics.find((m) => m.id === 'ignore_drink');
  const drinkEntry = ledger.characterMechanics.find(
    (e) => e.mechanicId === 'ignore_drink',
  );
  if (
    drinkDefense &&
    drinkEntry &&
    drinkDefense.verification.ledgerId === 'M17'
  ) {
    const review = z
      .record(z.string(), z.unknown())
      .safeParse(drinkEntry.review);
    const original = z.object({
      quantity: z.literal('VERIFIED_ORIGINAL_JSON'),
      exactSourceRecords: z.literal('VERIFIED_ORIGINAL_JSON'),
      semantics: z.literal('VERIFIED_ORIGINAL_JSON_AND_OFFICIAL_RULES'),
    });
    const characters = z.object({
      dimli: original,
      eve: original,
      fleck: original,
      gog: z.object({
        quantity: z.literal('VERIFIED_MATRIX_AND_OFFICIAL_TWO_CARD_EXAMPLE'),
        exactCardText: z.literal('VERIFIED_OFFICIAL_CARD_IMAGE_BOTH_COPIES'),
        semantics: z.literal('VERIFIED_CURRENT_OFFICIAL_RULES'),
      }),
    });
    const image = z
      .object({
        kind: z.literal('OFFICIAL_CARD_IMAGE'),
        authority: z.literal('PRIMARY'),
        officialHost: z.literal(true),
        url: z.literal(
          'https://slugfestgames.com/wp-content/uploads/2015/11/2ndRuleofSometimes3.png',
        ),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .safeParse(source.sources.official_m17_gog_cards);
    if (
      drinkDefense.verification.status !== 'VERIFIED' ||
      drinkEntry.status !== 'VERIFIED' ||
      drinkDefense.projectRulesetOverrides !== undefined ||
      !review.success ||
      !image.success ||
      [
        drinkDefense.verification,
        drinkEntry,
        ...(review.success ? [review.data] : []),
      ].some(
        (item) => !characters.safeParse(item.characterVerification).success,
      )
    )
      errors.push(
        'M17 must retain six original records and both complete publisher Gog Drink-defense cards without a project override',
      );
    const legality = {
      mode: 'RESPONSE',
      trigger: {
        event: 'DRINK_PENDING',
        affects: 'SELF',
        chasersComplete: true,
      },
    };
    const binding = {
      responseTrigger: {
        event: 'DRINK',
        alternatives: [[{ kind: 'AFFECTS', relation: 'SELF' }]],
      },
      effects: [{ op: 'IGNORE', scope: 'CURRENT_EFFECT' }],
    };
    if (
      JSON.stringify(drinkDefense.legality) !== JSON.stringify(legality) ||
      JSON.stringify(drinkDefense.effects) !==
        JSON.stringify([{ op: 'IGNORE_CURRENT_DRINK' }]) ||
      [drinkDefense, ...(review.success ? [review.data] : [])].some(
        (item) =>
          JSON.stringify(item.sharedImplementation) !== JSON.stringify(binding),
      )
    )
      errors.push(
        'M17 must preserve own pending whole-Drink Ignore after all Chasers without payment, global Negate or Drink Event broadening',
      );
  }
  const extraDrinks = source.mechanics.find(
    (m) => m.id === 'order_two_extra_drinks_paid',
  );
  const extraEntry = ledger.characterMechanics.find(
    (e) => e.mechanicId === 'order_two_extra_drinks_paid',
  );
  if (
    extraDrinks &&
    extraEntry &&
    (extraDrinks.verification.ledgerId === 'M18' ||
      extraDrinks.verification.status === 'VERIFIED_FOR_PROJECT_RULESET' ||
      extraEntry.status === 'VERIFIED_FOR_PROJECT_RULESET' ||
      extraDrinks.projectRulesetOverrides !== undefined)
  ) {
    const review = z
      .record(z.string(), z.unknown())
      .safeParse(extraEntry.review);
    const origin = z
      .object({
        kind: z.literal('PROJECT_RULE_OVERRIDE'),
        authority: z.literal('USER_SPECIFIED'),
        label: z.literal('M18 USER OVERRIDE'),
        officialSourceVerified: z.literal(false),
        scope: z.literal('GOG_OWNERSHIP_QUANTITY_AND_TWO_STANDARD_COPIES_ONLY'),
        path: z.literal('codex-prompts/step-24a-m18-user-override.md'),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .safeParse(source.sources[m18Override.sourceId]);
    const standard = z
      .object({
        kind: z.literal('OFFICIAL_PRINT_AND_PLAY_CARD'),
        authority: z.literal('PRIMARY'),
        officialHost: z.literal(true),
        url: z.literal(
          'https://slugfestgames.com/wp-content/uploads/2016/12/RedDragonInn6DaarekaPrintAndPlay.pdf',
        ),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .safeParse(source.sources.official_m18_standard_card);
    if (
      extraDrinks.verification.status !== 'VERIFIED_FOR_PROJECT_RULESET' ||
      extraEntry.status !== 'VERIFIED_FOR_PROJECT_RULESET' ||
      !review.success ||
      !origin.success ||
      !standard.success ||
      [extraDrinks, ...(review.success ? [review.data] : [])].some(
        (item) =>
          JSON.stringify(item.projectRulesetOverrides) !==
          JSON.stringify(m18Override),
      ) ||
      [
        extraDrinks.verification,
        extraEntry,
        ...(review.success ? [review.data] : []),
      ].some(
        (item) =>
          JSON.stringify(item.characterVerification) !==
            JSON.stringify(m18Characters) ||
          JSON.stringify(item.fieldVerification) !== JSON.stringify(m18Fields),
      )
    )
      errors.push(
        'M18 must preserve its ownership/quantity/identical-copy USER OVERRIDE separately from the publisher-supported standard mechanic and original Dimli/Eve records',
      );
    if (
      JSON.stringify(extraDrinks.legality) !== JSON.stringify(m18Legality) ||
      JSON.stringify(extraDrinks.effects) !== JSON.stringify(m18Effects) ||
      [extraDrinks, ...(review.success ? [review.data] : [])].some(
        (item) =>
          JSON.stringify(item.sharedImplementation) !==
          JSON.stringify(m18Binding),
      )
    )
      errors.push(
        'M18 must preserve own Order a Drink phase, one Gold to Inn then two extra Drinks for other players using the shared phase/payment/ordering binding',
      );
    const row = source.characters
      .find((c) => c.id === 'gog')
      ?.cards.find((r) => r.mechanicId === extraDrinks.id);
    if (
      !row ||
      row.quantity !== 2 ||
      row.type !== 'SOMETIMES' ||
      row.canonicalCardTitle !== 'Wench, bring some drinks for my friends!' ||
      JSON.stringify(row.projectRuleOverride) !== JSON.stringify(m18Override)
    )
      errors.push(
        'M18 Gog must retain exactly two identical standard copies bound only to M18 USER OVERRIDE',
      );
  }
  const freeDrinks = source.mechanics.find(
    (m) => m.id === 'order_two_extra_drinks_free_or_waive_refill',
  );
  const freeEntry = ledger.characterMechanics.find(
    (e) => e.mechanicId === freeDrinks?.id,
  );
  if (freeDrinks && freeEntry && freeDrinks.verification.ledgerId === 'M19') {
    const review = z
      .record(z.string(), z.unknown())
      .safeParse(freeEntry.review);
    const original = z
      .object({
        kind: z.literal('ORIGINAL_UNOFFICIAL_JSON'),
        authority: z.literal('SECONDARY'),
        url: z.literal(
          'https://raw.githubusercontent.com/HaxxonHax/the-inn/main/Cards/base/fleck/fleck.json',
        ),
        sha256: z.literal(
          '0eeea03f64b4e787a2766d7a79627a69ce5e1f8709ba2ae5c6d62150dbdea648',
        ),
      })
      .safeParse(source.sources.the_inn_m19_original_fleck);
    if (
      !original.success ||
      !review.success ||
      freeDrinks.verification.status !== 'VERIFIED' ||
      freeEntry.status !== 'VERIFIED' ||
      freeDrinks.projectRulesetOverrides !== undefined ||
      [
        freeDrinks.verification,
        freeEntry,
        ...(review.success ? [review.data] : []),
      ].some(
        (item) =>
          JSON.stringify(item.characterVerification) !==
          JSON.stringify(m19Characters),
      )
    )
      errors.push(
        'M19 must retain two original Fleck records and separate absence checks without a project override or publisher-direct card provenance claim',
      );
    if (
      [freeDrinks, ...(review.success ? [review.data] : [])].some(
        (item) =>
          JSON.stringify(item.legality) !== JSON.stringify(m19Legality) ||
          JSON.stringify(item.effects) !== JSON.stringify(m19Effects),
      )
    )
      errors.push(
        'M19 must preserve alternative own-phase two free face-down extra orders to others OR the pending current self one-Gold refill waiver, without refunds or future exemptions',
      );
    const row = source.characters
      .find((c) => c.id === 'fleck')
      ?.cards.find((r) => r.mechanicId === freeDrinks.id);
    if (
      !row ||
      row.quantity !== 2 ||
      row.type !== 'SOMETIMES' ||
      JSON.stringify(row.canonicalCardTitles) !==
        JSON.stringify([
          'Wench, please allow me to pay for these drinks with a song!',
          'Wench, please allow me to pay for these drinks with a song!',
        ])
    )
      errors.push(
        'M19 must retain exactly two separately recorded Fleck Sometimes copies',
      );
  }
  const toast = source.mechanics.find(
    (m) => m.id === 'all_players_drink_from_inn',
  );
  const toastEntry = ledger.characterMechanics.find(
    (e) => e.mechanicId === toast?.id,
  );
  if (toast && toastEntry && toast.verification.ledgerId === 'M20') {
    const review = z
      .record(z.string(), z.unknown())
      .safeParse(toastEntry.review);
    const original = z
      .object({
        kind: z.literal('ORIGINAL_UNOFFICIAL_JSON'),
        authority: z.literal('SECONDARY'),
        url: z.literal(
          'https://raw.githubusercontent.com/HaxxonHax/the-inn/main/Cards/base/fleck/fleck.json',
        ),
        sha256: z.literal(
          '0eeea03f64b4e787a2766d7a79627a69ce5e1f8709ba2ae5c6d62150dbdea648',
        ),
      })
      .safeParse(source.sources.the_inn_m20_original_fleck);
    if (
      !original.success ||
      !review.success ||
      toast.verification.status !== 'VERIFIED' ||
      toastEntry.status !== 'VERIFIED' ||
      toast.projectRulesetOverrides !== undefined ||
      [
        toast.verification,
        toastEntry,
        ...(review.success ? [review.data] : []),
      ].some(
        (item) =>
          JSON.stringify(item.characterVerification) !==
          JSON.stringify(m20Characters),
      )
    )
      errors.push(
        'M20 must retain the complete original Fleck Action and separate absence checks without an override or publisher-direct card provenance claim',
      );
    if (
      [toast, ...(review.success ? [review.data] : [])].some(
        (item) =>
          JSON.stringify(item.legality) !==
            JSON.stringify({ mode: 'ACTION_PHASE', actor: 'SELF' }) ||
          JSON.stringify(item.effects) !==
            JSON.stringify([
              {
                op: 'FORCE_SIMULTANEOUS_DRINK_FROM_INN',
                targets: 'ALL_PLAYERS',
                skipDrinkEvents: true,
              },
            ]) ||
          JSON.stringify(item.drinkSemantics) !== JSON.stringify(m20Semantics),
      )
    )
      errors.push(
        'M20 must preserve own Action, separate Inn Drinks for all living players including self, leading-Event discard/search, standard Chasers and independent responses before simultaneous consumption',
      );
    const audit = z.object({
      status: z.literal('PARTIAL_SHARED_ENGINE_SUPPORT'),
      supportedBinding: z.unknown(),
      missingCapabilities: z.tuple([
        z.literal('drink.simultaneous-from-inn-leading-event-skip'),
      ]),
    });
    if (
      [toast, ...(review.success ? [review.data] : [])].some((item) => {
        const parsed = audit.safeParse(item.engineAudit);
        return (
          !parsed.success ||
          JSON.stringify(parsed.data.supportedBinding) !==
            JSON.stringify({
              effects: [
                {
                  op: 'FORCE_SIMULTANEOUS_DRINK',
                  targets: 'ALL_PLAYERS',
                  source: 'INN',
                },
              ],
            })
        );
      })
    )
      errors.push(
        'M20 engine audit must retain the existing Inn batch binding and explicit unimplemented leading-Event skip capability',
      );
    const row = source.characters
      .find((c) => c.id === 'fleck')
      ?.cards.find((r) => r.mechanicId === toast.id);
    if (
      !row ||
      row.quantity !== 1 ||
      row.type !== 'ACTION' ||
      row.canonicalCardTitle !== 'A toast! To my friends!'
    )
      errors.push('M20 must retain exactly one original Fleck Action copy');
  }
  const extraReveal = source.mechanics.find(
    (m) => m.id === 'force_extra_drink_during_other_drink_phase',
  );
  const revealEntry = ledger.characterMechanics.find(
    (e) => e.mechanicId === extraReveal?.id,
  );
  if (
    extraReveal &&
    revealEntry &&
    (extraReveal.verification.ledgerId === 'M21' ||
      extraReveal.verification.status === 'VERIFIED_FOR_PROJECT_RULESET' ||
      revealEntry.status === 'VERIFIED_FOR_PROJECT_RULESET' ||
      extraReveal.projectRulesetOverrides !== undefined)
  ) {
    const review = z
      .record(z.string(), z.unknown())
      .safeParse(revealEntry.review);
    const origin = z
      .object({
        kind: z.literal('PROJECT_RULE_OVERRIDE'),
        authority: z.literal('USER_SPECIFIED'),
        label: z.literal('M21 USER OVERRIDE'),
        scope: z.literal('GOG_M21_TWO_COPIES_ONLY'),
        path: z.literal('codex-prompts/step-24a-m21-user-override.md'),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        officialSourceVerified: z.literal(false),
      })
      .safeParse(source.sources[m21Override.sourceId]);
    const records = [extraReveal, ...(review.success ? [review.data] : [])];
    const identity = z.object({
      dimli: z.object({
        quantity: z.literal('VERIFIED_ORIGINAL_JSON_AND_MATRIX'),
        exactSourceRecord: z.literal('VERIFIED_ORIGINAL_JSON'),
        semantics: z.literal('VERIFIED_ORIGINAL_JSON_AND_OFFICIAL_RULES'),
      }),
      eve: z.object({
        quantity: z.literal('VERIFIED_ABSENT_ORIGINAL_JSON_AND_MATRIX'),
      }),
      fleck: z.object({
        quantity: z.literal('VERIFIED_ABSENT_ORIGINAL_JSON_AND_MATRIX'),
      }),
      gog: z.object({
        quantity: z.literal(
          'PROJECT_RULE_OVERRIDE_WITH_SECONDARY_MATRIX_SUPPORT',
        ),
        cardType: z.literal(
          'PROJECT_RULE_OVERRIDE_WITH_SECONDARY_MATRIX_SUPPORT',
        ),
        canonicalCardTitle: z.literal('Gog say you drink MORE!'),
        cardIdentity: z.literal('VERIFIED_OFFICIAL_NAMED_EXAMPLE'),
        exactCardText: z.literal('UNAVAILABLE'),
        normalizedSemantics: z.literal('PROJECT_RULE_OVERRIDE'),
        identicalCopies: z.literal('PROJECT_RULE_OVERRIDE'),
        officialSourceVerified: z.literal(false),
        projectRuleOverrideAuthorized: z.literal(true),
      }),
    });
    const primary = z
      .object({
        authority: z.literal('PRIMARY'),
        kind: z.literal('OFFICIAL_RULES_NAMED_CARD_EXAMPLE'),
        url: z.literal(
          'https://slugfestgames.com/wp-content/uploads/2021/11/RDI8RulesWeb.pdf',
        ),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .safeParse(source.sources.official_m21_gog_rdi8_example);
    const sharedRules = z
      .object({
        authority: z.literal('PRIMARY'),
        kind: z.literal('OFFICIAL_GENERIC_RULES'),
        url: z.literal(
          'https://slugfestgames.com/wp-content/uploads/2021/11/RDI8RulesWeb.pdf',
        ),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .safeParse(source.sources.official_m21_shared_drink_team_rules);
    if (
      extraReveal.verification.status !== 'VERIFIED_FOR_PROJECT_RULESET' ||
      revealEntry.status !== 'VERIFIED_FOR_PROJECT_RULESET' ||
      !review.success ||
      !origin.success ||
      !primary.success ||
      !sharedRules.success ||
      records.some(
        (item) =>
          JSON.stringify(item.projectRulesetOverrides) !==
          JSON.stringify(m21Override),
      ) ||
      [
        extraReveal.verification,
        revealEntry,
        ...(review.success ? [review.data] : []),
      ].some(
        (item) =>
          !identity.safeParse(item.characterVerification).success ||
          JSON.stringify(item.fieldVerification) !== JSON.stringify(m21Fields),
      )
    )
      errors.push(
        'M21 must preserve its Gog-only USER OVERRIDE and unavailable physical wording separately from publisher identity/examples and generic rules',
      );
    const legality = {
      mode: 'CHARACTER_TEMPLATES',
      templates: { dimli: m21DimliLegality, gog: m21GogLegality },
    };
    const effects = [
      {
        op: 'CHARACTER_TEMPLATE',
        templates: { dimli: m21DimliEffects, gog: m21GogEffects },
      },
    ];
    if (
      records.some(
        (item) =>
          JSON.stringify(item.legality) !== JSON.stringify(legality) ||
          JSON.stringify(item.effects) !== JSON.stringify(effects) ||
          JSON.stringify(item.characterTemplates) !==
            JSON.stringify(m21Templates),
      )
    )
      errors.push(
        'M21 must preserve Dimli original phase timing separately from Gog actual other-player Drink reveal including contest, complete Chasers, one independent target-own-pile Drink and unchanged contest comparison',
      );
    const audit = z.object({
      status: z.literal('PARTIAL_SHARED_ENGINE_SUPPORT'),
      supportedGogBinding: z.unknown(),
      dimliPhaseOpportunity: z.literal('REQUIRES_STEP_24B_SHARED_CAPABILITY'),
      missingCapabilities: z.tuple([
        z.literal('reaction.other-player-drink-phase-opportunity'),
        z.literal('team.variant-runtime-and-other-player-targeting'),
      ]),
      teamRuntimeImplemented: z.literal(false),
      teamAcceptance: z.literal('NOT_EXECUTABLE_WITH_CURRENT_ENGINE'),
    });
    const acceptance = z.object({
      status: z.literal('INCOMPLETE_ENGINE_ACCEPTANCE'),
      passedRequiredTests: z.tuple([
        z.literal('A'),
        z.literal('B'),
        z.literal('C'),
        z.literal('D'),
        z.literal('E'),
        z.literal('F'),
        z.literal('G'),
        z.literal('H'),
        z.literal('I'),
      ]),
      pendingRequiredTests: z.tuple([z.literal('J')]),
      missingCapabilities: z.tuple([
        z.literal('team.variant-runtime-and-other-player-targeting'),
      ]),
    });
    const teamDeferred = teamModeDeferralAuthorized(source, revealEntry);
    const completionStatus = teamDeferred
      ? 'SOURCE_REVIEW_COMPLETE'
      : 'INCOMPLETE_ENGINE_ACCEPTANCE';
    if (
      revealEntry.completionStatus !== completionStatus ||
      extraReveal.verification.completionStatus !== completionStatus ||
      records.some(
        (item) =>
          !audit.safeParse(item.engineAudit).success ||
          !acceptance.safeParse(item.engineAcceptance).success ||
          JSON.stringify(
            z.record(z.string(), z.unknown()).safeParse(item.engineAudit).data
              ?.supportedGogBinding,
          ) !== JSON.stringify(m21GogBinding),
      )
    )
      errors.push(
        'M21 must retain incomplete team acceptance J and the existing shared binding/capability audit; a four-seat test cannot claim team runtime or COMPLETE',
      );
    for (const [id, quantity, title] of [
      ['dimli', 1, 'Drink up, friend!'],
      ['gog', 2, 'Gog say you drink MORE!'],
    ] as const) {
      const row = source.characters
        .find((c) => c.id === id)
        ?.cards.find((r) => r.mechanicId === extraReveal.id);
      if (
        !row ||
        row.quantity !== quantity ||
        row.type !== 'SOMETIMES' ||
        row.canonicalCardTitle !== title ||
        (id === 'gog'
          ? JSON.stringify(row.projectRuleOverride) !==
            JSON.stringify(m21Override)
          : row.projectRuleOverride !== undefined)
      )
        errors.push(
          'M21 must retain one original Dimli and two identical Gog Sometimes copies using only the Gog-scoped M21 override',
        );
    }
    if (!teamDeferred)
      errors.push(
        'M21 required team acceptance J remains pending; source semantics are authorized but M21 is not COMPLETE',
      );
  }
  const lock = lockSchema.safeParse(lockInput);
  if (!lock.success)
    errors.push(
      'Source lock missing or invalid; no source lock may be created with unverified items',
    );
  else if (
    Object.entries(hashes).some(
      ([key, hash]) => lock.data[key as keyof typeof hashes] !== hash,
    )
  )
    errors.push('Source lock hash mismatch');
  const passedDrink = source.mechanics.find((m) => m.id === 'pass_own_drink');
  if (passedDrink?.verification.ledgerId === 'M22') {
    const expectedLegality = {
      mode: 'RESPONSE',
      trigger: {
        event: 'DRINK_PENDING',
        sourceCardType: 'DRINK',
        affects: 'SELF',
        chasersComplete: true,
      },
      target: 'OTHER_PLAYER',
    };
    const expectedSemantics = {
      scope: 'WHOLE_CURRENT_DRINK_INCLUDING_CHASERS',
      recipient: 'CHOSEN_OTHER_PLAYER',
      inspectBeforeChoice: true,
      drinkEvents: false,
      negate: false,
      ignore: false,
      changesDrinkEffects: true,
      contestComparison: 'ORIGINAL_REVEALER_UNCHANGED',
      targetRestrictions: 'SHARED_ANOTHER_PLAYER_AND_RECEIVABLE_EFFECT_RULES',
    };
    const same = (a: unknown, b: unknown) =>
      JSON.stringify(a) === JSON.stringify(b);
    if (
      !same(passedDrink.legality, expectedLegality) ||
      !same(passedDrink.effects, [
        { op: 'PASS_CURRENT_DRINK', target: 'CHOSEN_PLAYER' },
      ]) ||
      !same(passedDrink.drinkSemantics, expectedSemantics)
    )
      errors.push(
        'M22 must preserve own actual Drink, whole completed Chasers, another legal recipient, inspection and unchanged original Contest comparison',
      );
    const original = z.object({
      kind: z.literal('ORIGINAL_UNOFFICIAL_JSON'),
      authority: z.literal('SECONDARY'),
      url: z.literal(
        'https://raw.githubusercontent.com/HaxxonHax/the-inn/main/Cards/base/dimli/dimli.json',
      ),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
    });
    if (
      !original.safeParse(source.sources.the_inn_m22_original_dimli).success ||
      passedDrink.projectRulesetOverrides !== undefined
    )
      errors.push(
        'M22 must retain original Dimli reference provenance without a project override or publisher-direct text claim',
      );
  }

  const drinkCounter = source.mechanics.find(
    (m) => m.verification.ledgerId === 'M27',
  );
  if (drinkCounter !== undefined) {
    const entry = ledger.characterMechanics.find((e) => e.ledgerId === 'M27');
    const same = (a: unknown, b: unknown) =>
      JSON.stringify(a) === JSON.stringify(b);
    const expectedLegality = {
      mode: 'RESPONSE',
      trigger: {
        event: 'CARD_PENDING',
        sourceCardType: 'SOMETIMES',
        sourceCapability: 'CHANGES_DRINK_EFFECT',
        direct: true,
        affectedObject: 'DRINK_NOT_DRINK_EVENT',
        excludeOnly: [
          'ORDERS_OR_BUYS_DRINK',
          'GIVES_SPECIAL_RESERVE_DRINK',
          'FORCES_DRINK',
          'DIRECT_PLAYER_ALCOHOL',
          'AFFECTS_DRINK_EVENT',
        ],
      },
      sameCounterTarget: false,
    };
    const expectedMetadata = {
      family: 'rdi.negate_drink_change',
      allowedCounterFamilies: ['rdi.negate_sometimes', 'rdi_core_hard_no'],
      incomingRestriction: 'ONLY_IDONTTHINKSO_FAMILY',
      provenance: 'PUBLISHER_VERIFIED',
    };
    const expectedBinding = {
      responseKind: 'NEGATE',
      responseTrigger: {
        event: 'CARD',
        alternatives: [
          [
            { kind: 'SOURCE_TYPE', types: ['SOMETIMES'] },
            { kind: 'NEGATABLE', value: true },
            {
              kind: 'SOURCE_CAPABILITY',
              capabilities: ['CHANGES_DRINK_EFFECT'],
              match: 'ANY',
            },
            {
              kind: 'SOURCE_CAPABILITY',
              capabilities: ['AFFECTS_DRINK_EVENT'],
              match: 'NONE',
            },
          ],
        ],
      },
      effects: [{ op: 'NEGATE', scope: 'TOP_STACK' }],
      counterFamily: expectedMetadata.family,
      allowedCounterFamilies: expectedMetadata.allowedCounterFamilies,
    };
    const semanticEvidence = z.object({
      status: z.literal('COMPLETE'),
      classification: z.literal('PUBLISHER_VERIFIED'),
      type: z.literal('VERIFIED_PUBLISHER'),
      directDrinkChangeNegate: z.literal('VERIFIED_PUBLISHER'),
      validAndInvalidCategories: z.literal('VERIFIED_PUBLISHER'),
      directEffectRule: z.literal('VERIFIED_PUBLISHER'),
      cannotTargetSameMechanic: z.literal('VERIFIED_PUBLISHER'),
      incomingCounterRestriction: z.literal('VERIFIED_PUBLISHER'),
      officialSourceVerified: z.literal(true),
    });
    const audit = z
      .object({ supportedBinding: z.unknown() })
      .safeParse(drinkCounter.engineAudit);
    const review = z
      .looseObject({
        legality: z.unknown(),
        effects: z.unknown(),
        counterMetadata: z.unknown(),
        engineAudit: z.unknown(),
        mechanicVerification: semanticEvidence,
      })
      .safeParse(entry?.review);
    if (
      !same(drinkCounter.legality, expectedLegality) ||
      !same(drinkCounter.effects, [{ op: 'NEGATE_CURRENT_SOURCE' }]) ||
      !same(drinkCounter.counterMetadata, expectedMetadata) ||
      !audit.success ||
      !same(audit.data.supportedBinding, expectedBinding) ||
      !semanticEvidence.safeParse(drinkCounter.mechanicVerification).success ||
      drinkCounter.projectRulesetOverrides !== undefined ||
      drinkCounter.projectRuleOverride !== undefined ||
      !review.success ||
      !same(review.data.legality, drinkCounter.legality) ||
      !same(review.data.effects, drinkCounter.effects) ||
      !same(review.data.counterMetadata, drinkCounter.counterMetadata) ||
      !same(review.data.engineAudit, drinkCounter.engineAudit)
    )
      errors.push(
        'M27 must preserve the publisher-verified direct Drink-change Sometimes Negate and protected incoming counter family',
      );
    for (const id of [
      'official_rdi2_9e',
      'official_m27_direct_effect_clarification',
      'official_m27_special_reserve_exclusion',
    ]) {
      if (
        !z
          .object({ authority: z.literal('PRIMARY') })
          .safeParse(source.sources[id]).success
      )
        errors.push(
          `M27 publisher mechanic evidence requires primary source ${id}`,
        );
    }
    const gog = z.object({
      quantity: z.literal('VERIFIED_SECONDARY_MATRIX'),
      mechanicFamily: z.literal('VERIFIED_SECONDARY_MATRIX'),
      exactPhysicalCard: z.literal('UNAVAILABLE'),
      physicalCopyProvenance: z.literal(
        'M27 USER OVERRIDE — Gog physical-copy provenance',
      ),
      publisherDirectOwnership: z.literal('NOT_CLAIMED'),
      semantics: z.literal('VERIFIED_PUBLISHER'),
      incomingCounterRestriction: z.literal('VERIFIED_PUBLISHER'),
    });
    if (
      !z
        .object({ gog })
        .safeParse(drinkCounter.verification.characterVerification).success
    )
      errors.push(
        'M27 must separate publisher mechanic evidence from secondary Gog quantity and user-only physical-copy provenance',
      );
    const provenance = z.strictObject({
      label: z.literal('M27 USER OVERRIDE — Gog physical-copy provenance'),
      classification: z.literal('PROJECT_RULE_OVERRIDE'),
      scope: z.literal('GOG_PHYSICAL_COPY_PROVENANCE_ONLY'),
      sourceId: z.literal('user_m27_gog_physical_provenance_2026_10_06'),
      owner: z.literal('gog'),
      quantity: z.literal(1),
      canonicalCardTitle: z.literal(
        'The Wench thinks you should stop playing with the drinks.',
      ),
      mechanicId: z.literal('negate_drink_change_card'),
      cardType: z.literal('SOMETIMES'),
      publisherDirectOwnership: z.literal(false),
      gameplayChanged: z.literal(false),
    });
    const provenanceReview = z
      .object({
        physicalCopyProvenanceOverride: provenance,
      })
      .safeParse(entry?.review);
    const provenanceSource = z
      .object({
        kind: z.literal('USER_PROVENANCE_OVERRIDE'),
        authority: z.literal('PROJECT_RULE_OVERRIDE'),
        scope: z.literal('GOG_PHYSICAL_COPY_PROVENANCE_ONLY'),
        path: z.literal(
          'codex-prompts/step-24a-m27-gog-provenance-override.md',
        ),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .safeParse(source.sources.user_m27_gog_physical_provenance_2026_10_06);
    const gogCards =
      source.characters
        .find((c) => c.id === 'gog')
        ?.cards.filter((c) => c.mechanicId === drinkCounter.id) ?? [];
    if (
      !provenance.safeParse(drinkCounter.physicalCopyProvenanceOverride)
        .success ||
      !provenanceReview.success ||
      !same(
        entry?.physicalCopyProvenanceOverride,
        drinkCounter.physicalCopyProvenanceOverride,
      ) ||
      !same(
        entry?.characterVerification,
        drinkCounter.verification.characterVerification,
      ) ||
      !provenanceSource.success ||
      gogCards.length !== 1 ||
      gogCards[0]?.quantity !== 1 ||
      gogCards[0]?.canonicalCardTitle !==
        'The Wench thinks you should stop playing with the drinks.' ||
      !same(
        gogCards[0]?.projectRuleOverride,
        drinkCounter.physicalCopyProvenanceOverride,
      )
    )
      errors.push(
        'M27 requires the scoped Gog one-copy provenance override; gameplay remains publisher-verified',
      );
  }

  const twoDamage = source.mechanics.find(
    (m) => m.verification.ledgerId === 'M31',
  );
  if (twoDamage !== undefined) {
    const entry = ledger.characterMechanics.find((e) => e.ledgerId === 'M31');
    const same = (a: unknown, b: unknown) =>
      JSON.stringify(a) === JSON.stringify(b);
    const effects = [
      {
        op: 'CHANGE_STAT',
        target: 'CHOSEN_PLAYER',
        stat: 'FORTITUDE',
        delta: -2,
      },
    ];
    const normalization = z.strictObject({
      label: z.literal('M31 USER OVERRIDE — physical identity normalization'),
      classification: z.literal('PROJECT_RULE_OVERRIDE'),
      scope: z.literal('GOG_M31_PHYSICAL_IDENTITY_NORMALIZATION'),
      sourceId: z.literal(
        'user_m31_physical_identity_normalization_2026_10_06',
      ),
      owner: z.literal('gog'),
      mechanicId: z.literal('damage_two'),
      quantity: z.literal(5),
      allCopiesUseStandardMechanic: z.literal(true),
      perCopyGameplayVariation: z.literal(false),
      unidentifiedPrintedTitlesWaived: z.literal(4),
      inventPrintedTitles: z.literal(false),
      publisherVerifiedUnknownTitles: z.literal(false),
    });
    const audit = z
      .object({ supportedBinding: z.unknown() })
      .safeParse(twoDamage.engineAudit);
    const semantics = z.object({
      status: z.literal('COMPLETE'),
      classification: z.literal('PUBLISHER_VERIFIED_STANDARD_M31'),
      physicalExampleTitle: z.literal('Why you laugh at Gog?'),
      type: z.literal('VERIFIED_PUBLISHER_ACTION'),
      target: z.literal('VERIFIED_PUBLISHER_OTHER_PLAYER'),
      fortitudeLoss: z.literal('VERIFIED_PUBLISHER_EXACTLY_TWO'),
      timing: z.literal('VERIFIED_PUBLISHER_NORMAL_ACTION'),
      additionalEffects: z.literal('NONE'),
      incomingCounterRestriction: z.literal('NONE'),
    });
    const review = z
      .looseObject({
        physicalIdentityNormalizationOverride: normalization,
        mechanicVerification: semantics,
      })
      .safeParse(entry?.review);
    const gog =
      source.characters
        .find((c) => c.id === 'gog')
        ?.cards.filter((c) => c.mechanicId === twoDamage.id) ?? [];
    if (
      twoDamage.cardType !== 'ACTION' ||
      !same(twoDamage.legality, {
        mode: 'ACTION_PHASE',
        target: 'OTHER_PLAYER',
      }) ||
      !same(twoDamage.effects, effects) ||
      !audit.success ||
      !same(audit.data.supportedBinding, { effects }) ||
      !semantics.safeParse(twoDamage.mechanicVerification).success ||
      !normalization.safeParse(twoDamage.physicalIdentityNormalizationOverride)
        .success ||
      !review.success ||
      !same(
        entry?.physicalIdentityNormalizationOverride,
        twoDamage.physicalIdentityNormalizationOverride,
      ) ||
      twoDamage.projectRuleOverride !== undefined ||
      twoDamage.projectRulesetOverrides !== undefined ||
      twoDamage.counterMetadata !== undefined ||
      gog.length !== 1 ||
      gog[0]?.quantity !== 5 ||
      gog[0]?.type !== 'ACTION' ||
      gog[0]?.canonicalCardTitle !== undefined ||
      gog[0]?.canonicalCardTitles !== undefined ||
      !same(
        gog[0]?.projectRuleOverride,
        twoDamage.physicalIdentityNormalizationOverride,
      )
    )
      errors.push(
        'M31 must preserve one Gog quantity-five normalized physical family, no invented printed titles and the standard publisher two-damage other-player Action',
      );
    const gogEvidence = z.object({
      quantity: z.literal('VERIFIED_SECONDARY_MATRIX'),
      mechanicFamily: z.literal('VERIFIED_SECONDARY_MATRIX'),
      namedPublisherTemplate: z.literal('Why you laugh at Gog?'),
      namedTemplateSemantics: z.literal(
        'VERIFIED_PUBLISHER_ACTION_OTHER_PLAYER_LOSE_TWO_FORTITUDE',
      ),
      allFivePhysicalCopyIdentities: z.literal(
        'FOUR_PRINTED_IDENTITIES_UNAVAILABLE_REQUIREMENT_WAIVED',
      ),
      allFivePhysicalCopyWording: z.literal('NOT_CLAIMED'),
      officialSourceVerifiedForAllFiveCopies: z.literal(false),
      publisherUnidentifiedPhysicalCopies: z.literal(4),
      allFiveSameMechanic: z.literal(
        'M31 USER OVERRIDE — physical identity normalization',
      ),
      unknownPrintedTitleRequirement: z.literal('WAIVED_BY_M31_USER_OVERRIDE'),
      normalizedGameplay: z.literal(
        'VERIFIED_PUBLISHER_STANDARD_M31_WITH_USER_PHYSICAL_FAMILY_NORMALIZATION',
      ),
    });
    if (
      !z
        .object({ gog: gogEvidence })
        .safeParse(twoDamage.verification.characterVerification).success ||
      !same(
        entry?.characterVerification,
        twoDamage.verification.characterVerification,
      ) ||
      !z
        .object({ authority: z.literal('PRIMARY') })
        .safeParse(source.sources.official_rdi2_9e).success ||
      !z
        .object({
          kind: z.literal('USER_PHYSICAL_IDENTITY_NORMALIZATION_OVERRIDE'),
          authority: z.literal('PROJECT_RULE_OVERRIDE'),
          scope: z.literal('GOG_M31_PHYSICAL_IDENTITY_NORMALIZATION'),
          path: z.literal(
            'codex-prompts/step-24a-m31-gog-identity-normalization.md',
          ),
          sha256: z.string().regex(/^[a-f0-9]{64}$/),
        })
        .safeParse(
          source.sources.user_m31_physical_identity_normalization_2026_10_06,
        ).success
    )
      errors.push(
        'M31 must separate publisher standard mechanics, secondary quantity and user-waived unknown physical identities',
      );
  }

  const paidDamage = source.mechanics.find(
    (m) => m.verification.ledgerId === 'M33',
  );
  if (paidDamage !== undefined) {
    const same = (a: unknown, b: unknown) =>
      JSON.stringify(a) === JSON.stringify(b);
    const effects = [
      {
        op: 'CHANGE_STAT',
        target: 'CHOSEN_PLAYER',
        stat: 'FORTITUDE',
        delta: -3,
      },
      { op: 'PAY_INN', target: 'SELF', amount: 1, asEffectNotCost: true },
    ];
    const audit = z
      .object({ supportedBinding: z.unknown() })
      .safeParse(paidDamage.engineAudit);
    const cards =
      source.characters
        .find((c) => c.id === 'gog')
        ?.cards.filter((c) => c.mechanicId === paidDamage.id) ?? [];
    const title = 'Sorry, Gog not see you sitting there...';
    if (
      paidDamage.cardType !== 'ACTION' ||
      !same(paidDamage.legality, {
        mode: 'ACTION_PHASE',
        target: 'OTHER_PLAYER',
      }) ||
      !same(paidDamage.effects, effects) ||
      !audit.success ||
      !same(audit.data.supportedBinding, {
        effects: [effects[0], { op: 'PAY_INN', target: 'SELF', amount: 1 }],
      }) ||
      paidDamage.canonicalCardTitle !== title ||
      paidDamage.display['en-US'] !== title ||
      paidDamage.projectRuleOverride !== undefined ||
      paidDamage.projectRulesetOverrides !== undefined ||
      cards.length !== 1 ||
      cards[0]?.quantity !== 1 ||
      cards[0]?.type !== 'ACTION' ||
      cards[0]?.canonicalCardTitle !== title ||
      cards[0]?.display['en-US'] !== title
    )
      errors.push(
        'M33 must preserve the identified one-copy other-player Action and ordered three-damage then one-Gold resolving payment without a play cost or user override',
      );
    if (
      !z
        .object({
          kind: z.literal('DIRECT_PHYSICAL_CARD_PHOTO'),
          authority: z.literal('SECONDARY'),
          publisherHosted: z.literal(false),
          sha256: z.string().regex(/^[a-f0-9]{64}$/),
        })
        .safeParse(source.sources.physical_gog_review_photo_2015).success ||
      !z
        .object({ authority: z.literal('PRIMARY') })
        .safeParse(source.sources.official_m33_payment_rules_rdi9).success ||
      !z
        .object({
          gog: z.object({
            exactCardText: z.literal('VERIFIED_DIRECT_PHYSICAL_CARD_PHOTO'),
            officialSourceVerified: z.literal(false),
            paymentSemanticsPublisherVerified: z.literal(true),
            physicalImagePublisherHosted: z.literal(false),
          }),
        })
        .safeParse(paidDamage.verification.characterVerification).success
    )
      errors.push(
        'M33 must separate third-party physical-card evidence from publisher payment semantics',
      );
  }

  const retaliation = source.mechanics.find(
    (m) => m.verification.ledgerId === 'M37',
  );
  if (retaliation !== undefined) {
    const entry = ledger.characterMechanics.find((e) => e.ledgerId === 'M37');
    const same = (a: unknown, b: unknown) =>
      JSON.stringify(a) === JSON.stringify(b);
    const effects = [
      {
        op: 'CHANGE_STAT',
        target: 'ORIGINAL_SOURCE_PLAYER',
        stat: 'FORTITUDE',
        delta: -2,
      },
    ];
    const binding = {
      responseTrigger: {
        event: 'SYSTEM',
        alternatives: [
          [
            { kind: 'SYSTEM_EVENT', events: ['FORTITUDE_LOSS_RESOLVED'] },
            {
              kind: 'ACTUAL_STAT_LOSS',
              stat: 'FORTITUDE',
              relation: 'SELF',
              minAmount: 1,
              requirePlayerCard: true,
              excludeMitigationCardsPlayed: true,
            },
            { kind: 'ORIGINAL_SOURCE_PLAYER', relation: 'OTHER' },
          ],
        ],
      },
      effects,
    };
    const audit = z
      .object({ supportedBinding: z.unknown() })
      .safeParse(retaliation.engineAudit);
    if (
      retaliation.cardType !== 'SOMETIMES' ||
      !same(retaliation.effects, effects) ||
      !same(retaliation.legality, {
        mode: 'SYSTEM_RESPONSE',
        trigger: {
          systemEvent: 'FORTITUDE_LOSS_RESOLVED',
          affected: 'SELF',
          sourcePlayer: 'OTHER',
          sourceCardRequired: true,
          actualLossMin: 1,
          selfPlayedReductionForThisLoss: false,
          selfPlayedIgnoreForThisLoss: false,
        },
      }) ||
      !audit.success ||
      !same(audit.data.supportedBinding, binding) ||
      retaliation.verification.status !== 'VERIFIED_FOR_PROJECT_RULESET' ||
      entry?.status !== 'VERIFIED_FOR_PROJECT_RULESET'
    )
      errors.push(
        'M37 must require another player-played card, actual post-loss timing and no played reduction/Ignore for this specific loss, including Negated mitigation',
      );
    const overrideSchema = z.object({
      sourceId: z.literal('user_m37_gog_retaliation_override_2026_10_06'),
      label: z.literal('M37 USER OVERRIDE'),
      scope: z.literal('GOG_M37_RETALIATION'),
      provenance: z.literal('PROJECT_RULE_OVERRIDE'),
      officialSourceVerified: z.literal(false),
      gogExactSemantics: z.literal('PROJECT_RULE_OVERRIDE'),
      negatedMitigationAttempt: z.literal('PROJECT_RULE_OVERRIDE'),
      printedTitleRequired: z.literal(false),
    });
    const gog =
      source.characters
        .find((c) => c.id === 'gog')
        ?.cards.filter((c) => c.mechanicId === retaliation.id) ?? [];
    if (
      !overrideSchema.safeParse(retaliation.projectRulesetOverrides).success ||
      !same(
        entry?.projectRulesetOverrides,
        retaliation.projectRulesetOverrides,
      ) ||
      !z
        .object({
          gog: z.object({
            exactCardText: z.literal('UNAVAILABLE'),
            normalizedSemantics: z.literal('PROJECT_RULE_OVERRIDE'),
            reductionIgnoreExclusions: z.literal('M37 USER OVERRIDE'),
            negatedMitigationAttempt: z.literal('PROJECT_RULE_OVERRIDE'),
            officialSourceVerified: z.literal(false),
          }),
        })
        .safeParse(retaliation.verification.characterVerification).success ||
      !same(
        entry?.characterVerification,
        retaliation.verification.characterVerification,
      ) ||
      gog.length !== 1 ||
      gog[0]?.quantity !== 1 ||
      gog[0]?.type !== 'SOMETIMES' ||
      !overrideSchema.safeParse(gog[0]?.projectRuleOverride).success ||
      !z
        .object({
          authority: z.literal('PROJECT_RULE_OVERRIDE'),
          scope: z.literal('GOG_M37_RETALIATION'),
          path: z.literal(
            'codex-prompts/step-24a-m37-retaliation-user-override.md',
          ),
          sha256: z.string().regex(/^[a-f0-9]{64}$/),
          officialSourceVerified: z.literal(false),
        })
        .safeParse(source.sources.user_m37_gog_retaliation_override_2026_10_06)
        .success
    )
      errors.push(
        'M37 must preserve one Gog standard copy and separate unavailable exact wording, matrix evidence and the scoped M37 USER OVERRIDE',
      );
  }

  const healing = source.mechanics.find(
    (m) => m.verification.ledgerId === 'M40',
  );
  if (healing !== undefined) {
    const entry = ledger.characterMechanics.find((e) => e.ledgerId === 'M40');
    const same = (a: unknown, b: unknown) =>
      JSON.stringify(a) === JSON.stringify(b);
    const effects = [
      { op: 'CHANGE_STAT', target: 'SELF', stat: 'FORTITUDE', delta: 2 },
    ];
    const audit = z
      .object({ supportedBinding: z.unknown() })
      .safeParse(healing.engineAudit);
    const overrideSchema = z.object({
      sourceId: z.literal('user_m40_gog_healing_override_2026_10_07'),
      label: z.literal('M40 USER OVERRIDE — Gog healing card normalization'),
      scope: z.literal('GOG_M40_HEALING'),
      provenance: z.literal('PROJECT_RULE_OVERRIDE'),
      officialSourceVerified: z.literal(false),
      printedTitleRequired: z.literal(false),
      noAdditionalRestrictions: z.literal(true),
    });
    const gog =
      source.characters
        .find((c) => c.id === 'gog')
        ?.cards.filter((c) => c.mechanicId === healing.id) ?? [];
    if (
      healing.cardType !== 'ANYTIME' ||
      !same(healing.legality, { mode: 'ANYTIME' }) ||
      !same(healing.effects, effects) ||
      !audit.success ||
      !same(audit.data.supportedBinding, { type: 'ANYTIME', effects }) ||
      healing.verification.status !== 'VERIFIED_FOR_PROJECT_RULESET' ||
      entry?.status !== 'VERIFIED_FOR_PROJECT_RULESET'
    )
      errors.push(
        'M40 must use ordinary Anytime legality and exactly shared SELF +2 Fortitude without extra cost, trigger, target or effect',
      );
    if (
      !overrideSchema.safeParse(healing.projectRulesetOverrides).success ||
      !same(entry?.projectRulesetOverrides, healing.projectRulesetOverrides) ||
      !z
        .object({
          gog: z.object({
            exactCardText: z.literal('UNAVAILABLE'),
            printedCardIdentity: z.literal(
              'UNAVAILABLE_WAIVED_BY_M40_USER_OVERRIDE',
            ),
            normalizedSemantics: z.literal('PROJECT_RULE_OVERRIDE'),
            displayLabel: z.literal('NORMALIZED_FALLBACK_NOT_PHYSICAL_TITLE'),
            officialSourceVerified: z.literal(false),
          }),
        })
        .safeParse(healing.verification.characterVerification).success ||
      !same(
        entry?.characterVerification,
        healing.verification.characterVerification,
      ) ||
      gog.length !== 1 ||
      gog[0]?.quantity !== 1 ||
      gog[0]?.type !== 'ANYTIME' ||
      gog[0]?.canonicalCardTitle !== undefined ||
      !same(gog[0]?.display, {
        'en-US': 'Gog the Half-Ogre — Second Wind',
        'zh-TW': '戈格・半食人魔—喘口氣',
      }) ||
      !overrideSchema.safeParse(gog[0]?.projectRuleOverride).success ||
      !z
        .object({
          authority: z.literal('PROJECT_RULE_OVERRIDE'),
          scope: z.literal('GOG_M40_HEALING'),
          path: z.literal(
            'codex-prompts/step-24a-m40-gog-healing-user-override.md',
          ),
          sha256: z.string().regex(/^[a-f0-9]{64}$/),
          officialSourceVerified: z.literal(false),
        })
        .safeParse(source.sources.user_m40_gog_healing_override_2026_10_07)
        .success
    )
      errors.push(
        'M40 must preserve one Gog copy, normalized fallback title, unavailable printed wording, and the scoped M40 USER OVERRIDE separately from publisher rules',
      );
  }

  const same = (a: unknown, b: unknown) =>
    JSON.stringify(a) === JSON.stringify(b);
  for (const [ledgerId, mechanicId, type, mode, amount] of [
    ['M42', 'take_one_gold', 'ANYTIME', 'ANYTIME', 1],
    ['M43', 'take_two_gold', 'ACTION', 'ACTION_PHASE', 2],
  ] as const) {
    const m = source.mechanics.find(
      (m) => m.verification.ledgerId === ledgerId,
    );
    if (
      m &&
      (m.id !== mechanicId ||
        m.cardType !== type ||
        !same(m.legality, { mode, target: 'ANY_LIVING_PLAYER' }) ||
        !same(m.effects, [
          { op: 'TRANSFER_GOLD', from: 'CHOSEN_PLAYER', to: 'SELF', amount },
        ]) ||
        !same(m.engineAudit, {
          status: 'AVAILABLE_SHARED_IMPLEMENTATION',
          supportedBinding: {
            type,
            targetPolicy: 'ANY_LIVING_PLAYER',
            effects: [{ op: 'COLLECT_GOLD', target: 'CHOSEN_PLAYER', amount }],
          },
          missingCapabilities: [],
          productionRdi2CardCompiled: false,
        }))
    )
      errors.push(
        `${ledgerId} must preserve original type, chosen living player including self and exact payment, with shared COLLECT_GOLD binding`,
      );
  }
  const ambrosia = source.drinkDeck.cards.find(
    (d) => d.verification.ledgerId === 'D09',
  );
  if (ambrosia) {
    const entry = ledger.drinks.find((e) => e.drinkId === 'fine_ambrosia');
    const provenance = {
      sourceId: 'user_fine_ambrosia_override_2026_10_05',
      scope: 'FINE_AMBROSIA_CLASSIFICATION_AND_EFFECTS',
      classification: 'PROJECT_RULE_OVERRIDE',
      officialSourceVerified: false,
    };
    if (
      ambrosia.id !== 'fine_ambrosia' ||
      ambrosia.quantity !== 1 ||
      ambrosia.kind !== 'DRINK_EVENT' ||
      ambrosia.verification.status !== 'VERIFIED_FOR_PROJECT_RULESET' ||
      entry?.status !== 'VERIFIED_FOR_PROJECT_RULESET' ||
      !same(ambrosia.effects, [
        { op: 'CHANGE_STAT', target: 'DRINKER', stat: 'ALCOHOL', delta: 1 },
        { op: 'CHANGE_STAT', target: 'DRINKER', stat: 'FORTITUDE', delta: 4 },
        { op: 'PAY_INN', target: 'DRINKER', amount: 2 },
      ]) ||
      !same(ambrosia.projectRulesetOverride, provenance) ||
      !same(entry?.projectRulesetOverride, provenance) ||
      !z
        .object({
          authority: z.literal('USER_SPECIFIED'),
          instruction: z.literal(
            'treat it as drink event, +alcohol +4 fortitude -2 gold',
          ),
          confirmation: z.literal('yes +1 alcohol and 2 gold pay to inn'),
        })
        .safeParse(source.sources.user_fine_ambrosia_override_2026_10_05)
        .success
    )
      errors.push(
        'D09 must preserve the explicit Fine Ambrosia project override: Drink Event, +1 Alcohol/+4 Fortitude/pay Inn two Gold, never official card wording',
      );
  }

  return {
    valid: errors.length === 0,
    errors,
    counts: {
      characters: characterTotals,
      characterPhysical,
      drinkPhysical,
      mechanics: source.mechanics.length,
      verifiedMechanics:
        ledger.characterMechanics.filter(verifiedStatus).length,
      verifiedDrinks: ledger.drinks.filter(verifiedStatus).length,
    },
  };
}

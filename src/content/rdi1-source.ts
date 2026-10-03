import { z } from 'zod';
import { reactionConditionSchema } from './reaction-triggers';
import { RDI1_ENGINE_CAPABILITIES } from './rdi1-capabilities';

const text = z.string().trim().min(1).max(10000);
const key = z.string().regex(/^[a-z][a-z0-9_.-]{0,127}$/);
const integer = z.number().int().safe();
const count = integer.min(0).max(1000);
const amount = integer.min(1).max(64);
const bilingual = z.strictObject({ 'en-US': text, 'zh-TW': text });
const cardType = z.enum([
  'ACTION',
  'SOMETIMES',
  'ANYTIME',
  'GAMBLING',
  'CHEATING',
]);
const systemEvent = z.enum([
  'ANTE_REQUIRED',
  'PAYMENT_REQUIRED',
  'GAMBLING_WIN_BEFORE_PAYOUT',
  'FORTITUDE_LOSS_RESOLVED',
]);
const trigger = z
  .strictObject({
    event: z.enum(['CARD', 'DRINK']).optional(),
    systemEvent: z
      .union([systemEvent, z.array(systemEvent).min(1).max(4)])
      .optional(),
    all: z.array(reactionConditionSchema).min(1).max(16).optional(),
    actor: z.literal('SELF').optional(),
    affects: z.literal('SELF').optional(),
    affected: z.literal('SELF').optional(),
    sourceActor: z.literal('OTHER').optional(),
    sourcePlayer: z.literal('OTHER').optional(),
    sourceTypes: z.array(cardType).min(1).max(5).optional(),
    directStat: z
      .array(z.enum(['FORTITUDE', 'ALCOHOL', 'GOLD']))
      .min(1)
      .max(3)
      .optional(),
    directStatLoss: z.literal('FORTITUDE').optional(),
    actualLossMin: amount.optional(),
    minAmount: amount.optional(),
    negatable: z.boolean().optional(),
    sourceFact: z.literal('CHANGES_DRINK_EFFECT').optional(),
    timing: z
      .enum(['AFTER_REVEAL_BEFORE_RESOLVE', 'AFTER_CHASERS_BEFORE_RESOLVE'])
      .optional(),
  })
  .refine(
    (t) => (t.event !== undefined) !== (t.systemEvent !== undefined),
    'Exactly one event or systemEvent is required',
  );
const targetHint = z.enum([
  'OTHER_PLAYER',
  'CURRENT_DRINK',
  'ANY_LIVING_PLAYER',
  'OTHER_ACTIVE_GAMBLER',
]);
const legality = z.union([
  z.strictObject({
    modes: z
      .array(z.enum(['ACTION_PHASE', 'GAMBLING_PRIORITY']))
      .min(1)
      .max(2),
    blockedAfter: z.array(z.literal('WINNING_HAND_LOCK')).max(1).optional(),
    target: targetHint.optional(),
  }),
  z.strictObject({
    mode: z.literal('ACTION_PHASE'),
    actor: z.literal('SELF').optional(),
    target: targetHint.optional(),
  }),
  z.strictObject({ mode: z.literal('ANYTIME'), target: targetHint.optional() }),
  z.strictObject({
    mode: z.literal('RESPONSE'),
    trigger: trigger.refine(
      (t) => t.event !== undefined,
      'Response needs a card/Drink event',
    ),
    target: targetHint.optional(),
    excludeSourceFacts: z
      .array(
        z.enum([
          'SAME_COUNTER_FAMILY',
          'ORDERS_DRINK',
          'FORCES_DRINK',
          'DIRECT_ALCOHOL_STAT',
          'AFFECTS_DRINK_EVENT',
        ]),
      )
      .min(1)
      .max(5)
      .optional(),
  }),
  z.strictObject({
    mode: z.literal('SYSTEM_RESPONSE'),
    trigger: trigger.refine(
      (t) => t.systemEvent !== undefined,
      'System response needs a system event',
    ),
  }),
  z.strictObject({
    mode: z.literal('MULTI_TRIGGER'),
    triggers: z.array(trigger).min(2).max(8),
  }),
  z.strictObject({
    mode: z.literal('PHASE_OPPORTUNITY'),
    phase: z.literal('ORDER_DRINK'),
    actor: z.literal('SELF'),
  }),
  z.strictObject({
    mode: z.literal('GAMBLING_CHECKPOINT'),
    requires: z.strictObject({
      gamblingActive: z.literal(true),
      notAfterFinalPass: z.boolean().optional(),
      notAnteAvoidance: z.boolean().optional(),
      sourceWillNotEndRound: z.boolean().optional(),
      potMin: amount.optional(),
    }),
  }),
]);
const effectTarget = z.enum([
  'SELF',
  'CHOSEN_PLAYER',
  'EACH_OTHER_PLAYER',
  'ALL_PLAYERS',
  'ORIGINAL_SOURCE_PLAYER',
]);
/** Compilation plans are bounded data. They are deliberately NOT the executable ContentPack DSL. */
export const rdi1EffectPlanSchema = z.union([
  z.strictObject({
    op: z.enum([
      'START_OR_TAKE_GAMBLING_CONTROL',
      'NEGATE_CURRENT_SOURCE',
      'WIN_GAMBLING',
      'CANCEL_CURRENT_ANTE_FOR_SELF',
      'IGNORE_CONTEXT_FOR_SELF',
      'IGNORE_CURRENT_EFFECT_FOR_SELF',
      'IGNORE_CURRENT_DRINK',
      'REPLACE_DRINK_ALCOHOL_WITH_FORTITUDE',
      'DRINKING_CONTEST',
      'ROUND_ON_HOUSE',
    ]),
  }),
  z.strictObject({
    op: z.literal('TAKE_GAMBLING_CONTROL'),
    allowedNextCategories: z
      .array(z.enum(['GAMBLING', 'CHEATING']))
      .min(1)
      .max(2)
      .optional(),
  }),
  z.strictObject({
    op: z.enum([
      'ANTE_ALL_ACTIVE',
      'SUBSTITUTE_PAYMENT_FROM_INN',
      'TAKE_FROM_GAMBLING_POT',
    ]),
    amount,
  }),
  z.strictObject({
    op: z.enum(['FORCE_LEAVE_GAMBLING', 'PASS_CURRENT_DRINK']),
    target: z.literal('CHOSEN_PLAYER'),
  }),
  z.strictObject({
    op: z.enum(['LEAVE_GAMBLING', 'REPLACE_GAMBLING_WINNER']),
    target: z.literal('SELF'),
  }),
  z.strictObject({
    op: z.literal('END_GAMBLING'),
    potDestination: z.literal('INN'),
  }),
  z.strictObject({
    op: z.literal('CONTEXT_BRANCH'),
    branches: z
      .array(
        z.enum([
          'CANCEL_ANTE_AND_LEAVE',
          'IGNORE_CURRENT_DRINK',
          'IGNORE_DRINK_AND_PAY_INN_1',
        ]),
      )
      .min(2)
      .max(3),
  }),
  z.strictObject({
    op: z.literal('FORCE_SIMULTANEOUS_DRINK'),
    targets: z.literal('ALL_PLAYERS'),
  }),
  z.strictObject({
    op: z.literal('ORDER_EXTRA_DRINKS'),
    count: amount,
    targets: z.literal('OTHER_PLAYERS_EACH_CARD'),
  }),
  z.strictObject({
    op: z.literal('QUEUE_EXTRA_DRINK'),
    target: z.literal('SOURCE_ACTOR'),
    source: z.literal('DRINK_ME_PILE'),
    separateDrink: z.literal(true),
  }),
  z.strictObject({
    op: z.literal('FORCE_DRINK'),
    target: z.literal('CHOSEN_PLAYER'),
    source: z.literal('DRINK_ME_PILE'),
  }),
  z.strictObject({
    op: z.literal('SPLIT_CURRENT_DRINK'),
    target: z.literal('CHOSEN_PLAYER'),
    rounding: z.literal('CEIL_EACH_NUMERIC_EFFECT'),
  }),
  z.strictObject({
    op: z.literal('MODIFY_DRINK'),
    alcoholDelta: integer,
    fortitudeDelta: integer,
  }),
  z.strictObject({
    op: z.literal('CHANGE_STAT'),
    target: effectTarget,
    stat: z.enum(['FORTITUDE', 'ALCOHOL', 'GOLD']),
    delta: integer,
  }),
  z.strictObject({
    op: z.enum(['PAY_INN', 'TRANSFER_GOLD']),
    target: effectTarget,
    amount,
  }),
]);
const requirements = z.array(key).max(64);
const verification = z.strictObject({
  status: z.literal('MECHANICALLY_VERIFIED'),
  confidence: z.literal('HIGH'),
  basis: z.array(key).min(1).max(16),
});
const mechanic = z
  .strictObject({
    id: key,
    type: cardType,
    display: bilingual,
    rulesSummary: bilingual,
    responseKind: z.enum(['IGNORE', 'NEGATE', 'SOMETIMES']).nullable(),
    legality,
    effects: z.array(rdi1EffectPlanSchema).min(1).max(32),
    engineRequirements: requirements,
    notes: z.array(text).max(32),
    verification,
  })
  .refine(
    (m) =>
      m.type !== 'SOMETIMES' ||
      ('mode' in m.legality &&
        [
          'RESPONSE',
          'SYSTEM_RESPONSE',
          'MULTI_TRIGGER',
          'PHASE_OPPORTUNITY',
          'GAMBLING_CHECKPOINT',
        ].includes(m.legality.mode)),
    'Sometimes requires explicit response, system, phase or checkpoint legality',
  );
const card = z.strictObject({
  cardKey: key,
  mechanicId: key,
  quantity: amount,
  display: bilingual,
  rulesSummary: bilingual,
  type: cardType,
});
const drink = z
  .strictObject({
    drinkKey: key,
    quantity: amount,
    type: z.enum(['DRINK', 'DRINK_EVENT']),
    display: bilingual,
    rulesSummary: bilingual,
    alcoholContent: integer.optional(),
    fortitudeChange: integer.optional(),
    chaser: z.boolean().optional(),
    specialMechanics: z
      .array(
        z.strictObject({
          op: z.literal('TRAIT_REPLACEMENT'),
          trait: z.enum(['ORC', 'TROLL']),
          replace: z.strictObject({ alcohol: integer, fortitude: integer }),
        }),
      )
      .max(8)
      .optional(),
    effectPlan: z.array(rdi1EffectPlanSchema).min(1).max(32).optional(),
    engineRequirements: requirements.optional(),
  })
  .refine(
    (d) =>
      d.type === 'DRINK'
        ? d.alcoholContent !== undefined &&
          d.fortitudeChange !== undefined &&
          d.chaser !== undefined &&
          d.specialMechanics !== undefined
        : d.effectPlan !== undefined && d.engineRequirements !== undefined,
    'Drinks need numeric/special plans; Events need effectPlan and engineRequirements',
  );
export const rdi1SourceSchema = z.strictObject({
  schemaVersion: z.literal('rdi1-mechanics-normalized-v1'),
  status: z.literal('READY_FOR_ENGINE_COMPILATION'),
  copyrightStrategy: z.strictObject({
    cardNames: text,
    rulesText: text,
    publicDistributionNote: text,
  }),
  sourceRefs: z.record(key, z.strictObject({ url: z.url(), role: text })),
  product: z.strictObject({
    id: z.literal('rdi1'),
    canonicalName: text,
    display: bilingual,
    characterCount: count,
    characterPhysicalCards: count,
    drinkPhysicalCards: count,
  }),
  characters: z
    .array(
      z.strictObject({
        id: z.enum(['deirdre', 'fiona', 'gerki', 'zot']),
        canonicalName: text,
        display: bilingual,
        role: bilingual,
        primaryDeckPhysicalCount: count,
        cards: z.array(card).min(1).max(160),
      }),
    )
    .min(1)
    .max(4),
  mechanics: z.array(mechanic).min(1).max(256),
  drinkDeck: z.strictObject({
    physicalCount: count,
    cards: z.array(drink).min(1).max(64),
  }),
  verification: z.strictObject({
    deckTotals: z.strictObject({
      deirdre: count,
      fiona: count,
      gerki: count,
      zot: count,
    }),
    characterPhysicalTotal: count,
    drinkPhysicalTotal: count,
    expected: z.strictObject({
      deirdre: count,
      fiona: count,
      gerki: count,
      zot: count,
      drink: count,
    }),
  }),
});
export type Rdi1Source = z.infer<typeof rdi1SourceSchema>;
export const rdi1RequiredCapabilitiesSchema = z.strictObject({
  requiredCapabilities: requirements.min(1),
});
export function verifyRdi1Source(input: unknown, requiredInput: unknown) {
  const errors: string[] = [];
  const parsed = rdi1SourceSchema.safeParse(input),
    required = rdi1RequiredCapabilitiesSchema.safeParse(requiredInput);
  for (const result of [parsed, required])
    if (!result.success)
      for (const issue of result.error.issues)
        errors.push(`${issue.path.join('.')}: ${issue.message}`);
  if (!parsed.success || !required.success)
    return { valid: false, errors, source: null, counts: null };
  const source = parsed.data;
  const unique = (values: string[], label: string) => {
    if (new Set(values).size !== values.length)
      errors.push(`Duplicate ${label} key`);
  };
  unique(
    source.characters.map((c) => c.id),
    'character',
  );
  unique(
    source.mechanics.map((m) => m.id),
    'mechanic',
  );
  unique(
    source.characters.flatMap((c) => c.cards.map((card) => card.cardKey)),
    'card',
  );
  unique(
    source.drinkDeck.cards.map((d) => d.drinkKey),
    'Drink',
  );
  unique(required.data.requiredCapabilities, 'capability');
  const mechanics = new Map(source.mechanics.map((m) => [m.id, m]));
  const referenced = new Set<string>();
  const totals: Record<string, number> = {};
  for (const character of source.characters) {
    totals[character.id] = character.cards.reduce(
      (sum, card) => sum + card.quantity,
      0,
    );
    for (const card of character.cards) {
      referenced.add(card.mechanicId);
      const definition = mechanics.get(card.mechanicId);
      if (!definition) errors.push(`Missing mechanic ${card.mechanicId}`);
      else if (definition.type !== card.type)
        errors.push(`Type mismatch for ${card.cardKey}`);
      if (!card.cardKey.startsWith(`${character.id}.`))
        errors.push(`Wrong owner for ${card.cardKey}`);
    }
  }
  for (const id of ['deirdre', 'fiona', 'gerki', 'zot'] as const)
    if (
      totals[id] !== 40 ||
      source.characters.find((c) => c.id === id)?.primaryDeckPhysicalCount !==
        40 ||
      source.verification.deckTotals[id] !== 40 ||
      source.verification.expected[id] !== 40
    )
      errors.push(`${id}: physical deck must equal 40`);
  const characterPhysical = Object.values(totals).reduce((a, b) => a + b, 0),
    drinkPhysical = source.drinkDeck.cards.reduce(
      (sum, d) => sum + d.quantity,
      0,
    );
  if (
    characterPhysical !== 160 ||
    source.product.characterPhysicalCards !== 160 ||
    source.verification.characterPhysicalTotal !== 160 ||
    source.product.characterCount !== 4 ||
    source.characters.length !== 4
  )
    errors.push(
      'Character physical total must equal 160 across four characters',
    );
  if (
    drinkPhysical !== 30 ||
    source.drinkDeck.physicalCount !== 30 ||
    source.product.drinkPhysicalCards !== 30 ||
    source.verification.drinkPhysicalTotal !== 30 ||
    source.verification.expected.drink !== 30
  )
    errors.push('Drink physical total must equal 30');
  for (const m of source.mechanics) {
    if (!referenced.has(m.id)) errors.push(`Unreferenced mechanic ${m.id}`);
    for (const ref of m.verification.basis)
      if (!Object.hasOwn(source.sourceRefs, ref))
        errors.push(`Missing evidence reference ${ref}`);
  }
  const used = source.mechanics
    .flatMap((m) => m.engineRequirements)
    .concat(source.drinkDeck.cards.flatMap((d) => d.engineRequirements ?? []));
  for (const id of [...used, ...required.data.requiredCapabilities])
    if (!Object.hasOwn(RDI1_ENGINE_CAPABILITIES, id))
      errors.push(`Unknown engine requirement ${id}`);
  for (const id of new Set(used))
    if (!required.data.requiredCapabilities.includes(id))
      errors.push(`Undeclared engine requirement ${id}`);
  for (const id of required.data.requiredCapabilities)
    if (!used.includes(id)) errors.push(`Unused required capability ${id}`);
  const visit = (value: unknown) => {
    if (typeof value === 'string' && /\b(?:UNKNOWN|TODO|NO_OP)\b/i.test(value))
      errors.push('Forbidden UNKNOWN/TODO/NO_OP entry');
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value !== null && typeof value === 'object')
      for (const [name, child] of Object.entries(value)) {
        visit(name);
        visit(child);
      }
  };
  visit(source);
  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)],
    source,
    counts: {
      characters: totals,
      characterPhysical,
      drinkPhysical,
      mechanics: source.mechanics.length,
      characterRecords: source.characters.flatMap((c) => c.cards).length,
      drinkRecords: source.drinkDeck.cards.length,
      sometimes: source.mechanics.filter((m) => m.type === 'SOMETIMES').length,
    },
  };
}

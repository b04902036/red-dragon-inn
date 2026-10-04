import { cardDefinitionSchema } from './cards';
import type { CardDefinition } from './cards';
import { effectSchema } from './effects';
import type { Effect } from './effects';
import { contentPackSchema } from './pack';
import type { ContentPack } from './pack';
import type { ReactionCondition, ResponseTrigger } from './reaction-triggers';
import { rdi1SourceSchema, verifyRdi1Source } from './rdi1-source';
import type { Rdi1Source } from './rdi1-source';
import { releasedCatalog } from './catalog';

export const RDI1_VERSION = 'content_rdi1_mechanics_v1';
type Mechanic = Rdi1Source['mechanics'][number];
type Trigger = Extract<Mechanic['legality'], { mode: 'RESPONSE' }>['trigger'];
type Plan = Mechanic['effects'][number];
const idKey = (key: string) => key.replaceAll('.', '_').replaceAll('-', '_');

/** Explicit plan-to-DSL translation; unknown plans fail closed in the source schema. */
export function compileRdi1Effect(plan: Plan): Effect {
  switch (plan.op) {
    case 'START_OR_TAKE_GAMBLING_CONTROL':
      return { op: 'START_GAMBLING' };
    case 'TAKE_GAMBLING_CONTROL':
      return {
        op: plan.op,
        allowedNextCategories: plan.allowedNextCategories ?? [
          'GAMBLING',
          'CHEATING',
        ],
      };
    case 'NEGATE_CURRENT_SOURCE':
      return { op: 'NEGATE', scope: 'TOP_STACK' };
    case 'IGNORE_CONTEXT_FOR_SELF':
    case 'IGNORE_CURRENT_EFFECT_FOR_SELF':
    case 'IGNORE_CURRENT_DRINK':
      return { op: 'IGNORE', scope: 'CURRENT_EFFECT' };
    case 'TRANSFER_GOLD':
      // Normalized source plans describe collecting FROM the specified players.
      return { op: 'COLLECT_GOLD', target: plan.target, amount: plan.amount };
    case 'ORDER_EXTRA_DRINKS':
      return { op: plan.op, count: plan.count };
    case 'QUEUE_EXTRA_DRINK':
    case 'FORCE_DRINK':
    case 'SPLIT_CURRENT_DRINK':
      return effectSchema.parse({ op: plan.op, target: plan.target });
    default:
      return effectSchema.parse(plan);
  }
}

function compileTrigger(trigger: Trigger): ReactionCondition[][] {
  const all: ReactionCondition[] = [...(trigger.all ?? [])];
  if (trigger.systemEvent !== undefined) {
    const events = Array.isArray(trigger.systemEvent)
      ? trigger.systemEvent
      : [trigger.systemEvent];
    all.push({ kind: 'SYSTEM_EVENT', events });
    if (trigger.actor === 'SELF')
      all.push({
        kind: 'PAYMENT_CONTEXT',
        payer: 'SELF',
        purpose:
          events.length === 1 && events[0] === 'ANTE_REQUIRED' ? 'ANTE' : 'ANY',
        minAmount: trigger.minAmount ?? 1,
      });
  } else all.push({ kind: 'SOURCE_KIND', kinds: [trigger.event!] });
  if (trigger.affects !== undefined)
    all.push({ kind: 'AFFECTS', relation: trigger.affects });
  if (trigger.affected !== undefined)
    all.push({
      kind: 'ACTUAL_STAT_LOSS',
      stat: 'FORTITUDE',
      relation: trigger.affected,
      minAmount: trigger.actualLossMin ?? 1,
    });
  if (trigger.sourceActor !== undefined)
    all.push({ kind: 'SOURCE_ACTOR', relation: trigger.sourceActor });
  if (trigger.sourcePlayer !== undefined)
    all.push({
      kind: 'ORIGINAL_SOURCE_PLAYER',
      relation: trigger.sourcePlayer,
    });
  if (trigger.sourceTypes !== undefined)
    all.push({ kind: 'SOURCE_TYPE', types: trigger.sourceTypes });
  if (trigger.negatable !== undefined)
    all.push({ kind: 'NEGATABLE', value: trigger.negatable });
  if (trigger.sourceFact !== undefined)
    all.push({
      kind: 'SOURCE_CAPABILITY',
      capabilities: [trigger.sourceFact],
      match: 'ANY',
    });
  if (trigger.directStatLoss !== undefined)
    all.push({
      kind: 'PENDING_STAT',
      stat: trigger.directStatLoss,
      direction: 'LOSS',
      relation: 'SELF',
    });
  // Both reveal timing hints refer to the completed compound Drink response window.
  return trigger.directStat === undefined
    ? [all]
    : trigger.directStat.map((stat) => [
        ...all,
        { kind: 'PENDING_STAT', stat, direction: 'ANY', relation: 'SELF' },
      ]);
}

export function compileRdi1Trigger(
  legality: Mechanic['legality'],
): ResponseTrigger {
  if (!('mode' in legality))
    throw new RangeError('Expected Sometimes legality');
  switch (legality.mode) {
    case 'RESPONSE': {
      const alternatives = compileTrigger(legality.trigger);
      for (const alternative of alternatives) {
        const exclusions = legality.excludeSourceFacts ?? [];
        if (exclusions.includes('SAME_COUNTER_FAMILY'))
          alternative.push({ kind: 'COUNTER_FAMILY', relation: 'DIFFERENT' });
        const capabilities = exclusions.filter(
          (fact) => fact !== 'SAME_COUNTER_FAMILY',
        );
        if (capabilities.length)
          alternative.push({
            kind: 'SOURCE_CAPABILITY',
            capabilities,
            match: 'NONE',
          });
      }
      return { event: legality.trigger.event!, alternatives };
    }
    case 'SYSTEM_RESPONSE':
      return {
        event: 'SYSTEM',
        alternatives: compileTrigger(legality.trigger),
      };
    case 'MULTI_TRIGGER':
      return {
        event: 'ANY',
        alternatives: legality.triggers.flatMap(compileTrigger),
      };
    case 'PHASE_OPPORTUNITY':
      return {
        event: 'SYSTEM',
        alternatives: [
          [
            { kind: 'SYSTEM_EVENT', events: ['PHASE_OPPORTUNITY'] },
            {
              kind: 'PHASE_OPPORTUNITY',
              phase: legality.phase,
              actor: legality.actor,
            },
          ],
        ],
      };
    case 'GAMBLING_CHECKPOINT':
      return {
        event: 'SYSTEM',
        alternatives: [
          [
            { kind: 'SYSTEM_EVENT', events: ['GAMBLING_CHECKPOINT'] },
            { kind: 'GAMBLING', fact: 'ACTIVE' },
            {
              kind: 'GAMBLING_CHECKPOINT',
              notAfterFinalPass: legality.requires.notAfterFinalPass ?? false,
              notAnteAvoidance: legality.requires.notAnteAvoidance ?? false,
              sourceWillNotEndRound:
                legality.requires.sourceWillNotEndRound ?? false,
              potMin: legality.requires.potMin ?? 0,
            },
          ],
        ],
      };
    default:
      throw new RangeError('Expected Sometimes legality');
  }
}

/** Deterministic pure compiler: no wall clock, RNG, filesystem, or runtime title checks. */
export function compileRdi1Source(input: unknown): ContentPack {
  const source = rdi1SourceSchema.parse(input);
  const requiredCapabilities = [
    ...new Set([
      ...source.mechanics.flatMap((m) => m.engineRequirements),
      ...source.drinkDeck.cards.flatMap((d) => d.engineRequirements ?? []),
    ]),
  ];
  const verified = verifyRdi1Source(source, { requiredCapabilities });
  if (!verified.valid) throw new RangeError(verified.errors.join('\n'));
  const pack: ContentPack = contentPackSchema.parse({
    schemaVersion: 1,
    version: {
      id: RDI1_VERSION,
      name: 'RDI1 public-rules mechanics paraphrase v1',
      createdAt: '2026-10-04T00:00:00.000Z',
    },
    products: [
      {
        id: 'product_rdi1',
        slug: 'rdi1',
        name: source.product.canonicalName,
        releaseYear: 2007,
      },
    ],
    characters: [],
    decks: [],
    cards: [],
    deckCards: [],
    ruleModules: [],
    assets: [],
    requirements: [],
    translations: [],
  });
  const translate = (
    entityType: 'PRODUCT' | 'CHARACTER' | 'CARD',
    entityId: string,
    field: 'name' | 'rulesText',
    bilingual: { 'en-US': string; 'zh-TW': string },
  ) => {
    for (const locale of ['en-US', 'zh-TW'] as const)
      pack.translations!.push({
        entityType,
        entityId,
        field,
        locale,
        text: bilingual[locale],
        sourceKind: 'MANUAL',
        sourceRef: 'rdi1-mechanics-normalized-v1',
        status: 'MANUAL_REVIEWED',
      });
  };
  translate('PRODUCT', 'product_rdi1', 'name', source.product.display);
  const mechanics = new Map(source.mechanics.map((m) => [m.id, m]));
  // Character traits are content metadata, verified against the publisher's character profiles.
  const traits = {
    deirdre: ['ELF'],
    fiona: ['HUMAN'],
    gerki: ['HALFLING'],
    zot: ['HUMAN'],
  };
  for (const character of [...source.characters].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    const characterId = releasedCatalog.find(
      (c) => c.canonicalName === character.canonicalName,
    )?.id;
    if (characterId === undefined)
      throw new RangeError('Unknown RDI1 character identity');
    pack.characters.push({
      id: characterId as ContentPack['characters'][number]['id'],
      productId: pack.products[0]!.id,
      slug: `rdi1-${character.id}`,
      name: character.canonicalName,
      villain: false,
      complexity: null,
      specialRuleKey: null,
      rules: { traits: traits[character.id], resources: {}, sideDeckKeys: [] },
    });
    const deck = {
      id: `deck_rdi1_${character.id}`,
      characterId,
      type: 'CHARACTER',
      slug: `rdi1-${character.id}`,
      name: `${character.display['en-US']} deck`,
    };
    pack.decks.push(contentPackSchema.shape.decks.element.parse(deck));
    pack.requirements!.push({
      characterId: pack.characters.at(-1)!.id,
      primaryDeckCount: 40,
      sideDecks: [],
      components: [],
    });
    translate('CHARACTER', characterId, 'name', character.display);
    for (const record of [...character.cards].sort((a, b) =>
      a.cardKey.localeCompare(b.cardKey),
    )) {
      const mechanic = mechanics.get(record.mechanicId)!;
      let effects = mechanic.effects.map(compileRdi1Effect);
      const cost = effects.find(
        (effect) => effect.op === 'PAY_INN' && effect.target === 'SELF',
      );
      const mandatoryGoldCost =
        cost?.op === 'PAY_INN' ? cost.amount : undefined;
      if (cost !== undefined)
        effects = effects.filter((effect) => effect !== cost);
      const control = effects.find(
        (effect) => effect.op === 'TAKE_GAMBLING_CONTROL',
      );
      const metadata = {
        ...(mandatoryGoldCost === undefined ? {} : { mandatoryGoldCost }),
        ...('target' in mechanic.legality &&
        mechanic.legality.target === 'ANY_LIVING_PLAYER'
          ? { targetPolicy: 'ANY_LIVING_PLAYER' }
          : {}),
        ...(mechanic.id === 'negate_sometimes_counter'
          ? {
              counterFamily: 'rdi_core_hard_no',
              counterPolicy: 'SAME_FAMILY_ONLY',
            }
          : {}),
        ...(mechanic.id === 'negate_drink_change_card'
          ? { counterFamily: 'rdi_core_drink_change' }
          : {}),
      };
      const definition: CardDefinition = cardDefinitionSchema.parse({
        id: `carddef_rdi1_${idKey(record.cardKey)}`,
        characterId,
        type: record.type,
        name: record.display['en-US'],
        rulesText: record.rulesSummary['en-US'],
        source: 'PUBLIC_RULES_PARAPHRASE',
        negatable: true,
        effects,
        ...metadata,
        ...(record.type === 'SOMETIMES'
          ? {
              responseKind: mechanic.responseKind ?? 'SOMETIMES',
              responseTrigger: compileRdi1Trigger(mechanic.legality),
              ...('mode' in mechanic.legality &&
              mechanic.legality.mode === 'PHASE_OPPORTUNITY'
                ? { phaseOpportunity: mechanic.legality.phase }
                : {}),
            }
          : {}),
        ...(record.type === 'GAMBLING' || record.type === 'CHEATING'
          ? {
              gambling: {
                canStart:
                  'modes' in mechanic.legality &&
                  mechanic.legality.modes.includes('ACTION_PHASE'),
                allowedNextCategories:
                  control?.op === 'TAKE_GAMBLING_CONTROL'
                    ? control.allowedNextCategories
                    : ['GAMBLING', 'CHEATING'],
                immediateWin: false,
              },
            }
          : {}),
      });
      pack.cards.push(definition);
      pack.deckCards.push({
        deckId: pack.decks.at(-1)!.id,
        cardId: definition.id,
        quantity: record.quantity,
      });
      translate('CARD', definition.id, 'name', record.display);
      translate('CARD', definition.id, 'rulesText', record.rulesSummary);
    }
  }
  const drinkDeck = contentPackSchema.shape.decks.element.parse({
    id: 'deck_rdi1_inn',
    characterId: null,
    type: 'INN_DRINK',
    slug: 'rdi1-inn',
    name: 'RDI1 Inn Drink deck',
  });
  pack.decks.push(drinkDeck);
  for (const drink of [...source.drinkDeck.cards].sort((a, b) =>
    a.drinkKey.localeCompare(b.drinkKey),
  )) {
    const definition = cardDefinitionSchema.parse({
      id: `carddef_rdi1_drink_${idKey(drink.drinkKey)}`,
      type: drink.type,
      name: drink.display['en-US'],
      rulesText: drink.rulesSummary['en-US'],
      source: 'PUBLIC_RULES_PARAPHRASE',
      negatable: false,
      effects: (drink.effectPlan ?? []).map(compileRdi1Effect),
      ...(drink.type === 'DRINK'
        ? {
            alcoholContent: drink.alcoholContent!,
            fortitudeChange: drink.fortitudeChange!,
            chaser: drink.chaser!,
            chaserSource: 'INN',
            traitReplacements: drink.specialMechanics!.map((special) => ({
              trait: special.trait,
              alcoholContent: special.replace.alcohol,
              fortitudeChange: special.replace.fortitude,
            })),
          }
        : {}),
    });
    pack.cards.push(definition);
    pack.deckCards.push({
      deckId: drinkDeck.id,
      cardId: definition.id,
      quantity: drink.quantity,
    });
    translate('CARD', definition.id, 'name', drink.display);
    translate('CARD', definition.id, 'rulesText', drink.rulesSummary);
  }
  return contentPackSchema.parse(pack);
}

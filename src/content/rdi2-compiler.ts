import { z } from 'zod';
import { cardDefinitionSchema } from './cards';
import { effectSchema } from './effects';
import type { Effect } from './effects';
import { contentPackSchema } from './pack';
import type { ContentPack } from './pack';
import { releasedCatalog } from './catalog';
import { rdi2SourceSchema, verifyRdi2Source } from './rdi2-source';
import type {
  ReactionCondition as Condition,
  ResponseTrigger,
} from './reaction-triggers';
import { responseTriggerSchema } from './reaction-triggers';
import { characterIdSchema } from '../shared/ids';

export const RDI2_VERSION = 'content_rdi2_mechanics_v1';
export const COMBINED_VERSION = 'content_rdi1_rdi2_mechanics_v1';
export interface Rdi2AuditInputs {
  ledger: unknown;
  matrix: string;
  lock: unknown;
  hashes: Parameters<typeof verifyRdi2Source>[4];
}
type Plan = { op: string; [key: string]: unknown };
const selfStat = (
  stat: 'FORTITUDE' | 'ALCOHOL' | 'GOLD',
  direction: 'ANY' | 'LOSS' = 'ANY',
): Condition => ({ kind: 'PENDING_STAT', stat, direction, relation: 'SELF' });
const sourceCard: Condition = { kind: 'SOURCE_KIND', kinds: ['CARD'] };
const cardTypes: Condition = {
  kind: 'SOURCE_TYPE',
  types: ['ACTION', 'SOMETIMES', 'ANYTIME'],
};
const affectsSelf: Condition = { kind: 'AFFECTS', relation: 'SELF' };
const payment: Condition = {
  kind: 'PAYMENT_CONTEXT',
  payer: 'SELF',
  purpose: 'ANY',
  minAmount: 1,
};
const ante: Condition[] = [
  { kind: 'SYSTEM_EVENT', events: ['ANTE_REQUIRED'] },
  { ...payment, purpose: 'ANTE' },
  { kind: 'GAMBLING', fact: 'PARTICIPANT' },
];
const ownOrder: Condition[] = [
  { kind: 'SYSTEM_EVENT', events: ['PHASE_OPPORTUNITY'] },
  { kind: 'PHASE_OPPORTUNITY', phase: 'ORDER_DRINK', actor: 'SELF' },
];
const drink: Condition[] = [{ kind: 'SOURCE_KIND', kinds: ['DRINK'] }];

/** Compiler identities select audited bindings; the runtime never dispatches on these IDs. */
export function compileRdi2Trigger(
  id: string,
  character: string,
): ResponseTrigger {
  let event: ResponseTrigger['event'] = 'CARD';
  let alternatives: Condition[][];
  switch (id) {
    case 'anti_cheat_win_round':
      alternatives = [
        [
          sourceCard,
          { kind: 'SOURCE_TYPE', types: ['CHEATING'] },
          { kind: 'GAMBLING', fact: 'PARTICIPANT' },
        ],
      ];
      break;
    case 'dump_gambling_pot_to_inn':
    case 'take_one_from_pot':
      event = 'SYSTEM';
      alternatives = [
        [
          { kind: 'SYSTEM_EVENT', events: ['GAMBLING_CHECKPOINT'] },
          { kind: 'GAMBLING', fact: 'ACTIVE' },
          {
            kind: 'GAMBLING_CHECKPOINT',
            notAfterFinalPass: true,
            notAnteAvoidance: id === 'dump_gambling_pot_to_inn',
            sourceWillNotEndRound: id === 'dump_gambling_pot_to_inn',
            potMin: id === 'take_one_from_pot' ? 1 : 0,
          },
        ],
      ];
      break;
    case 'restart_gambling_round':
      event = 'SYSTEM';
      alternatives = [
        [
          { kind: 'SYSTEM_EVENT', events: ['GAMBLING_WIN_BEFORE_PAYOUT'] },
          { kind: 'GAMBLING', fact: 'PARTICIPANT' },
        ],
      ];
      break;
    case 'substitute_payment_from_inn':
    case 'illusionary_payment':
      event = 'SYSTEM';
      alternatives = [[payment]];
      break;
    case 'avoid_ante_leave':
      event = 'SYSTEM';
      alternatives = [ante];
      break;
    case 'avoid_ante_leave_or_ignore_drink':
      event = 'ANY';
      alternatives = [ante, [...drink, affectsSelf]];
      break;
    case 'ignore_card_all_stats':
      alternatives = (['FORTITUDE', 'ALCOHOL', 'GOLD'] as const).map((stat) => [
        sourceCard,
        cardTypes,
        selfStat(stat),
      ]);
      break;
    case 'ignore_card_fortitude':
      alternatives = [[sourceCard, cardTypes, selfStat('FORTITUDE')]];
      break;
    case 'negate_sometimes_counter':
      alternatives = [
        [
          sourceCard,
          { kind: 'SOURCE_TYPE', types: ['SOMETIMES'] },
          { kind: 'NEGATABLE', value: true },
        ],
      ];
      break;
    case 'ignore_drink':
    case 'pass_own_drink':
    case 'split_own_drink':
    case 'alcohol_to_fortitude':
      event = 'DRINK';
      alternatives = [[...drink, affectsSelf]];
      break;
    case 'order_two_extra_drinks_paid':
      event = 'SYSTEM';
      alternatives = [ownOrder];
      break;
    case 'order_two_extra_drinks_free_or_waive_refill':
      event = 'SYSTEM';
      alternatives = [
        ownOrder,
        [
          { kind: 'SYSTEM_EVENT', events: ['DRINK_DECK_REFILL_PAYMENT'] },
          payment,
        ],
      ];
      break;
    case 'force_extra_drink_during_other_drink_phase':
      if (character === 'dimli') {
        event = 'SYSTEM';
        alternatives = [
          [
            { kind: 'SYSTEM_EVENT', events: ['PHASE_OPPORTUNITY'] },
            { kind: 'PHASE_OPPORTUNITY', phase: 'DRINK', actor: 'OTHER' },
          ],
        ];
      } else if (character === 'gog') {
        event = 'DRINK';
        alternatives = [
          [...drink, { kind: 'SOURCE_ACTOR', relation: 'OTHER' }],
        ];
      } else throw new RangeError('Unsupported extra-Drink template owner');
      break;
    case 'add_two_alcohol_to_drink':
      event = 'DRINK';
      alternatives = [drink];
      break;
    case 'replace_drink_with_four_alcohol':
      event = 'DRINK';
      alternatives = [[...drink, { kind: 'SOURCE_ACTOR', relation: 'OTHER' }]];
      break;
    case 'negate_drink_change_card':
      alternatives = [
        [
          sourceCard,
          { kind: 'SOURCE_TYPE', types: ['SOMETIMES'] },
          { kind: 'NEGATABLE', value: true },
          { kind: 'COUNTER_FAMILY', relation: 'DIFFERENT' },
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
      ];
      break;
    case 'hit_back_two_after_loss':
      event = 'SYSTEM';
      alternatives = [
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
      ];
      break;
    case 'share_pain':
      alternatives = [
        [
          sourceCard,
          selfStat('FORTITUDE', 'LOSS'),
          { kind: 'ORIGINAL_SOURCE_PLAYER', relation: 'OTHER' },
        ],
      ];
      break;
    case 'redirect_fortitude_loss':
      alternatives = [
        [
          sourceCard,
          selfStat('FORTITUDE', 'LOSS'),
          { kind: 'LIVING_PLAYER_COUNT', min: 3, max: 4 },
        ],
        [
          sourceCard,
          cardTypes,
          selfStat('FORTITUDE'),
          { kind: 'LIVING_PLAYER_COUNT', min: 2, max: 2 },
        ],
      ];
      break;
    default:
      throw new RangeError(`Unsupported Sometimes mechanic ${id}`);
  }
  return responseTriggerSchema.parse({ event, alternatives });
}

export function compileRdi2Effect(plan: Plan): Effect {
  const target = plan.target === 'DRINKER' ? 'SELF' : plan.target;
  let effect: unknown;
  switch (plan.op) {
    case 'START_OR_TAKE_GAMBLING_CONTROL':
      effect = { op: 'START_GAMBLING' };
      break;
    case 'TAKE_GAMBLING_CONTROL':
      effect = {
        op: plan.op,
        allowedNextCategories:
          plan.lockNextControlTo === 'CHEATING'
            ? ['CHEATING']
            : ['GAMBLING', 'CHEATING'],
      };
      break;
    case 'NEGATE_CURRENT_SOURCE':
      effect = { op: 'NEGATE', scope: 'TOP_STACK' };
      break;
    case 'IGNORE_CURRENT_EFFECT_FOR_SELF':
    case 'IGNORE_CURRENT_DRINK':
      effect = { op: 'IGNORE', scope: 'CURRENT_EFFECT' };
      break;
    case 'WIN_GAMBLING':
    case 'PREVENT_CURRENT_GOLD_LOSS':
    case 'CANCEL_CURRENT_ANTE_FOR_SELF':
    case 'DRINKING_CONTEST':
    case 'ROUND_ON_HOUSE':
      effect = { op: plan.op };
      break;
    case 'ANTE_ALL_ACTIVE':
      effect = { op: plan.op, amount: plan.amount };
      break;
    case 'FORCE_LEAVE_GAMBLING':
      effect = { op: plan.op, target, allowSelfTarget: true };
      break;
    case 'END_GAMBLING':
      effect = { op: plan.op, potDestination: plan.potDestination };
      break;
    case 'RESTART_GAMBLING_ROUND':
      effect = { op: plan.op, ante: plan.ante };
      break;
    case 'SUBSTITUTE_CURRENT_GOLD_LOSS_FROM_INN':
      effect = {
        op: 'SUBSTITUTE_PAYMENT_FROM_INN',
        amount: 1,
        scope: 'CURRENT_OBLIGATION',
      };
      break;
    case 'TAKE_FROM_GAMBLING_POT':
      effect = { op: plan.op, amount: plan.amount };
      break;
    case 'LEAVE_GAMBLING':
    case 'PASS_CURRENT_DRINK':
    case 'SPLIT_CURRENT_DRINK':
      effect = { op: plan.op, target };
      break;
    case 'REPLACE_DRINK_ALCOHOL_WITH_FORTITUDE':
      effect = { op: plan.op };
      break;
    case 'ORDER_EXTRA_DRINKS':
      effect = { op: plan.op, count: plan.count };
      break;
    case 'CONTEXT_BRANCH':
      effect =
        Array.isArray(plan.branches) &&
        plan.branches.every((b) => typeof b === 'string')
          ? {
              op: plan.op,
              branches: ['CANCEL_ANTE_AND_LEAVE', 'IGNORE_CURRENT_DRINK'],
            }
          : { op: 'ORDER_EXTRA_OR_WAIVE_REFILL', count: 2 };
      break;
    case 'CHARACTER_TEMPLATE':
      effect = { op: 'QUEUE_EXTRA_DRINK', target: 'SOURCE_ACTOR' };
      break;
    case 'FORCE_SIMULTANEOUS_DRINK_FROM_INN':
      effect = {
        op: 'FORCE_SIMULTANEOUS_DRINK',
        targets: 'ALL_PLAYERS',
        source: 'INN',
        skipLeadingEvents: true,
      };
      break;
    case 'MODIFY_DRINK':
      effect = {
        op: plan.op,
        alcoholDelta: plan.alcoholDelta,
        fortitudeDelta: plan.fortitudeDelta,
        allowDrinkEvents: false,
      };
      break;
    case 'REPLACE_CURRENT_DRINK_BASE_EFFECTS':
      effect = {
        op: 'REPLACE_DRINK_BASE',
        alcohol: plan.alcohol,
        fortitude: plan.fortitude,
      };
      break;
    case 'TRANSFER_GOLD':
      effect = { op: 'COLLECT_GOLD', target: plan.from, amount: plan.amount };
      break;
    case 'CHANGE_STAT':
      effect = { op: plan.op, target, stat: plan.stat, delta: plan.delta };
      break;
    case 'PAY_INN':
      effect = { op: plan.op, target, amount: plan.amount };
      break;
    case 'SPLIT_PENDING_FORTITUDE_LOSS_WITH_SOURCE':
      effect = { op: 'SHARE_FORTITUDE_LOSS' };
      break;
    case 'REDIRECT_PENDING_FORTITUDE_LOSS':
      effect = {
        op: 'REDIRECT_FORTITUDE_LOSS',
        target,
        excludeOriginalSource: true,
        twoPlayerIgnoreFallback: true,
      };
      break;
    case 'OPTIONAL_CHALLENGE':
      effect = { op: 'OPTIONAL_DRINK_CHALLENGE', target: 'SELF' };
      break;
    default:
      throw new RangeError(`Unsupported normalized effect ${plan.op}`);
  }
  return effectSchema.parse(effect);
}

const zh = (text: string) =>
  text
    .replaceAll('體力', '耐力值')
    .replace(/耐力(?!值)/g, '耐力值')
    .replace(/酒精含量|酒精(?!值)/g, '酒精值')
    .replace(/飲酒事件|飲料事件/g, '酒卡事件')
    .replaceAll('Drink Me!', '暢飲區');

/** Pure compilation accepts only an individually audited, hash-matched source bundle. */
export function compileRdi2Source(
  input: unknown,
  audit: Rdi2AuditInputs,
): ContentPack {
  const verified = verifyRdi2Source(
    input,
    audit.ledger,
    audit.matrix,
    audit.lock,
    audit.hashes,
  );
  if (!verified.valid) throw new RangeError(verified.errors.join('\n'));
  const source = rdi2SourceSchema.parse(input);
  const product = z
    .object({
      canonicalName: z.string(),
      display: z.object({ 'en-US': z.string(), 'zh-TW': z.string() }),
    })
    .parse(source.product);
  const pack = contentPackSchema.parse({
    schemaVersion: 1,
    version: {
      id: RDI2_VERSION,
      name: 'RDI2 project-rules mechanics paraphrase v1',
      createdAt: '2026-10-07T00:00:00.000Z',
    },
    products: [
      {
        id: 'product_rdi2',
        slug: 'rdi2',
        name: product.canonicalName,
        releaseYear: null,
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
    text: { 'en-US': string; 'zh-TW': string },
  ) => {
    for (const locale of ['en-US', 'zh-TW'] as const)
      pack.translations!.push({
        entityType,
        entityId,
        field,
        locale,
        text: locale === 'zh-TW' ? zh(text[locale]) : text[locale],
        sourceKind: 'MANUAL',
        sourceRef: 'rdi2-step24a-project-ruleset-implementation-translation',
        status: 'MANUAL_REVIEWED',
      });
  };
  translate('PRODUCT', 'product_rdi2', 'name', product.display);
  const mechanics = new Map(source.mechanics.map((m) => [m.id, m]));
  const traits = {
    dimli: ['DWARF'],
    eve: ['HUMAN'],
    fleck: ['HALF_ELF'],
    gog: ['HALF_OGRE'],
  };
  for (const character of [...source.characters].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    const identity = releasedCatalog.find(
      (c) => c.canonicalName === character.canonicalName,
    );
    if (!identity) throw new RangeError('Unknown RDI2 catalog identity');
    const characterId = characterIdSchema.parse(identity.id);
    pack.characters.push({
      id: characterId,
      productId: pack.products[0]!.id,
      slug: `rdi2-${character.id}`,
      name: identity.canonicalName,
      villain: false,
      complexity: null,
      specialRuleKey: null,
      rules: { traits: traits[character.id], resources: {}, sideDeckKeys: [] },
    });
    const deck = contentPackSchema.shape.decks.element.parse({
      id: `deck_rdi2_${character.id}`,
      characterId: identity.id,
      type: 'CHARACTER',
      slug: `rdi2-${character.id}`,
      name: `${character.display['en-US']} deck`,
    });
    pack.decks.push(deck);
    pack.requirements!.push({
      characterId,
      primaryDeckCount: 40,
      sideDecks: [],
      components: [],
    });
    translate('CHARACTER', identity.id, 'name', character.display);
    for (const record of [...character.cards].sort((a, b) =>
      a.cardKey.localeCompare(b.cardKey),
    )) {
      const mechanic = mechanics.get(record.mechanicId)!;
      const definition = cardDefinitionSchema.parse({
        id: `carddef_${record.cardKey.replaceAll('.', '_')}`,
        characterId: identity.id,
        name: record.display['en-US'],
        rulesText: record.rulesSummary['en-US'],
        source: 'PUBLIC_RULES_PARAPHRASE',
        type: record.type,
        negatable: true,
        effects: mechanic.effects
          .filter(
            (p) =>
              mechanic.id !== 'order_two_extra_drinks_paid' ||
              p.op !== 'PAY_INN',
          )
          .map(compileRdi2Effect),
        ...(['ANY_LIVING_PLAYER', 'ANY_ACTIVE_GAMBLER'].includes(
          String(mechanic.legality.target),
        )
          ? { targetPolicy: 'ANY_LIVING_PLAYER' }
          : {}),
        ...(record.type === 'SOMETIMES'
          ? {
              responseKind: 'SOMETIMES',
              responseTrigger: compileRdi2Trigger(mechanic.id, character.id),
            }
          : {}),
        ...(mechanic.id === 'order_two_extra_drinks_paid'
          ? { phaseOpportunity: 'ORDER_DRINK', mandatoryGoldCost: 1 }
          : {}),
        ...(mechanic.id === 'negate_sometimes_counter'
          ? {
              counterFamily: 'rdi_core_hard_no',
              counterPolicy: 'SAME_FAMILY_ONLY',
            }
          : {}),
        ...(mechanic.id === 'negate_drink_change_card'
          ? {
              counterFamily: 'rdi.negate_drink_change',
              allowedCounterFamilies: [
                'rdi.negate_sometimes',
                'rdi_core_hard_no',
              ],
            }
          : {}),
        ...(record.type === 'GAMBLING' || record.type === 'CHEATING'
          ? {
              gambling: {
                canStart: mechanic.id === 'gambling_start_or_control',
                allowedNextCategories:
                  mechanic.id === 'gambling_winning_hand'
                    ? ['CHEATING']
                    : ['GAMBLING', 'CHEATING'],
                immediateWin: false,
              },
            }
          : {}),
      });
      pack.cards.push(definition);
      pack.deckCards.push({
        deckId: deck.id,
        cardId: definition.id,
        quantity: record.quantity,
      });
      translate('CARD', definition.id, 'name', record.display);
      translate('CARD', definition.id, 'rulesText', record.rulesSummary);
    }
  }
  const inn = contentPackSchema.shape.decks.element.parse({
    id: 'deck_rdi2_inn',
    characterId: null,
    type: 'INN_DRINK',
    slug: 'rdi2-inn',
    name: 'RDI2 Inn Drink deck',
  });
  pack.decks.push(inn);
  for (const record of [...source.drinkDeck.cards].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    const numeric = (stat: string) =>
      record.effects
        .filter((p) => p.op === 'CHANGE_STAT' && p.stat === stat)
        .reduce((sum, p) => sum + z.number().int().parse(p.delta), 0);
    const alcohol = numeric('ALCOHOL'),
      fortitude = numeric('FORTITUDE');
    const chaser = record.effects.some((p) => p.op === 'ADD_CHASER');
    const split = record.builtInSplit !== undefined;
    const replacement =
      record.traitReplacement === undefined
        ? undefined
        : z
            .object({
              ifAnyTrait: z.array(z.string()),
              replaceEntireNumericEffectWith: z.object({
                alcohol: z.number(),
                fortitude: z.number(),
              }),
            })
            .parse(record.traitReplacement);
    const effects = record.effects
      .filter(
        (p) =>
          p.op !== 'ADD_CHASER' &&
          (record.kind === 'DRINK_EVENT' || p.op !== 'CHANGE_STAT'),
      )
      .map(compileRdi2Effect);
    const definition = cardDefinitionSchema.parse({
      id: `carddef_rdi2_drink_${record.id}`,
      type: record.kind,
      name: record.display['en-US'],
      rulesText: drinkSummary(
        record.id,
        alcohol,
        fortitude,
        chaser,
        split,
        replacement,
        'en-US',
      ),
      source: 'PUBLIC_RULES_PARAPHRASE',
      negatable: false,
      effects,
      ...(record.kind === 'DRINK'
        ? {
            alcoholContent: alcohol,
            fortitudeChange: fortitude,
            chaser,
            chaserSource: 'INN',
            ...(split ? { builtInSplit: true } : {}),
            ...(replacement
              ? {
                  traitReplacements: replacement.ifAnyTrait.map((trait) => ({
                    trait,
                    alcoholContent:
                      replacement.replaceEntireNumericEffectWith.alcohol,
                    fortitudeChange:
                      replacement.replaceEntireNumericEffectWith.fortitude,
                  })),
                }
              : {}),
          }
        : {}),
    });
    pack.cards.push(definition);
    pack.deckCards.push({
      deckId: inn.id,
      cardId: definition.id,
      quantity: record.quantity,
    });
    translate('CARD', definition.id, 'name', record.display);
    translate('CARD', definition.id, 'rulesText', {
      'en-US': definition.rulesText,
      'zh-TW': drinkSummary(
        record.id,
        alcohol,
        fortitude,
        chaser,
        split,
        replacement,
        'zh-TW',
      ),
    });
  }
  return contentPackSchema.parse(pack);
}

function drinkSummary(
  id: string,
  alcohol: number,
  fortitude: number,
  chaser: boolean,
  split: boolean,
  replacement:
    | {
        ifAnyTrait: string[];
        replaceEntireNumericEffectWith: { alcohol: number; fortitude: number };
      }
    | undefined,
  locale: 'en-US' | 'zh-TW',
) {
  const chinese = locale === 'zh-TW';
  if (id === 'drinking_contest')
    return chinese
      ? '所有玩家依序揭露完整飲料與續杯，回應後喝下；酒精值最高者向其他玩家各收取 1 金幣，平手者繼續。酒卡事件算 0 且不結算效果。'
      : 'Each player reveals a complete Drink, responds and drinks. Highest modified Alcohol wins 1 Gold from each other player; ties repeat. Events count zero without effects.';
  if (id === 'round_on_house')
    return chinese
      ? '從酒館找出完整飲料與續杯，跳過前導酒卡事件；所有玩家各自獲得一杯副本，可分別回應。'
      : 'Find a complete Inn Drink, skipping leading Events. Each player receives an independent copy with its own responses.';
  if (id === 'the_challenge')
    return chinese
      ? '可接受或拒絕挑戰；接受後從酒館喝下兩杯獨立飲料與續杯，跳過前導酒卡事件。兩杯結算及救援回應後仍存活，向其他適用玩家各收取 1 金幣。拒絕或淘汰不收款。'
      : 'Accept or decline. Accepting drinks two independent Inn Drinks, skipping leading Events. After both and rescue responses, survival collects 1 Gold from each applicable other player. Declining or elimination pays nothing.';
  if (id === 'fine_ambrosia')
    return chinese
      ? '酒卡事件：酒精值 +1、耐力值 +4，支付酒館 2 金幣。此分類與效果採用專案規則。'
      : 'Drink Event: gain 1 Alcohol and 4 Fortitude, then pay 2 Gold to the Inn. Classification and effects use the project ruleset.';
  const parts = [
    chinese
      ? `酒精值 ${alcohol >= 0 ? '+' : ''}${alcohol}；耐力值 ${fortitude >= 0 ? '+' : ''}${fortitude}。`
      : `Alcohol ${alcohol >= 0 ? '+' : ''}${alcohol}; Fortitude ${fortitude >= 0 ? '+' : ''}${fortitude}.`,
  ];
  if (chaser)
    parts.push(chinese ? '從酒館揭露續杯。' : 'Reveal a Chaser from the Inn.');
  if (split)
    parts.push(
      chinese
        ? '初次回應後可與另一玩家分杯，合併數值減半並向上取整，兩杯可獨立回應。作為續杯或酒卡事件結果不可分杯，也不能被其他分杯卡分杯。'
        : 'After initial responses, optionally split with another player, rounding combined numeric effects up; each half has independent responses. Cannot split as a Chaser or Event result, or through another split card.',
    );
  if (replacement)
    parts.push(
      chinese
        ? `${replacement.ifAnyTrait.join('/')}：整組數值改為酒精值 +${replacement.replaceEntireNumericEffectWith.alcohol}、耐力值 ${replacement.replaceEntireNumericEffectWith.fortitude}。`
        : `${replacement.ifAnyTrait.join('/')}: replace all numeric effects with Alcohol +${replacement.replaceEntireNumericEffectWith.alcohol}, Fortitude ${replacement.replaceEntireNumericEffectWith.fortitude}.`,
    );
  return parts.join(' ');
}

export function combineRdi1Rdi2(
  rdi1: ContentPack,
  rdi2: ContentPack,
): ContentPack {
  return contentPackSchema.parse({
    ...rdi1,
    version: {
      id: COMBINED_VERSION,
      name: 'RDI1 + RDI2 project-rules mechanics v1',
      createdAt: '2026-10-07T00:00:00.000Z',
    },
    products: [...rdi1.products, ...rdi2.products],
    characters: [...rdi1.characters, ...rdi2.characters],
    decks: [...rdi1.decks, ...rdi2.decks],
    cards: [...rdi1.cards, ...rdi2.cards],
    deckCards: [...rdi1.deckCards, ...rdi2.deckCards],
    translations: [...(rdi1.translations ?? []), ...(rdi2.translations ?? [])],
    requirements: [...(rdi1.requirements ?? []), ...(rdi2.requirements ?? [])],
    ruleModules: [...rdi1.ruleModules, ...rdi2.ruleModules],
    assets: [...rdi1.assets, ...rdi2.assets],
  });
}

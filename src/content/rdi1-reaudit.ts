import { z } from 'zod';
import type { Rdi1Source } from './rdi1-source';

export const RDI1_PRE_REAUDIT_SHA256 =
  '91357d8e03180e397caf760ac0fbadac9c1260a79a89eeea81751ea5619b2156';
const counts = z.strictObject({
  deirdre: z.number().int().nonnegative(),
  fiona: z.number().int().nonnegative(),
  gerki: z.number().int().nonnegative(),
  zot: z.number().int().nonnegative(),
});
const bilingual = z.strictObject({ 'en-US': z.string(), 'zh-TW': z.string() });
const ledgerSchema = z.looseObject({
  auditedFileSha256: z.literal(RDI1_PRE_REAUDIT_SHA256),
  characterMechanics: z
    .array(
      z.looseObject({
        ledgerId: z.string(),
        mechanicId: z.string(),
        type: z.string(),
        counts,
        currentSummary: bilingual,
        mechanicStatus: z.enum([
          'VERIFIED_CURRENT_OR_LATER_OFFICIAL_BEHAVIOR_PLUS_EXACT_MATRIX_QUANTITY',
          'MATCHES_FRESH_EXACT_MATRIX_AND_CURRENT_OFFICIAL_GENERIC_RULES',
          'MATCHES_MATRIX_BUT_PRIMARY_EXACT_SCOPE_NOT_FULLY_VERIFIED',
          'MUST_FIX',
        ]),
        freshEvidence: z.array(z.string()).min(1),
      }),
    )
    .length(40),
  drinks: z
    .array(
      z.looseObject({
        ledgerId: z.string(),
        drinkKey: z.string(),
        quantity: z.number().int().positive(),
        type: z.string(),
        currentAlcohol: z.number().nullable(),
        currentFortitude: z.number().nullable(),
        chaser: z.boolean().nullable(),
      }),
    )
    .length(18),
});
export function reauditEvidenceTier(
  row: z.infer<typeof ledgerSchema>['characterMechanics'][number],
) {
  if (
    row.mechanicStatus ===
    'MATCHES_MATRIX_BUT_PRIMARY_EXACT_SCOPE_NOT_FULLY_VERIFIED'
  )
    return 'LIMITED_PRIMARY_CARD_TEXT';
  if (row.freshEvidence.includes('official_rdi6_3e'))
    return 'LATER_OFFICIAL_CROSSCHECK';
  if (
    row.mechanicStatus ===
    'MATCHES_FRESH_EXACT_MATRIX_AND_CURRENT_OFFICIAL_GENERIC_RULES'
  )
    return 'FRESH_COMPLETE_MATRIX_PLUS_CURRENT_GENERIC_RULES';
  return 'CURRENT_OFFICIAL_DIRECT';
}
/** Compare individual records, including zero quantities; totals cannot hide a swap. */
export function verifyRdi1Reaudit(source: Rdi1Source, input: unknown) {
  const ledger = ledgerSchema.safeParse(input);
  if (!ledger.success)
    return {
      valid: false,
      errors: ['Invalid fresh RDI1 verification ledger'],
      mechanics: [],
      drinks: [],
    };
  const errors: string[] = [];
  if (
    source.sourceRefs.official_rules_current?.url !==
    'https://slugfestgames.com/wp-content/uploads/2021/10/RDI1-15thEd.pdf'
  )
    errors.push('Current rules reference must be Fifteenth Edition');
  if (source.mechanics.length !== 40 || source.drinkDeck.cards.length !== 18)
    errors.push('Expected exactly 40 mechanics and 18 Drink definitions');
  if (
    new Set(ledger.data.characterMechanics.map((r) => r.mechanicId)).size !==
      40 ||
    new Set(ledger.data.drinks.map((r) => r.drinkKey)).size !== 18
  )
    errors.push('Duplicate ledger record');
  const changed = new Set([
    'all_players_drink_now',
    'force_extra_drink_on_reveal',
    'negate_drink_change_card',
  ]);
  const mechanics = ledger.data.characterMechanics.map((row) => {
    const before = errors.length;
    const mechanic = source.mechanics.find((m) => m.id === row.mechanicId);
    if (!mechanic || mechanic.type !== row.type)
      errors.push(`${row.ledgerId}: missing mechanic or type mismatch`);
    else {
      for (const character of source.characters) {
        const actual = character.cards
          .filter((c) => c.mechanicId === row.mechanicId)
          .reduce((sum, c) => sum + c.quantity, 0);
        if (actual !== row.counts[character.id])
          errors.push(`${row.ledgerId}: ${character.id} quantity mismatch`);
      }
      if (
        !changed.has(row.mechanicId) &&
        JSON.stringify(mechanic.rulesSummary) !==
          JSON.stringify(row.currentSummary)
      )
        errors.push(`${row.ledgerId}: unapproved summary change`);
      const v = mechanic.verification;
      if (
        v.status !== 'REAUDITED' ||
        v.evidenceTier !== reauditEvidenceTier(row) ||
        v.quantityEvidenceTier !== 'SECONDARY_COMPLETE_MATRIX' ||
        v.ledgerId !== row.ledgerId ||
        JSON.stringify(v.basis) !== JSON.stringify(row.freshEvidence)
      )
        errors.push(`${row.ledgerId}: evidence tier or references mismatch`);
      for (const character of source.characters)
        for (const card of character.cards.filter(
          (c) => c.mechanicId === row.mechanicId,
        ))
          if (
            JSON.stringify(card.rulesSummary) !==
            JSON.stringify(mechanic.rulesSummary)
          )
            errors.push(`${row.ledgerId}: character summary mismatch`);
    }
    return {
      ledgerId: row.ledgerId,
      mechanicId: row.mechanicId,
      status: errors.length === before ? 'PASS' : 'FAIL',
      evidenceTier: reauditEvidenceTier(row),
      counts: row.counts,
    };
  });
  const drinks = ledger.data.drinks.map((row) => {
    const before = errors.length;
    const drink = source.drinkDeck.cards.find(
      (d) => d.drinkKey === row.drinkKey,
    );
    if (
      !drink ||
      drink.quantity !== row.quantity ||
      drink.type !== row.type ||
      (drink.alcoholContent ?? null) !== row.currentAlcohol ||
      (drink.fortitudeChange ?? null) !== row.currentFortitude ||
      (drink.chaser ?? null) !== row.chaser
    )
      errors.push(
        `${row.ledgerId}: Drink quantity/type/numeric/Chaser mismatch`,
      );
    return {
      ledgerId: row.ledgerId,
      drinkKey: row.drinkKey,
      quantity: row.quantity,
      status: errors.length === before ? 'PASS' : 'FAIL',
    };
  });
  const all = source.mechanics.find((m) => m.id === 'all_players_drink_now');
  if (
    all?.effects[0]?.op !== 'FORCE_SIMULTANEOUS_DRINK' ||
    all.effects[0].source !== 'INN'
  )
    errors.push('All-player Drink source must be INN');
  const extra = source.mechanics.find(
    (m) => m.id === 'force_extra_drink_on_reveal',
  );
  if (
    !extra ||
    !('mode' in extra.legality) ||
    extra.legality.mode !== 'RESPONSE' ||
    extra.legality.trigger?.timing !== 'AFTER_CHASERS_BEFORE_RESOLVE'
  )
    errors.push('Extra Drink requires complete Chasers');
  const counter = source.mechanics.find(
    (m) => m.id === 'negate_drink_change_card',
  );
  if (
    !counter ||
    !('mode' in counter.legality) ||
    counter.legality.mode !== 'RESPONSE' ||
    JSON.stringify(counter.legality.trigger?.sourceTypes) !== '["SOMETIMES"]' ||
    counter.counterMetadata?.family !== 'rdi_core_drink_change' ||
    JSON.stringify(counter.counterMetadata?.allowedCounterFamilies) !==
      '["rdi_core_hard_no"]'
  )
    errors.push(
      'Drink counter requires Sometimes and protected hard-counter metadata',
    );
  const contest = source.drinkDeck.cards.find(
    (d) => d.drinkKey === 'drinking_contest',
  )?.effectPlan?.[0];
  if (
    contest?.op !== 'DRINKING_CONTEST' ||
    contest.rules?.drinkEvents !== 'IGNORE' ||
    contest.rules.scoring !== 'REVEALED_WITH_MODIFIERS' ||
    contest.rules.settlement !== 'AFTER_CONTEST'
  )
    errors.push(
      'Contest rules must match the current official settlement/scoring/Event policy',
    );
  const house = source.drinkDeck.cards.find(
    (d) => d.drinkKey === 'round_on_house',
  )?.effectPlan?.[0];
  if (house?.op !== 'ROUND_ON_HOUSE' || house.payForRefill !== true)
    errors.push('Current House Drink uses the official Inn refill policy');
  if (
    JSON.stringify(
      source.mechanics.find((m) => m.id === 'substitute_one_gold_from_inn')
        ?.effects,
    ) !== '[{"op":"SUBSTITUTE_PAYMENT_FROM_INN","amount":1}]'
  )
    errors.push('Inn substitution must remain exactly one Gold');
  return { valid: errors.length === 0, errors, mechanics, drinks };
}

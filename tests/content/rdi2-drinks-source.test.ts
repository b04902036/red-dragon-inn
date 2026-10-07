import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { verifyRdi2Source } from '../../src/content/rdi2-source';
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const s = read('content-private/imports/rdi2/source-candidate.json'),
  l = read('content-private/imports/rdi2/verification-ledger.json');
const matrix = readFileSync('reference/rdi2/rdi2-mechanics-matrix.csv', 'utf8');
const hashes = {
  normalizedSha256: 'a'.repeat(64),
  ledgerSha256: 'b'.repeat(64),
  matrixSha256: 'c'.repeat(64),
};
const verify = (source = s, ledger = l) =>
  verifyRdi2Source(source, ledger, matrix, null, hashes);
const overridden = ['D03', 'D14', 'D15', 'D17', 'D18', 'D19', 'D20', 'D23'];
it('qualifies every Drink individually while preserving pending team acceptance', () => {
  expect(l.drinks).toHaveLength(23);
  for (const entry of l.drinks) {
    expect(entry.review.evidence.length).toBeGreaterThanOrEqual(3);
    expect(entry.review.checks.map((c: { check: string }) => c.check)).toEqual(
      entry.requiredChecks,
    );
    expect(entry.review.quantity).toBe(entry.quantity);
    if (overridden.includes(entry.ledgerId)) {
      expect(entry.status).toBe('VERIFIED_FOR_PROJECT_RULESET');
      expect(entry.projectRulesetOverride.label).toBe(
        entry.ledgerId + ' USER OVERRIDE',
      );
      expect(entry.previousBlockedReview.missingEvidence).toHaveLength(1);
      expect(
        entry.review.checks.every(
          (c: { result: string }) => c.result === 'PASS',
        ),
      ).toBe(true);
    } else {
      expect(
        entry.review.checks.every(
          (c: { result: string }) => c.result === 'PASS',
        ),
      ).toBe(true);
      expect(entry.status).toBe(
        entry.ledgerId === 'D09' ? 'VERIFIED_FOR_PROJECT_RULESET' : 'VERIFIED',
      );
    }
  }
  expect(verify().counts).toMatchObject({
    verifiedMechanics: 44,
    verifiedDrinks: 23,
    characterPhysical: 160,
    drinkPhysical: 30,
  });
  expect(verify().valid).toBe(false);
  expect(verify().errors.join('\n')).not.toContain(
    'M21 required team acceptance J remains pending',
  );
});
it.each([1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 16, 21, 22])(
  'rejects an unreviewed effect change to individually qualified D%s',
  (n) => {
    const source = structuredClone(s);
    source.drinkDeck.cards[n - 1].effects.push({
      op: 'CHANGE_STAT',
      target: 'DRINKER',
      stat: 'FORTITUDE',
      delta: -9,
    });
    expect(verify(source).errors.join('\n')).toContain(
      `Reviewed Drink changed D${String(n).padStart(2, '0')}/effects`,
    );
  },
);
it.each([
  'classification',
  'amount',
  'recipient',
  'authority',
  'scope',
  'official',
  'ledger',
])(
  'rejects broadening or mislabeling the existing D09 override: %s',
  (change) => {
    const source = structuredClone(s),
      ledger = structuredClone(l),
      d = source.drinkDeck.cards[8];
    if (change === 'classification') d.kind = 'DRINK';
    if (change === 'amount') d.effects[2].amount = 1;
    if (change === 'recipient') d.effects[2].op = 'TRANSFER_GOLD';
    if (change === 'authority')
      source.sources.user_fine_ambrosia_override_2026_10_05.authority =
        'PRIMARY';
    if (change === 'scope') d.projectRulesetOverride.scope = 'OTHER_DRINK';
    if (change === 'official')
      d.projectRulesetOverride.officialSourceVerified = true;
    if (change === 'ledger') ledger.drinks[8].status = 'VERIFIED';
    expect(verify(source, ledger).errors.join('\n')).toContain(
      'D09 must preserve',
    );
  },
);
it.each([
  'quantity',
  'kind',
  'traitReplacement',
  'builtInSplit',
  'drinkSemantics',
])('rejects a changed reviewed Drink field: %s', (key) => {
  const source = structuredClone(s),
    d = source.drinkDeck.cards[12];
  d[key] =
    key === 'quantity'
      ? 2
      : key === 'kind'
        ? 'DRINK_EVENT'
        : { unsupported: true };
  expect(verify(source).errors.join('\n')).toContain(
    `Reviewed Drink changed D13/${key}`,
  );
});
it('keeps Mead modified numeric splitting and independent response timing explicit', () => {
  const d = s.drinkDeck.cards[12];
  expect(d.builtInSplit.resultAlcoholEach).toBeUndefined();
  expect(d.builtInSplit).toMatchObject({
    unmodifiedAlcoholEach: 2,
    numericBasis: 'RESOLVED_DRINK_INCLUDING_PRIOR_MODIFIERS',
    halvesRound: 'CEIL',
    target: 'OTHER_PLAYER',
    decision: 'OPTIONAL_AFTER_INITIAL_DRINK_RESPONSES',
    halvesIndependent: true,
    responsesAfterSplit: true,
    notAllowedWhen: ['RESULT_OF_DRINK_EVENT', 'CHASER'],
    cannotBeSplitByOtherSplitCards: true,
  });
  expect(l.drinks[12].review.builtInSplit).toEqual(d.builtInSplit);
});
it('keeps distinct current Contest and Round on the House event rules', () => {
  expect(s.drinkDeck.cards[4].drinkSemantics).toMatchObject({
    initialEvent: 'COUNTS_ZERO_NO_EFFECT_DO_NOT_SKIP',
    extraDrinksDoNotEnterComparison: true,
    winnerPassesOut: 'COLLECT_FIRST_THEN_ELIMINATE',
    zeroGold:
      'REMAIN_UNTIL_CONTEST_END_IGNORE_FURTHER_PAYMENTS_ELIMINATE_IF_NOT_WINNER',
  });
  expect(s.drinkDeck.cards[15].drinkSemantics).toMatchObject({
    leadingEvents: 'DISCARD_AND_CONTINUE',
    responseBeforeCopy: false,
    responseAfterCopy: true,
    countsAsSplit: false,
    meadCopyBuiltInSplitAllowed: false,
  });
});

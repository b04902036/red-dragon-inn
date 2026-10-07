import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { verifyRdi2Source } from '../../src/content/rdi2-source';
import {
  challengeSemantics,
  finalResolutionPath,
  finalResolutionSha256,
  verifyFinalResolutions,
  teamModeDeferralAuthorized,
  teamModeTodo,
} from '../../src/content/rdi2-final-resolution';

const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const source = read('content-private/imports/rdi2/source-candidate.json');
const ledger = read('content-private/imports/rdi2/verification-ledger.json');
const matrix = readFileSync('reference/rdi2/rdi2-mechanics-matrix.csv', 'utf8');
const hashes = {
  normalizedSha256: 'a'.repeat(64),
  ledgerSha256: 'b'.repeat(64),
  matrixSha256: 'c'.repeat(64),
};
it('accepts all ten narrowly scoped decisions from the byte-preserved user prompt', () => {
  expect(
    createHash('sha256')
      .update(readFileSync(finalResolutionPath))
      .digest('hex'),
  ).toBe(finalResolutionSha256);
  expect(verifyFinalResolutions(source, ledger)).toEqual([]);
  expect(verifyRdi2Source(source, ledger, matrix, null, hashes).counts).toEqual(
    {
      characters: { dimli: 40, eve: 40, fleck: 40, gog: 40 },
      characterPhysical: 160,
      drinkPhysical: 30,
      mechanics: 44,
      verifiedMechanics: 44,
      verifiedDrinks: 23,
    },
  );
});
it.each([3, 14, 15, 17, 18, 19, 20, 23])(
  'rejects coordinated source/review changes to D%s',
  (n) => {
    const s = structuredClone(source),
      l = structuredClone(ledger);
    s.drinkDeck.cards[n - 1].effects.push({
      op: 'CHANGE_STAT',
      target: 'DRINKER',
      stat: 'FORTITUDE',
      delta: -9,
    });
    l.drinks[n - 1].review.effects = s.drinkDeck.cards[n - 1].effects;
    expect(verifyFinalResolutions(s, l).join('\n')).toContain(
      `D${String(n).padStart(2, '0')} must preserve`,
    );
  },
);
it.each([14, 15, 18])(
  'rejects trait additions, additive interpretations or retained Fortitude loss in D%s',
  (n) => {
    for (const change of ['trait', 'additive', 'fortitude']) {
      const s = structuredClone(source),
        l = structuredClone(ledger),
        d = s.drinkDeck.cards[n - 1];
      if (change === 'trait') d.traitReplacement.ifAnyTrait.push('HUMAN');
      if (change === 'additive') d.traitReplacement.additive = true;
      if (change === 'fortitude')
        d.traitReplacement.replaceEntireNumericEffectWith.fortitude = -1;
      l.drinks[n - 1].review.traitReplacement = d.traitReplacement;
      expect(verifyFinalResolutions(s, l).join('\n')).toContain(
        `D${n} must preserve`,
      );
    }
  },
);
it.each(Object.keys(challengeSemantics))(
  'rejects changed Challenge boundary: %s',
  (key) => {
    const s = structuredClone(source),
      l = structuredClone(ledger);
    s.drinkDeck.cards[16].drinkSemantics[key] = 'ALTERED_RULE';
    l.drinks[16].review.drinkSemantics = s.drinkDeck.cards[16].drinkSemantics;
    expect(verifyFinalResolutions(s, l).join('\n')).toContain(
      'D17 must preserve',
    );
  },
);
it.each([3, 14, 15, 17, 18, 19, 20, 23])(
  'rejects Chaser and fake publisher classification for D%s',
  (n) => {
    const s = structuredClone(source),
      l = structuredClone(ledger),
      d = s.drinkDeck.cards[n - 1];
    d.hasChaser = true;
    expect(verifyFinalResolutions(s, l).join('\n')).toContain(
      `D${String(n).padStart(2, '0')} must preserve`,
    );
    d.hasChaser = false;
    d.verification.evidenceClassification.completeCardDetails =
      'PUBLISHER_DIRECT';
    l.drinks[n - 1].review.evidenceClassification =
      d.verification.evidenceClassification;
    expect(verifyFinalResolutions(s, l).join('\n')).toContain(
      'evidence classification mismatch',
    );
  },
);
it.each(['title', 'gold', 'target', 'cost', 'provenance'])(
  'rejects invented or broadened M41 detail: %s',
  (change) => {
    const s = structuredClone(source),
      l = structuredClone(ledger),
      m = s.mechanics[40],
      c = s.characters
        .find((c: { id: string }) => c.id === 'gog')
        .cards.find((c: { mechanicId: string }) => c.mechanicId === m.id);
    if (change === 'title') c.canonicalCardTitle = 'Impress the Table';
    if (change === 'gold') m.effects[0].amount = 2;
    if (change === 'target') m.legality.target = 'CHOSEN_PLAYER';
    if (change === 'cost')
      m.effects.push({ op: 'PAY_INN', target: 'SELF', amount: 1 });
    if (change === 'provenance')
      m.verification.characterVerification.gog.officialSourceVerified = true;
    l.characterMechanics[40].review.effects = m.effects;
    expect(verifyFinalResolutions(s, l).join('\n')).toContain('M41');
  },
);
it.each(['type', 'self', 'owner', 'variant', 'quantity'])(
  'rejects broadened M44 provenance or changed publisher mechanic: %s',
  (change) => {
    const s = structuredClone(source),
      l = structuredClone(ledger),
      m = s.mechanics[43];
    if (change === 'type') m.cardType = 'ACTION';
    if (change === 'self') m.legality.target = 'ANY_OTHER_PLAYER';
    if (change === 'owner')
      m.physicalCopyProvenanceOverride.publisherDirectOwnership = true;
    if (change === 'variant')
      m.projectRulesetOverrides = { label: 'NEW_GOG_VARIANT' };
    if (change === 'quantity')
      s.characters
        .find((c: { id: string }) => c.id === 'gog')
        .cards.find(
          (c: { mechanicId: string }) => c.mechanicId === m.id,
        ).quantity = 2;
    expect(verifyFinalResolutions(s, l).join('\n')).toContain('M44');
  },
);
it('rejects removing or promoting the user evidence source', () => {
  const s = structuredClone(source);
  delete s.sources.user_step24a_final_resolution_2026_10_07;
  expect(verifyFinalResolutions(s, ledger).join('\n')).toContain(
    'explicit user authority',
  );
  s.sources.user_step24a_final_resolution_2026_10_07 = {
    authority: 'PRIMARY',
    path: finalResolutionPath,
    sha256: finalResolutionSha256,
    officialSourceVerified: true,
  };
  expect(verifyFinalResolutions(s, ledger).join('\n')).toContain(
    'explicit user authority',
  );
});
it('preserves the standard publisher-supported portions of D15, D17, D18 and D20', () => {
  expect(
    source.drinkDeck.cards[14].verification.evidenceClassification
      .ordinaryFortitudeLoss,
  ).toBe('PUBLISHER_DIRECT');
  expect(
    source.drinkDeck.cards[16].verification.evidenceClassification
      .acceptTwoSeparateChaserDrinksAndSuccessfulPayout,
  ).toBe('PUBLISHER_DIRECT');
  expect(
    source.drinkDeck.cards[17].verification.evidenceClassification
      .ordinaryNumericEffects,
  ).toBe('PUBLISHER_DIRECT');
  expect(
    source.drinkDeck.cards[19].verification.evidenceClassification
      .negativeDrinkContestFloor,
  ).toBe('PUBLISHER_DIRECT');
});
it.each([
  'mechanicOp',
  'drinkOp',
  'drinkReference',
  'missingDrink',
  'removedBasis',
])('rejects source graph bypass: %s', (change) => {
  const s = structuredClone(source),
    l = structuredClone(ledger);
  if (change === 'mechanicOp')
    s.mechanics[0].effects.push({ op: 'UNREGISTERED_OPERATION' });
  if (change === 'drinkOp')
    s.drinkDeck.cards[0].effects.push({ op: 'UNREGISTERED_OPERATION' });
  if (change === 'drinkReference')
    s.drinkDeck.cards[0].specialMechanicId = 'unregistered_mechanic';
  if (change === 'missingDrink') {
    s.drinkDeck.cards.pop();
    l.drinks.pop();
  }
  if (change === 'removedBasis') {
    delete s.mechanics[40].verification.ledgerId;
    delete s.sources.user_step24a_final_resolution_2026_10_07;
  }
  expect(verifyFinalResolutions(s, l).length).toBeGreaterThan(0);
});
it('allows the explicitly authorized non-blocking team TODO without claiming a team test passed', () => {
  const entry = ledger.characterMechanics[20];
  expect(teamModeDeferralAuthorized(source, entry)).toBe(true);
  expect(source.mechanics[20].engineAcceptance.pendingRequiredTests).toEqual([
    'J',
  ]);
  expect(source.mechanics[20].engineAudit.teamRuntimeImplemented).toBe(false);
  expect(source.mechanics[20].teamModeTodo).toEqual(teamModeTodo);
  expect(
    verifyRdi2Source(source, ledger, matrix, null, hashes).errors.join('\n'),
  ).not.toContain('M21 required team acceptance');
});
it.each(['source', 'scope', 'testPassed', 'rulesChanged', 'ledger'])(
  'rejects an unauthorized team deferral: %s',
  (change) => {
    const s = structuredClone(source),
      l = structuredClone(ledger);
    if (change === 'source')
      delete s.sources.user_team_mode_nonblocking_todo_2026_10_07;
    if (change === 'scope')
      s.mechanics[20].teamModeTodo.scope = 'ALL_MISSING_FEATURES';
    if (change === 'testPassed')
      s.mechanics[20].teamModeTodo.teamTestPassed = true;
    if (change === 'rulesChanged')
      s.mechanics[20].teamModeTodo.mechanicsChanged = true;
    if (change === 'ledger')
      delete l.characterMechanics[20].review.teamModeTodo;
    expect(teamModeDeferralAuthorized(s, l.characterMechanics[20])).toBe(false);
    expect(
      verifyRdi2Source(s, l, matrix, null, hashes).errors.join('\n'),
    ).toContain('M21 required team acceptance');
  },
);
it.each(['authority', 'officialSourceVerified', 'path', 'sha256', 'todo'])(
  'requires the exact team decision provenance: %s',
  (key) => {
    const s = structuredClone(source);
    if (key === 'todo') s.nonBlockingTodos = [];
    else
      s.sources.user_team_mode_nonblocking_todo_2026_10_07[key] =
        'INVALID_PROVENANCE';
    expect(teamModeDeferralAuthorized(s, ledger.characterMechanics[20])).toBe(
      false,
    );
  },
);

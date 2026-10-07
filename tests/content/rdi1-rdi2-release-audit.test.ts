import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';
import { verifyRdi1Rdi2Release } from '../../src/content/rdi1-rdi2-release';
import { loadRdi1Rdi2ReleaseInput } from '../../scripts/rdi1-rdi2-release-input';
import { combinedPack, rdi2Pack } from '../fixtures/rdi2-content';
import { characterIdSchema } from '../../src/shared/ids';
const input = loadRdi1Rdi2ReleaseInput();
const changed = () => ({
  ...structuredClone(input),
  combined: structuredClone(combinedPack),
});
it('fresh locks, original-record hashes, cached evidence, and all eight-character hard gates pass', () => {
  expect(verifyRdi1Rdi2Release(input)).toMatchObject({
    valid: true,
    errors: [],
    counts: {
      playableCharacters: 8,
      characterPhysicalCards: 320,
      drinkPhysicalCards: 60,
      uniqueDefinitions: 226,
      sourceConflicts: 0,
      unknownMechanics: 0,
      unknownEffects: 0,
      unsupportedCards: 0,
      sometimesWithoutStructuredTrigger: 0,
      missingEnUS: 0,
      missingZhTW: 0,
      sampleProductionRecords: 0,
    },
  });
});
it.each(combinedPack.decks.map((deck) => deck.id))(
  'rejects wrong physical quantity in %s even if another deck compensates',
  (id) => {
    const test = changed(),
      own = test.combined.deckCards.find(
        (row) => row.deckId === id && row.quantity > 1,
      )!;
    const other = test.combined.deckCards.find((row) => row.deckId !== id)!;
    own.quantity--;
    other.quantity++;
    expect(verifyRdi1Rdi2Release(test).valid).toBe(false);
  },
);
it.each(['en-US', 'zh-TW'] as const)(
  'one missing %s field closes the release gate',
  (locale) => {
    const test = changed();
    test.combined.translations!.splice(
      test.combined.translations!.findIndex((row) => row.locale === locale),
      1,
    );
    expect(verifyRdi1Rdi2Release(test)).toMatchObject({
      valid: false,
      counts: locale === 'en-US' ? { missingEnUS: 1 } : { missingZhTW: 1 },
    });
  },
);
it.each(['normalizedSha256', 'ledgerSha256', 'matrixSha256'] as const)(
  'rejects RDI2 %s drift without trusting the old report',
  (key) => {
    const test = changed();
    test.rdi2Audit.hashes[key] = '0'.repeat(64);
    expect(verifyRdi1Rdi2Release(test)).toMatchObject({ valid: false });
  },
);
it.each(Object.keys(input.rdi1Hashes))(
  'rejects RDI1 locked byte drift: %s',
  (key) => {
    const test = changed();
    test.rdi1Hashes[key] = '0'.repeat(64);
    expect(verifyRdi1Rdi2Release(test)).toMatchObject({ valid: false });
  },
);
it.each(['files', 'records'] as const)(
  'cached evidence %s must reproduce, not just retain a verified ledger label',
  (key) => {
    const test = changed();
    test.evidenceHashes[key] = [];
    expect(verifyRdi1Rdi2Release(test)).toMatchObject({ valid: false });
    expect(verifyRdi1Rdi2Release(test).errors.join('\n')).toMatch(
      /hash not reproduced/,
    );
  },
);
it('rejects missing locks, a malformed ledger, and an unregistered source mechanic', () => {
  const lock = changed();
  lock.rdi1Lock = null;
  expect(verifyRdi1Rdi2Release(lock).valid).toBe(false);
  const ledger = changed();
  ledger.rdi2Audit.ledger = null;
  expect(verifyRdi1Rdi2Release(ledger).errors).toContain(
    'Invalid evidence ledger',
  );
  const source = changed();
  (source.rdi2Source as { mechanics: { id: string }[] }).mechanics[0]!.id =
    'unregistered_release_mechanic';
  expect(verifyRdi1Rdi2Release(source).valid).toBe(false);
});
it.each([
  'NO_TRIGGER',
  'NO_EFFECT',
  'UNKNOWN_OPERATION',
  'UNKNOWN_HANDLER',
  'SAMPLE',
  'MISSING_CHARACTER',
  'EXTRA_CHARACTER',
  'INVALID_GRAPH',
] as const)('fails closed for %s', (defect) => {
  const test = changed();
  const card = test.combined.cards.find((card) => card.type === 'SOMETIMES')!;
  if (defect === 'NO_TRIGGER' && card.type === 'SOMETIMES')
    delete card.responseTrigger;
  if (defect === 'NO_EFFECT') card.effects = [];
  if (defect === 'UNKNOWN_OPERATION')
    (card as unknown as { effects: unknown[] }).effects = [
      { op: 'UNREGISTERED' },
    ];
  if (defect === 'UNKNOWN_HANDLER')
    (card as unknown as { effects: unknown[] }).effects = [
      { op: 'CUSTOM', effect_key: 'unregistered.release', params: {} },
    ];
  if (defect === 'SAMPLE') card.source = 'SAMPLE';
  if (defect === 'MISSING_CHARACTER') test.combined.characters.pop();
  if (defect === 'EXTRA_CHARACTER')
    test.combined.characters.push({
      ...test.combined.characters[0]!,
      id: characterIdSchema.parse('character_rdi3_unreviewed'),
      slug: 'rdi3-unreviewed',
    });
  if (defect === 'INVALID_GRAPH')
    test.combined = null as unknown as typeof combinedPack;
  expect(verifyRdi1Rdi2Release(test).valid).toBe(false);
});
it.each([
  'eve_give_two_alcohol',
  'eve_damage_three',
  'eve_ignore_card_all_stats',
  'eve_illusionary_payment',
  'dimli_restart_gambling_round',
  'drink_mead',
  'eve_redirect_fortitude_loss',
  'drink_fine_ambrosia',
  'drink_the_challenge',
])(
  'rejects regression of the specially re-audited compiled binding %s',
  (suffix) => {
    const test = changed(),
      card = test.combined.cards.find((card) => card.id.endsWith(suffix))!;
    if (card.type === 'DRINK') {
      card.alcoholContent = 6;
      delete card.builtInSplit;
    } else card.effects = [{ op: 'PAY_INN', target: 'SELF', amount: 5 }];
    expect(verifyRdi1Rdi2Release(test).valid).toBe(false);
  },
);
it('current Eve/Mead/redirect/Fine Ambrosia/Challenge plans retain their exact verified project meaning', () => {
  const card = (suffix: string) =>
    rdi2Pack.cards.find((card) => card.id.endsWith(suffix))!;
  expect(card('eve_give_two_alcohol').effects).toEqual([
    { op: 'CHANGE_STAT', target: 'CHOSEN_PLAYER', stat: 'ALCOHOL', delta: 2 },
  ]);
  expect(card('eve_damage_three').effects).toEqual([
    {
      op: 'CHANGE_STAT',
      target: 'CHOSEN_PLAYER',
      stat: 'FORTITUDE',
      delta: -3,
    },
  ]);
  expect(card('eve_illusionary_payment').effects).toEqual([
    { op: 'PREVENT_CURRENT_GOLD_LOSS' },
  ]);
  expect(card('dimli_restart_gambling_round').effects).toEqual([
    { op: 'RESTART_GAMBLING_ROUND', ante: 1 },
  ]);
  expect(card('drink_mead')).toMatchObject({
    type: 'DRINK',
    alcoholContent: 3,
    builtInSplit: true,
  });
  expect(card('eve_redirect_fortitude_loss').effects).toEqual([
    {
      op: 'REDIRECT_FORTITUDE_LOSS',
      target: 'CHOSEN_PLAYER',
      excludeOriginalSource: true,
      twoPlayerIgnoreFallback: true,
    },
  ]);
  expect(card('drink_fine_ambrosia').effects).toEqual([
    { op: 'CHANGE_STAT', target: 'SELF', stat: 'ALCOHOL', delta: 1 },
    { op: 'CHANGE_STAT', target: 'SELF', stat: 'FORTITUDE', delta: 4 },
    { op: 'PAY_INN', target: 'SELF', amount: 2 },
  ]);
  expect(card('drink_the_challenge').effects).toEqual([
    { op: 'OPTIONAL_DRINK_CHALLENGE', target: 'SELF' },
  ]);
});
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(path.join(directory, entry.name))
      : [path.join(directory, entry.name)],
  );
}
it('generic engine has no character, RDI1/RDI2 definition-ID, or displayed-card-text dispatch', () => {
  const violations: string[] = [];
  for (const file of files('src/engine').filter((file) =>
    file.endsWith('.ts'),
  )) {
    const ast = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const display = (node: ts.Node) =>
      ts.isPropertyAccessExpression(node) &&
      ['name', 'title', 'rulesText'].includes(node.name.text);
    const visit = (node: ts.Node) => {
      if (
        (ts.isStringLiteral(node) &&
          /carddef_rdi[12]_|^(?:rdi[12]-)?(?:deirdre|fiona|gerki|zot|dimli|eve|fleck|gog)$/i.test(
            node.text,
          )) ||
        (ts.isBinaryExpression(node) &&
          (display(node.left) || display(node.right)))
      )
        violations.push(`${file}: ${node.getText(ast)}`);
      ts.forEachChild(node, visit);
    };
    visit(ast);
  }
  expect(violations).toEqual([]);
});
it('no test is skipped or focused, and current runtime has no unresolved verification comments', () => {
  for (const file of files('tests').filter((file) =>
    /\.(?:test|spec)\.tsx?$/.test(file),
  )) {
    const ast = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node))
        expect(node.expression.getText(ast), file).not.toMatch(
          /^(?:it|test|describe)(?:\.\w+)*\.(?:skip|only)(?:\.\w+)*$/,
        );
      ts.forEachChild(node, visit);
    };
    visit(ast);
  }
  for (const file of [...files('src/engine'), ...files('worker')].filter(
    (file) => file.endsWith('.ts'),
  ))
    expect(readFileSync(file, 'utf8'), file).not.toMatch(
      /\b(?:TODO|FIXME|UNVERIFIED|ASSUMED|GUESSED)\b/,
    );
});

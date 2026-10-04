import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';
import { verifyRdi1Pack } from '../../src/content/rdi1-pack';
import { validateContentImport } from '../../src/content/import';
import { verifyProductionContent } from '../../src/content/production';
import { compileRdi1Source } from '../../src/content/rdi1-compiler';
import { effectSchema } from '../../src/content/effects';
import { rdi1Pack, rdi1Source } from '../fixtures/rdi1-content';

it('all RDI1 hard release gates pass for the actual locked edition, independently of the full catalog', () => {
  expect(verifyRdi1Pack(rdi1Pack, rdi1Source)).toEqual({
    valid: true,
    characters: 4,
    characterDecks: { deirdre: 40, fiona: 40, gerki: 40, zot: 40 },
    characterPhysicalCards: 160,
    drinkPhysicalCards: 30,
    unknownMechanics: 0,
    unknownEffects: 0,
    sometimesWithoutStructuredLegality: 0,
    missingEnUS: 0,
    missingZhTW: 0,
    sampleProductionRecords: 0,
    errors: [],
  });
  expect(rdi1Pack.cards).toHaveLength(110);
  expect(rdi1Source.mechanics).toHaveLength(40);
  const supported = validateContentImport(JSON.stringify(rdi1Pack));
  expect(supported.report).toMatchObject({
    valid: true,
    unsupportedEffects: [],
    unsupportedSpecialRules: [],
    missingAssets: [],
    errors: [],
  });
  expect(
    rdi1Pack.cards.filter((card) =>
      card.effects.some((effect) => !effectSchema.safeParse(effect).success),
    ),
  ).toEqual([]);
  expect(rdi1Pack.assets).toEqual([]);
  expect(verifyProductionContent(rdi1Pack)).toMatchObject({
    complete: false,
    presentCharacters: 4,
  });
});

it.each(['deirdre', 'fiona', 'gerki', 'zot'])(
  'rejects balanced 39/41 character decks even when the total remains 160 (%s)',
  (character) => {
    const changed = structuredClone(rdi1Pack);
    const deck = changed.decks.find((d) => d.slug === `rdi1-${character}`)!;
    const own = changed.deckCards.find(
      (row) => row.deckId === deck.id && row.quantity >= 2,
    )!;
    const other = changed.deckCards.find(
      (row) => row.deckId !== deck.id && row.deckId !== 'deck_rdi1_inn',
    )!;
    own.quantity--;
    other.quantity++;
    const report = verifyRdi1Pack(changed, rdi1Source);
    expect(report.characterPhysicalCards).toBe(160);
    expect(report.characterDecks[character]).toBe(39);
    expect(report.valid).toBe(false);
  },
);

it.each([-1, 1])(
  'rejects a Drink deck changed by %i physical card',
  (delta) => {
    const changed = structuredClone(rdi1Pack);
    changed.deckCards.find(
      (row) => row.deckId === 'deck_rdi1_inn' && row.quantity >= 2,
    )!.quantity += delta;
    const report = verifyRdi1Pack(changed, rdi1Source);
    expect(report.drinkPhysicalCards).toBe(30 + delta);
    expect(report.valid).toBe(false);
  },
);

it.each(['en-US', 'zh-TW'] as const)(
  'a single missing required %s field closes the RDI1 gate',
  (locale) => {
    const changed = structuredClone(rdi1Pack);
    const index = changed.translations!.findIndex(
      (row) => row.locale === locale && row.entityType === 'CARD',
    );
    changed.translations!.splice(index, 1);
    const report = verifyRdi1Pack(changed, rdi1Source);
    expect(report.valid).toBe(false);
    expect(locale === 'en-US' ? report.missingEnUS : report.missingZhTW).toBe(
      1,
    );
  },
);

it('missing Sometimes triggers, sample provenance and a no-op substitution cannot pass release', () => {
  const trigger = structuredClone(rdi1Pack);
  const sometimes = trigger.cards.find((card) => card.type === 'SOMETIMES')!;
  if (sometimes.type !== 'SOMETIMES') throw new Error('Missing Sometimes');
  delete sometimes.responseTrigger;
  expect(verifyRdi1Pack(trigger, rdi1Source)).toMatchObject({
    valid: false,
    sometimesWithoutStructuredLegality: 1,
  });
  const sample = structuredClone(rdi1Pack);
  sample.cards[0]!.source = 'SAMPLE';
  expect(verifyRdi1Pack(sample, rdi1Source)).toMatchObject({
    valid: false,
    sampleProductionRecords: 1,
  });
  const noop = structuredClone(rdi1Pack);
  noop.cards.find((card) => card.type === 'ACTION')!.effects = [];
  expect(verifyRdi1Pack(noop, rdi1Source).valid).toBe(false);
});

it.each([
  { op: 'UNKNOWN_RELEASE_OPERATION' },
  { op: 'CUSTOM', effect_key: 'unregistered.release-handler', params: {} },
  {
    op: 'CUSTOM',
    effect_key: 'core.adjust-resource',
    target: 'SELF',
    params: { resource: 'mana', delta: 'client-script' },
  },
])(
  'rejects unsupported or unvalidated effects before they can become fallbacks: %j',
  (effect) => {
    const changed = structuredClone(rdi1Pack) as unknown as {
      cards: { effects: unknown[] }[];
    };
    changed.cards[0]!.effects = [effect];
    expect(validateContentImport(JSON.stringify(changed)).pack).toBeNull();
    expect(verifyRdi1Pack(changed, rdi1Source).valid).toBe(false);
  },
);

it('unknown source mechanics fail compilation rather than manufacturing playable cards', () => {
  const changed = structuredClone(rdi1Source);
  changed.characters[0]!.cards[0]!.mechanicId = 'unknown_release_mechanic';
  expect(() => compileRdi1Source(changed)).toThrow();
});

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? files(file) : [file];
  });
}

it('engine decisions never compare card titles, prose or RDI1-specific definition IDs', () => {
  const violations: string[] = [];
  for (const file of files('src/engine').filter((f) => f.endsWith('.ts'))) {
    const ast = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const title = (node: ts.Node) =>
      (ts.isPropertyAccessExpression(node) &&
        ['name', 'title', 'rulesText'].includes(node.name.text)) ||
      (ts.isElementAccessExpression(node) &&
        ts.isStringLiteral(node.argumentExpression) &&
        ['name', 'title', 'rulesText'].includes(
          node.argumentExpression.text,
        )) ||
      (ts.isIdentifier(node) &&
        ['name', 'title', 'rulesText'].includes(node.text));
    const visit = (node: ts.Node) => {
      if (
        (ts.isBinaryExpression(node) &&
          [
            ts.SyntaxKind.EqualsEqualsToken,
            ts.SyntaxKind.EqualsEqualsEqualsToken,
            ts.SyntaxKind.ExclamationEqualsToken,
            ts.SyntaxKind.ExclamationEqualsEqualsToken,
          ].includes(node.operatorToken.kind) &&
          (title(node.left) || title(node.right))) ||
        (ts.isStringLiteral(node) && node.text.startsWith('carddef_rdi1_'))
      )
        violations.push(`${file}: ${node.getText(ast)}`);
      ts.forEachChild(node, visit);
    };
    visit(ast);
  }
  expect(violations).toEqual([]);
});

it('clients do not import engine legality/commands or issue authoritative expiry commands', () => {
  for (const file of files('src/client').filter((f) => /\.tsx?$/.test(f))) {
    const source = readFileSync(file, 'utf8');
    expect(source, file).not.toMatch(
      /EXPIRE_PROMPT|applyCommand|legalResponsesForPlayer|evaluateReactionTrigger|from\s+['"][^'"]*engine\//,
    );
  }
  // The countdown is display-only; its interval does not dispatch expiry or pass.
  const countdown = readFileSync('src/client/PromptCountdown.tsx', 'utf8');
  expect(countdown).toContain('prompt.deadlineAt - now');
  expect(countdown).not.toMatch(/\bsend\(|PASS_RESPONSE|PASS_ANYTIME/);
});

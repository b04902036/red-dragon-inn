import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildTitleVariants,
  loadTitleSources,
} from '../../scripts/card-title-variants.mjs';
import { planAssets } from '../../scripts/card-voice-assets.mjs';
const pack = JSON.parse(
  await readFile('content-private/imports/rdi2/pack-combined.json', 'utf8'),
);
const sources = await loadTitleSources();
const config = JSON.parse(
  await readFile('content/presentation/character-voices.json', 'utf8'),
);

test('all eight authoritative sources map 40 copies each, 320 total, to owned definitions', () => {
  const titles = buildTitleVariants(pack, sources);
  assert.equal(sources.length, 8);
  assert.equal(
    new Set(titles.entries.map((entry) => entry.characterId)).size,
    8,
  );
  let total = 0;
  for (const character of pack.characters) {
    const entries = titles.entries.filter(
      (entry) => entry.characterId === character.id,
    );
    const quantity = entries.reduce(
      (sum, entry) =>
        sum +
        entry.variants.reduce((sum, variant) => sum + variant.quantity, 0),
      0,
    );
    assert.equal(quantity, 40);
    total += quantity;
    for (const entry of entries) {
      const deck = pack.decks.find(
        (deck) =>
          deck.characterId === character.id && deck.type === 'CHARACTER',
      );
      const record = pack.deckCards.find(
        (record) =>
          record.deckId === deck.id && record.cardId === entry.cardDefinitionId,
      );
      assert.equal(
        entry.variants.reduce((sum, variant) => sum + variant.quantity, 0),
        record.quantity,
      );
    }
  }
  assert.equal(total, 320);
  const planned = planAssets(pack, config, titles);
  assert.equal(
    new Set(planned.map((asset) => asset.assetPath)).size,
    planned.length,
  );
});
test('exact strings including Gog overrides are preserved, distinct titles split and duplicate copies deduplicate', () => {
  const titles = buildTitleVariants(pack, sources);
  for (const source of sources)
    for (const row of source.input.rows) {
      const original = new Map();
      for (const title of row.canonicalCardTitles)
        original.set(title, (original.get(title) ?? 0) + 1);
      const entry = titles.entries.find(
        (entry) =>
          entry.cardDefinitionId.startsWith(
            `carddef_${source.game}_${source.name}_`,
          ) &&
          entry.variants.some(
            (variant) => variant.spokenText === row.canonicalCardTitles[0],
          ),
      );
      assert.ok(entry);
      assert.deepEqual(
        new Map(
          entry.variants.map((variant) => [
            variant.spokenText,
            variant.quantity,
          ]),
        ),
        original,
      );
    }
  assert.ok(titles.entries.some((entry) => entry.variants.length > 1));
  assert.ok(
    titles.entries.some((entry) =>
      entry.variants.some((variant) => variant.quantity > 1),
    ),
  );
});
test('variant IDs and import output are stable under row/source/title reordering', () => {
  const reversed = structuredClone(sources).reverse();
  for (const source of reversed) {
    source.input.rows.reverse();
    for (const row of source.input.rows) row.canonicalCardTitles.reverse();
  }
  assert.deepEqual(
    buildTitleVariants(pack, reversed),
    buildTitleVariants(pack, sources),
  );
});
test('a duplicated production definition fails the unique cardKey mapping', () => {
  const invalid = structuredClone(pack);
  const card = invalid.cards.find(
    (card) => card.id === 'carddef_rdi1_deirdre_damage_two',
  );
  assert.ok(card);
  invalid.cards.push(card);
  assert.throws(
    () => buildTitleVariants(invalid, sources),
    /ambiguous cardKey/,
  );
});
for (const [name, mutate] of [
  ['missing source', (sources) => sources.pop()],
  ['missing row', (sources) => sources[0].input.rows.pop()],
  [
    'unknown key',
    (sources) => {
      sources[0].input.rows[0].cardKey = 'deirdre.unknown';
    },
  ],
  [
    'wrong title count',
    (sources) => sources[0].input.rows[0].canonicalCardTitles.pop(),
  ],
  [
    'wrong physical count',
    (sources) => {
      sources[0].input.physicalCardCount = 39;
    },
  ],
  [
    'duplicate ownership',
    (sources) => {
      sources[1] = structuredClone(sources[0]);
    },
  ],
])
  test(`preflight rejects ${name} before an asset plan exists`, () => {
    const invalid = structuredClone(sources);
    mutate(invalid);
    assert.throws(() => buildTitleVariants(pack, invalid));
  });

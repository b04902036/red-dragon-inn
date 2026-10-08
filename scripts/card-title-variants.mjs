import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { atomicFile, sha256, titlesSchema } from './card-voice-assets.mjs';

export const titleSources = [
  ...['deirdre', 'fiona', 'gerki', 'zot'].map((name) => ['rdi1', name]),
  ...['dimli', 'eve', 'fleck', 'gog'].map((name) => ['rdi2', name]),
];
// Historical input keys, mapped at the import boundary only. The locked Gog
// deck has exactly one Fortitude-ignore row and one paid extra-order row.
const aliases = {
  'gog.ignore_action_sometimes_fort_loss': 'ignore_card_fortitude',
  'gog.order_two_extra_drinks': 'order_two_extra_drinks_paid',
};
export function buildTitleVariants(pack, sources) {
  if (sources.length !== 8)
    throw new Error('Expected all eight title sources.');
  const entries = [];
  const characters = new Set();
  for (const { game, name, input } of sources) {
    const prefix = `carddef_${game}_${name}_`;
    const owned = pack.cards.filter((card) => card.id.startsWith(prefix));
    const owners = new Set(owned.map((card) => card.characterId));
    if (input.characterId !== name || owners.size !== 1)
      throw new Error(`Unknown or ambiguous character ownership: ${name}`);
    const characterId = [...owners][0];
    const decks = pack.decks.filter(
      (deck) => deck.type === 'CHARACTER' && deck.characterId === characterId,
    );
    if (decks.length !== 1 || characters.has(characterId))
      throw new Error(`Duplicate or ambiguous deck ownership: ${name}`);
    characters.add(characterId);
    const records = pack.deckCards.filter((row) => row.deckId === decks[0].id);
    if (
      input.physicalCardCount !== 40 ||
      records.reduce((sum, row) => sum + row.quantity, 0) !== 40 ||
      input.rows.reduce((sum, row) => sum + row.quantity, 0) !== 40
    )
      throw new Error(`Expected exactly 40 physical assignments: ${name}`);
    const seen = new Set();
    for (const row of input.rows) {
      if (
        !Number.isInteger(row.quantity) ||
        row.quantity < 1 ||
        row.canonicalCardTitles.length !== row.quantity
      )
        throw new Error(`Title count differs from quantity: ${row.cardKey}`);
      if (!row.cardKey.startsWith(`${name}.`))
        throw new Error(`Unknown cardKey: ${row.cardKey}`);
      const suffix = aliases[row.cardKey] ?? row.cardKey.slice(name.length + 1);
      const matches = records.filter(
        (record) => record.cardId === `${prefix}${suffix}`,
      );
      if (
        matches.length !== 1 ||
        owned.filter((card) => card.id === matches[0].cardId).length !== 1 ||
        seen.has(matches[0].cardId)
      )
        throw new Error(
          `Unknown, duplicate or ambiguous cardKey: ${row.cardKey}`,
        );
      const record = matches[0];
      if (record.quantity !== row.quantity)
        throw new Error(`Deck quantity mismatch: ${row.cardKey}`);
      seen.add(record.cardId);
      const quantities = new Map();
      for (const title of row.canonicalCardTitles)
        quantities.set(title, (quantities.get(title) ?? 0) + 1);
      const variants = [...quantities]
        .map(([spokenText, quantity]) => ({
          variantId: `v_${sha256(spokenText).slice(0, 24)}`,
          spokenText,
          quantity,
        }))
        .sort((a, b) => a.variantId.localeCompare(b.variantId));
      if (
        new Set(variants.map((variant) => variant.variantId)).size !==
        variants.length
      )
        throw new Error('Variant hash collision.');
      entries.push({ characterId, cardDefinitionId: record.cardId, variants });
    }
    if (seen.size !== records.length)
      throw new Error(`Missing deck rows: ${name}`);
  }
  return titlesSchema.parse({
    schemaVersion: 2,
    entries: entries.sort((a, b) =>
      `${a.characterId}:${a.cardDefinitionId}`.localeCompare(
        `${b.characterId}:${b.cardDefinitionId}`,
      ),
    ),
  });
}
export async function loadTitleSources() {
  return Promise.all(
    titleSources.map(async ([game, name]) => ({
      game,
      name,
      input: JSON.parse(
        await readFile(
          `content-private/imports/${game}/${game}-${name}-printed-titles.json`,
          'utf8',
        ),
      ),
    })),
  );
}
export function buildTitleAssignments(pack, titles) {
  return {
    contentVersionId: pack.version.id,
    entries: titles.entries.map(
      ({ characterId, cardDefinitionId, variants }) => ({
        characterId,
        cardDefinitionId,
        variants: variants.map(({ variantId, quantity }) => ({
          variantId,
          quantity,
        })),
      }),
    ),
  };
}
export async function importTitleVariants() {
  const pack = JSON.parse(
    await readFile('content-private/imports/rdi2/pack-combined.json', 'utf8'),
  );
  const titles = buildTitleVariants(pack, await loadTitleSources());
  const assignments = buildTitleAssignments(pack, titles);
  await atomicFile(
    'content-private/voice/canonical-titles.json',
    JSON.stringify(titles, null, 2) + '\n',
  );
  await atomicFile(
    'content/presentation/card-title-assignments.json',
    JSON.stringify(assignments, null, 2) + '\n',
  );
  return { titles, assignments };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await importTitleVariants();
  console.log('PASS: 8 characters, 40 physical assignments each, 320 total.');
}

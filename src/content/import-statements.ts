import { contentPackSchema } from './pack';
import type { ContentPack } from './pack';
export interface ContentInsert {
  sql: string;
  values: unknown[];
}
/** Shared parameterized inserts: one validated version and graph, committed in one batch. */
export function contentImportStatements(input: ContentPack) {
  const pack = contentPackSchema.parse(input);
  const version = pack.version.id;
  const statements: ContentInsert[] = [
    {
      sql: 'INSERT INTO content_versions (id, name, created_at) VALUES (?, ?, ?)',
      values: [version, pack.version.name, pack.version.createdAt],
    },
  ];
  const insert = (sql: string, values: unknown[]) =>
    statements.push({ sql, values });
  for (const p of pack.products)
    insert(
      'INSERT INTO products (content_version_id, id, slug, name, release_year) VALUES (?, ?, ?, ?, ?)',
      [version, p.id, p.slug, p.name, p.releaseYear],
    );
  for (const c of pack.characters)
    insert(
      'INSERT INTO characters (content_version_id, id, product_id, slug, name, villain, complexity, special_rule_key, rules_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        version,
        c.id,
        c.productId,
        c.slug,
        c.name,
        Number(c.villain),
        c.complexity,
        c.specialRuleKey,
        JSON.stringify(c.rules),
      ],
    );
  for (const d of pack.decks)
    insert(
      'INSERT INTO decks (content_version_id, id, character_id, deck_type, slug, name) VALUES (?, ?, ?, ?, ?, ?)',
      [version, d.id, d.characterId, d.type, d.slug, d.name],
    );
  for (const c of pack.cards) {
    const custom = c.effects.find((effect) => effect.op === 'CUSTOM');
    insert(
      'INSERT INTO cards (content_version_id, id, character_id, slug, name, card_type, effect_key, effect_params_json, effect_dsl_json, rules_summary, definition_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        version,
        c.id,
        c.characterId ?? null,
        c.id.replace('carddef_', '').replaceAll('_', '-'),
        c.name,
        c.type,
        custom?.effect_key ?? null,
        custom ? JSON.stringify(custom.params) : null,
        JSON.stringify(c.effects),
        c.rulesText,
        JSON.stringify(c),
      ],
    );
  }
  for (const d of pack.deckCards)
    insert(
      'INSERT INTO deck_cards (content_version_id, deck_id, card_id, quantity) VALUES (?, ?, ?, ?)',
      [version, d.deckId, d.cardId, d.quantity],
    );
  for (const r of pack.ruleModules)
    insert(
      'INSERT INTO rule_modules (content_version_id, id, rule_key, summary, rules_json) VALUES (?, ?, ?, ?, ?)',
      [version, r.id, r.ruleKey, r.summary, JSON.stringify(r.rules)],
    );
  for (const a of pack.assets)
    insert(
      'INSERT INTO assets (content_version_id, id, owner_type, owner_id, asset_type, object_key, license_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        version,
        a.id,
        a.ownerType,
        a.ownerId,
        a.type,
        a.objectKey,
        a.licenseStatus,
      ],
    );
  return statements;
}

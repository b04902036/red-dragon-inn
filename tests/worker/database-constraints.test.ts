import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { assetSchema } from '../../src/content/pack';
import { D1ContentRepository } from '../../worker/repositories/content';
import { D1MatchRepository } from '../../worker/repositories/matches';
import {
  draftPack,
  freshDatabase,
  matchInput,
  seedDatabase,
  sql,
} from './database-helpers';

describe('D1 relational constraints and publication guards', () => {
  const repository = new D1ContentRepository(env.DB);
  beforeEach(async () => {
    await freshDatabase();
    await repository.saveDraft(draftPack());
  });
  it.each([
    "UPDATE products SET content_version_id = 'content_missing'",
    "UPDATE characters SET product_id = 'product_missing'",
    "UPDATE decks SET character_id = 'character_missing' WHERE deck_type = 'CHARACTER'",
    "UPDATE deck_cards SET deck_id = 'deck_missing' WHERE deck_id = 'deck_sample_tokens'",
    "UPDATE deck_cards SET card_id = 'carddef_missing' WHERE deck_id = 'deck_sample_tokens'",
    "UPDATE deck_cards SET content_version_id = 'content_missing'",
    'DELETE FROM products',
    "DELETE FROM decks WHERE deck_type = 'CHARACTER'",
  ])('rejects invalid references: %s', async (query) => {
    await expect(sql(query)).rejects.toThrow('FOREIGN KEY');
  });
  it('prevents cross-version references even when an ID exists in another version', async () => {
    await sql(
      "INSERT INTO content_versions VALUES ('content_empty', 'Empty', '2026-10-02T00:00:00Z', NULL)",
    );
    await expect(
      sql(
        "UPDATE decks SET content_version_id = 'content_empty' WHERE id = 'deck_sample_tokens'",
      ),
    ).rejects.toThrow('FOREIGN KEY');
    await expect(
      sql(
        "INSERT INTO assets VALUES ('content_empty', 'asset_bad', 'CARD', 'carddef_sample_shove', 'ICON', 'sample/a.svg', 'ORIGINAL')",
      ),
    ).rejects.toThrow('Invalid asset owner');
  });
  it.each([
    "UPDATE characters SET slug = 'sample-grovekeeper'",
    "INSERT INTO products SELECT content_version_id, 'product_another', slug, name, release_year FROM products",
    'INSERT INTO deck_cards SELECT * FROM deck_cards',
    "INSERT INTO rule_modules SELECT content_version_id, 'rule_another', rule_key, summary, rules_json FROM rule_modules",
  ])('enforces uniqueness: %s', async (query) => {
    await expect(sql(query)).rejects.toThrow('UNIQUE');
  });
  it.each([
    'UPDATE deck_cards SET quantity = 0',
    'UPDATE deck_cards SET quantity = 65',
    'UPDATE characters SET villain = 2',
    'UPDATE characters SET complexity = 6',
    "UPDATE characters SET rules_json = '[]'",
    "UPDATE rule_modules SET rules_json = 'invalid'",
    "UPDATE decks SET character_id = NULL WHERE deck_type = 'CHARACTER'",
    "UPDATE cards SET effect_dsl_json = '[]' WHERE id = 'carddef_sample_shove'",
    "UPDATE cards SET name = 'inconsistent'",
    "UPDATE cards SET effect_params_json = '[]' WHERE effect_key IS NOT NULL",
    "UPDATE cards SET definition_json = '{}'",
  ])('enforces quantities and JSON consistency: %s', async (query) => {
    await expect(sql(query)).rejects.toThrow();
  });
  it.each([
    ['PRODUCT', 'products', 'product_sample'],
    ['CHARACTER', 'characters', 'character_sample_3'],
    ['DECK', 'decks', 'deck_sample_tokens'],
    ['CARD', 'cards', 'carddef_sample_token'],
    ['RULE_MODULE', 'rule_modules', 'rule_sample_core'],
  ])(
    'maintains polymorphic %s asset ownership',
    async (ownerType, table, ownerId) => {
      await sql(
        "INSERT INTO assets VALUES ('content_draft', 'asset_owned', ?, ?, 'ICON', 'sample/icon.svg', 'ORIGINAL')",
        ownerType,
        ownerId,
      );
      await expect(
        sql("UPDATE assets SET owner_id = 'missing'"),
      ).rejects.toThrow('Invalid asset owner');
      await expect(
        sql(`DELETE FROM ${table} WHERE id = ?`, ownerId),
      ).rejects.toThrow();
      await expect(
        sql(`UPDATE ${table} SET id = 'renamed' WHERE id = ?`, ownerId),
      ).rejects.toThrow();
      await expect(
        sql(
          "INSERT INTO assets VALUES ('content_draft', 'asset_duplicate', ?, ?, 'ICON', 'sample/icon.svg', 'ORIGINAL')",
          ownerType,
          ownerId,
        ),
      ).rejects.toThrow('UNIQUE');
      await sql("DELETE FROM assets WHERE id = 'asset_owned'");
      expect(
        (
          await env.DB.prepare('SELECT COUNT(*) AS count FROM assets').first<{
            count: number;
          }>()
        )?.count,
      ).toBe(0);
    },
  );
  it.each([
    'products',
    'characters',
    'decks',
    'cards',
    'deck_cards',
    'rule_modules',
    'assets',
  ])('blocks inserts, updates, and deletes of published %s', async (table) => {
    const pack = draftPack('content_published');
    pack.assets = [
      assetSchema.parse({
        id: 'asset_sample',
        ownerType: 'PRODUCT',
        ownerId: 'product_sample',
        type: 'ICON',
        objectKey: 'sample/icon.svg',
        licenseStatus: 'ORIGINAL',
      }),
    ];
    await repository.saveDraft(pack);
    await repository.publishVersion(pack.version.id);
    await expect(
      sql(
        `INSERT INTO ${table} SELECT * FROM ${table} WHERE content_version_id = 'content_published'`,
      ),
    ).rejects.toThrow('immutable');
    await expect(
      sql(
        `UPDATE ${table} SET content_version_id = content_version_id WHERE content_version_id = 'content_published'`,
      ),
    ).rejects.toThrow('immutable');
    await expect(
      sql(
        `DELETE FROM ${table} WHERE content_version_id = 'content_published'`,
      ),
    ).rejects.toThrow(/immutable|Asset owner is referenced/);
    if (table !== 'assets')
      await expect(
        sql(
          `UPDATE ${table} SET content_version_id = 'content_published' WHERE content_version_id = 'content_draft'`,
        ),
      ).rejects.toThrow('immutable');
  });
  it('protects published version metadata and permits draft editing', async () => {
    const pack = draftPack();
    await sql(
      "UPDATE products SET name = 'Updated draft' WHERE content_version_id = 'content_draft'",
    );
    await sql(
      "UPDATE content_versions SET name = 'Updated draft' WHERE id = 'content_draft'",
    );
    await repository.publishVersion(pack.version.id);
    await expect(
      sql(
        "UPDATE content_versions SET published_at = NULL WHERE id = 'content_draft'",
      ),
    ).rejects.toThrow('immutable');
    await expect(
      sql("DELETE FROM content_versions WHERE id = 'content_draft'"),
    ).rejects.toThrow('immutable');
    await expect(
      sql(
        "INSERT OR REPLACE INTO content_versions (id, name, created_at, published_at) VALUES ('content_draft', 'Replacement', '2026-10-02T00:00:00Z', NULL)",
      ),
    ).rejects.toThrow('immutable');
    await sql(
      "INSERT INTO content_versions VALUES ('content_empty_published', 'Empty', '2026-10-02T00:00:00Z', '2026-10-02T00:00:00Z')",
    );
    await expect(
      sql(
        "INSERT OR REPLACE INTO content_versions VALUES ('content_empty_published', 'Replacement', '2026-10-02T00:00:00Z', NULL)",
      ),
    ).rejects.toThrow('immutable');
  });
  it('requires published content and valid version-scoped players, and rolls back incomplete match creation', async () => {
    const matches = new D1MatchRepository(env.DB);
    await expect(
      matches.create(matchInput('match_draft', 'content_draft')),
    ).rejects.toThrow('published');
    await seedDatabase();
    const input = matchInput();
    input.players[1]!.characterId = draftPack().characters[0]!.id;
    // Valid identity, but this character is removed from a second version.
    const other = draftPack('content_other');
    other.deckCards = [];
    other.decks = [];
    other.cards = [];
    other.characters = [];
    await repository.saveDraft(other);
    await repository.publishVersion(other.version.id);
    await expect(
      matches.create({ ...input, contentVersionId: other.version.id }),
    ).rejects.toThrow('FOREIGN KEY');
    expect(await matches.get(input.id)).toBeNull();
    await matches.create(matchInput());
    await expect(
      sql("UPDATE match_players SET character_id = 'character_missing'"),
    ).rejects.toThrow('FOREIGN KEY');
    await expect(
      sql("UPDATE match_players SET content_version_id = 'content_draft'"),
    ).rejects.toThrow('FOREIGN KEY');
    await expect(sql('UPDATE match_players SET seat = 0')).rejects.toThrow(
      'UNIQUE',
    );
    await expect(
      sql('INSERT INTO match_players SELECT * FROM match_players'),
    ).rejects.toThrow('UNIQUE');
  });
});

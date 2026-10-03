import { applyD1Migrations, reset } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { sampleContentPack } from '../../src/content/sample';
import { D1ContentRepository } from '../../worker/repositories/content';
import { seedDatabase } from './database-helpers';

describe('D1 migration and seed workflow in Workers', () => {
  beforeEach(async () => {
    await reset();
  });
  it('creates all fifteen tables from empty D1 and reapplies without changing data or schema', async () => {
    const before = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'content_versions'",
    ).all();
    expect(before.results).toEqual([]);
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    const tables = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations' ORDER BY name",
    ).all<{ name: string }>();
    expect(tables.results.map((row) => row.name)).toEqual([
      'assets',
      'cards',
      'characters',
      'content_versions',
      'deck_cards',
      'decks',
      'match_commands',
      'match_events',
      'match_manifests',
      'match_players',
      'match_results',
      'match_snapshots',
      'matches',
      'products',
      'rule_modules',
    ]);
    await seedDatabase();
    const schema = await env.DB.prepare(
      'SELECT name, sql FROM sqlite_master ORDER BY name',
    ).all();
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    expect(
      await env.DB.prepare(
        'SELECT name, sql FROM sqlite_master ORDER BY name',
      ).all(),
    ).toMatchObject({ results: schema.results });
    expect(
      (
        await env.DB.prepare('SELECT name FROM d1_migrations ORDER BY id').all<{
          name: string;
        }>()
      ).results.map((row) => row.name),
    ).toEqual(env.TEST_MIGRATIONS.map((m) => m.name));
    expect(
      (
        await env.DB.prepare('SELECT COUNT(*) AS count FROM cards').first<{
          count: number;
        }>()
      )?.count,
    ).toBe(10);
  });
  it('seeds original content idempotently and round-trips every character, card, quantity, rule, and drink', async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    await seedDatabase();
    await seedDatabase();
    const repository = new D1ContentRepository(env.DB);
    const version = sampleContentPack.version.id;
    expect(await repository.getVersion(version)).toEqual({
      ...sampleContentPack.version,
      publishedAt: sampleContentPack.version.createdAt,
    });
    for (const character of sampleContentPack.characters) {
      const graph = await repository.loadCharacter(version, character.id);
      expect(graph?.character).toEqual(character);
      expect(graph?.product).toEqual(sampleContentPack.products[0]);
      expect(graph?.ruleModules).toEqual(sampleContentPack.ruleModules);
      expect(graph?.assets).toEqual([]);
    }
    for (const deck of sampleContentPack.decks) {
      const graph = await repository.loadDeck(version, deck.id);
      const entries = sampleContentPack.deckCards.filter(
        (entry) => entry.deckId === deck.id,
      );
      expect(graph?.deck).toEqual(deck);
      expect(graph?.cards).toEqual(
        entries
          .map((entry) => ({
            definition: sampleContentPack.cards.find(
              (card) => card.id === entry.cardId,
            ),
            quantity: entry.quantity,
          }))
          .sort((a, b) => a.definition!.id.localeCompare(b.definition!.id)),
      );
      expect(graph?.totalQuantity).toBe(
        entries.reduce((n, entry) => n + entry.quantity, 0),
      );
    }
    const quantities = await env.DB.prepare(
      'SELECT quantity FROM deck_cards WHERE deck_id = ? AND card_id = ?',
    )
      .bind('deck_sample_0', 'carddef_sample_shove')
      .all();
    expect(quantities.results).toEqual([{ quantity: 2 }]);
    expect(
      (
        await env.DB.prepare('SELECT COUNT(*) AS count FROM cards WHERE id = ?')
          .bind('carddef_sample_shove')
          .first<{ count: number }>()
      )?.count,
    ).toBe(1);
  });
});

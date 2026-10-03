import { contentImportStatements } from '../../src/content/import-statements';
import { z } from 'zod';
import { cardDefinitionSchema } from '../../src/content/cards';
import {
  assetSchema,
  characterSchema,
  contentPackSchema,
  contentVersionSchema,
  deckSchema,
  productSchema,
  ruleModuleSchema,
} from '../../src/content/pack';
import {
  characterIdSchema,
  contentVersionIdSchema,
  deckIdSchema,
} from '../../src/shared/ids';
import type {
  CharacterId,
  ContentVersionId,
  DeckId,
} from '../../src/shared/ids';
import type { ContentPack } from '../../src/content/pack';
import type { ContentRepository, DeckGraph } from './contracts';
import { parseJsonColumn } from './schemas';

type Row = Record<string, unknown>;
const rowSchema = z.record(z.string(), z.unknown());
const toCharacter = (r: Row) =>
  characterSchema.parse({
    id: r.id,
    productId: r.product_id,
    slug: r.slug,
    name: r.name,
    villain: r.villain === 1,
    complexity: r.complexity,
    specialRuleKey: r.special_rule_key,
    rules: parseJsonColumn(r.rules_json),
  });
const toDeck = (r: Row) =>
  deckSchema.parse({
    id: r.id,
    characterId: r.character_id,
    type: r.deck_type,
    slug: r.slug,
    name: r.name,
  });
const toAsset = (r: Row) =>
  assetSchema.parse({
    id: r.id,
    ownerType: r.owner_type,
    ownerId: r.owner_id,
    type: r.asset_type,
    objectKey: r.object_key,
    licenseStatus: r.license_status,
  });

export class D1ContentRepository implements ContentRepository {
  constructor(private readonly db: D1Database) {}

  async saveDraft(input: ContentPack): Promise<void> {
    const pack = contentPackSchema.parse(input);
    const statements = contentImportStatements(pack).map(({ sql, values }) =>
      this.db.prepare(sql).bind(...values),
    );
    await this.db.batch(statements);
  }

  async publishVersion(id: ContentVersionId): Promise<void> {
    const version = contentVersionIdSchema.parse(id);
    const result = await this.db
      .prepare(
        "UPDATE content_versions SET published_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND published_at IS NULL",
      )
      .bind(version)
      .run();
    if (result.meta.changes !== 1)
      throw new RangeError('Version is missing or already published');
  }

  async getVersion(id: ContentVersionId) {
    const r = await this.db
      .prepare('SELECT * FROM content_versions WHERE id = ?')
      .bind(contentVersionIdSchema.parse(id))
      .first<Row>();
    return r === null
      ? null
      : contentVersionSchema.parse({
          id: r.id,
          name: r.name,
          createdAt: r.created_at,
          publishedAt: r.published_at,
        });
  }

  private async deckGraph(
    version: ContentVersionId,
    row: Row,
  ): Promise<DeckGraph> {
    const deck = toDeck(row);
    const result = await this.db
      .prepare(
        'SELECT c.definition_json, dc.quantity FROM deck_cards dc JOIN cards c ON c.content_version_id = dc.content_version_id AND c.id = dc.card_id WHERE dc.content_version_id = ? AND dc.deck_id = ? ORDER BY c.id',
      )
      .bind(version, deck.id)
      .all<Row>();
    const cards = result.results.map((r) => ({
      definition: cardDefinitionSchema.parse(
        parseJsonColumn(r.definition_json),
      ),
      quantity: z.number().int().min(1).max(64).parse(r.quantity),
    }));
    return {
      deck,
      cards,
      totalQuantity: cards.reduce((total, card) => total + card.quantity, 0),
    };
  }

  async loadDeck(id: ContentVersionId, deckId: DeckId) {
    const version = contentVersionIdSchema.parse(id);
    const row = await this.db
      .prepare(
        'SELECT d.* FROM decks d JOIN content_versions v ON v.id = d.content_version_id WHERE d.content_version_id = ? AND d.id = ? AND v.published_at IS NOT NULL',
      )
      .bind(version, deckIdSchema.parse(deckId))
      .first<Row>();
    return row === null ? null : this.deckGraph(version, row);
  }

  async loadCharacter(id: ContentVersionId, characterId: CharacterId) {
    const versionId = contentVersionIdSchema.parse(id);
    const row = await this.db
      .prepare(
        'SELECT c.* FROM characters c JOIN content_versions v ON v.id = c.content_version_id WHERE c.content_version_id = ? AND c.id = ? AND v.published_at IS NOT NULL',
      )
      .bind(versionId, characterIdSchema.parse(characterId))
      .first<Row>();
    if (row === null) return null;
    const character = toCharacter(row);
    const [version, productRow, deckRows, ruleRows, assetRows] =
      await Promise.all([
        this.getVersion(versionId),
        this.db
          .prepare(
            'SELECT * FROM products WHERE content_version_id = ? AND id = ?',
          )
          .bind(versionId, character.productId)
          .first<Row>(),
        this.db
          .prepare(
            'SELECT * FROM decks WHERE content_version_id = ? AND character_id = ? ORDER BY id',
          )
          .bind(versionId, character.id)
          .all<Row>(),
        this.db
          .prepare(
            'SELECT * FROM rule_modules WHERE content_version_id = ? ORDER BY id',
          )
          .bind(versionId)
          .all<Row>(),
        this.db
          .prepare(
            'SELECT * FROM assets WHERE content_version_id = ? ORDER BY id',
          )
          .bind(versionId)
          .all<Row>(),
      ]);
    const r = rowSchema.parse(productRow);
    const product = productSchema.parse({
      id: r.id,
      slug: r.slug,
      name: r.name,
      releaseYear: r.release_year,
    });
    const decks = await Promise.all(
      deckRows.results.map((deck) => this.deckGraph(versionId, deck)),
    );
    const rules = ruleRows.results.map((r) =>
      ruleModuleSchema.parse({
        id: r.id,
        ruleKey: r.rule_key,
        summary: r.summary,
        rules: parseJsonColumn(r.rules_json),
      }),
    );
    const owners = new Set<string>([
      product.id,
      character.id,
      ...decks.map((d) => d.deck.id),
      ...decks.flatMap((d) => d.cards.map((c) => c.definition.id)),
      ...rules.map((rule) => rule.id),
    ]);
    const assets = assetRows.results
      .map(toAsset)
      .filter((asset) => owners.has(asset.ownerId));
    return {
      version: contentVersionSchema.parse(version),
      product,
      character,
      decks,
      ruleModules: rules,
      assets,
    };
  }
}

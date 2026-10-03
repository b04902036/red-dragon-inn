import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { assetSchema } from '../../src/content/pack';
import type { ContentPack } from '../../src/content/pack';
import { sampleContentPack } from '../../src/content/sample';
import {
  characterIdSchema,
  contentVersionIdSchema,
  deckIdSchema,
} from '../../src/shared/ids';
import { D1ContentRepository } from '../../worker/repositories/content';
import { draftPack, freshDatabase, sql } from './database-helpers';

describe('D1 content repository', () => {
  const repository = new D1ContentRepository(env.DB);
  beforeEach(freshDatabase);
  it('saves a draft atomically, keeps drafts unavailable for play, and publishes once', async () => {
    const pack = draftPack();
    const version = pack.version.id;
    const character = pack.characters[0]!.id;
    const deck = pack.decks[0]!.id;
    expect(await repository.getVersion(version)).toBeNull();
    expect(await repository.loadCharacter(version, character)).toBeNull();
    expect(await repository.loadDeck(version, deck)).toBeNull();
    await repository.saveDraft(pack);
    expect(await repository.getVersion(version)).toEqual({
      ...pack.version,
      publishedAt: null,
    });
    expect(await repository.loadCharacter(version, character)).toBeNull();
    expect(await repository.loadDeck(version, deck)).toBeNull();
    await repository.publishVersion(version);
    const graph = await repository.loadCharacter(version, character);
    expect(graph?.version.publishedAt).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(graph?.character).toEqual(pack.characters[0]);
    expect(graph?.decks).toHaveLength(1);
    expect(graph?.decks[0]?.cards).toHaveLength(6);
    expect(graph?.decks[0]?.totalQuantity).toBe(7);
    await expect(repository.publishVersion(version)).rejects.toThrow(
      'already published',
    );
    await expect(
      repository.publishVersion(
        contentVersionIdSchema.parse('content_missing'),
      ),
    ).rejects.toThrow('missing');
    expect(
      await repository.loadCharacter(
        version,
        characterIdSchema.parse('character_missing'),
      ),
    ).toBeNull();
    expect(
      await repository.loadDeck(version, deckIdSchema.parse('deck_missing')),
    ).toBeNull();
  });
  it('round-trips resources, custom params, reaction/drink metadata, and every asset owner', async () => {
    const pack = draftPack();
    pack.characters[1]!.villain = true;
    pack.characters[1]!.complexity = null;
    pack.products[0]!.releaseYear = null;
    const owners = [
      ['PRODUCT', 'product_sample'],
      ['CHARACTER', 'character_sample_1'],
      ['DECK', 'deck_sample_tokens'],
      ['CARD', 'carddef_sample_token'],
      ['RULE_MODULE', 'rule_sample_core'],
      ['CHARACTER', 'character_sample_2'],
    ];
    pack.assets = owners.map(([ownerType, ownerId], i) =>
      assetSchema.parse({
        id: `asset_${i}`,
        ownerType,
        ownerId,
        type: 'ICON',
        objectKey: `sample/${i}.svg`,
        licenseStatus: 'ORIGINAL',
      }),
    );
    await repository.saveDraft(pack);
    await repository.publishVersion(pack.version.id);
    const graph = await repository.loadCharacter(
      pack.version.id,
      pack.characters[1]!.id,
    );
    expect(graph?.character).toEqual(pack.characters[1]);
    expect(graph?.product).toEqual(pack.products[0]);
    expect(graph?.decks).toHaveLength(2);
    expect(graph?.assets).toEqual(pack.assets.slice(0, 5));
    expect(graph?.ruleModules).toEqual(pack.ruleModules);
    for (const deck of pack.decks) {
      const graph = await repository.loadDeck(pack.version.id, deck.id);
      for (const card of graph!.cards)
        expect(card.definition).toEqual(
          pack.cards.find((definition) => definition.id === card.definition.id),
        );
    }
    const custom = await env.DB.prepare(
      'SELECT effect_key, effect_params_json, effect_dsl_json, definition_json FROM cards WHERE id = ?',
    )
      .bind('carddef_sample_token')
      .first<{
        effect_key: string;
        effect_params_json: string;
        effect_dsl_json: string;
        definition_json: string;
      }>();
    expect(custom?.effect_key).toBe('sample.adjust-resource');
    expect(JSON.parse(custom!.effect_params_json)).toEqual({
      resource: 'tokens',
      delta: 1,
    });
    expect(JSON.parse(custom!.effect_dsl_json)).toEqual(
      pack.cards.find((card) => card.type === 'SPECIAL')?.effects,
    );
    expect(JSON.parse(custom!.definition_json)).toEqual(
      pack.cards.find((card) => card.type === 'SPECIAL'),
    );
  });
  it('rejects derived slug collisions and invalid effects before any writes', async () => {
    const pack = draftPack();
    const card = sampleContentPack.cards[0]!;
    const collision = {
      ...pack,
      cards: [
        { ...card, id: 'carddef_same_slug' },
        { ...card, id: 'carddef_same-slug' },
      ],
      deckCards: [],
    } as unknown as ContentPack;
    await expect(repository.saveDraft(collision)).rejects.toThrow(
      'Duplicate derived card slug',
    );
    expect(await repository.getVersion(pack.version.id)).toBeNull();
    expect(
      (
        await env.DB.prepare('SELECT COUNT(*) AS count FROM products').first<{
          count: number;
        }>()
      )?.count,
    ).toBe(0);
    await expect(
      repository.saveDraft({
        ...pack,
        cards: [{ ...card, effects: [{ op: 'EXECUTE_JS', code: 'bad' }] }],
      } as unknown as ContentPack),
    ).rejects.toThrow();
    expect(await repository.getVersion(pack.version.id)).toBeNull();
    await expect(
      repository.getVersion(
        "content_bad' OR 1=1" as ContentPack['version']['id'],
      ),
    ).rejects.toThrow();
  });
  it('fails closed on malformed database JSON rather than returning unsafe definitions', async () => {
    const pack = draftPack();
    await repository.saveDraft(pack);
    await sql(
      "UPDATE cards SET definition_json = json_set(definition_json, '$.source', 'UNTRUSTED') WHERE id = ?",
      'carddef_sample_shove',
    );
    await repository.publishVersion(pack.version.id);
    await expect(
      repository.loadDeck(pack.version.id, pack.decks[0]!.id),
    ).rejects.toThrow();
  });
});

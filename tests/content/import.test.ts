import { describe, expect, it, vi } from 'vitest';
import { importContent, validateContentImport } from '../../src/content/import';
import { sampleContentPack } from '../../src/content/sample';

const fixture = () => structuredClone(sampleContentPack);
const check = (pack: unknown) => validateContentImport(JSON.stringify(pack));
describe('content import validation and reporting', () => {
  it('rejects distinct card IDs that would collide in D1 derived slugs', () => {
    const pack = fixture();
    pack.cards.push({ ...pack.cards[0]!, id: 'carddef_slug_a' as never });
    pack.cards.push({ ...pack.cards[0]!, id: 'carddef_slug-a' as never });
    expect(check(pack).report.errors).toContain(
      'pack: Duplicate derived card slug',
    );
  });
  it('accepts original JSON with shared definitions and correct physical quantities', () => {
    const { pack, report } = check(fixture());
    expect(pack).toEqual(sampleContentPack);
    expect(report).toMatchObject({
      valid: true,
      versionId: 'content_sample_v1',
      characters: 4,
      decks: 6,
      uniqueCards: 10,
      physicalCards: 37,
      errors: [],
      unsupportedEffects: [],
      missingAssets: [],
    });
    expect(
      pack!.cards.filter((card) => card.id === 'carddef_sample_shove'),
    ).toHaveLength(1);
    expect(
      pack!.deckCards
        .filter((row) => row.cardId === 'carddef_sample_shove')
        .map((row) => row.quantity),
    ).toEqual([2, 2, 2, 2]);
  });
  it.each([
    [
      'foreign reference',
      (p: ReturnType<typeof fixture>) => {
        p.characters[0]!.productId =
          'product_missing' as (typeof p.characters)[number]['productId'];
      },
    ],
    [
      'duplicate ID',
      (p: ReturnType<typeof fixture>) => {
        p.cards.push(p.cards[0]!);
      },
    ],
    [
      'bad quantity',
      (p: ReturnType<typeof fixture>) => {
        p.deckCards[0]!.quantity = 0;
      },
    ],
    [
      'card category',
      (p: ReturnType<typeof fixture>) => {
        Object.assign(p.cards[0]!, { type: 'UNKNOWN' });
      },
    ],
    [
      'malformed DSL',
      (p: ReturnType<typeof fixture>) => {
        Object.assign(p.cards[0]!, { effects: '{invalid json' });
      },
    ],
    [
      'executable params',
      (p: ReturnType<typeof fixture>) => {
        Object.assign(p.cards[0]!, {
          effects: [
            {
              op: 'CUSTOM',
              target: 'SELF',
              effect_key: 'sample.adjust-resource',
              params: { resource: 'tokens', delta: 'eval()' },
            },
          ],
        });
      },
    ],
  ])('rejects %s with a human-readable field report', (_name, mutate) => {
    const pack = fixture();
    mutate(pack);
    const result = check(pack);
    expect(result.pack).toBeNull();
    expect(result.report.valid).toBe(false);
    expect(result.report.errors.length).toBeGreaterThan(0);
    expect(
      result.report.errors.every(
        (error) => typeof error === 'string' && error.includes(':'),
      ),
    ).toBe(true);
  });
  it('reports unknown custom keys without running them', () => {
    const pack = fixture();
    Object.assign(pack.cards[0]!, {
      effects: [
        {
          op: 'CUSTOM',
          target: 'SELF',
          effect_key: 'unknown.character-power',
          params: {},
        },
      ],
    });
    expect(check(pack).report).toMatchObject({
      valid: false,
      unsupportedEffects: ['unknown.character-power'],
    });
  });
  it('reports malformed JSON and a throwing source adapter', () => {
    expect(validateContentImport('{bad').report.errors).toEqual([
      'Invalid json source: decoding failed.',
    ]);
    expect(
      validateContentImport('', {
        format: 'local-export',
        decode() {
          throw new Error('Private text');
        },
      }).report.errors,
    ).toEqual(['Invalid local-export source: decoding failed.']);
    expect(validateContentImport('null').pack).toBeNull();
  });
  it('allows adapters while sharing strict validation and reports unavailable assets', () => {
    const pack = fixture();
    pack.assets = [
      {
        id: 'asset_import_icon' as never,
        ownerType: 'CHARACTER',
        ownerId: pack.characters[0]!.id,
        type: 'ICON',
        objectKey: 'icons/sample.svg',
        licenseStatus: 'ORIGINAL',
      },
    ];
    const adapter = { format: 'manual-local', decode: () => pack };
    const result = validateContentImport('local source', adapter);
    expect(result.report).toMatchObject({
      valid: true,
      missingAssets: ['icons/sample.svg'],
    });
    expect(result.report.warnings).toHaveLength(1);
    expect(
      validateContentImport('', adapter, ['icons/sample.svg']).report.warnings,
    ).toEqual([]);
  });
  it('writes nothing by default, in explicit dry runs, or for invalid input', async () => {
    const store = { saveDraft: vi.fn().mockResolvedValue(undefined) };
    expect(
      (await importContent(JSON.stringify(fixture()), store)).written,
    ).toBe(false);
    expect(
      (await importContent(JSON.stringify(fixture()), store, { dryRun: true }))
        .written,
    ).toBe(false);
    expect(
      (await importContent('invalid', store, { dryRun: false })).written,
    ).toBe(false);
    expect(store.saveDraft).not.toHaveBeenCalled();
    expect(
      (await importContent(JSON.stringify(fixture()), store, { dryRun: false }))
        .written,
    ).toBe(true);
    expect(store.saveDraft).toHaveBeenCalledExactlyOnceWith(sampleContentPack);
  });
});

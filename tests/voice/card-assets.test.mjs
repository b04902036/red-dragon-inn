import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  configurationSchema,
  requiredCards,
  planAssets,
  generateAssets,
  verifyAssets,
  validMp3,
} from '../../scripts/card-voice-assets.mjs';
const names = [
  'deirdre',
  'fiona',
  'gerki',
  'zot',
  'dimli',
  'eve',
  'fleck',
  'gog',
];
const config = {
  schemaVersion: 1,
  characters: names.map((name) => ({
    characterId: `character_sample_${name}`,
    enabled: ['gog', 'dimli', 'fleck'].includes(name),
    voiceId: ['gog', 'dimli', 'fleck'].includes(name)
      ? 'aaaaaaaaaaaaaaaaaaaa'
      : null,
    modelId: 'eleven_flash_v2_5',
    outputFormat: 'mp3_44100_128',
  })),
};
const pack = {
  characters: config.characters.map((c) => ({ id: c.characterId })),
  decks: config.characters.map((c) => ({
    id: `deck_${c.characterId}`,
    characterId: c.characterId,
    type: 'CHARACTER',
  })),
  deckCards: config.characters.map((c) => ({
    deckId: `deck_${c.characterId}`,
    cardId: `carddef_${c.characterId}`,
    quantity: 40,
  })),
  cards: config.characters.map((c) => ({
    id: `carddef_${c.characterId}`,
    name: 'Descriptive display label, never spoken',
    type: 'SOMETIMES',
    rulesText: 'Never speak these rules.',
  })),
};
const titles = {
  schemaVersion: 2,
  entries: config.characters.map((c) => ({
    characterId: c.characterId,
    cardDefinitionId: `carddef_${c.characterId}`,
    variants: [
      {
        variantId: 'v_test',
        quantity: 40,
        spokenText: `Sample ${c.characterId}: "An exact title!"`,
      },
    ],
  })),
};
const mp3 = () => {
  const bytes = Buffer.alloc(834);
  bytes.writeUInt32BE(0xfffb9000, 0);
  bytes.writeUInt32BE(0xfffb9000, 417);
  return bytes;
};
const good = () =>
  new Response(mp3(), { headers: { 'Content-Type': 'audio/mpeg' } });
async function temporary(run) {
  const root = await mkdtemp(join(tmpdir(), 'rdi-card-voice-'));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
test('manual config contains exactly the user-confirmed three IDs; others remain null', async () => {
  const actual = configurationSchema.parse(
    JSON.parse(
      await readFile('content/presentation/character-voices.json', 'utf8'),
    ),
  );
  assert.deepEqual(
    Object.fromEntries(
      actual.characters
        .filter((c) => c.enabled)
        .map((c) => [c.characterId, c.voiceId]),
    ),
    {
      character_rdi_gog_the_half_ogre: 'LSaaFXnHBKjbbNrMtOsH',
      character_rdi_dimli_the_dwarf: 'iDHk3E7ojf3zi6XPDM2o',
      character_rdi_fleck_the_bard: 'kJ1WJLsLiz0CnWmEPesT',
    },
  );
  assert.deepEqual(
    actual.characters
      .filter((c) => c.enabled)
      .map((c) => c.voiceId)
      .sort(),
    [
      'LSaaFXnHBKjbbNrMtOsH',
      'iDHk3E7ojf3zi6XPDM2o',
      'kJ1WJLsLiz0CnWmEPesT',
    ].sort(),
  );
  assert.equal(
    actual.characters.filter((c) => !c.enabled && c.voiceId === null).length,
    5,
  );
});
test('ownership follows deck membership, physical copies deduplicate, Drink/Event records are excluded', () => {
  const source = {
    ...pack,
    cards: [
      ...pack.cards,
      { id: 'carddef_drink', type: 'DRINK', name: 'Sample Drink' },
    ],
    decks: [
      ...pack.decks,
      { id: 'deck_inn', type: 'DRINK', characterId: null },
    ],
    deckCards: [
      ...pack.deckCards,
      { deckId: 'deck_inn', cardId: 'carddef_drink', quantity: 30 },
    ],
  };
  assert.equal(requiredCards(source, config).length, 8);
  assert.equal(planAssets(source, config, titles).length, 3);
  assert.throws(
    () =>
      planAssets(pack, config, {
        ...titles,
        entries: [...titles.entries, titles.entries[0]],
      }),
    /duplicate/,
  );
  assert.throws(
    () =>
      planAssets(pack, config, {
        ...titles,
        entries: [{ ...titles.entries[0], characterId: 'character_wrong' }],
      }),
    /ownership/,
  );
});
test('missing canonical text fails preflight before HTTP, rather than speaking descriptive names', async () => {
  let requests = 0;
  await assert.rejects(
    generateAssets({
      pack,
      configuration: config,
      titles: { schemaVersion: 2, entries: [] },
      fetchImpl: () => {
        requests++;
        return good();
      },
    }),
    /printed titles missing/,
  );
  assert.equal(requests, 0);
});
test('TTS receives exact titles, selected voice, explicit model/format; cache skips with no key or requests', () =>
  temporary(async (root) => {
    const calls = [];
    const result = await generateAssets({
      pack,
      configuration: config,
      titles,
      root,
      apiKey: 'TEST_ONLY_KEY',
      fetchImpl: (url, request) => {
        calls.push({ url, request });
        return good();
      },
    });
    assert.equal(result.requests, 3);
    for (const [index, call] of calls.entries()) {
      assert.equal(
        call.url,
        'https://api.elevenlabs.io/v1/text-to-speech/aaaaaaaaaaaaaaaaaaaa?output_format=mp3_44100_128',
      );
      assert.equal(call.request.headers['xi-api-key'], 'TEST_ONLY_KEY');
      const body = JSON.parse(call.request.body);
      assert.equal(
        body.text,
        titles.entries.filter(
          (entry) =>
            config.characters.find(
              (character) => character.characterId === entry.characterId,
            ).enabled,
        )[index].variants[0].spokenText,
      );
      assert.equal(body.model_id, 'eleven_flash_v2_5');
      assert.equal(call.request.body.includes('rules'), false);
    }
    const cached = await generateAssets({
      pack,
      configuration: config,
      titles,
      root,
      fetchImpl: () => {
        throw new Error('Must not request');
      },
    });
    assert.equal(cached.requests, 0);
    assert.equal(
      Object.values(cached.counts).reduce((sum, c) => sum + c.skipped, 0),
      3,
    );
    assert.equal(
      (await verifyAssets({ pack, configuration: config, titles, root })).count,
      3,
    );
    assert.equal(
      (
        await readFile(join(root, 'audio/cards/manifest.json'), 'utf8')
      ).includes('TEST_ONLY_KEY'),
      false,
    );
    await assert.rejects(
      verifyAssets({ pack, configuration: config, titles, root, strict: true }),
      /Unconfigured/,
    );
  }));
test('rate limits stop safely, then resume partial successes only', () =>
  temporary(async (root) => {
    let calls = 0;
    const result = await generateAssets({
      pack,
      configuration: config,
      titles,
      root,
      apiKey: 'TEST',
      wait: async () => {},
      fetchImpl: () => {
        calls++;
        return calls === 1
          ? good()
          : new Response('DO NOT LOG THIS', { status: 429 });
      },
    });
    assert.equal(result.requests, 2);
    assert.equal(result.failures.length, 1);
    assert.equal(
      JSON.parse(
        await readFile(join(root, 'audio/cards/manifest.json'), 'utf8'),
      ).entries.length,
      1,
    );
    assert.equal(JSON.stringify(result).includes('DO NOT LOG'), false);
    const resumed = await generateAssets({
      pack,
      configuration: config,
      titles,
      root,
      apiKey: 'TEST',
      fetchImpl: good,
    });
    assert.equal(resumed.requests, 2);
    assert.equal(resumed.counts.character_sample_dimli.skipped, 1);
    const firstAsset = planAssets(pack, config, titles)[0];
    await rm(join(root, firstAsset.assetPath.slice(1)));
    const waits = [];
    const unavailable = await generateAssets({
      pack,
      configuration: config,
      titles,
      root,
      apiKey: 'TEST',
      wait: async (delay) => {
        waits.push(delay);
      },
      fetchImpl: () => new Response('DO NOT LOG THIS', { status: 503 }),
    });
    assert.equal(unavailable.requests, 4);
    assert.deepEqual(waits, [500, 1000, 2000]);
    assert.match(unavailable.failures[0].reason, /HTTP 503/);
    assert.equal(JSON.stringify(unavailable).includes('DO NOT LOG'), false);
  }));
test('only missing, corrupt or changed-input files regenerate', () =>
  temporary(async (root) => {
    await generateAssets({
      pack,
      configuration: config,
      titles,
      root,
      apiKey: 'TEST',
      fetchImpl: good,
    });
    const assets = planAssets(pack, config, titles);
    await rm(join(root, assets[0].assetPath.slice(1)));
    await writeFile(join(root, assets[1].assetPath.slice(1)), Buffer.alloc(0));
    const changed = {
      ...titles,
      entries: titles.entries.map((entry, i) =>
        i === 7
          ? {
              ...entry,
              variants: [
                {
                  ...entry.variants[0],
                  spokenText: 'Sample updated canonical title.',
                },
              ],
            }
          : entry,
      ),
    };
    await assert.rejects(
      verifyAssets({ pack, configuration: config, titles: changed, root }),
      /invalid/,
    );
    const result = await generateAssets({
      pack,
      configuration: config,
      titles: changed,
      root,
      apiKey: 'TEST',
      fetchImpl: good,
    });
    assert.equal(result.requests, 3);
    assert.equal(
      (
        await verifyAssets({
          pack,
          configuration: config,
          titles: changed,
          root,
        })
      ).count,
      3,
    );
  }));
test('reject zero/truncated/wrong-format media; network and auth failures preserve successful work', () =>
  temporary(async (root) => {
    assert.equal(validMp3(mp3()), true);
    assert.equal(validMp3(mp3().subarray(0, 800)), false);
    const wrong = mp3();
    wrong[2] = 0xb0;
    assert.equal(validMp3(wrong), false);
    assert.equal(validMp3(Buffer.alloc(0)), false);
    for (const fetchImpl of [
      () => new Response('KEY_REFLECTION', { status: 401 }),
      () => {
        throw new Error('KEY_REFLECTION');
      },
      () =>
        new Response(Buffer.alloc(0), {
          headers: { 'content-type': 'audio/mpeg' },
        }),
    ]) {
      const result = await generateAssets({
        pack,
        configuration: config,
        titles,
        root,
        apiKey: 'TEST',
        fetchImpl,
      });
      assert.equal(result.requests, 1);
      assert.equal(result.failures.length, 1);
      assert.equal(JSON.stringify(result).includes('KEY_REFLECTION'), false);
    }
    await generateAssets({
      pack,
      configuration: config,
      titles,
      root,
      apiKey: 'TEST',
      fetchImpl: good,
    });
    const manifestPath = join(root, 'audio/cards/manifest.json');
    const previousManifest = await readFile(manifestPath, 'utf8');
    const firstPath = join(
      root,
      planAssets(pack, config, titles)[0].assetPath.slice(1),
    );
    const previousBytes = await readFile(firstPath);
    const undecodable = await generateAssets({
      pack,
      configuration: config,
      titles,
      root,
      apiKey: 'TEST',
      fetchImpl: good,
      validateAudio: () => {
        throw new Error('KEY_REFLECTION');
      },
    });
    assert.equal(undecodable.requests, 1);
    assert.match(undecodable.failures[0].reason, /failed browser decoding/);
    assert.equal(JSON.stringify(undecodable).includes('KEY_REFLECTION'), false);
    assert.equal(await readFile(manifestPath, 'utf8'), previousManifest);
    assert.deepEqual(await readFile(firstPath), previousBytes);
  }));
test('verifier rejects extra/stale files and duplicate manifest paths', () =>
  temporary(async (root) => {
    await generateAssets({
      pack,
      configuration: config,
      titles,
      root,
      apiKey: 'TEST',
      fetchImpl: good,
    });
    const file = join(root, 'audio/cards/manifest.json');
    const manifest = JSON.parse(await readFile(file, 'utf8'));
    await writeFile(
      file,
      JSON.stringify({
        ...manifest,
        entries: [...manifest.entries, manifest.entries.at(-1)],
      }),
    );
    let requests = 0;
    await assert.rejects(
      generateAssets({
        pack,
        configuration: config,
        titles,
        root,
        apiKey: 'TEST',
        fetchImpl: () => {
          requests++;
          return good();
        },
      }),
      /Invalid voice manifest/,
    );
    assert.equal(requests, 0);
    await assert.rejects(
      verifyAssets({ pack, configuration: config, titles, root }),
      /Invalid voice manifest/,
    );
    await writeFile(file, JSON.stringify(manifest));
    await writeFile(join(root, 'audio/cards/unexpected.mp3'), mp3());
    await assert.rejects(
      verifyAssets({ pack, configuration: config, titles, root }),
      /Unexpected/,
    );
  }));
test('two printed variants under one mechanic get distinct clips, duplicate physical copies reuse clips, and corruption repairs only one', () =>
  temporary(async (root) => {
    const expanded = structuredClone(titles);
    const entry = expanded.entries.find(
      (entry) => entry.characterId === 'character_sample_dimli',
    );
    entry.variants = [
      {
        variantId: 'v_first',
        spokenText: 'Sample exact first title!',
        quantity: 12,
      },
      {
        variantId: 'v_second',
        spokenText: 'Sample exact SECOND title?',
        quantity: 28,
      },
    ];
    const texts = [];
    const generated = await generateAssets({
      pack,
      configuration: config,
      titles: expanded,
      root,
      apiKey: 'TEST',
      fetchImpl: (_url, request) => {
        texts.push(JSON.parse(request.body).text);
        return good();
      },
    });
    assert.equal(generated.requests, 4);
    assert.deepEqual(
      texts.slice(0, 2),
      entry.variants.map((variant) => variant.spokenText),
    );
    const assets = planAssets(pack, config, expanded);
    assert.notEqual(assets[0].assetPath, assets[1].assetPath);
    await writeFile(join(root, assets[1].assetPath.slice(1)), Buffer.alloc(0));
    const repaired = await generateAssets({
      pack,
      configuration: config,
      titles: expanded,
      root,
      apiKey: 'TEST',
      fetchImpl: good,
    });
    assert.equal(repaired.requests, 1);
    assert.equal(repaired.counts.character_sample_dimli.skipped, 1);
    assert.equal(
      (
        await verifyAssets({
          pack,
          configuration: config,
          titles: expanded,
          root,
        })
      ).count,
      4,
    );
    const nextConfig = structuredClone(config);
    nextConfig.characters[0].enabled = true;
    nextConfig.characters[0].voiceId = 'bbbbbbbbbbbbbbbbbbbb';
    const next = await generateAssets({
      pack,
      configuration: nextConfig,
      titles: expanded,
      root,
      apiKey: 'TEST',
      fetchImpl: good,
    });
    assert.equal(next.requests, 1);
    assert.equal(next.counts.character_sample_deirdre.generated, 1);
    assert.equal(next.counts.character_sample_dimli.skipped, 2);
  }));

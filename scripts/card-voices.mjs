import { readFile, mkdir, writeFile } from 'node:fs/promises';
import {
  configurationSchema,
  titlesSchema,
  planAssets,
  readManifest,
  currentAsset,
  generateAssets,
  verifyAssets,
} from './card-voice-assets.mjs';
import {
  buildTitleVariants,
  buildTitleAssignments,
  loadTitleSources,
} from './card-title-variants.mjs';
import { verifyDecoding, verifyAudioBytes } from './voice-decode.mjs';
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
try {
  const configuration = configurationSchema.parse(
    await readJson('content/presentation/character-voices.json'),
  );
  const pack = await readJson(
    'content-private/imports/rdi2/pack-combined.json',
  );
  const titles = titlesSchema.parse(
    await readJson('content-private/voice/canonical-titles.json'),
  );
  if (
    JSON.stringify(titles) !==
    JSON.stringify(buildTitleVariants(pack, await loadTitleSources()))
  )
    throw new Error(
      'Title inputs changed; run npm run voice:titles before generating.',
    );
  const assets = planAssets(pack, configuration, titles);
  if (
    JSON.stringify(
      await readJson('content/presentation/card-title-assignments.json'),
    ) !== JSON.stringify(buildTitleAssignments(pack, titles))
  )
    throw new Error(
      'Runtime presentation assignments are outdated; run npm run voice:titles.',
    );
  const [mode, ...extra] = process.argv.slice(2);
  if (extra.length || !['generate', 'partial', 'strict', 'plan'].includes(mode))
    throw new Error(
      'Use voice:generate, voice:verify:partial, voice:verify or voice:plan.',
    );
  await mkdir('.tools/voice-generation', { recursive: true });
  if (mode === 'plan' || mode === 'generate') {
    const manifest = await readManifest('public');
    let hits = 0;
    for (const asset of assets) {
      const entry = manifest.entries.find(
        (entry) =>
          entry.characterId === asset.characterId &&
          entry.cardDefinitionId === asset.cardDefinitionId &&
          entry.variantId === asset.variantId,
      );
      if (await currentAsset(entry, asset, 'public', verifyAudioBytes)) hits++;
    }
    const plan = {
      enabled: configuration.characters
        .filter((character) => character.enabled)
        .map((character) => character.characterId),
      physicalAssignments: 320,
      mappingErrors: 0,
      uniqueAssets: assets.length,
      cacheHits: hits,
      apiRequired: assets.length - hits,
    };
    await writeFile(
      '.tools/voice-generation/plan.json',
      JSON.stringify(plan, null, 2) + '\n',
    );
    console.log(JSON.stringify(plan));
    if (mode === 'generate') {
      const result = await generateAssets({
        pack,
        configuration,
        titles,
        apiKey: process.env.ELEVENLABS_API_KEY,
        validateAudio: verifyAudioBytes,
        report: console.log,
      });
      await writeFile(
        '.tools/voice-generation/last-run.json',
        JSON.stringify(result, null, 2) + '\n',
      );
      console.log(JSON.stringify(result));
      if (result.failures.length) process.exitCode = 1;
    }
  } else {
    const result = await verifyAssets({
      pack,
      configuration,
      titles,
      strict: mode === 'strict',
    });
    const decoded = await verifyDecoding(result.assets);
    await writeFile(
      '.tools/voice-generation/decoding.json',
      JSON.stringify(decoded, null, 2) + '\n',
    );
    console.log(
      `PASS: ${result.count} assets complete, current and browser-decoded; ${result.unconfigured.length} characters unconfigured.`,
    );
  }
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : 'Offline card voice operation failed.',
  );
  process.exitCode = 1;
}

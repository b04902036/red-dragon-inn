import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rename, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

const id = z.string().regex(/^[a-z][a-z0-9_]*$/);
const mapping = z
  .strictObject({
    characterId: id,
    enabled: z.boolean(),
    voiceId: z
      .string()
      .regex(/^[A-Za-z0-9]{20,64}$/)
      .nullable(),
    modelId: z.literal('eleven_flash_v2_5'),
    outputFormat: z.literal('mp3_44100_128'),
    voiceRoleOverride: id.optional(),
  })
  .refine(
    (value) => value.enabled === (value.voiceId !== null),
    'Enabled voices require a configured ID',
  );
export const configurationSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    characters: z.array(mapping).length(8),
  })
  .refine(
    (value) => new Set(value.characters.map((c) => c.characterId)).size === 8,
    'Duplicate character',
  );
export const titlesSchema = z.strictObject({
  schemaVersion: z.literal(1),
  entries: z.array(
    z.strictObject({
      characterId: id,
      cardDefinitionId: id,
      spokenText: z
        .string()
        .min(1)
        .max(1000)
        .refine(
          (text) => text === text.trim() && !/[\r\n\p{Script=Han}]/u.test(text),
          'Use the exact single canonical English title',
        ),
      evidence: z.string().min(1),
    }),
  ),
});
const settings = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0,
  use_speaker_boost: true,
  speed: 1,
};
export const sha256 = (bytes) =>
  createHash('sha256').update(bytes).digest('hex');
const assetSchema = z.strictObject({
  characterId: id,
  cardDefinitionId: id,
  spokenText: z.string().min(1),
  voiceId: mapping.shape.voiceId.unwrap(),
  modelId: mapping.shape.modelId,
  outputFormat: mapping.shape.outputFormat,
  voiceSettings: z.object({
    stability: z.number(),
    similarity_boost: z.number(),
    style: z.number(),
    use_speaker_boost: z.boolean(),
    speed: z.number(),
  }),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  assetPath: z
    .string()
    .regex(/^\/audio\/cards\/[a-z][a-z0-9_]*\/[a-z][a-z0-9_]*\.mp3$/),
  generatedAt: z.iso.datetime(),
  sourceUrl: z.string().url(),
  author: z.string(),
  license: z.string(),
});
export const manifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  entries: z.array(assetSchema),
});
export async function atomicFile(path, bytes) {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(`${path}.tmp`, bytes);
  await rename(`${path}.tmp`, path);
}
export async function readManifest(root) {
  try {
    return manifestSchema.parse(
      JSON.parse(
        await readFile(join(root, 'audio/cards/manifest.json'), 'utf8'),
      ),
    );
  } catch (error) {
    if (error.code === 'ENOENT') return { schemaVersion: 1, entries: [] };
    throw new Error(
      'Invalid voice manifest; preserve and repair it before generation.',
      { cause: error },
    );
  }
}
export function requiredCards(pack, inputConfiguration) {
  const configuration = configurationSchema.parse(inputConfiguration);
  if (
    JSON.stringify(pack.characters.map((c) => c.id).sort()) !==
    JSON.stringify(configuration.characters.map((c) => c.characterId).sort())
  )
    throw new Error(
      'Voice configuration must match the production eight-character catalog.',
    );
  const required = [];
  for (const character of configuration.characters) {
    const decks = pack.decks.filter(
      (deck) =>
        deck.type === 'CHARACTER' && deck.characterId === character.characterId,
    );
    if (decks.length !== 1)
      throw new Error(
        `Expected one primary deck for ${character.characterId}.`,
      );
    const records = pack.deckCards.filter(
      (record) => record.deckId === decks[0].id,
    );
    if (records.reduce((sum, record) => sum + record.quantity, 0) !== 40)
      throw new Error(
        `Expected 40 physical cards for ${character.characterId}.`,
      );
    for (const cardDefinitionId of [
      ...new Set(records.map((record) => record.cardId)),
    ].sort()) {
      const card = pack.cards.find((card) => card.id === cardDefinitionId);
      if (
        !card ||
        !['ACTION', 'SOMETIMES', 'ANYTIME', 'GAMBLING', 'CHEATING'].includes(
          card.type,
        )
      )
        throw new Error(
          'Character deck contains a missing or non-character card.',
        );
      required.push({ character, cardDefinitionId, displayName: card.name });
    }
  }
  return required;
}
export function planAssets(pack, configuration, inputTitles) {
  const titles = titlesSchema.parse(inputTitles);
  const required = requiredCards(pack, configuration);
  const known = new Set(
    required.map(
      (card) => `${card.character.characterId}:${card.cardDefinitionId}`,
    ),
  );
  const seen = new Set();
  for (const title of titles.entries) {
    const key = `${title.characterId}:${title.cardDefinitionId}`;
    if (!known.has(key) || seen.has(key))
      throw new Error(
        `Unknown ownership or duplicate canonical title mapping: ${key}`,
      );
    seen.add(key);
  }
  const missing = [];
  const assets = [];
  for (const card of required.filter((card) => card.character.enabled)) {
    const title = titles.entries.find(
      (title) =>
        title.characterId === card.character.characterId &&
        title.cardDefinitionId === card.cardDefinitionId,
    );
    if (!title) {
      missing.push({
        characterId: card.character.characterId,
        cardDefinitionId: card.cardDefinitionId,
        displayName: card.displayName,
      });
      continue;
    }
    const inputs = {
      characterId: card.character.characterId,
      cardDefinitionId: card.cardDefinitionId,
      spokenText: title.spokenText,
      voiceId: card.character.voiceId,
      modelId: card.character.modelId,
      outputFormat: card.character.outputFormat,
      voiceSettings: settings,
    };
    assets.push({
      ...inputs,
      contentHash: sha256(JSON.stringify(inputs)),
      assetPath: `/audio/cards/${inputs.characterId}/${inputs.cardDefinitionId}.mp3`,
    });
  }
  if (missing.length) {
    const error = new Error(
      `Canonical printed titles missing for ${missing.length} configured character definitions. Descriptive pack names cannot be substituted. No API requests made.`,
    );
    error.missingTitles = missing;
    throw error;
  }
  return assets;
}
/** Validate MPEG-1 Layer III, 44.1 kHz, 128 kbps frames, including ID3 tags. */
export function validMp3(bytes) {
  let offset = 0,
    frames = 0;
  if (bytes.subarray(0, 3).toString('ascii') === 'ID3') {
    if (bytes.length < 10 || bytes.subarray(6, 10).some((value) => value > 127))
      return false;
    offset =
      10 +
      (bytes[6] << 21) +
      (bytes[7] << 14) +
      (bytes[8] << 7) +
      bytes[9] +
      (bytes[5] & 16 ? 10 : 0);
  }
  while (offset + 4 <= bytes.length) {
    if (
      bytes.subarray(offset, offset + 3).toString('ascii') === 'TAG' &&
      offset + 128 === bytes.length
    )
      break;
    const header = bytes.readUInt32BE(offset);
    if (
      header >>> 21 !== 2047 ||
      ((header >>> 19) & 3) !== 3 ||
      ((header >>> 17) & 3) !== 1 ||
      ((header >>> 12) & 15) !== 9 ||
      ((header >>> 10) & 3) !== 0
    )
      return false;
    const length = Math.floor((144000 * 128) / 44100) + ((header >>> 9) & 1);
    if (offset + length > bytes.length) return false;
    frames++;
    offset += length;
  }
  return (
    frames >= 2 && (offset === bytes.length || offset + 128 === bytes.length)
  );
}
export async function currentAsset(entry, asset, root, validateAudio) {
  if (
    !entry ||
    entry.contentHash !== asset.contentHash ||
    entry.assetPath !== asset.assetPath ||
    Object.keys(asset).some(
      (key) => JSON.stringify(asset[key]) !== JSON.stringify(entry[key]),
    )
  )
    return false;
  try {
    const bytes = await readFile(join(root, asset.assetPath.slice(1)));
    if (!validMp3(bytes) || sha256(bytes) !== entry.sha256) return false;
    await validateAudio?.(bytes);
    return true;
  } catch {
    return false;
  }
}
export async function generateAssets({
  pack,
  configuration,
  titles,
  root = 'public',
  apiKey,
  fetchImpl = fetch,
  validateAudio,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  report = () => {},
  now = () => new Date().toISOString(),
}) {
  const assets = planAssets(pack, configuration, titles);
  const manifest = await readManifest(root);
  const manifestKeys = new Set();
  const manifestPaths = new Set();
  for (const entry of manifest.entries) {
    const key = `${entry.characterId}:${entry.cardDefinitionId}`;
    const planned = assets.find(
      (asset) =>
        asset.characterId === entry.characterId &&
        asset.cardDefinitionId === entry.cardDefinitionId,
    );
    if (
      !planned ||
      manifestKeys.has(key) ||
      manifestPaths.has(entry.assetPath) ||
      entry.assetPath !== planned.assetPath
    )
      throw new Error(
        'Stale ownership or duplicate manifest path; repair before spending credits.',
      );
    manifestKeys.add(key);
    manifestPaths.add(entry.assetPath);
  }
  const counts = Object.fromEntries(
    configuration.characters
      .filter((c) => c.enabled)
      .map((c) => [
        c.characterId,
        {
          expected: assets.filter((a) => a.characterId === c.characterId)
            .length,
          generated: 0,
          skipped: 0,
          failed: 0,
        },
      ]),
  );
  let requests = 0;
  const failures = [];
  for (const asset of assets) {
    const key = (entry) =>
      entry.characterId === asset.characterId &&
      entry.cardDefinitionId === asset.cardDefinitionId;
    const matches = manifest.entries.filter(key);
    if (matches.length > 1) throw new Error('Duplicate manifest ownership.');
    if (await currentAsset(matches[0], asset, root, validateAudio)) {
      counts[asset.characterId].skipped++;
      report(`SKIP ${asset.characterId}/${asset.cardDefinitionId}`);
      continue;
    }
    try {
      if (!apiKey?.trim())
        throw new Error(
          'ELEVENLABS_API_KEY is required for missing/stale assets.',
        );
      let bytes;
      for (let attempt = 0; attempt <= 3; attempt++) {
        let response;
        try {
          requests++;
          response = await fetchImpl(
            `https://api.elevenlabs.io/v1/text-to-speech/${asset.voiceId}?output_format=${asset.outputFormat}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'xi-api-key': apiKey,
              },
              body: JSON.stringify({
                text: asset.spokenText,
                model_id: asset.modelId,
                voice_settings: asset.voiceSettings,
              }),
              signal: AbortSignal.timeout(120000),
            },
          );
        } catch {
          throw new Error(
            'TTS network failure or timeout; resume rather than risk duplicate credit use.',
          );
        }
        if (
          [409, 429, 500, 502, 503, 504].includes(response.status) &&
          attempt < 3
        ) {
          await wait(500 * 2 ** attempt);
          continue;
        }
        if (!response.ok)
          throw new Error(`TTS HTTP ${response.status}; no model fallback.`);
        if (!response.headers.get('content-type')?.startsWith('audio/mpeg'))
          throw new Error('TTS returned an unexpected media type.');
        bytes = Buffer.from(await response.arrayBuffer());
        if (!validMp3(bytes))
          throw new Error('TTS returned corrupt or unexpected MP3 frames.');
        try {
          await validateAudio?.(bytes);
        } catch {
          throw new Error(
            'TTS MP3 failed browser decoding; previous files preserved.',
          );
        }
        break;
      }
      const entry = {
        ...asset,
        sha256: sha256(bytes),
        generatedAt: now(),
        sourceUrl: 'https://elevenlabs.io',
        author: 'User-selected character voice; speech generated by ElevenLabs',
        license:
          'ElevenLabs Free-plan terms; attribution required; no commercial license asserted',
      };
      await atomicFile(join(root, asset.assetPath.slice(1)), bytes);
      manifest.entries = [
        ...manifest.entries.filter((entry) => !key(entry)),
        assetSchema.parse(entry),
      ];
      await atomicFile(
        join(root, 'audio/cards/manifest.json'),
        JSON.stringify(manifest, null, 2) + '\n',
      );
      counts[asset.characterId].generated++;
      report(`GENERATE ${asset.characterId}/${asset.cardDefinitionId}`);
    } catch (error) {
      counts[asset.characterId].failed++;
      failures.push({
        characterId: asset.characterId,
        cardDefinitionId: asset.cardDefinitionId,
        reason: error instanceof Error ? error.message : 'TTS failure.',
      });
      break; // Preserve completed work; one failure never restarts the batch.
    }
  }
  return {
    counts,
    requests,
    failures,
    unconfigured: configuration.characters
      .filter((c) => !c.enabled)
      .map((c) => c.characterId),
  };
}
async function files(root) {
  try {
    return (
      await Promise.all(
        (await readdir(root, { withFileTypes: true })).map((entry) =>
          entry.isDirectory()
            ? files(join(root, entry.name))
            : [join(root, entry.name)],
        ),
      )
    ).flat();
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}
export async function verifyAssets({
  pack,
  configuration,
  titles,
  root = 'public',
  strict = false,
}) {
  const assets = planAssets(pack, configuration, titles);
  const manifest = await readManifest(root);
  const unconfigured = configuration.characters
    .filter((c) => !c.enabled)
    .map((c) => c.characterId);
  if (strict && unconfigured.length)
    throw new Error(`Unconfigured characters: ${unconfigured.join(', ')}`);
  const keys = new Set(),
    paths = new Set();
  for (const entry of manifest.entries) {
    const key = `${entry.characterId}:${entry.cardDefinitionId}`;
    const asset = assets.find(
      (a) =>
        a.characterId === entry.characterId &&
        a.cardDefinitionId === entry.cardDefinitionId,
    );
    if (
      !asset ||
      keys.has(key) ||
      paths.has(entry.assetPath) ||
      !(await currentAsset(entry, asset, root))
    )
      throw new Error(`Stale, duplicate or invalid manifest asset: ${key}`);
    keys.add(key);
    paths.add(entry.assetPath);
  }
  for (const asset of assets)
    if (!paths.has(asset.assetPath))
      throw new Error(
        `Missing asset: ${asset.characterId}/${asset.cardDefinitionId}`,
      );
  for (const path of await files(join(root, 'audio/cards'))) {
    if (path.endsWith('manifest.json')) continue;
    if (
      ![...paths].some((assetPath) => join(root, assetPath.slice(1)) === path)
    )
      throw new Error('Unexpected or stale file in character audio directory.');
  }
  return { count: assets.length, assets, unconfigured };
}

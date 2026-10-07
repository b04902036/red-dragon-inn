import { readFile, mkdir, writeFile } from 'node:fs/promises';
import {
  configurationSchema,
  titlesSchema,
  requiredCards,
  generateAssets,
  verifyAssets,
} from './card-voice-assets.mjs';
import { verifyDecoding, verifyAudioBytes } from './voice-decode.mjs';
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
try {
  const configuration = configurationSchema.parse(
    await readJson('content/presentation/character-voices.json'),
  );
  const pack = await readJson(
    'content-private/imports/rdi2/pack-combined.json',
  );
  let titles;
  try {
    titles = titlesSchema.parse(
      await readJson('content-private/voice/canonical-titles.json'),
    );
  } catch (error) {
    if (error.code !== 'ENOENT')
      throw new Error(
        'Invalid canonical-title input; repair before generation.',
        { cause: error },
      );
    titles = { schemaVersion: 1, entries: [] };
  }
  const configured = requiredCards(pack, configuration).filter(
    (card) => card.character.enabled,
  );
  const missing = configured
    .filter(
      (card) =>
        !titles.entries.some(
          (title) =>
            title.characterId === card.character.characterId &&
            title.cardDefinitionId === card.cardDefinitionId,
        ),
    )
    .map((card) => ({
      characterId: card.character.characterId,
      cardDefinitionId: card.cardDefinitionId,
      descriptiveLabel: card.displayName,
    }));
  await mkdir('.tools/voice-generation', { recursive: true });
  await writeFile(
    '.tools/voice-generation/title-audit.json',
    JSON.stringify(
      {
        requiredDefinitions: configured.length,
        missingTitles: missing,
        warning:
          'Labels are descriptive, not verified printed titles. Different physical titles grouped into one mechanic definition require explicit provenance and a runtime presentation mapping, not an arbitrary choice.',
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    `Unconfigured: ${configuration.characters
      .filter((c) => !c.enabled)
      .map((c) => c.characterId)
      .join(', ')}`,
  );
  const args = process.argv.slice(2);
  if (
    args.length !== 1 ||
    !['generate', 'partial', 'strict', 'plan'].includes(args[0])
  )
    throw new Error(
      'Use voice:generate, voice:verify:partial, voice:verify or voice:plan.',
    );
  if (args[0] === 'plan')
    console.log(
      `Configured definitions: ${configured.length}; missing printed titles: ${missing.length}. See .tools/voice-generation/title-audit.json.`,
    );
  else if (args[0] === 'generate') {
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
  } else {
    const result = await verifyAssets({
      pack,
      configuration,
      titles,
      strict: args[0] === 'strict',
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

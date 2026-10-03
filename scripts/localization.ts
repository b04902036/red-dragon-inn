import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { resolve, relative, isAbsolute, dirname } from 'node:path';
import { getPlatformProxy } from 'wrangler';
import {
  contentPackSchema,
  contentTranslationSchema,
} from '../src/content/pack';
import {
  verifyContentTranslations,
  verifyUiTranslations,
  translatedEdition,
  translationWorksheet,
} from '../src/content/localization';
import { contentVersionIdSchema } from '../src/shared/ids';
import { D1ContentRepository } from '../worker/repositories/content';
import type { ContentDatabase } from '../src/content/database';

const { values, positionals } = parseArgs({
  options: {
    translate: { type: 'boolean' },
    input: { type: 'string' },
    translations: { type: 'string' },
    output: { type: 'string' },
    version: { type: 'string' },
  },
});
if (positionals.length) throw new Error('Unexpected positional arguments.');
if (values.translate) {
  if (!values.input) {
    process.stdout.write(
      'Translation workflow: --input owned-pack.json --translations reviewed-zh-TW.json --version content_new --output content-private/imports/new-pack.json. Without --translations, writes a MANUAL_DRAFT worksheet that requires human review. English definitions are preserved.\n',
    );
  } else {
    if (!values.output || !values.version)
      throw new Error(
        'Translation requires --version and --output inside content-private/imports.',
      );
    const destination = resolve(values.output);
    const subpath = relative(resolve('content-private/imports'), destination);
    if (!subpath || subpath.startsWith('..') || isAbsolute(subpath))
      throw new Error('Output must be inside ignored content-private/imports.');
    const input = contentPackSchema.parse(
      JSON.parse(await readFile(values.input, 'utf8')),
    );
    const rows = values.translations
      ? contentTranslationSchema
          .array()
          .parse(JSON.parse(await readFile(values.translations, 'utf8')))
      : translationWorksheet(input);
    const pack = translatedEdition(input, rows, {
      ...input.version,
      id: contentVersionIdSchema.parse(values.version),
      createdAt: new Date().toISOString(),
    });
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, JSON.stringify(pack, null, 2) + '\n');
    process.stdout.write(
      JSON.stringify(
        { output: values.output, ...verifyContentTranslations(pack) },
        null,
        2,
      ) + '\n',
    );
  }
} else {
  const uiIssues = verifyUiTranslations();
  let content: ReturnType<typeof verifyContentTranslations> | null = null;
  let configuredVersion: string | null = null;
  if (values.input)
    content = verifyContentTranslations(
      JSON.parse(await readFile(values.input, 'utf8')),
    );
  else {
    const platform = await getPlatformProxy<{ DB: ContentDatabase }>({
      configPath: 'wrangler.jsonc',
      persist: { path: '.wrangler/state/v3' },
      remoteBindings: false,
    });
    try {
      const repository = new D1ContentRepository(platform.env.DB);
      configuredVersion = await repository.productionVersion();
      if (configuredVersion)
        content = verifyContentTranslations(
          await repository.loadPack(
            contentVersionIdSchema.parse(configuredVersion),
          ),
        );
    } finally {
      await platform.dispose();
    }
  }
  const complete =
    uiIssues.length === 0 && (content === null || content.complete);
  process.stdout.write(
    JSON.stringify(
      {
        complete,
        uiIssues,
        configuredVersion,
        productionContent: content,
        releaseNote:
          configuredVersion === null && !values.input
            ? 'No production content channel is installed; content:verify:production separately blocks release.'
            : null,
      },
      null,
      2,
    ) + '\n',
  );
  if (!complete) process.exitCode = 1;
}

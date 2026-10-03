import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { getPlatformProxy } from 'wrangler';
import { verifyProductionContent } from '../src/content/production';
import { contentVersionIdSchema } from '../src/shared/ids';
import { D1ContentRepository } from '../worker/repositories/content';
import type { ContentDatabase } from '../src/content/database';

const { values, positionals } = parseArgs({
  options: {
    input: { type: 'string' },
    activate: { type: 'string' },
  },
});
if (positionals.length || (values.input && values.activate))
  throw new Error(
    'Use --input owned-pack.json, --activate published-version, or no args to verify the local production channel.',
  );
let pack: unknown = null;
if (values.input)
  pack = JSON.parse(await readFile(values.input, 'utf8')) as unknown;
else {
  const platform = await getPlatformProxy<{ DB: ContentDatabase }>({
    configPath: 'wrangler.jsonc',
    persist: { path: '.wrangler/state/v3' },
    remoteBindings: false,
  });
  try {
    const repository = new D1ContentRepository(platform.env.DB);
    const configuredVersion = values.activate
      ? contentVersionIdSchema.parse(values.activate)
      : await repository.productionVersion();
    if (configuredVersion)
      pack = await repository.loadPack(
        contentVersionIdSchema.parse(configuredVersion),
      );
    const report = verifyProductionContent(pack);
    process.stdout.write(
      JSON.stringify({ configuredVersion, ...report }, null, 2) + '\n',
    );
    if (!report.complete) process.exitCode = 1;
    else if (values.activate) {
      await repository.setProductionVersion(
        contentVersionIdSchema.parse(values.activate),
      );
      process.stdout.write(
        `Activated ${values.activate} for new local production rooms.\n`,
      );
    }
  } finally {
    await platform.dispose();
  }
}
if (values.input) {
  const report = verifyProductionContent(pack);
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  if (!report.complete) process.exitCode = 1;
}

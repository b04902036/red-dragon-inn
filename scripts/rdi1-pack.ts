import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { format } from 'prettier';
import { getPlatformProxy } from 'wrangler';
import { compileRdi1Source } from '../src/content/rdi1-compiler';
import { verifyRdi1Pack } from '../src/content/rdi1-pack';
import { verifyRdi1SourceLock } from '../src/content/rdi1-audit';
import { contentVersionIdSchema } from '../src/shared/ids';
import { D1ContentRepository } from '../worker/repositories/content';
import type { ContentDatabase } from '../src/content/database';

const { values } = parseArgs({
  options: {
    compile: { type: 'boolean' },
    activate: { type: 'string' },
    publish: { type: 'boolean' },
  },
});
if (
  (values.compile && (values.activate || values.publish)) ||
  (values.publish && values.activate)
)
  throw new Error('Compile and activate separately');
try {
  const lock: unknown = JSON.parse(
    await readFile('reference/rdi1/source-lock.json', 'utf8'),
  );
  const paths = [
    'content-private/imports/rdi1/source-normalized.json',
    'reference/rdi1/rdi1-mechanics-matrix.csv',
    'reference/rdi1/rdi1-card-matrix.md',
    'reference/rdi1/source-evidence.md',
    'reference/rdi1/required-engine-capabilities.json',
    'reference/rdi1/sometimes-legality-fixtures.json',
  ];
  const contents = await Promise.all(
    paths.map((path) => readFile(path, 'utf8')),
  );
  const hashes = Object.fromEntries(
    paths.map((path, index) => [
      path,
      createHash('sha256').update(contents[index]!).digest('hex'),
    ]),
  );
  const lockErrors = verifyRdi1SourceLock(lock, hashes);
  if (lockErrors.length) throw new Error(lockErrors.join('\n'));
  const source: unknown = JSON.parse(contents[0]!);
  let input: unknown;
  const platform =
    values.activate || values.publish
      ? await getPlatformProxy<{ DB: ContentDatabase }>({
          configPath: 'wrangler.jsonc',
          persist: { path: '.wrangler/state/v3' },
          remoteBindings: false,
        })
      : null;
  try {
    const repository =
      platform === null ? null : new D1ContentRepository(platform.env.DB);
    input =
      values.activate === undefined
        ? values.compile
          ? compileRdi1Source(source)
          : (JSON.parse(
              await readFile('content-private/imports/rdi1/pack.json', 'utf8'),
            ) as unknown)
        : await repository!.loadPack(
            contentVersionIdSchema.parse(values.activate),
          );
    const report = verifyRdi1Pack(input, source);
    process.stdout.write(
      `characters: ${report.characters}/4\nDeirdre: ${report.characterDecks.deirdre}/40\nFiona: ${report.characterDecks.fiona}/40\nGerki: ${report.characterDecks.gerki}/40\nZot: ${report.characterDecks.zot}/40\ncharacter physical cards: ${report.characterPhysicalCards}/160\nDrink deck: ${report.drinkPhysicalCards}/30\nunknown mechanics: ${report.unknownMechanics}\nunknown effects: ${report.unknownEffects}\nSometimes without structured legality: ${report.sometimesWithoutStructuredLegality}\nmissing en-US: ${report.missingEnUS}\nmissing zh-TW: ${report.missingZhTW}\nsample production records: ${report.sampleProductionRecords}\n`,
    );
    if (!report.valid) {
      process.stderr.write(report.errors.join('\n') + '\n');
      process.exitCode = 1;
    } else if (values.compile) {
      await writeFile(
        'content-private/imports/rdi1/pack.json',
        await format(JSON.stringify(input), { parser: 'json' }),
        'utf8',
      );
      await writeFile(
        'content-private/imports/rdi1/compile-report.json',
        await format(
          JSON.stringify({
            ...report,
            sourceSha256: hashes[paths[0]!],
            versionId: compileRdi1Source(source).version.id,
            provenance: 'PUBLIC_RULES_PARAPHRASE',
            distributionLicense: false,
            artworkBundled: false,
          }),
          { parser: 'json' },
        ),
        'utf8',
      );
      process.stdout.write(
        'Compiled private pack and report; no content imported.\n',
      );
    } else if (repository !== null) {
      const versionId = values.activate ?? compileRdi1Source(source).version.id;
      if (values.publish) {
        const published = await repository.loadPack(
          contentVersionIdSchema.parse(versionId),
        );
        if (published === null) {
          await repository.saveDraft(compileRdi1Source(source));
          await repository.publishVersion(
            contentVersionIdSchema.parse(versionId),
          );
        } else if (!verifyRdi1Pack(published, source).valid)
          throw new Error('Published RDI1 version differs from source');
      }
      await repository.setProductionVersion(
        contentVersionIdSchema.parse(versionId),
      );
      process.stdout.write(
        `Activated ${versionId} for new local production rooms.\n`,
      );
    }
  } finally {
    await platform?.dispose();
  }
} catch (error) {
  process.stderr.write(
    `RDI1 pack verification failed: ${error instanceof Error ? error.message : 'invalid input'}\n`,
  );
  process.exitCode = 1;
}

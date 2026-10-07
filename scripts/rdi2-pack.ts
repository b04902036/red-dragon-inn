import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { format } from 'prettier';
import { getPlatformProxy } from 'wrangler';
import {
  compileRdi2Source,
  combineRdi1Rdi2,
} from '../src/content/rdi2-compiler';
import { verifyRdi2Pack } from '../src/content/rdi2-pack';
import { verifyRdi1Pack } from '../src/content/rdi1-pack';
import { verifyRdi1SourceLock } from '../src/content/rdi1-audit';
import { contentPackSchema } from '../src/content/pack';
import { importContent } from '../src/content/import';
import { D1ContentRepository } from '../worker/repositories/content';
import type { ContentDatabase } from '../src/content/database';

const { values, positionals } = parseArgs({
  options: {
    compile: { type: 'boolean' },
    publish: { type: 'boolean' },
    combined: { type: 'boolean' },
    activate: { type: 'boolean' },
    'read-d1': { type: 'boolean' },
  },
});
if (
  positionals.length ||
  (values.compile &&
    (values.publish || values.activate || values['read-d1'])) ||
  (values.activate && !values.publish)
)
  throw new Error(
    'Compile separately; activation requires verified local publication',
  );
const sha = (bytes: string) => createHash('sha256').update(bytes).digest('hex');
const json = (bytes: string): unknown => JSON.parse(bytes) as unknown;
try {
  const root = 'content-private/imports/rdi2/';
  const [
    sourceBytes,
    ledgerBytes,
    matrix,
    lockBytes,
    rdi1SourceBytes,
    rdi1PackBytes,
    rdi1LockBytes,
  ] = await Promise.all([
    readFile(root + 'source-normalized.json', 'utf8'),
    readFile(root + 'verification-ledger.json', 'utf8'),
    readFile('reference/rdi2/rdi2-mechanics-matrix.csv', 'utf8'),
    readFile(root + 'source-lock.json', 'utf8'),
    readFile('content-private/imports/rdi1/source-normalized.json', 'utf8'),
    readFile(
      'content-private/imports/rdi1/pack-content_rdi1_mechanics_v2.json',
      'utf8',
    ),
    readFile('reference/rdi1/source-lock.json', 'utf8'),
  ]);
  const rdi1Paths = [
    'content-private/imports/rdi1/source-normalized.json',
    'reference/rdi1/rdi1-mechanics-matrix.csv',
    'reference/rdi1/rdi1-card-matrix.md',
    'reference/rdi1/source-evidence.md',
    'reference/rdi1/required-engine-capabilities.json',
    'reference/rdi1/sometimes-legality-fixtures.json',
  ];
  const rdi1Hashes = Object.fromEntries(
    await Promise.all(
      rdi1Paths.map(async (path) => [path, sha(await readFile(path, 'utf8'))]),
    ),
  );
  const lockErrors = verifyRdi1SourceLock(json(rdi1LockBytes), rdi1Hashes);
  if (lockErrors.length) throw new Error(lockErrors.join('\n'));
  const rdi1 = contentPackSchema.parse(json(rdi1PackBytes));
  const rdi1Report = verifyRdi1Pack(rdi1, json(rdi1SourceBytes));
  if (!rdi1Report.valid) throw new Error(rdi1Report.errors.join('\n'));
  const audit = {
    ledger: json(ledgerBytes),
    matrix,
    lock: json(lockBytes),
    hashes: {
      normalizedSha256: sha(sourceBytes),
      ledgerSha256: sha(ledgerBytes),
      matrixSha256: sha(matrix),
    },
  };
  const rdi2 = compileRdi2Source(json(sourceBytes), audit);
  const combined = combineRdi1Rdi2(rdi1, rdi2);
  const save = async (name: string, data: unknown) => {
    const bytes = await format(JSON.stringify(data), { parser: 'json' });
    try {
      await writeFile(root + name, bytes, { flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      if ((await readFile(root + name, 'utf8')) !== bytes)
        throw new Error(`Immutable artifact differs: ${name}`, {
          cause: error,
        });
    }
  };
  if (values.compile) {
    const report = verifyRdi2Pack(rdi2, rdi2),
      combinedReport = verifyRdi2Pack(combined, combined);
    if (!report.valid || !combinedReport.valid)
      throw new Error([...report.errors, ...combinedReport.errors].join('\n'));
    await save('pack.json', rdi2);
    await save('pack-combined.json', combined);
    await save('compile-report.json', {
      rdi2: report,
      combined: combinedReport,
      sourceHashes: audit.hashes,
      rdi1SourceSha256: sha(rdi1SourceBytes),
      rdi1PackSha256: sha(rdi1PackBytes),
      provenance: 'PUBLIC_RULES_PARAPHRASE',
      translationProvenance: 'MANUAL_REVIEWED_IMPLEMENTATION_NOT_OFFICIAL',
      distributionLicense: false,
      artworkBundled: false,
      teamRuntime: 'NON_BLOCKING_TODO',
      projectOverridesPreservedInSourceLedger: true,
    });
    process.stdout.write(
      JSON.stringify({ rdi2: report, combined: combinedReport }, null, 2) +
        '\n',
    );
  } else {
    const expected = values.combined || values.publish ? combined : rdi2;
    const privatePack = json(
      await readFile(
        root + (expected === combined ? 'pack-combined.json' : 'pack.json'),
        'utf8',
      ),
    );
    const report = verifyRdi2Pack(privatePack, expected);
    if (!report.valid) throw new Error(report.errors.join('\n'));
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    if (values.publish || values['read-d1']) {
      const platform = await getPlatformProxy<{ DB: ContentDatabase }>({
        configPath: 'wrangler.jsonc',
        persist: { path: '.wrangler/state/v3' },
        remoteBindings: false,
      });
      try {
        const repository = new D1ContentRepository(platform.env.DB);
        const old = await repository.loadPack(rdi1.version.id);
        if (!verifyRdi1Pack(old, json(rdi1SourceBytes)).valid)
          throw new Error(
            'Existing published RDI1 must remain valid before RDI2 publication',
          );
        const present = await repository.getVersion(expected.version.id);
        if (values.publish && present === null) {
          const dry = await importContent(
            JSON.stringify(expected),
            repository,
            { dryRun: true },
          );
          if (!dry.valid || dry.written)
            throw new Error('Dry-run import failed');
          const result = await importContent(
            JSON.stringify(expected),
            repository,
            { dryRun: false },
          );
          if (!result.written) throw new Error('Local content import failed');
          await repository.publishVersion(expected.version.id);
        }
        const loaded = await repository.loadPack(expected.version.id);
        const checked = verifyRdi2Pack(loaded, expected);
        if (!checked.valid) throw new Error(checked.errors.join('\n'));
        if (
          !verifyRdi1Pack(
            await repository.loadPack(rdi1.version.id),
            json(rdi1SourceBytes),
          ).valid
        )
          throw new Error('Old RDI1 version changed');
        if (values.activate)
          await repository.setProductionVersion(expected.version.id);
        process.stdout.write(
          `Verified local D1 ${expected.version.id}; old RDI1 preserved.${values.activate ? ' New-room production channel activated.' : ' Production channel unchanged.'}\n`,
        );
      } finally {
        await platform.dispose();
      }
    }
  }
} catch (error) {
  process.stderr.write(
    `RDI2 verification failed: ${error instanceof Error ? error.message : 'invalid input'}\n`,
  );
  process.exitCode = 1;
}

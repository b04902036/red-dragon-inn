import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { format } from 'prettier';
import { verifyRdi1Source } from '../src/content/rdi1-source';
import { validateRdi1Matrix } from '../src/content/rdi1-matrix';
import {
  renderRdi1EngineGap,
  rdi1LegalityFixturesSchema,
  verifyRdi1LegalityFixtures,
  verifyRdi1SourceLock,
} from '../src/content/rdi1-audit';

const { values } = parseArgs({
  options: { lock: { type: 'boolean', default: false } },
});
const paths = [
  'content-private/imports/rdi1/source-normalized.json',
  'reference/rdi1/rdi1-mechanics-matrix.csv',
  'reference/rdi1/rdi1-card-matrix.md',
  'reference/rdi1/source-evidence.md',
  'reference/rdi1/required-engine-capabilities.json',
  'reference/rdi1/sometimes-legality-fixtures.json',
];
try {
  const files = await Promise.all(
    paths.map(async (path) => [path, await readFile(path, 'utf8')] as const),
  );
  const contents = Object.fromEntries(files),
    sha256 = Object.fromEntries(
      files.map(([path, content]) => [
        path,
        createHash('sha256').update(content).digest('hex'),
      ]),
    );
  const required = JSON.parse(contents[paths[4]!]!) as {
    requiredCapabilities: string[];
  };
  const fixtures: unknown = JSON.parse(contents[paths[5]!]!);
  const result = verifyRdi1Source(
    JSON.parse(contents[paths[0]!]!) as unknown,
    required,
  );
  const errors = [...result.errors];
  if (result.source) {
    errors.push(
      ...validateRdi1Matrix(
        result.source,
        contents[paths[1]!]!,
        contents[paths[2]!]!,
      ),
      ...verifyRdi1LegalityFixtures(result.source, fixtures),
    );
  }
  const lockPath = 'reference/rdi1/source-lock.json';
  const lock = { schemaVersion: 1, engineBaseline: 'step-20', sha256 };
  if (!values.lock) {
    try {
      errors.push(
        ...verifyRdi1SourceLock(
          JSON.parse(await readFile(lockPath, 'utf8')) as unknown,
          sha256,
        ),
      );
    } catch {
      errors.push(
        'Source lock missing or unreadable; review inputs then explicitly run with --lock',
      );
    }
  }
  const valid = errors.length === 0;
  process.stdout.write(
    JSON.stringify(
      { valid, stage: 'SOURCE_VALIDATION_ONLY', ...result.counts, errors },
      null,
      2,
    ) + '\n',
  );
  if (!valid || !result.source) process.exitCode = 1;
  else {
    if (values.lock)
      await writeFile(
        lockPath,
        await format(JSON.stringify(lock), { parser: 'json' }),
        'utf8',
      );
    await writeFile(
      'docs/rdi1-engine-gap.md',
      await format(
        renderRdi1EngineGap(
          result.source,
          required.requiredCapabilities,
          rdi1LegalityFixturesSchema.parse(fixtures),
          sha256,
        ),
        { parser: 'markdown' },
      ),
      'utf8',
    );
    process.stdout.write(
      'Source lock verified; generated docs/rdi1-engine-gap.md. No content imported or published.\n',
    );
  }
} catch (error) {
  process.stderr.write(
    `RDI1 source verification failed: ${error instanceof Error ? error.message : 'invalid input'}\n`,
  );
  process.exitCode = 1;
}

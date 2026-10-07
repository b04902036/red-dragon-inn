import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { format } from 'prettier';
import { verifyRdi2Source } from '../src/content/rdi2-source';

async function optional(path: string) {
  return readFile(path, 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
    return null;
  });
}
const sha256 = (input: string) =>
  createHash('sha256').update(input).digest('hex');
const { values } = parseArgs({
  options: {
    lock: { type: 'boolean', default: false },
    'check-lock': { type: 'boolean', default: false },
  },
});
try {
  const root = 'content-private/imports/rdi2/';
  const [candidate, ledger, matrix, normalized, lock] = await Promise.all([
    readFile(root + 'source-candidate.json', 'utf8'),
    readFile(root + 'verification-ledger.json', 'utf8'),
    readFile('reference/rdi2/rdi2-mechanics-matrix.csv', 'utf8'),
    optional(root + 'source-normalized.json'),
    optional(root + 'source-lock.json'),
  ]);
  if (values.lock || values['check-lock']) {
    if (normalized !== null || lock !== null)
      throw new Error(
        'Source artifacts already exist; refusing to overwrite immutable normalized source or lock',
      );
    const proposed: unknown = {
      ...(JSON.parse(candidate) as Record<string, unknown>),
      schemaVersion: 'rdi2-source-normalized-v1',
      lockStatus: 'SOURCE_LOCKED_FOR_PROJECT_RULESET',
    };
    const proposedBytes = await format(JSON.stringify(proposed), {
      parser: 'json',
    });
    const identifiers = Object.keys(
      (proposed as { sources: Record<string, unknown> }).sources,
    ).sort();
    const computedHashes = {
      normalizedSha256: sha256(proposedBytes),
      ledgerSha256: sha256(ledger),
      matrixSha256: sha256(matrix),
    };
    const generatedLock = {
      ...computedHashes,
      date: new Date().toISOString().slice(0, 10),
      sourceVersionIdentifiers: identifiers,
      verifiedMechanicRows: 44,
      characterPhysicalCards: 160,
      drinkPhysicalCards: 30,
      unresolvedCount: 0,
    };
    const preflight = verifyRdi2Source(
      proposed,
      JSON.parse(ledger) as unknown,
      matrix,
      generatedLock,
      computedHashes,
    );
    process.stdout.write(
      JSON.stringify(
        { stage: 'SOURCE_LOCK_PREFLIGHT', ...preflight },
        null,
        2,
      ) + '\n',
    );
    if (!preflight.valid) {
      process.exitCode = 1;
    } else if (values.lock) {
      // Exclusive writes preserve existing evidence; no artifact is emitted for failed validation.
      await writeFile(root + 'source-normalized.json', proposedBytes, {
        flag: 'wx',
      });
      await writeFile(
        root + 'source-lock.json',
        await format(JSON.stringify(generatedLock), { parser: 'json' }),
        { flag: 'wx' },
      );
      const [writtenSource, writtenLock, writtenLedger, writtenMatrix] =
        await Promise.all([
          readFile(root + 'source-normalized.json', 'utf8'),
          readFile(root + 'source-lock.json', 'utf8'),
          readFile(root + 'verification-ledger.json', 'utf8'),
          readFile('reference/rdi2/rdi2-mechanics-matrix.csv', 'utf8'),
        ]);
      const verification = verifyRdi2Source(
        JSON.parse(writtenSource) as unknown,
        JSON.parse(writtenLedger) as unknown,
        writtenMatrix,
        JSON.parse(writtenLock) as unknown,
        {
          normalizedSha256: sha256(writtenSource),
          ledgerSha256: sha256(writtenLedger),
          matrixSha256: sha256(writtenMatrix),
        },
      );
      process.stdout.write(
        JSON.stringify(
          { stage: 'SOURCE_LOCK_READBACK', ...verification },
          null,
          2,
        ) + '\n',
      );
      if (!verification.valid) process.exitCode = 1;
    }
  } else {
    const result = verifyRdi2Source(
      JSON.parse(normalized ?? candidate) as unknown,
      JSON.parse(ledger) as unknown,
      matrix,
      lock === null ? null : (JSON.parse(lock) as unknown),
      {
        normalizedSha256: sha256(normalized ?? candidate),
        ledgerSha256: sha256(ledger),
        matrixSha256: sha256(matrix),
      },
    );
    if (normalized === null)
      result.errors.push(
        'Normalized source missing; candidate is diagnostic input only',
      );
    result.valid = result.errors.length === 0;
    process.stdout.write(
      JSON.stringify({ stage: 'SOURCE_VALIDATION_ONLY', ...result }, null, 2) +
        '\n',
    );
    if (!result.valid) process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(
    `RDI2 source verification failed: ${error instanceof Error ? error.message : 'invalid input'}\n`,
  );
  process.exitCode = 1;
}

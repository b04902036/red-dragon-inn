import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { Rdi2AuditInputs } from '../../src/content/rdi2-compiler';

export function rdi2CompileInput() {
  const root = 'content-private/imports/rdi2/';
  const source = readFileSync(root + 'source-normalized.json', 'utf8');
  const ledger = readFileSync(root + 'verification-ledger.json', 'utf8');
  const matrix = readFileSync(
    'reference/rdi2/rdi2-mechanics-matrix.csv',
    'utf8',
  );
  const digest = (text: string) =>
    createHash('sha256').update(text).digest('hex');
  const audit: Rdi2AuditInputs = {
    ledger: JSON.parse(ledger) as unknown,
    matrix,
    lock: JSON.parse(
      readFileSync(root + 'source-lock.json', 'utf8'),
    ) as unknown,
    hashes: {
      normalizedSha256: digest(source),
      ledgerSha256: digest(ledger),
      matrixSha256: digest(matrix),
    },
  };
  return { source: JSON.parse(source) as unknown, audit };
}

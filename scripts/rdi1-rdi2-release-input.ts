import { readFileSync, globSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { Rdi1Rdi2ReleaseInput } from '../src/content/rdi1-rdi2-release';
const sha = (bytes: string | Buffer) =>
  createHash('sha256').update(bytes).digest('hex');
const read = (path: string): unknown =>
  JSON.parse(readFileSync(path, 'utf8')) as unknown;
const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, item]) => [key, canonical(item)]),
        )
      : value;

/** Reproduce evidence bytes; no remote fetch, source edit, lock write or publication. */
export function loadRdi1Rdi2ReleaseInput(): Rdi1Rdi2ReleaseInput {
  const rdi1Paths = [
    'content-private/imports/rdi1/source-normalized.json',
    'reference/rdi1/rdi1-mechanics-matrix.csv',
    'reference/rdi1/rdi1-card-matrix.md',
    'reference/rdi1/source-evidence.md',
    'reference/rdi1/required-engine-capabilities.json',
    'reference/rdi1/sometimes-legality-fixtures.json',
  ];
  const root = 'content-private/imports/rdi2/';
  const files = new Set<string>(),
    records = new Set<string>();
  const crosscheck = read('reference/rdi2/the-inn-crosscheck.json') as {
    characters: Record<string, { sha256: string }>;
  };
  for (const character of ['dimli', 'eve', 'fleck']) {
    const bytes = readFileSync(
      `.tools/step24a-source-lock-resolution/evidence/${character}.json`,
    );
    const original = JSON.parse(bytes.toString('utf8')) as { cards: unknown[] };
    if (
      sha(bytes) !== crosscheck.characters[character]!.sha256 ||
      original.cards.length !== 40
    )
      throw new Error(`Original ${character} evidence hash/count mismatch`);
    for (const card of original.cards) {
      records.add(sha(JSON.stringify(card)));
      records.add(sha(JSON.stringify(canonical(card))));
    }
  }
  for (const path of globSync([
    '.tools/step24a*/**/*.{pdf,png,jpg,jpeg,json,txt}',
    'reference/rdi2/**/*.json',
    'codex-prompts/step-24a*.md',
  ]))
    files.add(sha(readFileSync(path)));
  const source = readFileSync(root + 'source-normalized.json', 'utf8');
  const ledger = readFileSync(root + 'verification-ledger.json', 'utf8');
  const matrix = readFileSync(
    'reference/rdi2/rdi2-mechanics-matrix.csv',
    'utf8',
  );
  return {
    rdi1Source: read('content-private/imports/rdi1/source-normalized.json'),
    rdi1Lock: read('reference/rdi1/source-lock.json'),
    rdi1Hashes: Object.fromEntries(
      rdi1Paths.map((path) => [path, sha(readFileSync(path))]),
    ),
    rdi2Source: JSON.parse(source) as unknown,
    rdi2Audit: {
      ledger: JSON.parse(ledger) as unknown,
      matrix,
      lock: read(root + 'source-lock.json'),
      hashes: {
        normalizedSha256: sha(source),
        ledgerSha256: sha(ledger),
        matrixSha256: sha(matrix),
      },
    },
    evidenceHashes: { files: [...files], records: [...records] },
    combined: read(root + 'pack-combined.json'),
  };
}

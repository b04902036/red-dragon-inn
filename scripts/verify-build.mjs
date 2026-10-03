import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
async function hashes(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = {};
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const key = prefix + entry.name;
    if (entry.isDirectory())
      Object.assign(
        result,
        await hashes(join(directory, entry.name), key + '/'),
      );
    else
      result[key] = createHash('sha256')
        .update(await readFile(join(directory, entry.name)))
        .digest('hex');
  }
  return result;
}
await run(process.execPath, ['node_modules/vite/bin/vite.js', 'build']);
const first = await hashes('dist');
await run(process.execPath, ['node_modules/vite/bin/vite.js', 'build']);
const second = await hashes('dist');
if (JSON.stringify(first) !== JSON.stringify(second))
  throw new Error('Production builds differ');
process.stdout.write(
  `Reproducible production build verified: ${Object.keys(first).length} files have identical SHA-256 hashes.\n`,
);

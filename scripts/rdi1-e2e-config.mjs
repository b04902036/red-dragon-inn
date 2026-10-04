import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import ts from 'typescript';

// Separate test entry/config; never add test routes or timing overrides to production.
const { config, error } = ts.parseConfigFileTextToJson(
  'wrangler.jsonc',
  await readFile('wrangler.jsonc', 'utf8'),
);
if (error) throw new Error('Cannot parse Worker configuration');
delete config.env;
config.main = resolve('tests/worker/rdi1-verification-worker.ts');
for (const database of config.d1_databases)
  database.migrations_dir = resolve(database.migrations_dir);
config.assets.run_worker_first.push('/__test/*');
await writeFile(
  '.tools/rdi1-e2e-wrangler.json',
  JSON.stringify(config, null, 2),
);

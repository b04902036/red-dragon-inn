import './runtime-env.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import ts from 'typescript';
const { config, error } = ts.parseConfigFileTextToJson(
  'wrangler.jsonc',
  await readFile('wrangler.jsonc', 'utf8'),
);
if (error) throw new Error('Cannot parse Worker configuration');
config.vars = { ...config.env.fixture.vars, FIXTURE_TIMING_MS: '30000,15000' };
delete config.env;
config.main = resolve('worker/index.ts');
for (const database of config.d1_databases)
  database.migrations_dir = resolve(database.migrations_dir);
await writeFile(
  '.tools/presentation-e2e-wrangler.json',
  JSON.stringify(config, null, 2),
);

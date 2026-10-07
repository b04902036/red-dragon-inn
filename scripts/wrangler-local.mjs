import './runtime-env.mjs';
import { spawnSync } from 'node:child_process';
const result = spawnSync(
  process.execPath,
  ['node_modules/wrangler/bin/wrangler.js', ...process.argv.slice(2)],
  { stdio: 'inherit', env: process.env },
);
process.exitCode = result.status ?? 1;

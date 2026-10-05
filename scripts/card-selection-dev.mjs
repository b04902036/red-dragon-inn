import { spawn } from 'node:child_process';

const environment = process.argv.includes('--fixture') ? 'dev-fixture' : 'dev';
const child = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'],
  {
    stdio: 'inherit',
    env: { ...process.env, CLOUDFLARE_ENV: environment },
  },
);
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});

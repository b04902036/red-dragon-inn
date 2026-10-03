import { spawn } from 'node:child_process';

// Explicit local fixture mode; production builds keep the default production environment.
const child = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'],
  {
    stdio: 'inherit',
    env: { ...process.env, CLOUDFLARE_ENV: 'fixture' },
  },
);
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});

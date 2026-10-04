import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: { port: { type: 'string', default: '4173' } },
});

// Preview must consume the build's generated configuration, including its content mode.
const previewEnvironment = { ...process.env };
delete previewEnvironment.CLOUDFLARE_ENV;
const child = spawn(
  process.execPath,
  [
    'node_modules/vite/bin/vite.js',
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    values.port,
    '--strictPort',
  ],
  { stdio: 'inherit', env: previewEnvironment },
);
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});

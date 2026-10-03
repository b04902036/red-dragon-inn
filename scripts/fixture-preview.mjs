import { spawn } from 'node:child_process';

// The build already selected fixture vars; preview must consume its generated config.
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
    '4173',
    '--strictPort',
  ],
  { stdio: 'inherit', env: previewEnvironment },
);
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});

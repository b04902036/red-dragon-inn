import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
const files = async (directory) =>
  (
    await Promise.all(
      (await readdir(directory, { withFileTypes: true })).map((entry) =>
        entry.isDirectory()
          ? files(join(directory, entry.name))
          : [join(directory, entry.name)],
      ),
    )
  ).flat();
const forbidden =
  /api\.elevenlabs\.io|xi-api-key|ELEVENLABS_API_KEY|\/v1\/text-to-(?:voice|speech)/;
let checked = 0;
for (const directory of ['src/client', 'worker', 'dist'])
  for (const filename of await files(directory)) {
    if (!/\.(?:tsx?|m?js|json)$/.test(filename)) continue;
    if (forbidden.test(await readFile(filename, 'utf8')))
      throw new Error(
        `Offline voice API reference found in runtime code: ${filename}`,
      );
    checked++;
  }
const skipDirectories = new Set([
  '.git',
  'node_modules',
  '.wrangler',
  'coverage',
  'test-results',
  'playwright-report',
]);
const key = process.env.ELEVENLABS_API_KEY;
let inspected = 0;
async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!skipDirectories.has(entry.name)) await inspect(path);
      continue;
    }
    if (
      entry.name === '.env.local' ||
      !/\.(?:tsx?|m?js|json|md|txt|csv|log|html)$|^\.env/.test(entry.name)
    )
      continue;
    const bytes = await readFile(path);
    const content =
      bytes[0] === 255 && bytes[1] === 254
        ? bytes.toString('utf16le')
        : bytes.toString('utf8');
    if (
      (key && content.includes(key)) ||
      /\bsk_[A-Za-z0-9]{24,}\b/.test(content)
    )
      throw new Error(`Possible secret found in ${path}; no value printed.`);
    inspected++;
  }
}
await inspect('.');
console.log(
  `PASS: ${checked} runtime source/build files contain no ElevenLabs endpoint, API-key reference or API header; ${inspected} workspace text files contain no exposed key.`,
);

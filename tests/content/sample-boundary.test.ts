import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { sampleContentPack } from '../../src/content/sample';

it('uses only the repository-safe sample pack without any private input dependency', () => {
  const sample = JSON.parse(
    readFileSync('content/samples/pack.json', 'utf8'),
  ) as unknown;
  expect(sampleContentPack).toEqual(sample);
  expect(
    sampleContentPack.cards.every((card) => card.source === 'SAMPLE'),
  ).toBe(true);
  const module = readFileSync('src/content/sample.ts', 'utf8');
  expect(module).toContain('../../content/samples/pack.json');
  expect(module).not.toMatch(
    /content-private|private-content|content\/private/,
  );
  const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
  expect(workflow).toContain('--input content/samples/pack.json --dry-run');
  expect(workflow).not.toMatch(/content-private|private-content/);
});

import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { rdi1Pack, rdi1Records } from '../fixtures/rdi1-content';

it('the checked-in mechanical matrix accounts for every compiled definition, quantity, locale and executable test', () => {
  const matrix = readFileSync('docs/rdi1-card-coverage.md', 'utf8');
  const rows = matrix
    .split('\n')
    .filter((line) => line.startsWith('| `carddef_rdi1_'));
  expect(rows).toHaveLength(rdi1Pack.cards.length);
  expect(matrix).not.toMatch(/TODO|unsupported|MISSING/);
  for (const record of rdi1Records) {
    const row = rows.find((line) => line.includes(`\`${record.id}\``))!;
    expect(row).toBeDefined();
    const cells = row.split('|').map((c) => c.trim());
    expect(cells[2]).toBe(String(record.quantity));
    expect(cells[3]).toBe(rdi1Pack.cards.find((c) => c.id === record.id)!.type);
    expect(row).toContain(`\`${record.mechanic}\``);
    expect(row.match(/present/g)).toHaveLength(2);
    expect(row).toContain(`positive: ${record.id}`);
    expect(row).toContain(`negative: ${record.id}`);
    expect(row).toContain(`resolution: ${record.id}`);
    for (const match of row.matchAll(/\]\(\.\.\/([^)]*)\)/g))
      expect(readFileSync(match[1]!, 'utf8')).toBeTruthy();
  }
  expect(
    rdi1Records
      .filter((r) => r.deck === 'drink')
      .reduce((n, r) => n + r.quantity, 0),
  ).toBe(30);
});

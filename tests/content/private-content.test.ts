import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('ignores private content paths and has no tracked private content', () => {
  const paths = [
    'private-content/licensed-pack.json',
    'content/private/licensed-pack.json',
    'src/content/private/licensed-pack.json',
    'content-private/imports/licensed-pack.json',
  ];
  const ignored = execFileSync(
    'git',
    ['check-ignore', '--no-index', ...paths],
    { encoding: 'utf8' },
  )
    .trim()
    .split(/\r?\n/);
  expect(ignored).toEqual(paths);
  const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split(
    /\r?\n/,
  );
  expect(
    tracked.filter((path) =>
      /^(private-content|content\/private|src\/content\/private|content-private\/imports)\//.test(
        path,
      ),
    ),
  ).toEqual([]);
});

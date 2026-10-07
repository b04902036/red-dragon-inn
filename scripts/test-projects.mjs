import { spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';

// Initialize Workers files separately after observed combined-pool startup
// stalls. Every configured suite still runs; Node suites share a run.
const coverage = process.argv.includes('--coverage');
const extra = process.argv.slice(2).filter((arg) => arg !== '--coverage');
const groups = [
  { projects: ['contracts', 'client'], files: [] },
  {
    projects: ['development-worker'],
    files: ['tests/worker/dev-card-selection.test.ts'],
  },
  ...readdirSync('tests/worker')
    .filter(
      (name) =>
        name.endsWith('.test.ts') && name !== 'dev-card-selection.test.ts',
    )
    .sort()
    .map((name) => ({
      projects: [
        name === 'production-content.test.ts' ||
        name === 'rdi1-content.test.ts' ||
        name === 'rdi2-content.test.ts' ||
        name === 'rdi2-full-verification.test.ts'
          ? 'production-worker'
          : 'worker',
      ],
      files: ['tests/worker/' + name],
    })),
];
let failed = false;
const maps = [];
for (const [index, { projects, files }] of groups.entries()) {
  const args = [
    'node_modules/vitest/vitest.mjs',
    'run',
    ...projects.flatMap((name) => ['--project', name]),
    ...files,
    ...extra,
  ];
  if (coverage)
    args.push(
      '--coverage',
      '--coverage.reporter=json',
      '--coverage.reportsDirectory=.tools/coverage-part',
      '--coverage.thresholds.statements=0',
      '--coverage.thresholds.branches=0',
      '--coverage.thresholds.functions=0',
      '--coverage.thresholds.lines=0',
    );
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (result.status !== 0) failed = true;
  if (coverage) {
    const path = '.tools/coverage-part/coverage-final.json';
    maps.push(JSON.parse(readFileSync(path, 'utf8')));
    mkdirSync('.tools/coverage-parts', { recursive: true });
    copyFileSync(path, `.tools/coverage-parts/${index}.json`);
  }
}
if (coverage) {
  const require = createRequire(import.meta.url);
  const { createCoverageMap } = require('istanbul-lib-coverage');
  const { createContext } = require('istanbul-lib-report');
  const reports = require('istanbul-reports');
  const merged = createCoverageMap({});
  for (const map of maps) merged.merge(map);
  const context = createContext({ dir: 'coverage', coverageMap: merged });
  for (const reporter of ['text', 'json', 'json-summary', 'html'])
    reports.create(reporter).execute(context);
  // Enforce the repository's unchanged per-file 90% gates on the aggregate
  // coverage across all runtime pools, rather than on incomplete sub-runs.
  for (const file of merged.files()) {
    const summary = merged.fileCoverageFor(file).toSummary();
    for (const metric of ['statements', 'branches', 'functions', 'lines'])
      if (summary[metric].pct < 90) {
        process.stderr.write(
          `${file}: ${metric} coverage ${summary[metric].pct}% is below 90%\n`,
        );
        failed = true;
      }
  }
}
process.exitCode = failed ? 1 : 0;

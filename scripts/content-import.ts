import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { getPlatformProxy } from 'wrangler';
import { validateContentImport } from '../src/content/import';
import { contentImportStatements } from '../src/content/import-statements';

interface Statement {
  bind(...values: unknown[]): Statement;
}
interface Database {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<unknown>;
}
const { values, positionals } = parseArgs({
  options: {
    input: { type: 'string' },
    write: { type: 'boolean' },
    'dry-run': { type: 'boolean' },
    publish: { type: 'boolean' },
  },
});
if (
  !values.input ||
  positionals.length ||
  (values.write && values['dry-run']) ||
  (values.publish && !values.write)
)
  throw new Error(
    'Usage: npm run content:import -- --input local-pack.json [--dry-run | --write [--publish]]',
  );
const source = await readFile(values.input, 'utf8');
const { pack, report } = validateContentImport(source);
process.stdout.write(
  JSON.stringify(
    { ...report, mode: values.write ? 'write' : 'dry-run' },
    null,
    2,
  ) + '\n',
);
if (pack === null) process.exitCode = 1;
else if (values.write) {
  const platform = await getPlatformProxy<{ DB: Database }>({
    configPath: 'wrangler.jsonc',
    persist: { path: '.wrangler/state/v3' },
    remoteBindings: false,
  });
  try {
    const db = platform.env.DB;
    const statements = contentImportStatements(pack).map(
      ({ sql, values: params }) => db.prepare(sql).bind(...params),
    );
    if (values.publish)
      statements.push(
        db
          .prepare(
            "UPDATE content_versions SET published_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND published_at IS NULL",
          )
          .bind(pack.version.id),
      );
    await db.batch(statements);
    process.stdout.write(
      `Imported ${pack.version.id}${values.publish ? ' (published)' : ' (draft)'} into local D1.\n`,
    );
  } finally {
    await platform.dispose();
  }
}

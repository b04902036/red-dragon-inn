import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getPlatformProxy } from 'wrangler';
import { matchIdSchema } from '../src/shared/ids';
import {
  coreStateSchema,
  replayEntrySchema,
  replayManifestSchema,
  replayFromBeginning,
  replayFromSnapshot,
} from '../src/engine/replay';
import { projectPublicGame } from '../src/protocol/projections';

// CLI only: these narrow interfaces keep the engine/tooling independent of Worker ambient types.
interface LocalStatement {
  bind(...values: unknown[]): LocalStatement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
}
interface LocalDatabase {
  prepare(query: string): LocalStatement;
}
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--match')
  throw new Error('Usage: npm run replay:inspect -- --match match_ID');
const matchId = matchIdSchema.parse(args[1]);
const platform = await getPlatformProxy<{ DB: LocalDatabase }>({
  configPath: 'wrangler.jsonc',
  persist: { path: '.wrangler/state/v3' },
  remoteBindings: false,
});
try {
  const db = platform.env.DB;
  const [source, rows, checkpoint] = await Promise.all([
    db
      .prepare('SELECT manifest_json FROM match_manifests WHERE match_id=?')
      .bind(matchId)
      .first<{ manifest_json: string }>(),
    db
      .prepare(
        'SELECT entry_json FROM match_commands WHERE match_id=? ORDER BY first_sequence',
      )
      .bind(matchId)
      .all<{ entry_json: string }>(),
    db
      .prepare(
        'SELECT sequence,snapshot_json FROM match_snapshots WHERE match_id=? ORDER BY sequence DESC LIMIT 1',
      )
      .bind(matchId)
      .first<{ sequence: number; snapshot_json: string }>(),
  ]);
  if (source === null || checkpoint === null)
    throw new Error(
      'Local match history or snapshot was not found. Start a local match first.',
    );
  const manifest = replayManifestSchema.parse(JSON.parse(source.manifest_json));
  const entries = rows.results.map((row) =>
    replayEntrySchema.parse(JSON.parse(row.entry_json)),
  );
  const snapshot = coreStateSchema.parse(JSON.parse(checkpoint.snapshot_json));
  const beginning = replayFromBeginning(manifest, entries);
  const resumed = replayFromSnapshot(
    snapshot,
    checkpoint.sequence,
    entries.filter((entry) => entry.firstSequence > checkpoint.sequence),
  );
  if (JSON.stringify(beginning) !== JSON.stringify(resumed))
    throw new Error('Replay from beginning differs from snapshot recovery');
  const view = projectPublicGame(beginning.state);
  const escape = (value: string) =>
    value.replace(
      /[&<>"']/g,
      (char) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[char]!,
    );
  const players = view.players
    .map(
      (player) =>
        `<tr><th>${escape(player.displayName)}</th><td>${player.fortitude}</td><td>${player.alcoholContent}</td><td>${player.gold}</td><td>${player.handCount}</td><td>${player.eliminated ? 'Eliminated' : 'Playing'}</td></tr>`,
    )
    .join('');
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local replay inspector</title><style>body{font:16px system-ui;max-width:1000px;margin:40px auto;padding:20px;background:#201713;color:#fff6e7}table{border-collapse:collapse;width:100%}td,th{padding:12px;text-align:left;border-bottom:1px solid #9e8068}.verified{color:#afdf9b}code{overflow-wrap:anywhere}</style><h1>Local replay inspector</h1><p class="verified">Replay verified: beginning and snapshot recovery match.</p><p>Match: <code>${escape(matchId)}</code></p><p>Pinned content: ${escape(manifest.setup.content.version.id)}</p><p>${entries.length} accepted commands · ${beginning.sequence} events · version ${view.version}</p><p>Lifecycle: ${view.lifecycle} · phase: ${view.phase ?? 'None'}</p><table><thead><tr><th>Player</th><th>Fortitude</th><th>Alcohol</th><th>Gold</th><th>Hand count</th><th>State</th></tr></thead><tbody>${players}</tbody></table><p>Local development report. The companion JSON includes private authoritative state; keep it in ignored local storage.</p></html>`;
  const directory = join('.tools', 'replay-inspector');
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, `${matchId}.json`),
    JSON.stringify(
      {
        schemaVersion: 1,
        manifest,
        entries,
        snapshot: { sequence: checkpoint.sequence, state: snapshot },
        replay: beginning,
      },
      null,
      2,
    ),
  );
  await writeFile(join(directory, `${matchId}.html`), html);
  process.stdout.write(
    `Replay verified. ${entries.length} commands / ${beginning.sequence} events. Report: ${join(directory, `${matchId}.html`)}\n`,
  );
} finally {
  await platform.dispose();
}

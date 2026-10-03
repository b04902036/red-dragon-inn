import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { sampleContentPack } from '../src/content/sample';
import { createMatch } from '../src/engine/setup';
import { applyCommand } from '../src/engine/commands';
import { DEFAULT_RULES } from '../src/engine/rules';
import type { CoreGameState } from '../src/engine/types';
import { matchIdSchema, playerIdSchema, roomIdSchema } from '../src/shared/ids';
import { projectPublicGame } from '../src/protocol/projections';
import { timingDemo } from './timing-demo';
import { gamblingDemo } from './gambling-demo';
import { drinksDemo } from './drinks-demo';

function prepare(handSize: number) {
  return createMatch({
    roomId: roomIdSchema.parse('room_demo'),
    matchId: matchIdSchema.parse('match_demo'),
    hostPlayerId: playerIdSchema.parse('player_0'),
    seed: 1,
    content: sampleContentPack,
    rules: {
      ...DEFAULT_RULES,
      handSize,
      timing: { responseMs: 0, phaseEndMs: 0 },
    },
    players: sampleContentPack.characters.map((character, seat) => ({
      id: playerIdSchema.parse(`player_${seat}`),
      characterId: character.id,
      seat: seat as 0 | 1 | 2 | 3,
      displayName: `Sample player ${seat + 1}`,
    })),
  });
}
function command(
  state: CoreGameState,
  type: string,
  fields: Record<string, unknown> = {},
) {
  return {
    type,
    roomId: state.roomId,
    commandId: `command_${state.version + 1}`,
    expectedStateVersion: state.version,
    ...fields,
  };
}
function accept(
  state: CoreGameState,
  type: string,
  fields: Record<string, unknown> = {},
) {
  const result = applyCommand(state, command(state, type, fields), {
    actorId: state.activePlayerId ?? state.control.hostPlayerId,
  });
  if (result.status !== 'ACCEPTED')
    throw new Error(`Demo command failed: ${type}`);
  return result;
}
function trace() {
  let result = accept(prepare(3), 'START_MATCH');
  const rows = [
    {
      label: 'Start match',
      view: projectPublicGame(result.state),
      events: result.events.map((e) => e.type),
      turn: result.state.control.turnNumber,
    },
  ];
  const append = (
    type: string,
    label: string,
    fields: Record<string, unknown> = {},
  ) => {
    result = accept(result.state, type, fields);
    if (result.state.responseWindow !== null) {
      const events = [...result.events];
      while (result.state.responseWindow !== null) {
        const window = result.state.responseWindow;
        const passed = applyCommand(
          result.state,
          command(result.state, 'PASS_RESPONSE', {
            responseWindowId: window.id,
          }),
          { actorId: window.priorityPlayerId! },
        );
        if (passed.status !== 'ACCEPTED')
          throw new Error('Turn trace response failed');
        result = passed;
        events.push(...passed.events);
      }
      result = { ...result, events };
    }
    rows.push({
      label,
      view: projectPublicGame(result.state),
      events: result.events.map((e) => e.type),
      turn: result.state.control.turnNumber,
    });
  };
  for (let turn = 0; turn < 12; turn += 1) {
    const actor = result.state.players.find(
      (p) => p.id === result.state.activePlayerId,
    )!;
    const target = result.state.players.find((p) => p.id !== actor.id)!;
    append('DISCARD', 'Discard two and redraw', {
      cardIds: actor.hand.slice(0, 2),
    });
    append('SKIP_ACTION', 'Skip action');
    append('ORDER_DRINK', 'Order a face-down Drink', {
      targetPlayerId: target.id,
    });
    append('TAKE_DRINK', 'Resolve Drink and Chasers');
    append('ADVANCE_PHASE', 'Complete elimination check');
    append('ADVANCE_PHASE', 'Start next turn');
  }
  return rows;
}
const rows = trace();
if (JSON.stringify(rows) !== JSON.stringify(trace()))
  throw new Error('Deterministic replay failed');
const countCards = (view: ReturnType<typeof projectPublicGame>) =>
  view.innDrinkDeckCount +
  view.innDrinkDiscardCount +
  view.players.reduce(
    (sum, p) =>
      sum +
      p.handCount +
      p.characterDeckCount +
      p.characterDiscardCount +
      p.drinkPileCount,
    0,
  );
const totalCards = countCards(rows[0]!.view);
if (rows.some((row) => countCards(row.view) !== totalCards))
  throw new Error('Report card conservation failed');
const actionState = accept(accept(prepare(7), 'START_MATCH').state, 'DISCARD', {
  cardIds: [],
}).state;
const actor = actionState.players[0]!;
const action = actor.hand.find(
  (id) =>
    actionState.definitions[actionState.cards[id]!.definitionId]!.type ===
    'ACTION',
)!;
const pending = accept(actionState, 'PLAY_CARD', {
  cardId: action,
  targetPlayerId: actionState.players[1]!.id,
});
const blocked = applyCommand(
  pending.state,
  command(pending.state, 'SKIP_ACTION'),
  { actorId: actor.id },
);
if (blocked.status !== 'REJECTED' || blocked.code !== 'RESOLUTION_PENDING')
  throw new Error('Pending action was skipped');
const html = (value: unknown) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
const tableRows = rows
  .map(
    (row) =>
      `<tr data-version="${row.view.version}"><td>${row.view.version}</td><td>${row.turn}</td><td>${html(row.label)}</td><td>${html(row.view.phase)}</td><td>${html(row.view.players.find((p) => p.id === row.view.activePlayerId)!.displayName)}</td><td>${row.view.players.map((p) => p.handCount).join(' / ')}</td><td>${row.view.players.map((p) => p.drinkPileCount).join(' / ')}</td><td>${row.view.innDrinkDeckCount}</td><td>${html(row.events.join(', '))}<details><summary>Inspect public view</summary><pre>${html(JSON.stringify(row.view, null, 2))}</pre></details></td></tr>`,
  )
  .join('\n');
const document = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Step 06 engine verification</title><style>
body{font:16px/1.5 system-ui,sans-serif;background:#f7f5f0;color:#292c30;margin:0;padding:2rem}main{max-width:1500px;margin:auto}h1,h2{line-height:1.2}section{background:white;border:1px solid #d8d5cd;border-radius:8px;padding:1.2rem;margin:1.2rem 0}.checks{color:#176b36;font-weight:600}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px}th,td{padding:.7rem;border-bottom:1px solid #ddd;text-align:left;vertical-align:top}th{background:#ece9e1;white-space:nowrap}td:nth-child(4){font-family:monospace}details{margin-top:.5rem}summary{cursor:pointer;color:#15498b}pre{max-width:500px;overflow:auto;font-size:12px}code{background:#ece9e1;padding:.1rem .25rem}tr:has(details[open]){background:#fff6da}
#gambling-trace table{min-width:1250px}#gambling-trace td:nth-child(6){white-space:nowrap}#gambling-trace td:last-child{min-width:210px}
</style><main><h1>Deterministic engine turn trace</h1><p>Step 06 development verification. Seed 1, four sample players, hand size 3, one initial Drink each. Rebuild this report after changing the engine.</p><p class="checks">Replay check: passed. Card conservation: ${totalCards} / ${totalCards} at every accepted command.</p><p>Drinks and Chasers now resolve through response windows. Elimination and Gold redistribution occur after the complete source settles. The multiplayer UI arrives in later steps.</p>${drinksDemo(actionState, html)}${gamblingDemo(actionState, html)}${timingDemo(actionState, html)}<section id="turn-trace"><h2>Twelve turns</h2><p>Counts are in seat order: players 1 / 2 / 3 / 4. Expand a row to inspect its public projection. Deck order, hands, face-down Drink identities, RNG, and dedupe records are excluded. Consumed Drinks return to Inn discard and can be reshuffled.</p><div class="table-wrap"><table><thead><tr><th>Version</th><th>Turn</th><th>Command</th><th>Phase</th><th>Active player</th><th>Hand counts</th><th>Drink piles</th><th>Inn cards</th><th>Events</th></tr></thead><tbody>${tableRows}</tbody></table></div></section><section id="pending-action"><h2>Action response window</h2><p><strong>${html(actionState.definitions[actionState.cards[action]!.definitionId]!.name)}</strong> opens a response window. Phase stays <code>${html(pending.state.phase)}</code>; target Fortitude stays <strong>${pending.state.players[1]!.fortitude}</strong>. Response priority starts with Sample player 2. Trying to skip the pending action returns <code>${blocked.code}</code>.</p><details><summary>Inspect revealed action and public view</summary><pre>${html(JSON.stringify(projectPublicGame(pending.state), null, 2))}</pre></details></section></main></html>`;
const outputDirectory = resolve('.tools/engine-demo');
mkdirSync(outputDirectory, { recursive: true });
writeFileSync(resolve(outputDirectory, 'trace.html'), document);
console.log('Engine trace ready: .tools/engine-demo/trace.html');

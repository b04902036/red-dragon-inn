import { applyCommand } from '../src/engine/commands';
import type { CoreGameState, MutableGameState } from '../src/engine/types';
import { projectPublicGame } from '../src/protocol/projections';
import type { DomainEvent } from '../src/protocol/events';
import { runSampleGame } from './sample-game';

export function drinksDemo(
  initial: CoreGameState,
  escape: (value: unknown) => string,
) {
  function preview(restore: boolean) {
    // Explicit developer scenario using physical sample instances and original definitions.
    let state = JSON.parse(JSON.stringify(initial)) as MutableGameState;
    state.phase = 'DRINK';
    state.players[0]!.alcoholContent = 18;
    const innCards = Object.values(state.cards)
      .filter((card) => card.ownerId === null)
      .map((card) => card.id)
      .sort();
    state.players.forEach((player) => {
      player.drinkPile = [];
    });
    state.innDrinkDiscard = [];
    state.innDrinkDeck.cardIds = [...innCards];
    for (const id of innCards)
      state.cards[id]!.location = {
        zone: 'INN_DRINK_DECK',
        deckId: state.innDrinkDeck.deckId,
      };
    for (const suffix of ['tea', 'tea', 'fizz']) {
      const id = state.innDrinkDeck.cardIds.find(
        (id) => state.cards[id]!.definitionId === `carddef_sample_${suffix}`,
      )!;
      state.innDrinkDeck.cardIds.splice(
        state.innDrinkDeck.cardIds.indexOf(id),
        1,
      );
      state.players[0]!.drinkPile.push(id);
      state.cards[id]!.location = {
        zone: 'DRINK_PILE',
        playerId: state.players[0]!.id,
      };
    }
    const rows = [
      { label: 'Prepared scenario', view: projectPublicGame(state) },
    ];
    const emitted: DomainEvent[] = [];
    const accept = (type: string) => {
      const window = state.responseWindow;
      const result = applyCommand(
        state,
        {
          type,
          roomId: state.roomId,
          commandId: `command_${state.version + 1}`,
          expectedStateVersion: state.version,
          ...(type === 'PASS_RESPONSE' ? { responseWindowId: window!.id } : {}),
        },
        { actorId: window?.priorityPlayerId ?? state.activePlayerId! },
      );
      if (result.status !== 'ACCEPTED') throw new Error('Drink preview failed');
      state = result.state as MutableGameState;
      emitted.push(...result.events);
      rows.push({
        label:
          type === 'TAKE_DRINK'
            ? 'Reveal Tea + Tea + Fizz'
            : `Pass: ${window!.priorityPlayerId}`,
        view: projectPublicGame(state),
      });
    };
    accept('TAKE_DRINK');
    if (restore) state = JSON.parse(JSON.stringify(state)) as MutableGameState;
    while (state.responseWindow !== null) accept('PASS_RESPONSE');
    if (
      !state.players[0]!.eliminated ||
      state.players[0]!.alcoholContent !== 20 ||
      state.players[0]!.fortitude !== 20 ||
      state.players[1]!.gold !== 11
    )
      throw new Error('Drink preview outcome failed');
    return { state, rows, emitted };
  }
  const scenario = preview(true);
  if (JSON.stringify(scenario) !== JSON.stringify(preview(false)))
    throw new Error('Drink replay failed');
  const table = scenario.rows
    .map((row, index) => {
      const drinker = row.view.players[0]!;
      const sources =
        row.view.resolutionStack[0]?.sourceCards
          ?.map((card) => initial.definitions[card.definitionId]!.name)
          .join(' → ') ?? 'None';
      const active = row.view.players.find(
        (player) => player.id === row.view.activePlayerId,
      )!.displayName;
      return `<tr data-drink-row="${index}"><td>${escape(row.label)}</td><td>${escape(sources)}</td><td>${drinker.alcoholContent}</td><td>${drinker.fortitude}</td><td>${drinker.eliminated ? 'Eliminated' : 'Playing'}</td><td>${row.view.players.map((player) => player.gold).join(' / ')}</td><td>${escape(row.view.phase)}</td><td>${escape(active)}<details><summary>Inspect public Drink view</summary><pre>${escape(JSON.stringify(row.view, null, 2))}</pre></details></td></tr>`;
    })
    .join('\n');
  const game = runSampleGame();
  if (JSON.stringify(game) !== JSON.stringify(runSampleGame()))
    throw new Error('Full match replay failed');
  const winner = game.state.players.find((player) =>
    game.state.winners.includes(player.id),
  )!;
  const matchRows = game.rows
    .map(
      (row, index) =>
        `<tr data-match-row="${index}"><td>${row.view.version}</td><td>${escape(row.label)}</td><td>${escape(row.view.lifecycle)}</td><td>${row.view.players.map((player) => `${player.alcoholContent}/${player.fortitude}`).join(' · ')}</td><td>${row.view.players.filter((player) => !player.eliminated).length}</td><td>${escape(
          row.view.players
            .filter((player) => player.eliminated)
            .map((player) => player.displayName)
            .join(', ') || 'None',
        )}<details><summary>Inspect public match view</summary><pre>${escape(JSON.stringify(row.view, null, 2))}</pre></details></td></tr>`,
    )
    .join('\n');
  return `<section id="drinks-trace"><h2>Drink chain and elimination</h2><p class="checks">Drink replay and snapshot resume: passed. Physical card conservation: ${scenario.state.initialCardCount}.</p><p>Prepared scenario: player 1 starts at Alcohol 18 / Fortitude 20, with two sample Teas and one Fizz. All three reveal as one Drink before responses. Stats stay unchanged until the final pass. Combined Alcohol +4 and Fortitude +2 are capped at 20 / 20, causing pass-out at equality.</p><p>Gold 10 splits into Inn 7 and 1 for each survivor. Player 1 has Gold 0; the other players have 11 each. The next living player starts DISCARD_DRAW. Counts and Gold values are in seat order.</p><div class="table-wrap"><table><thead><tr><th>Command / result</th><th>Revealed compound source</th><th>Alcohol</th><th>Fortitude</th><th>Player 1</th><th>Gold</th><th>Phase</th><th>Active player</th></tr></thead><tbody>${table}</tbody></table></div></section><section id="complete-match"><h2>Complete sample match</h2><p class="checks">Complete sample match: FINISHED. Replay: passed. Winner: <strong id="sample-winner">${escape(winner.displayName)}</strong>.</p><p>Original sample definitions, seed 1, initial Fortitude 4 for a short demonstration. Starting at setup, commands play one gambling round, order and resolve Drinks, redistribute Gold, skip eliminated seats, and finish with one survivor. No authoritative state is edited during this match.</p><div class="table-wrap"><table><thead><tr><th>Version</th><th>Result</th><th>Lifecycle</th><th>Alcohol / Fortitude by seat</th><th>Survivors</th><th>Eliminated players</th></tr></thead><tbody>${matchRows}</tbody></table></div></section>`;
}

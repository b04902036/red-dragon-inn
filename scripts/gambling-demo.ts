import { applyCommand } from '../src/engine/commands';
import type { CoreGameState } from '../src/engine/types';
import type { DomainEvent } from '../src/protocol/events';
import { projectPublicGame } from '../src/protocol/projections';
import type { PlayerId } from '../src/shared/ids';

/** A deterministic public report from actual sample-card commands. */
export function gamblingDemo(
  initial: CoreGameState,
  escape: (value: unknown) => string,
) {
  function run(restore: boolean) {
    let state = initial;
    const rows: {
      label: string;
      view: ReturnType<typeof projectPublicGame>;
      events: DomainEvent[];
    }[] = [];
    let pendingEvents: DomainEvent[] = [];
    const totalGold = initial.players.reduce(
      (sum, player) => sum + player.gold,
      0,
    );
    const accept = (
      type: string,
      fields: Record<string, unknown>,
      actorId: PlayerId,
    ) => {
      const result = applyCommand(
        state,
        {
          type,
          roomId: state.roomId,
          commandId: `command_${state.version + 1}`,
          expectedStateVersion: state.version,
          ...fields,
        },
        { actorId },
      );
      if (result.status !== 'ACCEPTED')
        throw new Error(`Gambling demo failed: ${type}`);
      state = result.state;
      pendingEvents.push(...result.events);
      if (
        state.players.reduce(
          (sum, player) => sum + player.gold,
          state.gambling?.pot ?? 0,
        ) !== totalGold
      )
        throw new Error('Gambling Gold conservation failed');
    };
    const append = (label: string) => {
      rows.push({
        label,
        view: projectPublicGame(state),
        events: pendingEvents,
      });
      pendingEvents = [];
    };
    const card = (seat: number, suffix: string) =>
      state.players[seat]!.hand.find(
        (id) => state.cards[id]!.definitionId === `carddef_sample_${suffix}`,
      )!;
    const passResponses = () => {
      while (state.responseWindow !== null)
        accept(
          'PASS_RESPONSE',
          {
            responseWindowId: state.responseWindow.id,
          },
          state.responseWindow.priorityPlayerId!,
        );
    };
    accept('PLAY_CARD', { cardId: card(0, 'gamble') }, state.players[0]!.id);
    passResponses();
    append('Four players ante');
    if (restore) state = JSON.parse(JSON.stringify(state)) as CoreGameState;
    accept(
      'GAMBLING_PLAY',
      { cardId: card(1, 'gamble') },
      state.players[1]!.id,
    );
    append('Player 2 plays Gambling (responses pending)');
    passResponses();
    append('Gambling resolves: player 2 controls');
    accept('GAMBLING_PLAY', { cardId: card(2, 'cheat') }, state.players[2]!.id);
    append('Player 3 plays Cheating (responses pending)');
    passResponses();
    append('Cheating resolves: player 3 controls');
    for (const seat of [3, 0, 1]) {
      accept('GAMBLING_PASS', {}, state.players[seat]!.id);
      append(`Player ${seat + 1} passes${seat === 1 ? ': player 3 wins' : ''}`);
    }
    if (
      state.gambling !== null ||
      state.phase !== 'ORDER_DRINK' ||
      state.players[2]!.gold !== 13 ||
      state.resolutionStack.length !== 0
    )
      throw new Error('Gambling outcome failed');
    return { state, rows, totalGold };
  }
  const completed = run(true);
  if (JSON.stringify(completed) !== JSON.stringify(run(false)))
    throw new Error('Gambling replay and snapshot resume failed');
  const table = completed.rows
    .map((row, index) => {
      const round = row.view.gambling;
      const playerName = (id: PlayerId | null | undefined) =>
        row.view.players.find((player) => player.id === id)?.displayName ??
        'None';
      return `<tr data-gambling-row="${index}"><td>${escape(row.label)}</td><td>${round?.pot ?? 0}</td><td>${escape(playerName(round?.controlPlayerId))}</td><td>${escape(playerName(round?.priorityPlayerId))}</td><td>${escape(playerName(row.view.responseWindow?.priorityPlayerId))}</td><td>${row.view.players.map((player) => player.gold).join(' / ')}</td><td>${escape(round?.passedPlayerIds.map(playerName).join(', ') || 'None')}</td><td>${escape(row.view.phase)}</td><td><details><summary>Inspect ${row.events.length} events</summary><pre>${escape(row.events.map((event) => event.type).join('\n'))}</pre></details><details><summary>Inspect public gambling view</summary><pre>${escape(JSON.stringify(row.view, null, 2))}</pre></details></td></tr>`;
    })
    .join('\n');
  return `<section id="gambling-trace"><h2>Gambling round</h2><p class="checks">Gambling replay and snapshot resume: passed. Gold + pot: ${completed.totalGold} at every accepted command.</p><p>Each of four players antes 1 Gold. Player 2 takes control with Gambling, then player 3 with Cheating. After players 4, 1, and 2 pass, player 3 receives the whole pot once. Control cards resolve after their response windows close. Gold values are in seat order: players 1 / 2 / 3 / 4.</p><p>Phase stays ACTION and the active player stays Sample player 1 during the round. The final payout clears the suspended source and resumes ORDER_DRINK for that player. Expand a public view to inspect contributions and membership without hidden hands or the internal continuation.</p><div class="table-wrap"><table><thead><tr><th>Command / result</th><th>Pot</th><th>Controller</th><th>Gambling priority</th><th>Response priority</th><th>Gold</th><th>Passed</th><th>Phase</th><th>Events</th></tr></thead><tbody>${table}</tbody></table></div></section>`;
}

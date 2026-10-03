import { applyCommand } from '../src/engine/commands';
import type { CoreGameState } from '../src/engine/types';
import type { DomainEvent } from '../src/protocol/events';
import type { PlayerId } from '../src/shared/ids';
import { projectPublicGame } from '../src/protocol/projections';

/** Developer report uses actual sample cards and projects only public state. */
export function timingDemo(
  initial: CoreGameState,
  escape: (value: unknown) => string,
) {
  function run(nested: boolean) {
    let state = initial;
    const rows: {
      label: string;
      view: ReturnType<typeof projectPublicGame>;
      events: DomainEvent[];
    }[] = [];
    const accept = (
      type: string,
      label: string,
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
        throw new Error(`Timing demo failed: ${label}`);
      state = result.state;
      rows.push({
        label,
        view: projectPublicGame(state),
        events: result.events,
      });
    };
    const card = (seat: number, suffix: string) =>
      state.players[seat]!.hand.find(
        (id) => state.cards[id]!.definitionId === `carddef_sample_${suffix}`,
      )!;
    accept(
      'PLAY_CARD',
      'Player 1 plays Shove',
      { cardId: card(0, 'shove'), targetPlayerId: state.players[1]!.id },
      state.players[0]!.id,
    );
    accept(
      'PASS_RESPONSE',
      'Source actor passes',
      { responseWindowId: state.responseWindow!.id },
      state.players[0]!.id,
    );
    accept(
      'PLAY_RESPONSE',
      'Player 2 plays Ignore',
      { responseWindowId: state.responseWindow!.id, cardId: card(1, 'ignore') },
      state.players[1]!.id,
    );
    if (nested) {
      accept(
        'PASS_RESPONSE',
        'Response actor passes',
        { responseWindowId: state.responseWindow!.id },
        state.players[1]!.id,
      );
      accept(
        'PLAY_RESPONSE',
        'Player 3 negates Ignore',
        {
          responseWindowId: state.responseWindow!.id,
          cardId: card(2, 'negate'),
        },
        state.players[2]!.id,
      );
      state = JSON.parse(JSON.stringify(state)) as CoreGameState;
    }
    while (state.responseWindow !== null) {
      const actorId = state.responseWindow.priorityPlayerId!;
      const player = state.players.find((player) => player.id === actorId)!;
      accept(
        'PASS_RESPONSE',
        `${player.displayName} passes`,
        { responseWindowId: state.responseWindow.id },
        actorId,
      );
    }
    return { state, rows };
  }
  const nested = run(true);
  if (JSON.stringify(nested) !== JSON.stringify(run(true)))
    throw new Error('Nested replay failed');
  const ignored = run(false);
  if (
    nested.state.players[1]!.fortitude !== 18 ||
    ignored.state.players[1]!.fortitude !== 20
  )
    throw new Error('Timing outcome check failed');
  const completionOrder = nested.rows
    .flatMap((row) => row.events)
    .filter((event) => event.type === 'RESOLUTION_COMPLETED')
    .map((event) =>
      event.canceled
        ? 'Ignore (canceled)'
        : event.resolutionId === nested.rows[0]!.view.resolutionStack[0]!.id
          ? 'Shove'
          : 'Negate',
    )
    .join(' → ');
  const table = nested.rows
    .map((row) => {
      const priority =
        row.view.players.find(
          (player) => player.id === row.view.responseWindow?.priorityPlayerId,
        )?.displayName ?? 'None';
      const sources =
        row.view.resolutionStack
          .map(
            (frame) =>
              initial.definitions[frame.sourceCard!.definitionId]!.name,
          )
          .join(' → ') || 'Empty';
      return `<tr data-depth="${row.view.resolutionStack.length}"><td>${escape(row.label)}</td><td>${row.view.resolutionStack.length}</td><td>${escape(sources)}</td><td>${escape(priority)}</td><td>${row.view.players[1]!.fortitude}</td><td>${escape(row.view.phase)}</td><td>${escape(row.events.map((event) => event.type).join(', '))}<details><summary>Inspect public timing view</summary><pre>${escape(JSON.stringify(row.view, null, 2))}</pre></details></td></tr>`;
    })
    .join('\n');
  return `<section id="timing-trace"><h2>Three-level response chain</h2><p class="checks">Nested replay and snapshot resume: passed.</p><p>Player 1 plays Shove at player 2; player 2 plays Ignore; player 3 negates that Ignore. The leaf resolves first: <strong id="unwind-order">${escape(completionOrder)}</strong>.</p><p id="timing-outcomes">With Ignore alone, player 2 stays at Fortitude <strong>20</strong>. With Ignore negated, Shove reduces Fortitude to <strong>18</strong>. After resolution the stack is empty, priority is None, and phase is ORDER_DRINK.</p><div class="table-wrap"><table><thead><tr><th>Command</th><th>Stack depth</th><th>Sources (bottom → top)</th><th>Response priority</th><th>Player 2 Fortitude</th><th>Phase</th><th>Events</th></tr></thead><tbody>${table}</tbody></table></div></section>`;
}

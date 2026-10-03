import { it, expect } from 'vitest';
import { actionAttention } from '../../src/protocol/attention';
import { projectPublicGame } from '../../src/protocol/projections';
import { started, accepted, mutable } from '../fixtures/core-match';
import { playAction, actionState, passWindow } from '../fixtures/timing-match';
import { startRound } from '../fixtures/gambling-match';
it('keeps turn prompts stable across version/stat changes and changes keys for consecutive phases and turns', () => {
  const game = started(1, 7),
    view = projectPublicGame(game);
  expect(view.attention).toMatchObject({ playerId: 'player_0', kind: 'TURN' });
  expect(
    actionAttention(
      { ...view, version: 99 as typeof view.version },
      game.control.turnNumber,
    ),
  ).toEqual(view.attention);
  expect(actionAttention(view, game.control.turnNumber + 1)!.key).not.toBe(
    view.attention!.key,
  );
  const next = projectPublicGame(
    accepted(game, 'DISCARD', { cardIds: [] }).state,
  );
  expect(next.attention!.key).not.toBe(view.attention!.key);
});
it('identifies response priority, mandatory choices and consecutive choices within the same resolution', () => {
  const response = projectPublicGame(playAction().state);
  expect(response.attention).toMatchObject({
    kind: 'RESPONSE',
    playerId: response.responseWindow!.priorityPlayerId,
  });
  const passed = projectPublicGame(passWindow(playAction().state).state);
  expect(passed.attention?.key).not.toBe(response.attention!.key);
  const pending = playAction(
    actionState([
      {
        op: 'OPEN_OPTION',
        target: 'SELF',
        options: [{ id: 'yes', label: 'Yes' }],
      },
    ]),
    null,
  ).state;
  const choice = passWindow(pending).state,
    view = projectPublicGame(choice);
  expect(view.attention).toMatchObject({
    kind: 'CHOICE',
    playerId: 'player_0',
  });
  expect(actionAttention(view, 1, 2)!.key).not.toBe(
    actionAttention(view, 1, 3)!.key,
  );
});
it('identifies gambling priority and stays stable when only state version changes', () => {
  const state = startRound().state;
  const view = projectPublicGame(state);
  expect(view.attention).toMatchObject({
    kind: 'GAMBLING',
    playerId: state.gambling!.priorityPlayerId,
  });
  expect(
    actionAttention({ ...view, version: 22 as typeof view.version }, 1),
  ).toEqual(view.attention);
});
it('returns no actionable prompt for finished/lobby, settling, blocked resolution, missing actor/phase or eliminated player', () => {
  const game = mutable(started(1, 7)),
    view = projectPublicGame(game);
  for (const variant of [
    { ...view, lifecycle: 'FINISHED' as const },
    { ...view, matchId: null },
    { ...view, activePlayerId: null },
    { ...view, phase: null },
    {
      ...view,
      players: view.players.map((player) => ({ ...player, eliminated: true })),
    },
  ])
    expect(actionAttention(variant, 1)).toBeNull();
  const response = projectPublicGame(playAction().state);
  expect(
    actionAttention(
      {
        ...response,
        responseWindow: { ...response.responseWindow!, priorityPlayerId: null },
      },
      1,
    ),
  ).toBeNull();
  expect(actionAttention({ ...response, responseWindow: null }, 1)).toBeNull();
  const gamble = projectPublicGame(startRound().state);
  expect(
    actionAttention(
      { ...gamble, gambling: { ...gamble.gambling!, priorityPlayerId: null } },
      1,
    ),
  ).toBeNull();
});

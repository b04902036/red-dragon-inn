import {
  playerIdSchema,
  responseWindowIdSchema,
  commandIdSchema,
} from '../../src/shared/ids';
import { stateVersionSchema } from '../../src/shared/version';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GameTable } from '../../src/client/GameTable';
import { contextualActions, cardAction } from '../../src/client/game-actions';
import {
  initialRoomState,
  receiveRoomMessage,
  rejectionText,
  phaseName,
} from '../../src/client/room-state';
import {
  projectPrivatePlayer,
  projectPublicGame,
} from '../../src/protocol/projections';
import { samplePresentation as presentation } from '../../src/content/sample-presentation';
import type { RoomClientState } from '../../src/client/room-state';
import { started } from '../fixtures/core-match';
import { playAction } from '../fixtures/timing-match';
import { startRound } from '../fixtures/gambling-match';

const core = started(1, 7);
const stateFor = (game = core): RoomClientState => ({
  ...initialRoomState,
  status: 'synced',
  publicView: projectPublicGame(game),
  privateView: projectPrivatePlayer(game, playerIdSchema.parse('player_0')),
});
const display = (state = stateFor()) => {
  const send = vi.fn();
  const reconnect = vi.fn();
  render(
    <GameTable
      state={state}
      presentation={presentation}
      playerId="player_0"
      send={send}
      reconnect={reconnect}
    />,
  );
  return { send, reconnect };
};

describe('playable table', () => {
  it('shows owner resources and side-deck counts only in the own player panel', () => {
    const state = stateFor();
    state.privateView!.resources.private_token = 3;
    state.privateView!.sideDecks.private_token = {
      deckCount: 2,
      discardCount: 1,
    };
    display(state);
    const own = screen.getByRole('article', { name: 'Sample player 0 (you)' });
    expect(within(own).getByText('Resource private_token: 3')).toBeVisible();
    expect(
      within(own).getByText('Side deck private_token: 2 cards · 1 discarded'),
    ).toBeVisible();
    expect(screen.getAllByText('Resource private_token: 3')).toHaveLength(1);
  });
  it('renders only the private hand, opponent counts, public stats, phase and active seat', () => {
    const state = stateFor();
    display(state);
    const hand = screen.getByRole('region', { name: 'Your hand' });
    expect(hand.querySelectorAll('[data-card-id]')).toHaveLength(7);
    expect(
      [...hand.querySelectorAll('[data-card-id]')].map((card) =>
        card.getAttribute('data-card-id'),
      ),
    ).toEqual(state.privateView!.hand.map((card) => card.id));
    for (const opponent of core.players.slice(1))
      for (const cardId of opponent.hand)
        expect(document.querySelector(`[data-card-id="${cardId}"]`)).toBeNull();
    expect(screen.getAllByText('Hand: 7')).toHaveLength(core.players.length);
    expect(
      screen.getByRole('heading', { name: 'Discard and draw' }),
    ).toBeVisible();
    expect(screen.getByText('Active player:')).toHaveTextContent(
      'Sample player 0',
    );
    expect(
      screen.getByRole('button', { name: 'Discard and draw' }),
    ).toBeEnabled();
    expect(
      screen.queryByRole('button', { name: 'Take a Drink' }),
    ).not.toBeInTheDocument();
  });
  it('reads card text in a keyboard accessible dialog and sends only selected discard ids', async () => {
    const { send } = display();
    const user = userEvent.setup();
    const first = screen.getAllByRole('button', { name: /^Read / })[0]!;
    await user.click(first);
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(
      within(screen.getByRole('dialog')).getByRole('heading'),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(first).toHaveFocus();
    await user.click(screen.getAllByRole('checkbox')[0]!);
    await user.click(screen.getByRole('button', { name: 'Discard and draw' }));
    expect(send).toHaveBeenCalledWith('DISCARD', {
      cardIds: [stateFor().privateView!.hand[0]!.id],
    });
  });
  it('shows response priority and passes with its current window id', async () => {
    const game = playAction().state;
    const state = stateFor(game);
    state.publicView!.responseWindow!.priorityPlayerId =
      playerIdSchema.parse('player_0');
    const { send } = display(state);
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Pass response' }));
    expect(
      screen.getByText('Your response priority. Play a response or pass.'),
    ).toBeVisible();
    expect(send).toHaveBeenCalledWith('PASS_RESPONSE', {
      responseWindowId: state.publicView!.responseWindow!.id,
    });
  });
  it('shows waiting responses without giving the waiting seat a pass button', () => {
    const state = stateFor(playAction().state);
    state.publicView!.responseWindow!.priorityPlayerId =
      playerIdSchema.parse('player_1');
    display(state);
    expect(
      screen.getByText("Waiting for Sample player 1's response."),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Pass response' }),
    ).not.toBeInTheDocument();
  });
  it('shows gambling controller, pot and priority commands', () => {
    const state = stateFor(startRound().state);
    state.publicView!.gambling!.priorityPlayerId =
      playerIdSchema.parse('player_0');
    display(state);
    expect(
      screen.getByRole('heading', { name: 'Gambling round' }),
    ).toBeVisible();
    expect(screen.getByText(/Pot: .* Gold/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Pass gambling' })).toBeEnabled();
  });
  it('disables mutations while reconnecting or awaiting acknowledgement', async () => {
    const state = { ...stateFor(), status: 'reconnecting' as const };
    const { reconnect, send } = display(state);
    expect(screen.getByRole('status')).toHaveTextContent('Reconnecting');
    expect(
      screen.getByRole('button', { name: 'Discard and draw' }),
    ).toBeDisabled();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Reconnect' }));
    expect(reconnect).toHaveBeenCalledOnce();
    expect(send).not.toHaveBeenCalled();
  });
  it('shows eliminated spectators and hides their critical controls', () => {
    const state = stateFor();
    state.publicView!.players[0]!.eliminated = true;
    display(state);
    expect(
      screen.getByText('You are eliminated. Watch the rest of the match.'),
    ).toBeVisible();
    expect(screen.getByText(/Seat 1 · Eliminated/)).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Discard and draw' }),
    ).not.toBeInTheDocument();
  });
  it('offers an explicit target picker for ordering Drinks', async () => {
    const state = stateFor();
    state.publicView!.phase = 'ORDER_DRINK';
    const { send } = display(state);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Order a Drink' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Sample player 1',
      }),
    );
    expect(send).toHaveBeenCalledWith('ORDER_DRINK', {
      targetPlayerId: 'player_1',
    });
  });
  it('renders only private pending choice options and validates selection count', async () => {
    const state = stateFor();
    state.privateView!.pendingChoice = {
      responseWindowId: responseWindowIdSchema.parse('window_choice'),
      kind: 'OPTION',
      options: [
        { id: 'a', label: 'Keep the coin' },
        { id: 'b', label: 'Spend the coin' },
      ],
      min: 1,
      max: 1,
    };
    const { send } = display(state);
    const user = userEvent.setup();
    expect(
      screen.getByRole('button', { name: 'Confirm choice' }),
    ).toBeDisabled();
    await user.click(screen.getByLabelText('Keep the coin'));
    expect(screen.getByLabelText('Spend the coin')).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Confirm choice' }));
    expect(send).toHaveBeenCalledWith('CHOOSE_OPTION', {
      responseWindowId: responseWindowIdSchema.parse('window_choice'),
      optionId: 'a',
    });
  });
});

describe('view based action and connection rules', () => {
  it('offers Ignore only to players affected by the current sample source', () => {
    const view = stateFor(playAction().state).publicView!;
    const ignore = presentation.cards.find(
      (card) => card.responseKind === 'IGNORE',
    )!;
    view.responseWindow!.priorityPlayerId = playerIdSchema.parse('player_0');
    expect(cardAction(view, 'player_0', ignore, presentation.cards)).toBeNull();
    view.responseWindow!.priorityPlayerId = playerIdSchema.parse('player_1');
    expect(cardAction(view, 'player_1', ignore, presentation.cards)).toBe(
      'PLAY_RESPONSE',
    );
  });
  it.each([
    ['DISCARD_DRAW', 'DISCARD'],
    ['ACTION', 'SKIP_ACTION'],
    ['ORDER_DRINK', 'ORDER_DRINK'],
    ['DRINK', 'TAKE_DRINK'],
    ['ELIMINATION_CHECK', 'ADVANCE_PHASE'],
    ['NEXT_TURN', 'ADVANCE_PHASE'],
  ] as const)('offers only the phase command in %s', (phase, command) => {
    const view = stateFor().publicView!;
    view.phase = phase;
    expect(contextualActions(view, 'player_0')).toEqual([command]);
    expect(contextualActions(view, 'player_1')).toEqual([]);
  });
  it('limits action, gambling and reaction card buttons to their turn or priority', () => {
    const view = stateFor().publicView!;
    view.phase = 'ACTION';
    const action = presentation.cards.find((card) => card.type === 'ACTION')!;
    expect(cardAction(view, 'player_0', action)).toBe('PLAY_CARD');
    expect(cardAction(view, 'player_1', action)).toBeNull();
    const gambling = stateFor(startRound().state).publicView!;
    const cheat = presentation.cards.find((card) => card.type === 'CHEATING')!;
    expect(
      cardAction(gambling, gambling.gambling!.priorityPlayerId!, cheat),
    ).toBe('GAMBLING_PLAY');
    const response = stateFor(playAction().state).publicView!;
    expect(
      cardAction(response, response.responseWindow!.priorityPlayerId!, action),
    ).toBeNull();
  });
  it('rejects foreign or stale projections and never updates stats on acknowledgements', () => {
    const state = { ...stateFor(), pendingCommandId: 'command_1' };
    expect(
      receiveRoomMessage(
        state,
        {
          type: 'PRIVATE_STATE',
          view: projectPrivatePlayer(core, playerIdSchema.parse('player_1')),
        },
        core.roomId,
        'player_0',
      ),
    ).toBe(state);
    const ack = receiveRoomMessage(
      state,
      {
        type: 'COMMAND_ACCEPTED',
        commandId: commandIdSchema.parse('command_1'),
        stateVersion: core.version,
      },
      core.roomId,
      'player_0',
    );
    expect(ack.publicView).toBe(state.publicView);
    expect(ack.status).toBe('resyncing');
    const older = {
      ...state.publicView!,
      version: stateVersionSchema.parse(0),
    };
    expect(
      receiveRoomMessage(
        state,
        { type: 'PUBLIC_STATE', view: older },
        core.roomId,
        'player_0',
      ),
    ).toBe(state);
    const rejected = receiveRoomMessage(
      state,
      {
        type: 'COMMAND_REJECTED',
        commandId: commandIdSchema.parse('command_1'),
        stateVersion: core.version,
        code: 'VERSION_CONFLICT',
      },
      core.roomId,
      'player_0',
    );
    expect(rejected.status).toBe('resyncing');
    expect(rejected.error).toContain('table changed');
    expect(rejectionText('NOT_ALLOWED', 'NOT_ACTIVE_PLAYER')).toBe(
      'Wait for your turn.',
    );
    expect(phaseName(null)).toBe('Waiting');
  });
});

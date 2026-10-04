import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { GameTable } from '../../src/client/GameTable';
import { initialRoomState } from '../../src/client/room-state';
import { samplePresentation } from '../../src/content/sample-presentation';
import {
  projectPublicGame,
  projectPrivatePlayer,
} from '../../src/protocol/projections';
import { genericState, putCard, send } from '../fixtures/generic-match';

it('names the phase opportunity and sends the authoritative Sometimes PLAY_CARD and prompt identity', async () => {
  const state = genericState();
  state.phase = 'ORDER_DRINK';
  const id = putCard(state, 0, [{ op: 'ORDER_EXTRA_DRINKS', count: 2 }], {
    phaseOpportunity: 'ORDER_DRINK',
  });
  const pending = send(
    state,
    'ORDER_DRINK',
    { targetPlayerId: state.players[1]!.id },
    0,
  ).state;
  const privateView = projectPrivatePlayer(pending, pending.players[0]!.id);
  const presentation = {
    ...samplePresentation,
    cards: [
      ...samplePresentation.cards,
      {
        ...samplePresentation.cards.find(
          (c) => c.id === 'carddef_sample_breather',
        )!,
        id: state.cards[id]!.definitionId,
        name: 'Original extra orders',
        type: 'SOMETIMES' as const,
      },
    ],
  };
  const sendIntent = vi.fn();
  render(
    <GameTable
      state={{
        ...initialRoomState,
        status: 'synced',
        publicView: projectPublicGame(pending),
        privateView,
      }}
      presentation={presentation}
      playerId={pending.players[0]!.id}
      send={sendIntent}
      reconnect={vi.fn()}
    />,
  );
  expect(screen.getByText('Additional Drink ordering')).toBeVisible();
  expect(screen.queryByText('Empty Drink pile')).toBeNull();
  await userEvent.click(
    screen.getByRole('button', {
      name: 'Play Original extra orders',
    }),
  );
  expect(sendIntent).toHaveBeenCalledWith('PLAY_CARD', {
    cardId: id,
    promptId: pending.control.timedPrompt!.promptId,
  });
});

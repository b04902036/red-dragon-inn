import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { GameTable } from '../../src/client/GameTable';
import { initialRoomState } from '../../src/client/room-state';
import { LocaleProvider } from '../../src/client/i18n/LocaleProvider';
import {
  projectPrivatePlayer,
  projectPublicGame,
} from '../../src/protocol/projections';
import { samplePresentation } from '../../src/content/sample-presentation';
import { mutable, started } from '../fixtures/core-match';
import type { CoreGameState } from '../../src/engine/types';

function show(game: CoreGameState, seat = 0, send = vi.fn()) {
  return render(
    <LocaleProvider>
      <GameTable
        state={{
          ...initialRoomState,
          status: 'synced',
          publicView: projectPublicGame(game),
          privateView: projectPrivatePlayer(game, game.players[seat]!.id),
        }}
        presentation={samplePresentation}
        playerId={game.players[seat]!.id}
        send={send}
        reconnect={vi.fn()}
      />
    </LocaleProvider>,
  );
}
it.each(['en-US', 'zh-TW'])(
  'accessible %s discard selection requests replacement definitions without submitting a hand or deck',
  async (locale) => {
    localStorage.setItem('rdi:locale', locale);
    const game = mutable(started());
    game.rules.devCardSelection = true;
    const send = vi.fn();
    show(game, 0, send);
    const id = game.players[0]!.hand[0]!;
    const card = document.querySelector(`[data-card-id="${id}"] .card-body`)!;
    (card as HTMLElement).focus();
    await userEvent.keyboard(' ');
    const picker = screen.getByRole('region', {
      name:
        locale === 'zh-TW' ? '開發模式：指定牌' : 'Development: choose cards',
    });
    const select = within(picker).getByRole('combobox');
    const option = within(select).getAllByRole(
      'option',
    )[1] as HTMLOptionElement;
    await userEvent.selectOptions(select, option.value);
    await userEvent.click(within(picker).getByRole('button'));
    expect(send).toHaveBeenCalledWith('DEV_DISCARD_DRAW', {
      cardIds: [id],
      definitionIds: [option.value],
    });
  },
);
it('normal rooms and inactive players never show development controls', () => {
  const game = mutable(started());
  const ui = show(game);
  expect(
    screen.queryByText('Development: choose cards'),
  ).not.toBeInTheDocument();
  ui.unmount();
  game.rules.devCardSelection = true;
  show(game, 1);
  expect(
    screen.queryByText('Development: choose cards'),
  ).not.toBeInTheDocument();
});
it('chooses Drink Events and a living opponent, and sends only the validated intent', async () => {
  const game = mutable(started());
  game.rules.devCardSelection = true;
  game.phase = 'ORDER_DRINK';
  const send = vi.fn();
  show(game, 0, send);
  const picker = screen.getByRole('region', {
    name: 'Development: choose cards',
  });
  const event = projectPrivatePlayer(
    game,
    game.players[0]!.id,
  ).devChoices!.innCards.find(
    (choice) => game.definitions[choice.definitionId]!.type === 'DRINK_EVENT',
  )!;
  await userEvent.selectOptions(
    within(picker).getByLabelText('Chosen Drink or Drink Event'),
    event.definitionId,
  );
  const recipients = within(picker).getByLabelText('Give chosen Drink to');
  expect(
    within(recipients).queryByRole('option', {
      name: game.players[0]!.displayName,
    }),
  ).not.toBeInTheDocument();
  expect(within(picker).getByRole('button')).toBeDisabled();
  await userEvent.selectOptions(recipients, game.players[1]!.id);
  await userEvent.click(within(picker).getByRole('button'));
  expect(send).toHaveBeenCalledWith('DEV_ORDER_DRINK', {
    definitionId: event.definitionId,
    targetPlayerId: game.players[1]!.id,
  });
});

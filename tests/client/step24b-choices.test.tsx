import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameTable } from '../../src/client/GameTable';
import { LocaleProvider } from '../../src/client/i18n/LocaleProvider';
import { LOCALE_STORAGE_KEY } from '../../src/client/i18n/preference';
import { initialRoomState } from '../../src/client/room-state';
import { samplePresentation } from '../../src/content/sample-presentation';
import {
  projectPrivatePlayer,
  projectPublicGame,
} from '../../src/protocol/projections';
import { responseWindowIdSchema } from '../../src/shared/ids';
import { started } from '../fixtures/core-match';

it.each([
  [
    'en-US',
    'Accept the challenge',
    'Decline the challenge',
    'Drink it all',
    'Confirm choice',
  ],
  ['zh-TW', '接受挑戰', '拒絕挑戰', '自己喝完', '確認選擇'],
] as const)(
  'generic Drink choices are accessible and localized in %s and submit only the chosen intent',
  async (locale, accept, decline, keep, confirm) => {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    const game = started(1, 7);
    const playerId = game.players[0]!.id;
    const privateView = projectPrivatePlayer(game, playerId);
    privateView.pendingChoice = {
      responseWindowId: responseWindowIdSchema.parse('window_step24b_choice'),
      kind: 'OPTION',
      options: [
        { id: 'ACCEPT', label: 'Accept' },
        { id: 'DECLINE', label: 'Decline' },
        { id: 'KEEP', label: 'Drink it all' },
      ],
      min: 1,
      max: 1,
    };
    const send = vi.fn();
    render(
      <LocaleProvider>
        <GameTable
          state={{
            ...initialRoomState,
            status: 'synced',
            publicView: projectPublicGame(game),
            privateView,
          }}
          presentation={samplePresentation}
          playerId={playerId}
          send={send}
          reconnect={vi.fn()}
        />
      </LocaleProvider>,
    );
    expect(screen.getByLabelText(accept)).toBeVisible();
    expect(screen.getByLabelText(decline)).toBeVisible();
    expect(screen.getByLabelText(keep)).toBeVisible();
    const user = userEvent.setup();
    await user.click(screen.getByLabelText(decline));
    await user.click(screen.getByRole('button', { name: confirm }));
    expect(send).toHaveBeenCalledWith('CHOOSE_OPTION', {
      responseWindowId: 'window_step24b_choice',
      optionId: 'DECLINE',
    });
  },
);

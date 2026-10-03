import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect, vi } from 'vitest';
import App from '../../src/client/App';
import {
  LocaleProvider,
  LanguageSelector,
} from '../../src/client/i18n/LocaleProvider';
import {
  preferredLocale,
  LOCALE_STORAGE_KEY,
} from '../../src/client/i18n/preference';
import { GameTable } from '../../src/client/GameTable';
import { initialRoomState } from '../../src/client/room-state';
import {
  projectPublicGame,
  projectPrivatePlayer,
} from '../../src/protocol/projections';
import { playerIdSchema } from '../../src/shared/ids';
import { contentPresentation } from '../../src/content/presentation';
import { localizedFixturePack } from '../../src/content/fixture-localized';
import { started } from '../fixtures/core-match';
import { playAction } from '../fixtures/timing-match';
import { startRound } from '../fixtures/gambling-match';
import { drinkState, takeDrink } from '../fixtures/drink-match';
it.each(['fizz', 'toast'])(
  'renders canonical Chinese Drink/Chaser and Drink Event terminology for %s resolution',
  (suffix) => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'zh-TW');
    const game = takeDrink(drinkState([suffix])).queued.state;
    render(
      <LocaleProvider>
        <GameTable
          state={{
            ...initialRoomState,
            status: 'synced',
            publicView: projectPublicGame(game),
            privateView: projectPrivatePlayer(
              game,
              playerIdSchema.parse('player_0'),
            ),
          }}
          presentation={contentPresentation(
            localizedFixturePack,
            true,
            'zh-TW',
          )}
          playerId="player_0"
          send={vi.fn()}
          reconnect={vi.fn()}
        />
      </LocaleProvider>,
    );
    expect(screen.getByRole('region', { name: '遊戲牌桌' })).toBeVisible();
    expect(document.body.textContent).toContain(
      suffix === 'toast' ? '酒卡事件' : '續杯',
    );
    expect(document.body.textContent).not.toMatch(
      /Drink Event|Chaser|追酒|追飲/,
    );
  },
);

it('defaults to English, detects zh-TW, preserves an explicit choice and handles unavailable storage', () => {
  expect(preferredLocale({ getItem: () => null }, 'en-US')).toBe('en-US');
  expect(preferredLocale({ getItem: () => null }, 'zh-TW-x')).toBe('zh-TW');
  expect(preferredLocale({ getItem: () => null }, 'zh-CN')).toBe('en-US');
  expect(preferredLocale({ getItem: () => 'en-US' }, 'zh-TW')).toBe('en-US');
  expect(preferredLocale({ getItem: () => 'invalid' }, 'zh-TW')).toBe('zh-TW');
  expect(
    preferredLocale(
      {
        getItem: () => {
          throw new Error('Blocked');
        },
      },
      'zh-TW',
    ),
  ).toBe('zh-TW');
});
it('renders Traditional Chinese landing and accessibility text on a zh-TW browser and persists language selection', async () => {
  vi.spyOn(navigator, 'language', 'get').mockReturnValue('zh-TW');
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ ok: true, service: 'red-dragon-inn' }),
      ),
  );
  const user = userEvent.setup();
  const view = render(<App />);
  expect(screen.getByRole('heading', { name: '紅龍酒館' })).toBeVisible();
  expect(screen.getByLabelText('你的名字')).toBeVisible();
  expect(screen.getByRole('button', { name: '建立房間' })).toBeVisible();
  await user.selectOptions(screen.getByLabelText('語言'), 'en-US');
  expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en-US');
  expect(document.documentElement.lang).toBe('en-US');
  view.unmount();
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Red Dragon Inn' })).toBeVisible();
  vi.restoreAllMocks();
});
it.each(['turn', 'response', 'gambling', 'winner'] as const)(
  'localizes the %s table including accessibility, card inspection and glossary stats',
  async (mode) => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'zh-TW');
    const user = userEvent.setup();
    const game =
      mode === 'response'
        ? playAction().state
        : mode === 'gambling'
          ? startRound().state
          : started(1, 7);
    const publicView = projectPublicGame(game);
    if (mode === 'winner') {
      publicView.lifecycle = 'FINISHED';
      publicView.winners = [publicView.players[0]!.id];
    }
    const state = {
      ...initialRoomState,
      status: 'synced' as const,
      publicView,
      privateView: projectPrivatePlayer(game, playerIdSchema.parse('player_0')),
    };
    render(
      <LocaleProvider>
        <LanguageSelector />
        <GameTable
          state={state}
          presentation={contentPresentation(
            localizedFixturePack,
            true,
            'zh-TW',
          )}
          playerId="player_0"
          send={vi.fn()}
          reconnect={vi.fn()}
        />
      </LocaleProvider>,
    );
    expect(screen.getByRole('region', { name: '遊戲牌桌' })).toBeVisible();
    expect(screen.getAllByText('耐力值')).toHaveLength(4);
    expect(screen.getAllByText('酒精值')).toHaveLength(4);
    expect(screen.getAllByText('金幣').length).toBeGreaterThan(3);
    if (mode === 'turn') {
      expect(
        screen.getByRole('heading', { name: '棄牌抽牌階段' }),
      ).toBeVisible();
      await user.hover(
        screen.getAllByRole('checkbox', { name: '棄掉示範友善推擠' })[0]!,
      );
      expect(
        within(screen.getByRole('region', { name: '卡牌詳情' })).getByRole(
          'button',
          {
            name: '關閉卡牌詳情',
          },
        ),
      ).toBeVisible();
      expect(
        screen.getByRole('region', { name: '卡牌詳情' }),
      ).toHaveTextContent('耐力值');
    }
    if (mode === 'response')
      expect(screen.getByRole('heading', { name: '回應時機' })).toBeVisible();
    if (mode === 'gambling')
      expect(screen.getByRole('heading', { name: '賭博回合' })).toBeVisible();
    if (mode === 'winner')
      expect(screen.getByText(/Sample player 0.*獲勝/)).toBeVisible();
    expect(document.body.textContent).not.toMatch(
      /红|龙|馆|币|弃|饮|畅|赌|权|续|阶|时|选择|确认|连接/,
    );
  },
);

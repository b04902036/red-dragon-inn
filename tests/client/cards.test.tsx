import {
  act,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect, vi } from 'vitest';
import { HandCard } from '../../src/client/cards/HandCard';
import { CardPreview } from '../../src/client/cards/CardPreview';
import { useCardSelection } from '../../src/client/cards/useCardSelection';
import { useCardPreview } from '../../src/client/cards/useCardPreview';
import { GameTable } from '../../src/client/GameTable';
import { initialRoomState } from '../../src/client/room-state';
import { contentPresentation } from '../../src/content/presentation';
import { localizedFixturePack } from '../../src/content/fixture-localized';
import {
  projectPublicGame,
  projectPrivatePlayer,
} from '../../src/protocol/projections';
import { playerIdSchema, responseWindowIdSchema } from '../../src/shared/ids';
import { started } from '../fixtures/core-match';
import { LocaleProvider } from '../../src/client/i18n/LocaleProvider';
const presentation = contentPresentation(localizedFixturePack, true),
  definitions = presentation.cards.slice(0, 3);
function Harness({
  disabled = false,
  eligible = ['a', 'b', 'c'],
  max = 3,
  readonly = false,
  onAction = () => {},
  action = 'Play',
}: {
  disabled?: boolean;
  eligible?: string[];
  max?: number;
  readonly?: boolean;
  onAction?: () => void;
  action?: string;
}) {
  const selection = useCardSelection(eligible, max),
    preview = useCardPreview();
  return (
    <>
      {definitions.map((definition, index) => {
        const id = ['a', 'b', 'c'][index]!;
        return (
          <HandCard
            key={id}
            id={id}
            definition={definition}
            selectable={!readonly}
            disabled={disabled}
            selected={selection.selected.includes(id)}
            onToggle={selection.toggle}
            onPreview={preview.show}
            onLeave={preview.hide}
            onInspect={preview.pin}
            onClosePreview={preview.close}
          >
            <button onClick={onAction}>
              {action} {definition.name}
            </button>
          </HandCard>
        );
      })}
      <button onClick={selection.clear}>Clear selection</button>
      <CardPreview
        card={definitions.find((card) => card.id === preview.id)}
        onClose={preview.close}
        onEngage={() => preview.pin(preview.id!)}
      />
    </>
  );
}
it('selects/deselects the whole card and title, and keeps aria-checked, visible checkmark and styling in agreement', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  const card = screen.getAllByRole('checkbox')[0]!,
    article = card.closest('article')!;
  await user.click(article);
  expect(card).toBeChecked();
  expect(article).toHaveClass('selected-card');
  expect(within(article).getByText('✓ Selected')).toBeVisible();
  await user.click(within(card).getByRole('heading'));
  expect(card).not.toBeChecked();
  expect(article).not.toHaveClass('selected-card');
  await user.click(within(card).getByText('ACTION'));
  expect(card).toBeChecked();
  await user.click(screen.getByRole('button', { name: 'Clear selection' }));
  expect(card).not.toBeChecked();
});
it.each(['busy', 'ineligible', 'readonly'] as const)(
  'blocks selection when %s',
  async (mode) => {
    const user = userEvent.setup();
    render(
      <Harness
        disabled={mode === 'busy'}
        eligible={mode === 'ineligible' ? ['b', 'c'] : undefined}
        readonly={mode === 'readonly'}
      />,
    );
    const body =
      mode === 'readonly'
        ? screen.getAllByRole('group')[0]!
        : screen.getAllByRole('checkbox')[0]!;
    await user.click(body);
    await user.keyboard(' ');
    expect(body.closest('article')).not.toHaveClass('selected-card');
    if (mode === 'busy') expect(body).toHaveAttribute('aria-disabled', 'true');
  },
);
it('enforces maximum selections and lets a selected card be deselected to free a slot', async () => {
  const user = userEvent.setup();
  render(<Harness max={1} />);
  const cards = screen.getAllByRole('checkbox');
  await user.click(cards[0]!);
  await user.click(cards[1]!);
  expect(cards[0]).toBeChecked();
  expect(cards[1]).not.toBeChecked();
  await user.click(cards[0]!);
  await user.click(cards[1]!);
  expect(cards[1]).toBeChecked();
});
it.each(['Play', 'Respond', 'Take control'])(
  '%s embedded control never toggles card selection, including keyboard activation',
  async (action) => {
    const user = userEvent.setup(),
      callback = vi.fn();
    render(<Harness action={action} onAction={callback} />);
    const body = screen.getAllByRole('checkbox')[0]!,
      button = screen.getByRole('button', {
        name: `${action} ${definitions[0]!.name}`,
      });
    await user.click(button);
    expect(body).not.toBeChecked();
    await user.keyboard(' ');
    expect(body).not.toBeChecked();
    expect(callback).toHaveBeenCalledTimes(2);
  },
);
it('Space and Enter toggle selected state while focus shows details and Escape closes without moving focus', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  const body = screen.getAllByRole('checkbox')[0]!;
  act(() => body.focus());
  expect(
    screen.getByRole('region', { name: 'Card details' }),
  ).toHaveTextContent(definitions[0]!.rulesText);
  await user.keyboard(' ');
  expect(body).toBeChecked();
  await user.keyboard('{Enter}');
  expect(body).not.toBeChecked();
  await user.keyboard('{Escape}');
  expect(
    screen.queryByRole('region', { name: 'Card details' }),
  ).not.toBeInTheDocument();
  expect(body).toHaveFocus();
});
it('hover previews without clicks, moves between definitions, and clears on pointer leave', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  const cards = screen.getAllByRole('checkbox');
  await user.hover(cards[0]!);
  expect(
    within(screen.getByRole('region', { name: 'Card details' })).getByRole(
      'heading',
    ),
  ).toHaveTextContent(definitions[0]!.name);
  await user.hover(cards[1]!);
  expect(
    within(screen.getByRole('region', { name: 'Card details' })).getByRole(
      'heading',
    ),
  ).toHaveTextContent(definitions[1]!.name);
  await user.unhover(cards[1]!);
  await waitFor(() =>
    expect(
      screen.queryByRole('region', { name: 'Card details' }),
    ).not.toBeInTheDocument(),
  );
  expect(
    screen.queryByRole('button', { name: /^Read / }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('shows details when the card appears under a stationary pointer and only pointer movement is delivered', () => {
  render(<Harness />);
  const card = screen.getAllByRole('checkbox')[0]!;
  fireEvent.pointerMove(card, { pointerType: 'mouse' });
  expect(
    screen.getByRole('region', { name: 'Card details' }),
  ).toHaveTextContent(definitions[0]!.name);
  fireEvent.pointerMove(card, { pointerType: 'mouse' });
  expect(screen.getAllByRole('region', { name: 'Card details' })).toHaveLength(
    1,
  );
});
it('allows moving into the preview to read rules, then dismissing with Escape', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  const card = screen.getAllByRole('checkbox')[0]!;
  await user.hover(card);
  const region = screen.getByRole('region', { name: 'Card details' });
  await user.hover(region);
  await new Promise((resolve) => setTimeout(resolve, 120));
  expect(region).toBeVisible();
  act(() => region.focus());
  await user.keyboard('{ArrowDown}');
  expect(region).toHaveFocus();
  expect(region).toHaveTextContent(definitions[0]!.rulesText);
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
});
it('cancels stale leave timers on another card, the same card and unmount', () => {
  vi.useFakeTimers();
  const { unmount } = render(<Harness />);
  const cards = screen.getAllByRole('checkbox');
  fireEvent.pointerEnter(cards[0]!);
  fireEvent.pointerLeave(cards[0]!);
  fireEvent.pointerEnter(cards[1]!);
  act(() => vi.advanceTimersByTime(101));
  expect(screen.getByRole('region')).toHaveTextContent(definitions[1]!.name);
  fireEvent.pointerLeave(cards[1]!);
  fireEvent.pointerEnter(cards[1]!);
  act(() => vi.advanceTimersByTime(101));
  expect(screen.getByRole('region')).toHaveTextContent(definitions[1]!.name);
  fireEvent.pointerLeave(cards[1]!);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
});
it('focus/blur clean up previews, moving within the same card preserves preview, and touch inspection pins without selecting', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  const body = screen.getAllByRole('checkbox')[0]!,
    article = body.closest('article')!;
  act(() => body.focus());
  fireEvent.pointerLeave(article);
  expect(screen.getByRole('region', { name: 'Card details' })).toBeVisible();
  await user.tab();
  expect(screen.getByRole('region', { name: 'Card details' })).toBeVisible();
  await user.click(
    screen.getByRole('button', { name: `Details: ${definitions[0]!.name}` }),
  );
  expect(body).not.toBeChecked();
  fireEvent.pointerLeave(article);
  await user.click(screen.getByRole('button', { name: 'Clear selection' }));
  expect(screen.getByRole('region', { name: 'Card details' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Close card details' }));
  expect(
    screen.queryByRole('region', { name: 'Card details' }),
  ).not.toBeInTheDocument();
});
it('a delayed leave never closes a pinned preview or a newer card preview', () => {
  vi.useFakeTimers();
  render(<Harness />);
  const first = screen.getAllByRole('checkbox')[0]!,
    second = screen.getAllByRole('checkbox')[1]!;
  fireEvent.click(
    screen.getByRole('button', { name: `Details: ${definitions[0]!.name}` }),
  );
  fireEvent.pointerLeave(first);
  act(() => vi.advanceTimersByTime(101));
  expect(screen.getByRole('region')).toHaveTextContent(definitions[0]!.name);
  fireEvent.pointerEnter(second);
  fireEvent.pointerLeave(first);
  act(() => vi.advanceTimersByTime(101));
  expect(screen.getByRole('region')).toHaveTextContent(definitions[1]!.name);
  vi.useRealTimers();
});
it('does not open automatic hover details for touch and supports intentional readonly keyboard inspection', async () => {
  const user = userEvent.setup();
  render(<Harness readonly />);
  const body = screen.getAllByRole('group')[0]!,
    article = body.closest('article')!;
  fireEvent.pointerEnter(article, { pointerType: 'touch' });
  expect(
    screen.queryByRole('region', { name: 'Card details' }),
  ).not.toBeInTheDocument();
  act(() => body.focus());
  await user.keyboard('{Enter}');
  await user.tab();
  await user.tab();
  expect(screen.getByRole('region', { name: 'Card details' })).toBeVisible();
});
it('renders localized previews and selection cues without relying on animation', async () => {
  localStorage.setItem('rdi:locale', 'zh-TW');
  const user = userEvent.setup(),
    card = contentPresentation(localizedFixturePack, true, 'zh-TW').cards[0]!,
    toggle = vi.fn();
  render(
    <LocaleProvider>
      <HandCard
        id="a"
        definition={card}
        selectable
        selected
        onToggle={toggle}
        onPreview={() => {}}
        onLeave={() => {}}
        onInspect={() => {}}
        onClosePreview={() => {}}
      />
      <CardPreview card={card} onClose={() => {}} />
    </LocaleProvider>,
  );
  const checkbox = screen.getByRole('checkbox', { name: '棄掉示範友善推擠' });
  expect(checkbox).toBeChecked();
  expect(screen.getByText('✓ 已選擇')).toBeVisible();
  expect(screen.getByRole('region', { name: '卡牌詳情' })).toHaveTextContent(
    '耐力值',
  );
  await user.click(checkbox);
  expect(toggle).toHaveBeenCalledWith('a');
});
it('uses whole-card private choice metadata, enforces min/max and submits only projected physical card IDs', async () => {
  const game = started(1, 7),
    privateView = projectPrivatePlayer(game, playerIdSchema.parse('player_0'));
  privateView.pendingChoice = {
    responseWindowId: responseWindowIdSchema.parse('window_card_choice'),
    kind: 'CARD',
    options: privateView.hand
      .slice(0, 2)
      .map((card) => ({ id: card.id, label: 'Canonical hidden choice' })),
    min: 1,
    max: 1,
  };
  const send = vi.fn(),
    user = userEvent.setup();
  render(
    <GameTable
      state={{
        ...initialRoomState,
        status: 'synced',
        publicView: projectPublicGame(game),
        privateView,
      }}
      presentation={presentation}
      playerId="player_0"
      send={send}
      reconnect={() => {}}
    />,
  );
  const dialog = screen.getByRole('dialog'),
    cards = within(dialog).getAllByRole('checkbox');
  expect(
    within(dialog).getByRole('button', { name: 'Confirm choice' }),
  ).toBeDisabled();
  await user.click(cards[0]!.closest('article')!);
  expect(cards[0]).toBeChecked();
  expect(cards[1]).toHaveAttribute('aria-disabled', 'true');
  await user.click(cards[1]!);
  expect(cards[1]).not.toBeChecked();
  await user.click(
    within(dialog).getByRole('button', { name: 'Confirm choice' }),
  );
  expect(send).toHaveBeenCalledWith('CHOOSE_CARDS', {
    responseWindowId: privateView.pendingChoice.responseWindowId,
    cardIds: [privateView.hand[0]!.id],
  });
});

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { GameTable } from '../../src/client/GameTable';
import { initialRoomState } from '../../src/client/room-state';
import {
  projectPrivatePlayer,
  projectPublicGame,
} from '../../src/protocol/projections';
import { samplePresentation } from '../../src/content/sample-presentation';
import { contentPresentation } from '../../src/content/presentation';
import { localizedFixturePack } from '../../src/content/fixture-localized';
import { LocaleProvider } from '../../src/client/i18n/LocaleProvider';
import { LOCALE_STORAGE_KEY } from '../../src/client/i18n/preference';
import {
  actionState,
  cardInHand,
  playAction,
  priorityFor,
} from '../fixtures/timing-match';
import { accepted, intent, mutable, started } from '../fixtures/core-match';
import { reversedPendingStat } from '../fixtures/legal-play-match';
import { startRound } from '../fixtures/gambling-match';
import { DEFAULT_RULES } from '../../src/engine/rules';
import { applyCommand, applyTimeout } from '../../src/engine/commands';
import { synchronizePrompt } from '../../src/engine/timed-prompts';
import type { CoreGameState } from '../../src/engine/types';
import type { RoomClientState } from '../../src/client/room-state';
function stateFor(game: CoreGameState, seat = 0): RoomClientState {
  return {
    ...initialRoomState,
    status: 'synced',
    publicView: projectPublicGame(game),
    privateView: projectPrivatePlayer(game, game.players[seat]!.id),
  };
}
function table(
  state: RoomClientState,
  send = vi.fn(),
  presentation = samplePresentation,
) {
  return (
    <GameTable
      state={state}
      playerId={state.privateView!.playerId}
      presentation={presentation}
      send={send}
      reconnect={vi.fn()}
    />
  );
}
function card(id: string) {
  return document.querySelector<HTMLElement>(`[data-card-id="${id}"]`)!;
}
it('marks only the active player’s Action and legal Anytime, with a visible badge and accessible description', () => {
  const game = actionState();
  const state = stateFor(game);
  const ui = render(table(state));
  const action = card(cardInHand(game, 0, 'shove'));
  expect(action).toHaveAttribute('data-playable', 'true');
  expect(within(action).getByText('▶ Playable')).toBeVisible();
  expect(action.querySelector('.card-body')).toHaveAttribute(
    'aria-description',
    'Playable',
  );
  expect(card(cardInHand(game, 0, 'ignore'))).toHaveAttribute(
    'data-playable',
    'false',
  );
  ui.rerender(table(stateFor(game, 1)));
  expect(card(cardInHand(game, 1, 'shove'))).toHaveAttribute(
    'data-playable',
    'false',
  );
  expect(card(cardInHand(game, 1, 'breather'))).toHaveAttribute(
    'data-playable',
    'true',
  );
  expect(
    screen.queryByRole('button', { name: /Play Sample Friendly Shove/ }),
  ).toBeNull();
});
it('triggered Sometimes highlights only for current priority and unrelated cards stay ordinary', () => {
  const initial = playAction().state;
  const ui = render(table(stateFor(initial)));
  expect(card(cardInHand(initial, 0, 'ignore'))).toHaveAttribute(
    'data-playable',
    'false',
  );
  const state = priorityFor(initial, 1);
  ui.rerender(table(stateFor(state, 1)));
  expect(card(cardInHand(state, 1, 'ignore'))).toHaveAttribute(
    'data-playable',
    'true',
  );
  expect(card(cardInHand(state, 1, 'shove'))).toHaveAttribute(
    'data-playable',
    'false',
  );
  expect(screen.getByRole('button', { name: 'Pass response' })).toBeEnabled();
});
it('clears stale highlights immediately on public reset, then marks the newly legal card when private state arrives', () => {
  const { before, after, lossCardId, gainCardId } = reversedPendingStat();
  const old = stateFor(before),
    next = stateFor(after);
  const ui = render(table(old));
  expect(card(lossCardId)).toHaveAttribute('data-playable', 'true');
  expect(card(gainCardId)).toHaveAttribute('data-playable', 'false');
  ui.rerender(table({ ...old, publicView: next.publicView }));
  expect(document.querySelectorAll('[data-playable="true"]')).toHaveLength(0);
  expect(screen.queryByRole('button', { name: /^Respond with / })).toBeNull();
  ui.rerender(table(next));
  expect(card(lossCardId)).toHaveAttribute('data-playable', 'false');
  expect(card(gainCardId)).toHaveAttribute('data-playable', 'true');
});
it('gambling and Winning-Hand-like category restrictions expose only current authorized controls', () => {
  const game = mutable(startRound().state);
  const actor = game.players.find(
    (p) => p.id === game.gambling!.priorityPlayerId,
  )!;
  const ui = render(table(stateFor(game, actor.seat)));
  expect(card(cardInHand(game, actor.seat, 'cheat'))).toHaveAttribute(
    'data-playable',
    'true',
  );
  expect(card(cardInHand(game, actor.seat, 'breather'))).toHaveAttribute(
    'data-playable',
    'true',
  );
  game.gambling!.allowedControlCategories = ['GAMBLING'];
  ui.rerender(table(stateFor(game, actor.seat)));
  expect(card(cardInHand(game, actor.seat, 'cheat'))).toHaveAttribute(
    'data-playable',
    'false',
  );
  expect(card(cardInHand(game, actor.seat, 'gamble'))).toHaveAttribute(
    'data-playable',
    'true',
  );
});
it('target picker contains only server-valid targets and submits a validated intent', async () => {
  const game = actionState();
  const id = cardInHand(game, 0, 'shove');
  for (const player of game.players)
    player.special.resources.tokens = { value: 0, visibility: 'PUBLIC' };
  delete game.players[2]!.special.resources.tokens;
  game.definitions[game.cards[id]!.definitionId]!.effects = [
    {
      op: 'CUSTOM',
      effect_key: 'core.adjust-resource',
      target: 'CHOSEN_PLAYER',
      params: { resource: 'tokens', delta: 1 },
    },
  ];
  const send = vi.fn();
  render(table(stateFor(game), send));
  await userEvent.click(
    within(card(id)).getByRole('button', { name: /^Play / }),
  );
  const modal = screen.getByRole('dialog');
  expect(
    within(modal).queryByRole('button', { name: 'Sample player 2' }),
  ).toBeNull();
  expect(
    within(modal).getByRole('button', { name: 'Sample player 3' }),
  ).toBeVisible();
  await userEvent.click(
    within(modal).getByRole('button', { name: 'Sample player 1' }),
  );
  expect(send).toHaveBeenCalledWith('PLAY_CARD', {
    cardId: id,
    targetPlayerId: 'player_1',
  });
  const [type, fields] = send.mock.calls[0]!;
  expect(
    applyCommand(
      game,
      intent(game, type as string, fields as Record<string, unknown>),
      { actorId: game.players[0]!.id },
    ).status,
  ).toBe('ACCEPTED');
});
it('target selection closes on a newer public version and cannot submit a stale target', async () => {
  const game = actionState(),
    state = stateFor(game),
    send = vi.fn();
  const ui = render(table(state, send));
  await userEvent.click(
    within(card(cardInHand(game, 0, 'shove'))).getByRole('button', {
      name: /^Play /,
    }),
  );
  expect(screen.getByRole('dialog')).toBeVisible();
  const next = playAction(game).state;
  ui.rerender(table({ ...state, publicView: projectPublicGame(next) }, send));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(send).not.toHaveBeenCalled();
});
it.each(['en-US', 'zh-TW'] as const)(
  'localizes the playable cue in %s and restores it after reconnect',
  (locale) => {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    const game = started(1, 7),
      state = stateFor(game),
      presentation = contentPresentation(localizedFixturePack, true, locale);
    const show = (state: RoomClientState) => (
      <LocaleProvider>{table(state, vi.fn(), presentation)}</LocaleProvider>
    );
    const ui = render(show(state));
    expect(
      within(card(cardInHand(game, 0, 'breather'))).getByText(
        locale === 'en-US' ? '▶ Playable' : '▶ 可出牌',
      ),
    ).toBeVisible();
    ui.rerender(show({ ...state, status: 'reconnecting' }));
    expect(document.querySelectorAll('[data-playable="true"]')).toHaveLength(0);
    ui.rerender(
      show(stateFor(JSON.parse(JSON.stringify(game)) as CoreGameState)),
    );
    expect(card(cardInHand(game, 0, 'breather'))).toHaveAttribute(
      'data-playable',
      'true',
    );
  },
);
it('discard selection and playable styling coexist; keyboard Play never toggles the selection', async () => {
  const game = started(1, 7),
    send = vi.fn();
  render(table(stateFor(game), send));
  const element = card(cardInHand(game, 0, 'breather'));
  const body = within(element).getByRole('checkbox');
  expect(body).toHaveAttribute('aria-description', 'Playable');
  body.focus();
  await userEvent.keyboard(' ');
  expect(element).toHaveClass('selected-card', 'playable-card');
  expect(within(element).getByText('✓ Selected')).toBeVisible();
  const button = within(element).getByRole('button', { name: /^Play / });
  button.focus();
  await userEvent.keyboard('{Enter}');
  expect(body).toBeChecked();
  expect(send).toHaveBeenCalledWith('PLAY_CARD', {
    cardId: cardInHand(game, 0, 'breather'),
  });
});
it('phase-end highlights only the eligible holder; timeout removes that holder’s old plays', () => {
  const input = mutable(started(1, 7));
  input.rules.timing = { ...DEFAULT_RULES.timing };
  const game = accepted(input, 'DISCARD', { cardIds: [] }).state;
  const ui = render(table(stateFor(game)));
  expect(document.querySelectorAll('[data-playable="true"]')).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Pass Anytime' })).toBeEnabled();
  ui.rerender(table(stateFor(game, 1)));
  expect(document.querySelectorAll('[data-playable="true"]')).toHaveLength(0);
  const result = applyTimeout(game, {
    ...intent(game, 'EXPIRE_PROMPT'),
    promptId: game.control.timedPrompt!.promptId,
    now: game.control.timedPrompt!.deadlineAt,
  });
  if (result.status !== 'ACCEPTED') throw new Error('expiry rejected');
  ui.rerender(table(stateFor(result.state)));
  expect(document.querySelectorAll('[data-playable="true"]')).toHaveLength(0);
});
it('a card button cannot authorize a forged client-supplied list or wrong server target', () => {
  const game = actionState();
  const id = cardInHand(game, 1, 'shove');
  expect(
    applyCommand(
      game,
      intent(game, 'PLAY_CARD', {
        cardId: id,
        targetPlayerId: 'player_0',
        legalPlays: [{ cardId: id, commandType: 'PLAY_CARD' }],
      }),
      { actorId: game.players[1]!.id },
    ).status,
  ).toBe('REJECTED');
  const response = mutable(playAction().state);
  response.rules.timing = { ...DEFAULT_RULES.timing };
  synchronizePrompt(response, 1000, () => {});
  const state = stateFor(response);
  state.privateView!.legalPlays[0]!.promptId = 'prompt_stale';
  render(table(state));
  expect(card(state.privateView!.legalPlays[0]!.cardId)).toHaveAttribute(
    'data-playable',
    'false',
  );
});

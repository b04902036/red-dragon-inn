import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { GameTable } from '../../src/client/GameTable';
import { initialRoomState } from '../../src/client/room-state';
import {
  AudioProvider,
  AudioControls,
} from '../../src/client/audio/AudioProvider';
import { LocaleProvider } from '../../src/client/i18n/LocaleProvider';
import { contentPresentation } from '../../src/content/presentation';
import {
  projectPrivatePlayer,
  projectPublicGame,
} from '../../src/protocol/projections';
import { rdi1Pack } from '../fixtures/rdi1-content';
import {
  rdi1Match,
  rdi1SometimesContext,
  rdi1Keep,
  rdi1Play,
  rdi1Card,
  rdi1Activate,
  rdi1Until,
} from '../fixtures/rdi1-match';
import type { CoreGameState } from '../../src/engine/types';

// This suite checks response voice/highlight behavior. Web Audio decoding and
// seamless looping are exercised separately in buffered-music and browser tests.
vi.mock('../../src/client/audio/buffered-music', () => ({
  BufferedMusic: class {
    constructor(path: string) {
      return new Audio(path);
    }
  },
}));

const presentation = contentPresentation(rdi1Pack, false);
for (const definition of rdi1Pack.cards.filter((c) => c.type === 'SOMETIMES')) {
  it(`${definition.id}: real server highlight, owner-aware prompt, MP3 once, fresh prompt and reconnect deduplication`, async () => {
    sessionStorage.clear();
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    const { state, cardId, seat } = rdi1SometimesContext(rdi1Pack, definition);
    const playerId = state.players[seat]!.id;
    const view = projectPrivatePlayer(state, playerId);
    const calls: string[] = [];
    vi.stubGlobal(
      'Audio',
      class extends EventTarget {
        loop = false;
        volume = 1;
        currentTime = 0;
        constructor(readonly path: string) {
          super();
        }
        play() {
          calls.push(this.path);
          return Promise.resolve();
        }
        pause() {}
      },
    );
    const tree = (game: CoreGameState, suppress = false) => (
      <LocaleProvider>
        <AudioProvider>
          <AudioControls />
          <GameTable
            state={{
              ...initialRoomState,
              status: 'synced',
              publicView: projectPublicGame(game),
              privateView: suppress
                ? { ...view, responsePrompt: null }
                : projectPrivatePlayer(game, playerId),
            }}
            presentation={presentation}
            playerId={playerId}
            send={vi.fn()}
            reconnect={vi.fn()}
          />
        </AudioProvider>
      </LocaleProvider>
    );
    const ui = render(tree(state, true));
    await userEvent.click(screen.getByText('Sound', { exact: true }));
    ui.rerender(tree(state));
    const card = document.querySelector(`[data-card-id="${cardId}"]`)!;
    expect(card).toHaveAttribute('data-playable', 'true');
    expect(within(card as HTMLElement).getByText('▶ Playable')).toBeVisible();
    await waitFor(() =>
      expect(
        calls.filter((p) => p.endsWith('sometimes-response.mp3')),
      ).toHaveLength(1),
    );
    if (view.responsePrompt!.deadlineAt === null) {
      expect(screen.queryByRole('timer')).not.toBeInTheDocument();
      expect(screen.getByRole('note')).toHaveTextContent('no time limit');
    } else expect(screen.getByRole('timer')).toHaveTextContent('30');
    ui.rerender(tree(structuredClone(state)));
    expect(
      calls.filter((p) => p.endsWith('sometimes-response.mp3')),
    ).toHaveLength(1);
    const played = rdi1Play(state, cardId).state;
    ui.rerender(tree(played));
    expect(document.querySelector(`[data-card-id="${cardId}"]`)).toBeNull();
    ui.unmount();
    render(tree(state));
    await userEvent.click(screen.getByText('Sound', { exact: true }));
    expect(
      calls.filter((p) => p.endsWith('sometimes-response.mp3')),
    ).toHaveLength(1);
  });
}
for (const definition of rdi1Pack.cards.filter((c) => c.type === 'ANYTIME')) {
  it(`${definition.id}: server-projected Anytime-only response highlights without Sometimes voice`, async () => {
    sessionStorage.clear();
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    const state = rdi1Match(rdi1Pack);
    const cardId = Object.values(state.cards).find(
      (c) => c.definitionId === definition.id,
    )!.id;
    const seat = state.players.findIndex((p) => p.hand.includes(cardId));
    const source = rdi1Card(state, 'damage_two', seat);
    rdi1Keep(state, [source, cardId]);
    rdi1Activate(state, source);
    const pending = rdi1Until(
      rdi1Play(state, source, state.players[seat]!.id).state,
      (s) => s.responseWindow?.priorityPlayerId === state.players[seat]!.id,
    );
    const calls: string[] = [];
    vi.stubGlobal(
      'Audio',
      class extends EventTarget {
        loop = false;
        volume = 1;
        currentTime = 0;
        constructor(readonly path: string) {
          super();
        }
        play() {
          calls.push(this.path);
          return Promise.resolve();
        }
        pause() {}
      },
    );
    const view = projectPrivatePlayer(pending, pending.players[seat]!.id);
    expect(view.responsePrompt?.hasLegalSometimes).toBe(false);
    const tree = (active: boolean) => (
      <AudioProvider>
        <AudioControls />
        <GameTable
          state={{
            ...initialRoomState,
            status: 'synced',
            publicView: projectPublicGame(pending),
            privateView: active ? view : { ...view, responsePrompt: null },
          }}
          presentation={presentation}
          playerId={view.playerId}
          send={vi.fn()}
          reconnect={vi.fn()}
        />
      </AudioProvider>
    );
    const ui = render(tree(false));
    await userEvent.click(screen.getByText('Sound', { exact: true }));
    ui.rerender(tree(true));
    expect(
      document.querySelector(`[data-card-id="${cardId}"]`),
    ).toHaveAttribute('data-playable', 'true');
    if (view.responsePrompt!.deadlineAt === null) {
      expect(screen.queryByRole('timer')).not.toBeInTheDocument();
      expect(screen.getByRole('note')).toHaveTextContent('no time limit');
    } else expect(screen.getByRole('timer')).toHaveTextContent('30');
    expect(calls.filter((p) => p.endsWith('sometimes-response.mp3'))).toEqual(
      [],
    );
  });
}

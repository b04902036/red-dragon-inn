import { render, waitFor, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect, vi } from 'vitest';
import {
  AudioProvider,
  AudioControls,
} from '../../src/client/audio/AudioProvider';
import { useAttentionChime } from '../../src/client/audio/use-attention-chime';
import { projectPublicGame } from '../../src/protocol/projections';
import type { PublicGameView } from '../../src/protocol/views';
import { playAction, actionState, passWindow } from '../fixtures/timing-match';
import { startRound } from '../fixtures/gambling-match';
function Probe({ view, player }: { view: PublicGameView; player: string }) {
  useAttentionChime(view, player);
  return null;
}
it.each(['RESPONSE', 'CHOICE', 'GAMBLING'] as const)(
  'chimes once for the authoritative local %s prompt and never for a remote owner',
  async (kind) => {
    const play = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      'Audio',
      class {
        loop = false;
        volume = 0;
        currentTime = 0;
        play = play;
        pause = vi.fn();
        addEventListener = vi.fn();
        removeEventListener = vi.fn();
      },
    );
    const state =
      kind === 'RESPONSE'
        ? playAction().state
        : kind === 'GAMBLING'
          ? startRound().state
          : passWindow(
              playAction(
                actionState([
                  {
                    op: 'OPEN_OPTION',
                    target: 'SELF',
                    options: [{ id: 'yes', label: 'Yes' }],
                  },
                ]),
                null,
              ).state,
            ).state;
    const view = projectPublicGame(state),
      player = view.attention!.playerId;
    const tree = (value: PublicGameView, owner: string = player) => (
      <AudioProvider>
        <AudioControls />
        <Probe view={value} player={owner} />
      </AudioProvider>
    );
    const rendered = render(tree({ ...view, attention: null }));
    const user = userEvent.setup();
    await user.click(screen.getByText('Sound', { exact: true }));
    await user.click(screen.getByRole('button', { name: 'Enable sound' }));
    expect(play).toHaveBeenCalledTimes(1);
    rendered.rerender(tree(view, 'remote'));
    expect(play).toHaveBeenCalledTimes(1);
    rendered.rerender(tree(view));
    await waitFor(() => expect(play).toHaveBeenCalledTimes(2));
    rendered.rerender(tree({ ...view }));
    expect(play).toHaveBeenCalledTimes(2);
  },
);

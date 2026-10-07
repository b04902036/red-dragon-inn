import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PresentationDirector } from '../../src/client/PresentationDirector';
import { PresentationZone } from '../../src/client/PresentationZone';
import { GameTable, PlayerPanel } from '../../src/client/GameTable';
import { initialRoomState } from '../../src/client/room-state';
import { publicNarrationEventSchema } from '../../src/protocol/public-narration';
import {
  projectPublicGame,
  projectPrivatePlayer,
} from '../../src/protocol/projections';
import { samplePresentation } from '../../src/content/sample-presentation';
import { playAction, priorityFor } from '../fixtures/timing-match';
import { genericState } from '../fixtures/generic-match';
import type { CoreGameState } from '../../src/engine/types';
import { started } from '../fixtures/core-match';
const game = started(1, 7);
const view = projectPublicGame(game);
const event = (
  sequence: number,
  type: 'CHARACTER_CARDS_DRAWN' | 'DRINK_DEALT' = 'CHARACTER_CARDS_DRAWN',
) =>
  publicNarrationEventSchema.parse({
    type,
    id: `${view.matchId}:${sequence}`,
    matchId: view.matchId,
    sequence,
    stateVersion: 1,
    eventIndex: 0,
    resolutionId: null,
    parentId: null,
    playerId: 'player_0',
    count: 3,
  });
afterEach(() => vi.useRealTimers());
describe('presentation queue stays independent of gameplay', () => {
  it('ignores HISTORY, deduplicates LIVE, serializes events, and supports skip and fast-forward', () => {
    vi.useFakeTimers();
    const director = new PresentationDirector();
    director.start();
    director.ingest([event(1)], []);
    expect(director.getSnapshot().event).toBeNull();
    director.ingest(
      [event(1), event(2), event(3, 'DRINK_DEALT')],
      [event(2).id, event(3).id],
    );
    expect(director.getSnapshot().event?.id).toBe(event(2).id);
    expect(director.getSnapshot().queued).toBe(1);
    director.ingest(
      [event(1), event(2), event(3, 'DRINK_DEALT')],
      [event(2).id, event(3).id],
    );
    director.skip();
    expect(director.getSnapshot().event?.id).toBe(event(3).id);
    director.toggleFast();
    vi.advanceTimersByTime(100);
    expect(director.getSnapshot().event).toBeNull();
    director.pause();
  });
  it('reduced motion preserves event information and pause/resume retains an active beat for React StrictMode', () => {
    vi.useFakeTimers();
    const director = new PresentationDirector();
    director.setReducedMotion(true);
    director.start();
    director.ingest([event(1)], [event(1).id]);
    director.pause();
    vi.advanceTimersByTime(1000);
    expect(director.getSnapshot().event).toEqual(event(1));
    director.start();
    expect(director.getSnapshot().reducedMotion).toBe(true);
    vi.advanceTimersByTime(250);
    expect(director.getSnapshot().event).toBeNull();
    director.pause();
  });
  it('card-back-only draw presentation contains count and no hidden definition', () => {
    render(
      <PresentationZone
        snapshot={{
          event: event(1),
          queued: 0,
          fast: false,
          reducedMotion: true,
        }}
        history={[event(1)]}
        view={view}
        presentation={samplePresentation}
        skip={() => {}}
        toggleFast={() => {}}
      />,
    );
    expect(
      screen.getByText('Sample player 0 drew 3 character cards (hidden).'),
    ).toBeVisible();
    expect(
      document.querySelector('.presentation-card-backs'),
    ).toHaveTextContent('3');
    expect(document.querySelector('.presentation-zone')).toHaveClass(
      'reduced-motion',
    );
    expect(document.querySelector('.presentation-chain')).toBeNull();
  });
  it('HUD shows authoritative values, counts, knockout relation, and only an explicitly LIVE delta', () => {
    const stat = publicNarrationEventSchema.parse({
      type: 'STAT_CHANGED',
      id: `${view.matchId}:2`,
      matchId: view.matchId,
      sequence: 2,
      stateVersion: 2,
      eventIndex: 0,
      resolutionId: null,
      parentId: null,
      playerId: 'player_0',
      stat: 'FORTITUDE',
      before: 20,
      after: 18,
      delta: -2,
    });
    const player = { ...view.players[0]!, fortitude: 18, alcoholContent: 18 };
    const { rerender } = render(
      <PlayerPanel
        player={player}
        characterName="Deirdre"
        own
        active
        connected
        presentationEvent={stat}
      />,
    );
    const panel = screen.getByRole('article');
    expect(within(panel).getByText('-2 Fortitude')).toBeVisible();
    expect(
      within(panel).getByText('Alcohol ≥ Fortitude: passed out'),
    ).toBeVisible();
    expect(within(panel).getAllByText('18')).toHaveLength(2);
    expect(within(panel).getByText('Hand: 7')).toBeVisible();
    rerender(
      <PlayerPanel
        player={player}
        characterName="Deirdre"
        own
        active
        connected
      />,
    );
    expect(within(panel).queryByText('-2 Fortitude')).toBeNull();
  });
  it('30-second server response countdown and legal command stay immediately available during an active animation', () => {
    let state: CoreGameState = genericState();
    state = playAction(state, state.players[1]!.id).state;
    state = priorityFor(state, 1);
    const actor = state.players[1]!.id;
    expect(
      state.control.timedPrompt!.deadlineAt! -
        state.control.timedPrompt!.openedAt,
    ).toBe(30000);
    const send = vi.fn();
    const publicView = projectPublicGame(state);
    render(
      <GameTable
        state={{
          ...initialRoomState,
          status: 'synced',
          publicView,
          privateView: projectPrivatePlayer(state, actor),
          log: [event(1)],
          liveEventIds: [event(1).id],
        }}
        presentation={samplePresentation}
        playerId={actor}
        send={send}
        reconnect={() => {}}
      />,
    );
    expect(
      document.querySelector('[data-presentation-active="true"]'),
    ).not.toBeNull();
    expect(screen.getByRole('timer')).toHaveAttribute(
      'data-prompt-id',
      state.control.timedPrompt!.promptId,
    );
    const pass = screen.getByRole('button', {
      name: 'Pass response',
    });
    expect(pass).toBeEnabled();
    pass.click();
    expect(send).toHaveBeenCalledWith(
      'PASS_RESPONSE',
      expect.objectContaining({
        promptId: state.control.timedPrompt!.promptId,
      }),
    );
  });
});

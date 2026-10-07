import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  initialRoomState,
  receiveRoomMessage,
} from '../../src/client/room-state';
import { PublicTimelineLog } from '../../src/client/PublicTimelineLog';
import { PresentationZone } from '../../src/client/PresentationZone';
import { timelineText, timelineDepth } from '../../src/client/timeline-text';
import { publicNarrationEventSchema } from '../../src/protocol/public-narration';
import { projectPublicGame } from '../../src/protocol/projections';
import { samplePresentation } from '../../src/content/sample-presentation';
import { started } from '../fixtures/core-match';
import { NarrationMatch } from '../fixtures/public-narration-match';
import { publicContestMatch } from '../fixtures/public-contest-match';
import { contentPresentation } from '../../src/content/presentation';
import { combinedPack } from '../fixtures/rdi2-content';
import { genericState, putCard, legal } from '../fixtures/generic-match';

const view = projectPublicGame(started(1, 7));
const draw = (sequence: number) =>
  publicNarrationEventSchema.parse({
    type: 'CHARACTER_CARDS_DRAWN',
    id: `${view.matchId}:${sequence}`,
    matchId: view.matchId,
    sequence,
    stateVersion: 1,
    eventIndex: sequence - 1,
    resolutionId: null,
    parentId: null,
    playerId: 'player_1',
    count: 3,
  });
const receive = (
  state: typeof initialRoomState,
  events: ReturnType<typeof draw>[],
  mode: 'LIVE' | 'HISTORY',
) =>
  receiveRoomMessage(
    state,
    {
      type: 'PUBLIC_TIMELINE',
      matchId: view.matchId!,
      firstSequence: events[0]!.sequence,
      lastSequence: events.at(-1)!.sequence,
      events,
      mode,
    },
    view.roomId,
    'player_0',
  );
describe('full public log and history isolation', () => {
  it('shows every real contest round, Chaser, participant score, exact tie-break and payout in both locales', () => {
    const match = publicContestMatch();
    const view = projectPublicGame(match.state);
    for (const locale of ['en-US', 'zh-TW'] as const) {
      const presentation = contentPresentation(combinedPack, false, locale);
      const lines = match.narration.map((event) =>
        timelineText(event, match.narration, view, presentation, locale),
      );
      expect(lines.every((text) => !text.match(/\{[a-zA-Z]+\}/))).toBe(true);
      const rounds = match.narration.filter(
        (event) => event.type === 'CONTEST_ROUND_STARTED',
      );
      expect(rounds.map((event) => event.round)).toEqual([1, 2]);
      const results = match.narration.filter(
        (event) => event.type === 'CONTEST_RESULT',
      );
      expect(results[0]!.scores.map((score) => score.score)).toEqual([
        3, 3, 1, 0,
      ]);
      expect(results[0]!.winnerIds).toEqual([
        view.players[0]!.id,
        view.players[1]!.id,
      ]);
      expect(results[1]!.winnerIds).toEqual([view.players[0]!.id]);
      const resultLines = results.map((event) =>
        timelineText(event, match.narration, view, presentation, locale),
      );
      expect(resultLines[0]).toContain(locale === 'en-US' ? 'Tie:' : '平手：');
      expect(resultLines[1]).toContain(
        locale === 'en-US' ? 'Winner:' : '獲勝者：',
      );
      expect(
        lines.some((text) =>
          text.includes(locale === 'en-US' ? 'has a Chaser' : '有續杯'),
        ),
      ).toBe(true);
      expect(
        match.narration.filter((event) => event.type === 'PAYMENT_SETTLED'),
      ).toHaveLength(3);
      expect(view.players.map((player) => player.gold)).toEqual([13, 9, 9, 9]);
    }
  });
  it('keeps 150 ordered events, deduplicates HISTORY and LIVE, and never derives history from state snapshots', () => {
    let state: typeof initialRoomState = {
      ...initialRoomState,
      publicView: view,
    };
    for (let first = 1; first <= 150; first += 50)
      state = receive(
        state,
        Array.from({ length: 50 }, (_, i) => draw(first + i)),
        'HISTORY',
      );
    expect(state.log).toHaveLength(150);
    expect(state.liveEventIds).toEqual([]);
    const replay = receive(state, [draw(150)], 'LIVE');
    expect(replay).toBe(state);
    state = receive(state, [draw(151)], 'LIVE');
    expect(state.liveEventIds).toEqual([draw(151).id]);
    state = receive(state, [draw(151)], 'HISTORY');
    expect(state.log).toHaveLength(151);
    const updated = receiveRoomMessage(
      state,
      {
        type: 'PUBLIC_STATE',
        view: {
          ...view,
          version: 2 as typeof view.version,
          players: view.players.map((player) => ({ ...player, fortitude: 10 })),
        },
      },
      view.roomId,
      'player_0',
    );
    expect(updated.log).toEqual(state.log);
    expect(updated.publicView!.players[0]!.fortitude).toBe(10);
  });
  it('renders the whole log and keeps an upward scroll position until the user chooses new events', () => {
    let state = receive(
      { ...initialRoomState, publicView: view },
      Array.from({ length: 30 }, (_, i) => draw(i + 1)),
      'HISTORY',
    );
    const { rerender } = render(
      <PublicTimelineLog state={state} presentation={samplePresentation} />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(30);
    const region = screen.getByRole('region', { name: 'Table log' });
    Object.defineProperties(region, {
      scrollHeight: { configurable: true, value: 2000 },
      clientHeight: { configurable: true, value: 300 },
    });
    region.scrollTop = 100;
    fireEvent.scroll(region);
    state = receive(state, [draw(31)], 'LIVE');
    rerender(
      <PublicTimelineLog state={state} presentation={samplePresentation} />,
    );
    expect(region.scrollTop).toBe(100);
    act(() =>
      screen
        .getByRole('button', { name: 'New events — jump to latest' })
        .click(),
    );
    expect(region.scrollTop).toBe(2000);
    expect(within(region).getAllByRole('listitem')).toHaveLength(31);
  });
  it('localizes a real three-level Negate chain and actual stat changes without inferring final-state effects', () => {
    const game = genericState();
    game.publicNarrationVersion = 1;
    const a = putCard(
      game,
      0,
      [
        {
          op: 'CHANGE_STAT',
          target: 'CHOSEN_PLAYER',
          stat: 'FORTITUDE',
          delta: -2,
        },
      ],
      { type: 'ACTION' },
    );
    const b = putCard(game, 1, [{ op: 'NEGATE', scope: 'TOP_STACK' }], {
      trigger: {
        event: 'CARD',
        alternatives: [[{ kind: 'SOURCE_TYPE', types: ['ACTION'] }]],
      },
    });
    const c = putCard(game, 2, [{ op: 'NEGATE', scope: 'TOP_STACK' }], {
      trigger: {
        event: 'CARD',
        alternatives: [[{ kind: 'SOURCE_TYPE', types: ['SOMETIMES'] }]],
      },
    });
    const match = new NarrationMatch(game);
    match.play(0, a, 'player_1');
    match.until((state) => !!legal(state, 1, b));
    match.play(1, b);
    match.until((state) => !!legal(state, 2, c));
    match.play(2, c);
    match.settle();
    const plays = match.narration.filter(
      (event) => event.type === 'CARD_PLAYED',
    );
    expect(plays.map((event) => timelineDepth(event, match.narration))).toEqual(
      [0, 1, 2],
    );
    const publicView = projectPublicGame(match.state);
    const { rerender } = render(
      <PresentationZone
        snapshot={{
          event: plays[2]!,
          queued: 2,
          fast: false,
          reducedMotion: false,
        }}
        history={match.narration}
        view={publicView}
        presentation={samplePresentation}
        skip={() => {}}
        toggleFast={() => {}}
      />,
    );
    expect(document.querySelectorAll('.presentation-chain')).toHaveLength(3);
    expect(
      document.querySelector('.presentation-chain li li li'),
    ).not.toBeNull();
    const canceled = match.narration.find(
      (event) =>
        event.type === 'RESOLUTION_COMPLETED' &&
        event.resolutionId === plays[1]!.resolutionId,
    )!;
    rerender(
      <PresentationZone
        snapshot={{
          event: canceled,
          queued: 1,
          fast: false,
          reducedMotion: true,
        }}
        history={match.narration}
        view={publicView}
        presentation={samplePresentation}
        skip={() => {}}
        toggleFast={() => {}}
      />,
    );
    expect(document.querySelector('[data-canceled="true"]')).toHaveTextContent(
      'Negated',
    );
    const en = match.narration.map((event) =>
      timelineText(
        event,
        match.narration,
        publicView,
        samplePresentation,
        'en-US',
      ),
    );
    const zh = match.narration.map((event) =>
      timelineText(
        event,
        match.narration,
        publicView,
        samplePresentation,
        'zh-TW',
      ),
    );
    expect(en.some((text) => text.includes('Negates'))).toBe(true);
    expect(en.some((text) => text.includes('20 → 18 (-2)'))).toBe(true);
    expect(zh.some((text) => text.includes('取消'))).toBe(true);
    for (const text of [...en, ...zh])
      expect(text).not.toMatch(/\{[a-zA-Z]+\}/);
  });
});

import { expect, it } from 'vitest';
import { applyCommand } from '../../src/engine/commands';
import { coreStateSchema, replayFromSnapshot } from '../../src/engine/replay';
import {
  projectPrivatePlayer,
  projectPublicGame,
} from '../../src/protocol/projections';
import { intent, mutable } from '../fixtures/core-match';
import {
  anytimeSystemEvents,
  anytimeSystemOpportunity,
} from '../fixtures/anytime-system';
import {
  genericState,
  send,
  play,
  legal,
  until,
  reconnectAndReplay,
} from '../fixtures/generic-match';

it.each(anytimeSystemEvents)(
  'Anytime without any Sometimes is legal at %s, private and silent',
  (event) => {
    const { state, first } = anytimeSystemOpportunity(event);
    const player = state.players[1]!;
    expect(
      player.hand.every(
        (id) =>
          state.definitions[state.cards[id]!.definitionId]!.type === 'ANYTIME',
      ),
    ).toBe(true);
    const view = projectPrivatePlayer(state, player.id);
    expect(view.legalPlays.find((p) => p.cardId === first)?.commandType).toBe(
      'PLAY_RESPONSE',
    );
    expect(view.responsePrompt?.hasLegalSometimes).toBe(false);
    expect(JSON.stringify(projectPublicGame(state))).not.toContain(first);
    expect(
      JSON.stringify(projectPrivatePlayer(state, state.players[2]!.id)),
    ).not.toContain(first);
    const restored = coreStateSchema.parse(
      JSON.parse(JSON.stringify(state)) as unknown,
    );
    expect(projectPrivatePlayer(restored, player.id)).toEqual(view);
    reconnectAndReplay(state);
    const result = play(state, 1, first);
    expect(result.status).toBe('ACCEPTED');
    expect(result.state.control.timedPrompt?.promptId).not.toBe(
      view.responsePrompt!.promptId,
    );
  },
);

it.each(anytimeSystemEvents)(
  'Anytime at %s refreshes legality/windows, rejects stale inputs and replays exactly',
  (event) => {
    const { state, first, second } = anytimeSystemOpportunity(event, true);
    const old = state.control.timedPrompt!;
    const parent = state.resolutionStack.at(-1)!.id;
    const now = old.openedAt + 100;
    const command = intent(state, 'PLAY_RESPONSE', {
      cardId: first,
      responseWindowId: old.windowId,
      promptId: old.promptId,
    });
    const played = send(
      state,
      'PLAY_RESPONSE',
      {
        cardId: first,
        responseWindowId: old.windowId,
        promptId: old.promptId,
      },
      1,
      now,
    );
    expect(
      replayFromSnapshot(state, 0, [
        {
          actorId: state.players[1]!.id,
          command,
          firstSequence: 1,
          lastSequence: played.events.length,
          events: played.events,
          acceptedAt: new Date(now).toISOString(),
          clockTime: now,
        },
      ]).state,
    ).toEqual(played.state);
    const refreshed = until(
      played.state,
      (s) => s.resolutionStack.at(-1)?.id === parent,
    );
    expect(refreshed.players[1]!.fortitude).toBe(
      state.players[1]!.fortitude + 1,
    );
    expect(legal(refreshed, 1, first)).toBeUndefined();
    expect(legal(refreshed, 1, second)).toBeDefined();
    const fresh = refreshed.control.timedPrompt!;
    expect(fresh.windowId).not.toBe(old.windowId);
    expect(fresh.promptId).not.toBe(old.promptId);
    expect(fresh.openedAt).toBe(now);
    expect(
      projectPrivatePlayer(refreshed, state.players[1]!.id).responsePrompt
        ?.hasLegalSometimes,
    ).toBe(false);
    for (const fields of [
      { responseWindowId: old.windowId, promptId: fresh.promptId },
      { responseWindowId: fresh.windowId, promptId: old.promptId },
    ])
      expect(
        applyCommand(
          refreshed,
          intent(refreshed, 'PLAY_RESPONSE', { cardId: second, ...fields }),
          {
            actorId: state.players[1]!.id,
            clock: { now: () => now + 1 },
          },
        ),
      ).toMatchObject({ status: 'REJECTED', code: 'WRONG_WINDOW', events: [] });
    reconnectAndReplay(refreshed);
  },
);

it('re-evaluates effect eligibility after an Anytime changes the system responder state', () => {
  const fixture = anytimeSystemOpportunity('PAYMENT_REQUIRED', true);
  const state = mutable(fixture.state);
  const player = state.players[1]!;
  state.definitions[state.cards[fixture.first]!.definitionId]!.effects = [
    { op: 'CHANGE_STAT', target: 'SELF', stat: 'GOLD', delta: 1 },
  ];
  state.definitions[
    state.cards[fixture.second]!.definitionId
  ]!.mandatoryGoldCost = player.gold + 1;
  expect(legal(state, 1, fixture.second)).toBeUndefined();
  const parent = state.resolutionStack.at(-1)!.id;
  const played = play(state, 1, fixture.first).state;
  const refreshed = until(
    played,
    (s) => s.resolutionStack.at(-1)?.id === parent,
  );
  expect(refreshed.players[1]!.gold).toBe(player.gold + 1);
  expect(legal(refreshed, 1, fixture.second)).toBeDefined();
  expect(refreshed.control.timedPrompt?.promptId).not.toBe(
    state.control.timedPrompt!.promptId,
  );
  expect(
    projectPrivatePlayer(refreshed, player.id).responsePrompt
      ?.hasLegalSometimes,
  ).toBe(false);
});

it('Anytime alone never creates a phase Sometimes opportunity and retains 15-second phase-end grace', () => {
  const state = genericState();
  state.phase = 'ORDER_DRINK';
  const ordered = send(
    state,
    'ORDER_DRINK',
    { targetPlayerId: state.players[1]!.id },
    0,
  ).state;
  expect(ordered.resolutionStack).toEqual([]);
  expect(ordered.control.timedPrompt?.kind).toBe('PHASE_END_ANYTIME');
  expect(
    ordered.control.timedPrompt!.deadlineAt -
      ordered.control.timedPrompt!.openedAt,
  ).toBe(15000);
  expect(
    projectPrivatePlayer(ordered, ordered.control.timedPrompt!.priorityPlayerId)
      .responsePrompt?.hasLegalSometimes,
  ).toBe(false);
});

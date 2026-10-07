import { expect, it } from 'vitest';
import { combinedPack } from '../fixtures/rdi2-content';
import {
  selectedMatch,
  definitionCard,
  keep,
  drinkPile,
  send,
  until,
  play,
} from '../fixtures/rdi2-match';
import { projectPrivatePlayer } from '../../src/protocol/projections';
import { applyCommand } from '../../src/engine/commands';
import { intent } from '../fixtures/core-match';

it.each(['DISCARD_DRAW', 'ACTION', 'ORDER_DRINK', 'DRINK'] as const)(
  '%s has its own full 15s off-turn Anytime grace in a mixed production match',
  (phase) => {
    const state = selectedMatch(combinedPack, ['rdi1-deirdre', 'rdi2-gog']);
    const anytime = definitionCard(state, 'carddef_rdi2_gog_tip_wench');
    keep(state, [anytime]);
    state.rules.handSize = 1;
    state.phase = phase;
    if (phase === 'DRINK') drinkPile(state, 0, ['water']);
    const next = send(
      state,
      0,
      phase === 'DISCARD_DRAW'
        ? 'DISCARD'
        : phase === 'ACTION'
          ? 'SKIP_ACTION'
          : phase === 'ORDER_DRINK'
            ? 'ORDER_DRINK'
            : 'TAKE_DRINK',
      phase === 'DISCARD_DRAW'
        ? { cardIds: [] }
        : phase === 'ORDER_DRINK'
          ? { targetPlayerId: state.players[1]!.id }
          : {},
      5000,
    ).state;
    const grace = until(next, (s) => s.control.phaseEnd !== null);
    expect(grace.control.phaseEnd?.phase).toBe(phase);
    const prompt = grace.control.timedPrompt!;
    expect(prompt.kind).toBe('PHASE_END_ANYTIME');
    expect(prompt.deadlineAt).toBe(prompt.openedAt + 15000);
    const view = projectPrivatePlayer(grace, grace.players[1]!.id);
    expect(view.responsePrompt?.hasLegalSometimes).toBe(false);
    expect(view.legalPlays.some((p) => p.cardId === anytime)).toBe(true);
    const old = intent(grace, 'PASS_ANYTIME', {
      responseWindowId: grace.control.phaseEnd!.id,
      promptId: prompt.promptId,
    });
    const played = play(
      grace,
      anytime,
      grace.players[1]!.id,
      prompt.openedAt + 100,
    );
    expect(played.state.control.timedPrompt?.promptId).not.toBe(
      prompt.promptId,
    );
    expect(
      applyCommand(
        played.state,
        { ...old, expectedVersion: played.state.version },
        { actorId: grace.players[1]!.id },
      ),
    ).toMatchObject({ status: 'REJECTED', events: [] });
  },
);

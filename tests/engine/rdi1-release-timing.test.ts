import { expect, it } from 'vitest';
import { projectPrivatePlayer } from '../../src/protocol/projections';
import { rdi1Pack } from '../fixtures/rdi1-content';
import {
  rdi1Match,
  rdi1Keep,
  rdi1Play,
  rdi1Pass,
  rdi1Send,
  rdi1Until,
  rdi1Settle,
  rdi1DrinkPile,
} from '../fixtures/rdi1-match';
import type { CoreGameState } from '../../src/engine/types';

function card(state: CoreGameState, seat: number, mechanic: string) {
  const id = state.players[seat]!.hand.find((id) =>
    state.cards[id]!.definitionId.endsWith(`_${mechanic}`),
  );
  if (!id) throw new Error(`Missing RDI1 mechanic ${seat}/${mechanic}`);
  return id;
}

it.each(['DISCARD_DRAW', 'ACTION', 'ORDER_DRINK', 'DRINK'] as const)(
  '%s ends with an untimed owner Anytime opportunity in the real RDI1 edition',
  (phase) => {
    const state = rdi1Match(rdi1Pack);
    const anytime = card(state, 0, 'gain_two_fortitude');
    rdi1Keep(state, [anytime]);
    state.rules.handSize = 1;
    state.phase = phase;
    if (phase === 'DRINK') rdi1DrinkPile(state, 0, ['wine']);
    const next = rdi1Send(
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
    ).state;
    const grace = rdi1Until(next, (s) => s.control.phaseEnd !== null);
    expect(grace.control.phaseEnd?.phase).toBe(phase);
    const prompt = grace.control.timedPrompt!;
    expect(prompt.kind).toBe('PHASE_END_ANYTIME');
    expect(prompt.deadlineAt).toBeNull();
    const view = projectPrivatePlayer(grace, grace.players[0]!.id);
    expect(view.responsePrompt?.hasLegalSometimes).toBe(false);
    expect(view.legalPlays.some((play) => play.cardId === anytime)).toBe(true);
    expect(
      rdi1Play(grace, anytime).state.players[0]!.characterDiscard,
    ).toContain(anytime);
  },
);

it('source owner begins without a deadline, then other eligible living seats get a full 30s', () => {
  const state = rdi1Match(rdi1Pack);
  const attack = card(state, 0, 'damage_two');
  const anytime = card(state, 0, 'gain_two_fortitude');
  const ignore = card(state, 1, 'ignore_action_sometimes_fort_loss');
  rdi1Keep(state, [attack, anytime, ignore]);
  const pending = rdi1Play(state, attack, state.players[1]!.id).state;
  expect(pending.responseWindow?.priorityPlayerId).toBe(state.players[0]!.id);
  expect(pending.control.timedPrompt!.deadlineAt).toBeNull();
  expect(
    projectPrivatePlayer(pending, state.players[0]!.id).responsePrompt
      ?.hasLegalSometimes,
  ).toBe(false);
  const passed = rdi1Pass(pending).state;
  expect(passed.responseWindow?.priorityPlayerId).toBe(state.players[1]!.id);
  expect(
    projectPrivatePlayer(passed, state.players[1]!.id).responsePrompt
      ?.hasLegalSometimes,
  ).toBe(true);
  expect(passed.responseWindow?.eligiblePlayerIds).not.toContain(
    state.players[2]!.id,
  );
  expect(passed.responseWindow?.eligiblePlayerIds).not.toContain(
    state.players[3]!.id,
  );
  expect(
    passed.control.timedPrompt!.deadlineAt! -
      passed.control.timedPrompt!.openedAt,
  ).toBe(30_000);
});

it('the original Drink revealer starts the response order, ahead of an earlier seat with Anytime', () => {
  const state = rdi1Match(rdi1Pack);
  const earlier = card(state, 0, 'gain_two_fortitude');
  const revealer = card(state, 1, 'gain_two_fortitude');
  rdi1Keep(state, [earlier, revealer]);
  state.phase = 'DRINK';
  state.activePlayerId = state.players[1]!.id;
  rdi1DrinkPile(state, 1, ['wine']);
  const pending = rdi1Send(state, 1, 'TAKE_DRINK').state;
  expect(pending.responseWindow?.priorityPlayerId).toBe(state.players[1]!.id);
  expect(rdi1Pass(pending).state.responseWindow?.priorityPlayerId).toBe(
    state.players[0]!.id,
  );
});

it('no Sometimes and no Anytime means no fake response wait', () => {
  const state = rdi1Match(rdi1Pack);
  const attack = card(state, 0, 'damage_two');
  rdi1Keep(state, [attack]);
  const done = rdi1Play(state, attack, state.players[1]!.id).state;
  expect(done.players[1]!.fortitude).toBe(18);
  expect(done.responseWindow).toBeNull();
  expect(done.control.timedPrompt).toBeNull();
});

it('real hit-back becomes legal only after damage resolves, then applies sequential retaliation', () => {
  const state = rdi1Match(rdi1Pack);
  const attack = card(state, 0, 'damage_two');
  const hitBack = card(state, 1, 'hit_back_two_after_loss');
  const anytime = card(state, 2, 'tip_wench');
  rdi1Keep(state, [attack, hitBack, anytime]);
  const pending = rdi1Play(state, attack, state.players[1]!.id).state;
  expect(pending.players[1]!.fortitude).toBe(20);
  expect(pending.responseWindow?.eligiblePlayerIds).not.toContain(
    state.players[1]!.id,
  );
  const resolved = rdi1Until(pending, (s) =>
    projectPrivatePlayer(s, s.players[1]!.id).legalPlays.some(
      (play) => play.cardId === hitBack,
    ),
  );
  expect(resolved.players[1]!.fortitude).toBe(18);
  expect(resolved.resolutionStack.at(-1)!.task?.kind).toBe('POST_LOSS');
  const final = rdi1Settle(rdi1Play(resolved, hitBack).state);
  expect(final.players[0]!.fortitude).toBe(18);
  expect(final.players[1]!.fortitude).toBe(18);
});

it.each([true, false])(
  'elimination waits for the resolved-loss last-chance Anytime (rescue: %s)',
  (rescue) => {
    const state = rdi1Match(rdi1Pack);
    const attack = card(state, 0, 'damage_two');
    const anytime = card(state, 1, 'gain_two_fortitude');
    rdi1Keep(state, [attack, anytime]);
    state.players[1]!.fortitude = 2;
    const pending = rdi1Play(state, attack, state.players[1]!.id).state;
    const resolved = rdi1Until(pending, (s) => s.players[1]!.fortitude === 0);
    expect(resolved.players[1]!.eliminated).toBe(false);
    expect(
      resolved.control.timedPrompt!.deadlineAt! -
        resolved.control.timedPrompt!.openedAt,
    ).toBe(30_000);
    const view = projectPrivatePlayer(resolved, resolved.players[1]!.id);
    expect(view.legalPlays.some((play) => play.cardId === anytime)).toBe(true);
    expect(view.responsePrompt?.hasLegalSometimes).toBe(false);
    const final = rdi1Settle(
      rescue ? rdi1Play(resolved, anytime).state : resolved,
    );
    expect(final.players[1]!.eliminated).toBe(!rescue);
    expect(final.players[1]!.fortitude).toBe(rescue ? 2 : 0);
  },
);

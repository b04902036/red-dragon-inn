import { expect, it } from 'vitest';
import { applyCommand } from '../../src/engine/commands';
import { intent } from '../fixtures/core-match';
import { cardInHand } from '../fixtures/timing-match';
import {
  genericState,
  putCard,
  play,
  until,
  legal,
  settle,
  reconnectAndReplay,
} from '../fixtures/generic-match';
import { m15Effects, m15Trigger } from '../fixtures/rdi2-m15-project';
import {
  m16Effects,
  m16Trigger,
  m16Metadata,
} from '../fixtures/rdi2-m16-source';
function pending() {
  const initial = genericState();
  const ignore = putCard(initial, 1, m15Effects, { trigger: m15Trigger });
  const counter = putCard(initial, 2, m16Effects, {
    trigger: m16Trigger,
    ...m16Metadata,
  });
  const matching = putCard(initial, 3, m16Effects, {
    trigger: m16Trigger,
    ...m16Metadata,
  });
  const unrelated = putCard(initial, 0, m16Effects, {
    suffix: 'negate',
    trigger: m16Trigger,
    counterFamily: 'test.unrelated',
  });
  const source = play(
    initial,
    0,
    cardInHand(initial, 0, 'shove'),
    initial.players[1]!.id,
  ).state;
  expect(legal(source, 2, counter)).toBeUndefined();
  const response = play(
    until(source, (s) => legal(s, 1, ignore) !== undefined),
    1,
    ignore,
  );
  const opportunity = until(
    response.state,
    (s) => legal(s, 2, counter) !== undefined,
  );
  return { initial, opportunity, counter, matching, unrelated };
}
it('M16 Negates a Sometimes Ignore for another player through shared resolution', () => {
  const f = pending();
  expect(
    settle(play(f.opportunity, 2, f.counter).state).players[1]!.fortitude,
  ).toBe(18);
});
it('equivalent protected counters interoperate while unrelated incoming counters are rejected', () => {
  const f = pending();
  const countered = play(f.opportunity, 2, f.counter).state;
  expect(legal(countered, 0, f.unrelated)).toBeUndefined();
  const rejected = applyCommand(
    countered,
    intent(countered, 'PLAY_RESPONSE', {
      cardId: f.unrelated,
      responseWindowId: countered.responseWindow!.id,
      promptId: countered.control.timedPrompt!.promptId,
    }),
    { actorId: countered.players[0]!.id },
  );
  expect(rejected.status).toBe('REJECTED');
  expect(rejected.events).toEqual([]);
  expect(rejected.state).toBe(countered);
  reconnectAndReplay(countered);
  const responding = until(
    countered,
    (s) => legal(s, 3, f.matching) !== undefined,
  );
  expect(
    settle(play(responding, 3, f.matching).state).players[1]!.fortitude,
  ).toBe(20);
});

import { expect, it } from 'vitest';
import { cardDefinitionSchema } from '../../src/content/cards';
import { applyCommand } from '../../src/engine/commands';
import { DEFAULT_RULES } from '../../src/engine/rules';
import { drinkState } from '../fixtures/drink-match';
import { intent } from '../fixtures/core-match';
import {
  putCard,
  play,
  send,
  until,
  settle,
  legal,
  reconnectAndReplay,
} from '../fixtures/generic-match';
import { m22Effects, m22Trigger } from '../fixtures/rdi2-m22-source';
function fixture(chaser = false) {
  const state = drinkState([]);
  state.rules.timing = { ...DEFAULT_RULES.timing };
  const cards = [...state.innDrinkDeck.cardIds];
  cards.forEach((id, i) => {
    const d = cardDefinitionSchema.parse({
      id: `carddef_test_m22_${i}`,
      name: 'Original synthetic passing Drink',
      rulesText: 'Synthetic numeric test.',
      source: 'TEST_FIXTURE',
      type: 'DRINK',
      effects: [],
      alcoholContent: i === 0 ? 3 : 2,
      fortitudeChange: 0,
      chaser: chaser && i === 0,
    });
    state.definitions[d.id] = d;
    state.cards[id]!.definitionId = d.id;
  });
  const pile = cards.slice(0, chaser ? 2 : 1);
  state.players[0]!.drinkPile = pile;
  state.innDrinkDeck.cardIds = cards.slice(pile.length);
  for (const id of pile)
    state.cards[id]!.location = {
      zone: 'DRINK_PILE',
      playerId: state.players[0]!.id,
    };
  const pass = putCard(state, 0, m22Effects, { trigger: m22Trigger });
  return { state, pass, pile };
}
const pending = (state: ReturnType<typeof fixture>['state'], card: string) =>
  until(
    send(state, 'TAKE_DRINK', {}, 0).state,
    (s) => legal(s, 0, card) !== undefined,
  );
it.each([false, true])(
  'passes the whole completed Drink (Chasers=%s), preserves revealer and refreshes recipient response',
  (chaser) => {
    const { state, pass, pile } = fixture(chaser);
    expect(legal(state, 0, pass)).toBeUndefined();
    let s = pending(state, pass);
    expect(s.resolutionStack.at(-1)!.sourceCardIds).toEqual(pile);
    reconnectAndReplay(s);
    s = play(s, 0, pass, state.players[1]!.id).state;
    s = until(s, (x) => x.resolutionStack.length === 1);
    expect(s.resolutionStack[0]).toMatchObject({
      actorId: state.players[0]!.id,
      drinkRecipientId: state.players[1]!.id,
    });
    const final = settle(s);
    expect(final.players[0]!.alcoholContent).toBe(
      state.players[0]!.alcoholContent,
    );
    expect(final.players[1]!.alcoholContent).toBe(
      state.players[1]!.alcoholContent + (chaser ? 5 : 3),
    );
    expect([...final.innDrinkDiscard].sort()).toEqual([...pile].sort());
  },
);
it('rejects another player using the own-Drink pass and a forged self target', () => {
  const { state, pass } = fixture();
  const other = putCard(state, 1, m22Effects, { trigger: m22Trigger });
  const s = pending(state, pass);
  expect(legal(s, 1, other)).toBeUndefined();
  expect(legal(s, 0, pass)!.legalTargetPlayerIds).not.toContain(
    state.players[0]!.id,
  );
  expect(
    applyCommand(
      s,
      intent(s, 'PLAY_RESPONSE', {
        cardId: pass,
        targetPlayerId: state.players[0]!.id,
        responseWindowId: s.responseWindow!.id,
        promptId: s.control.timedPrompt!.promptId,
      }),
      {
        actorId: state.players[0]!.id,
        clock: { now: () => s.control.timedPrompt!.openedAt },
      },
    ),
  ).toMatchObject({ status: 'REJECTED', state: s, events: [] });
});
it('lets the new recipient Ignore the passed Drink independently', () => {
  const { state, pass } = fixture();
  const ignore = putCard(
    state,
    1,
    [{ op: 'IGNORE', scope: 'CURRENT_EFFECT' }],
    { trigger: m22Trigger },
  );
  let s = pending(state, pass);
  expect(legal(s, 1, ignore)).toBeUndefined();
  s = play(s, 0, pass, state.players[1]!.id).state;
  s = until(s, (x) => legal(x, 1, ignore) !== undefined);
  const final = settle(play(s, 1, ignore).state);
  expect(final.players.map((p) => p.alcoholContent)).toEqual(
    state.players.map((p) => p.alcoholContent),
  );
});

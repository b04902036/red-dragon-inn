import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { cardDefinitionSchema } from '../../src/content/cards';
import { contentPackSchema } from '../../src/content/pack';
import type { Effect } from '../../src/content/effects';
import { createMatch } from '../../src/engine/setup';
import { applyCommand } from '../../src/engine/commands';
import { DEFAULT_RULES } from '../../src/engine/rules';
import { intent, setupInput, accepted, mutable } from '../fixtures/core-match';
import {
  genericState,
  putCard,
  play,
  settle,
  until,
  legal,
  reconnectAndReplay,
  send,
  passCurrent,
} from '../fixtures/generic-match';
const source = JSON.parse(
  readFileSync('content-private/imports/rdi2/source-candidate.json', 'utf8'),
);
const family = source.characters
  .find((c: { id: string }) => c.id === 'gog')
  .cards.find((c: { mechanicId: string }) => c.mechanicId === 'damage_two');
const effects: Effect[] = [
  { op: 'CHANGE_STAT', target: 'CHOSEN_PLAYER', stat: 'FORTITUDE', delta: -2 },
];
it('C/F: allows another player and rejects a forged self target through server validation', () => {
  const state = genericState(),
    card = putCard(state, 0, effects, { type: 'ACTION' });
  expect(legal(state, 0, card)!.commandType).toBe('PLAY_CARD');
  expect(legal(state, 0, card)!.legalTargetPlayerIds).toContain(
    state.players[1]!.id,
  );
  expect(legal(state, 0, card)!.legalTargetPlayerIds).not.toContain(
    state.players[0]!.id,
  );
  const result = applyCommand(
    state,
    intent(state, 'PLAY_CARD', {
      cardId: card,
      targetPlayerId: state.players[0]!.id,
    }),
    { actorId: state.players[0]!.id, clock: { now: () => 1000 } },
  );
  expect(result.status).toBe('REJECTED');
  if (result.status === 'REJECTED') expect(result.code).toBe('INVALID_TARGET');
  expect(result.state).toEqual(state);
});
it('F: rejects play outside owner Action phase and does not expose it as a response or Anytime card', () => {
  const action = genericState(),
    card = putCard(action, 0, effects, { type: 'ACTION' });
  const state = settle(send(action, 'SKIP_ACTION', {}, 0).state);
  expect(state.phase).toBe('ORDER_DRINK');
  expect(legal(state, 0, card)).toBeUndefined();
  const result = applyCommand(
    state,
    intent(state, 'PLAY_CARD', {
      cardId: card,
      targetPlayerId: state.players[1]!.id,
    }),
    { actorId: state.players[0]!.id, clock: { now: () => 1000 } },
  );
  expect(result.status).toBe('REJECTED');
  expect(result.state).toEqual(state);
  const other = genericState(),
    otherCard = putCard(other, 1, effects, { type: 'ACTION' });
  expect(legal(other, 1, otherCard)).toBeUndefined();
  expect(
    applyCommand(
      other,
      intent(other, 'PLAY_CARD', {
        cardId: otherCard,
        targetPlayerId: other.players[0]!.id,
      }),
      { actorId: other.players[1]!.id, clock: { now: () => 1000 } },
    ).status,
  ).toBe('REJECTED');
});
it('G/D/E/F: the real quantity expander creates five instances of one standard definition and every instance resolves identically', () => {
  const input = setupInput(1, 7),
    pack = contentPackSchema.parse(input.content),
    owner = input.players[0]!,
    deck = pack.decks.find(
      (d) => d.characterId === owner.characterId && d.type === 'CHARACTER',
    )!;
  const definition = cardDefinitionSchema.parse({
    id: 'carddef_test_m31_family',
    name: 'Original synthetic standard two-damage family',
    rulesText: 'Synthetic Action to exercise generic two-damage behavior.',
    type: 'ACTION',
    source: 'TEST_FIXTURE',
    characterId: owner.characterId,
    effects,
  });
  pack.cards.push(definition);
  pack.deckCards.push({
    deckId: deck.id,
    cardId: definition.id,
    quantity: family.quantity,
  });
  input.content = pack;
  const expanded = createMatch(input),
    copies = Object.values(expanded.cards).filter(
      (c) => c.definitionId === definition.id,
    );
  expect(copies).toHaveLength(5);
  expect(new Set(copies.map((c) => c.id)).size).toBe(5);
  expect(copies.every((c) => c.ownerId === owner.id)).toBe(true);
  expect(source.mechanics[30].engineAudit.supportedBinding).toEqual({
    effects,
  });
  const initial = accepted(accepted(expanded, 'START_MATCH').state, 'DISCARD', {
    cardIds: [],
  }).state;
  for (const copy of copies) {
    const state = mutable(initial);
    state.rules.timing = { ...DEFAULT_RULES.timing };
    const player = state.players[0]!;
    if (!player.hand.includes(copy.id)) {
      const replaced = player.hand.pop()!,
        index = player.characterDeck.cardIds.indexOf(copy.id);
      expect(index).toBeGreaterThanOrEqual(0);
      player.characterDeck.cardIds[index] = replaced;
      state.cards[replaced]!.location = {
        zone: 'CHARACTER_DECK',
        playerId: player.id,
        deckId: player.characterDeck.deckId,
      };
      player.hand.push(copy.id);
      state.cards[copy.id]!.location = { zone: 'HAND', playerId: player.id };
    }
    const played = play(state, 0, copy.id, state.players[1]!.id);
    expect(played.events.some((event) => event.type === 'GOLD_CHANGED')).toBe(
      false,
    );
    const pending = played.state;
    expect(pending.resolutionStack.at(-1)!.kind).toBe('CARD');
    expect(pending.players.map((p) => p.fortitude)).toEqual(
      state.players.map((p) => p.fortitude),
    );
    reconnectAndReplay(pending);
    let final = pending;
    for (
      let i = 0;
      i < 128 &&
      (final.responseWindow !== null || final.control.phaseEnd !== null);
      i++
    ) {
      const result = passCurrent(final);
      expect(result.events.some((event) => event.type === 'GOLD_CHANGED')).toBe(
        false,
      );
      final = result.state;
    }
    expect(final.responseWindow).toBeNull();
    expect(final.control.phaseEnd).toBeNull();
    expect(final.players.map((p) => p.fortitude)).toEqual(
      state.players.map((p, i) => p.fortitude - (i === 1 ? 2 : 0)),
    );
    expect(
      final.players.map((p) => [p.gold, p.alcoholContent, p.drinkPile]),
    ).toEqual(
      state.players.map((p) => [p.gold, p.alcoholContent, p.drinkPile]),
    );
    expect(final.innDrinkDeck).toEqual(state.innDrinkDeck);
    expect(final.players[0]!.characterDiscard).toContain(copy.id);
    expect(final.phase).toBe('ORDER_DRINK');
  }
});
it.each(['IGNORE', 'NEGATE'] as const)(
  'normal %s response prevents M31 damage without an incoming-counter restriction',
  (op) => {
    const state = genericState(),
      card = putCard(state, 0, effects, { type: 'ACTION' }),
      defense = putCard(
        state,
        1,
        [
          op === 'IGNORE'
            ? { op, scope: 'CURRENT_EFFECT' }
            : { op, scope: 'TOP_STACK' },
        ],
        {
          trigger: {
            event: 'CARD',
            alternatives: [[{ kind: 'SOURCE_TYPE', types: ['ACTION'] }]],
          },
        },
      );
    let s = until(
      play(state, 0, card, state.players[1]!.id).state,
      (x) => legal(x, 1, defense) !== undefined,
    );
    s = play(s, 1, defense).state;
    const final = settle(s);
    expect(final.players.map((p) => p.fortitude)).toEqual(
      state.players.map((p) => p.fortitude),
    );
  },
);

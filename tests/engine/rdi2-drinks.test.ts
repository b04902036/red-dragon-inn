import { expect, it } from 'vitest';
import { applyCommand } from '../../src/engine/commands';
import { rdi2Pack } from '../fixtures/rdi2-content';
import {
  match,
  keep,
  drinkPile,
  innOrder,
  send,
  settle,
  play,
  until,
  definitionCard,
} from '../fixtures/rdi2-match';
import { intent, mutable } from '../fixtures/core-match';
import { assertCoreInvariants } from '../../src/engine/invariants';
import { projectPrivatePlayer } from '../../src/protocol/projections';

for (const definition of rdi2Pack.cards.filter(
  (c) => c.type === 'DRINK' || c.type === 'DRINK_EVENT',
))
  it(`${definition.id}: positive reveal, negative timing and exact numeric/Event resolution`, () => {
    const state = match(rdi2Pack);
    keep(state, []);
    state.phase = 'DRINK';
    state.players[0]!.fortitude = 14;
    state.players[0]!.alcoholContent = 5;
    drinkPile(state, 0, [definition.id.replace('carddef_rdi2_drink_', '')]);
    const id = state.players[0]!.drinkPile[0]!;
    if (definition.type === 'DRINK_EVENT')
      innOrder(
        state,
        definition.effects[0]!.op === 'DRINKING_CONTEST'
          ? ['dragon_breath_ale', 'elven_wine', 'dark_ale', 'water']
          : ['wizards_brew', 'water'],
      );
    else if (definition.chaser) innOrder(state, ['water']);
    const negative = mutable(state);
    negative.phase = 'ACTION';
    expect(
      applyCommand(negative, intent(negative, 'TAKE_DRINK'), {
        actorId: negative.players[0]!.id,
      }),
    ).toMatchObject({ status: 'REJECTED', state: negative, events: [] });
    const result = send(state, 0, 'TAKE_DRINK');
    const final = settle(result.state);
    assertCoreInvariants(final);
    expect(final.innDrinkDiscard).toContain(id);
    if (definition.type === 'DRINK') {
      expect(final.players[0]!.alcoholContent).toBe(
        5 + definition.alcoholContent,
      );
      expect(final.players[0]!.fortitude).toBe(14 + definition.fortitudeChange);
      if (definition.chaser)
        expect(
          result.events.filter((e) => e.type === 'DRINK_REVEALED'),
        ).toHaveLength(2);
    } else
      switch (definition.effects[0]!.op) {
        case 'DRINKING_CONTEST':
          expect(final.players.map((p) => p.gold)).toEqual([13, 9, 9, 9]);
          expect(final.players.map((p) => p.alcoholContent)).toEqual([
            9, 3, 1, 0,
          ]);
          break;
        case 'ROUND_ON_HOUSE':
          expect(final.players.map((p) => p.alcoholContent)).toEqual([
            7, 2, 2, 2,
          ]);
          expect(final.players.map((p) => p.fortitude)).toEqual([
            16, 20, 20, 20,
          ]);
          expect(final.innDrinkDiscard).toHaveLength(2);
          break;
        case 'OPTIONAL_DRINK_CHALLENGE':
          expect(final.players[0]!.alcoholContent).toBe(7);
          expect(final.players[0]!.fortitude).toBe(16);
          expect(final.players.map((p) => p.gold)).toEqual([13, 9, 9, 9]);
          break;
        case 'CHANGE_STAT':
          expect(final.players[0]).toMatchObject({
            alcoholContent: 6,
            fortitude: 18,
            gold: 8,
          });
          break;
        default:
          throw new Error(`No Drink oracle ${definition.id}`);
      }
  });
for (const definition of rdi2Pack.cards.filter(
  (c) => c.type === 'DRINK' && c.traitReplacements?.length,
)) {
  if (definition.type !== 'DRINK') throw new Error('Expected Drink');
  for (const replacement of definition.traitReplacements!)
    it(`${definition.id}: ${replacement.trait} replaces both numeric attributes`, () => {
      const state = match(rdi2Pack);
      keep(state, []);
      state.phase = 'DRINK';
      state.players[0]!.fortitude = 14;
      state.players[0]!.traits = [replacement.trait];
      drinkPile(state, 0, [definition.id.replace('carddef_rdi2_drink_', '')]);
      const final = settle(send(state, 0, 'TAKE_DRINK').state);
      expect(final.players[0]).toMatchObject({
        alcoholContent: replacement.alcoholContent,
        fortitude: 14 + replacement.fortitudeChange,
      });
    });
}
it('Gog’s real Half-Ogre trait uses the entire Ogre Brew replacement', () => {
  const state = match(rdi2Pack);
  keep(state, []);
  state.activePlayerId = state.players[3]!.id;
  state.phase = 'DRINK';
  state.players[3]!.fortitude = 14;
  drinkPile(state, 3, ['ogre_brew']);
  expect(settle(send(state, 3, 'TAKE_DRINK').state).players[3]).toMatchObject({
    alcoholContent: 3,
    fortitude: 14,
  });
});
it('Mead offers its own split, rounds each half up and rejects external split cards', () => {
  const state = match(rdi2Pack),
    external = definitionCard(state, 'carddef_rdi2_dimli_split_own_drink');
  keep(state, [external]);
  state.phase = 'DRINK';
  drinkPile(state, 0, ['mead']);
  const pending = send(state, 0, 'TAKE_DRINK').state;
  expect(
    projectPrivatePlayer(pending, state.players[0]!.id).legalPlays.some(
      (p) => p.cardId === external,
    ),
  ).toBe(false);
  const choice = until(
    pending,
    (s) => s.responseWindow?.pendingChoice?.kind === 'OPTION',
  );
  const option = choice.responseWindow!.pendingChoice!.options.find(
    (o) => o.id !== 'KEEP',
  )!.id;
  const selected = send(choice, 0, 'CHOOSE_OPTION', {
    responseWindowId: choice.responseWindow!.id,
    optionId: option,
  });
  const final = settle(selected.state);
  expect(final.players.filter((p) => p.alcoholContent === 2)).toHaveLength(2);
  expect(final.players[0]!.alcoholContent).toBe(2);
});
it.each(['CHASER', 'HOUSE', 'CONTEST', 'CHALLENGE'] as const)(
  'Mead cannot offer its built-in split as %s',
  (context) => {
    const state = match(rdi2Pack);
    keep(state, []);
    state.phase = 'DRINK';
    if (context === 'CHASER') {
      drinkPile(state, 0, ['wine_chaser']);
      innOrder(state, ['mead']);
    } else {
      drinkPile(state, 0, [
        context === 'HOUSE'
          ? 'round_on_house'
          : context === 'CONTEST'
            ? 'drinking_contest'
            : 'the_challenge',
      ]);
      innOrder(
        state,
        context === 'HOUSE'
          ? ['mead']
          : context === 'CONTEST'
            ? ['mead', 'water', 'light_ale', 'dark_ale']
            : ['mead', 'water'],
      );
    }
    let current = send(state, 0, 'TAKE_DRINK').state;
    for (
      let n = 0;
      n < 120 && (current.responseWindow || current.control.phaseEnd);
      n++
    ) {
      const choice = current.responseWindow?.pendingChoice;
      if (choice?.kind === 'OPTION') {
        expect(choice.options.some((o) => o.id === 'KEEP')).toBe(false);
        current = send(
          current,
          current.players.findIndex((p) => p.id === choice.playerId),
          'CHOOSE_OPTION',
          { responseWindowId: current.responseWindow!.id, optionId: 'ACCEPT' },
        ).state;
      } else {
        const p =
          current.responseWindow?.priorityPlayerId ??
          current.control.phaseEnd!.priorityPlayerId;
        current = send(
          current,
          current.players.findIndex((v) => v.id === p),
          current.responseWindow ? 'PASS_RESPONSE' : 'PASS_ANYTIME',
          {
            responseWindowId:
              current.responseWindow?.id ?? current.control.phaseEnd!.id,
          },
        ).state;
      }
    }
    expect(current.resolutionStack).toEqual([]);
    assertCoreInvariants(current);
  },
);
it('The Challenge decline consumes no additional Drinks and moves no Gold', () => {
  const state = match(rdi2Pack);
  keep(state, []);
  state.phase = 'DRINK';
  drinkPile(state, 0, ['the_challenge']);
  const before = [...state.innDrinkDeck.cardIds];
  const pending = send(state, 0, 'TAKE_DRINK').state;
  const final = settle(
    send(pending, 0, 'CHOOSE_OPTION', {
      responseWindowId: pending.responseWindow!.id,
      optionId: 'DECLINE',
    }).state,
  );
  expect(final.innDrinkDeck.cardIds).toEqual(before);
  expect(final.players.map((p) => p.gold)).toEqual([10, 10, 10, 10]);
});
it('a later actual RDI2 Drink modifier applies after Eve replaces the base with four Alcohol', () => {
  const state = match(rdi2Pack),
    replace = definitionCard(
      state,
      'carddef_rdi2_eve_replace_drink_with_four_alcohol',
    ),
    modifier = definitionCard(
      state,
      'carddef_rdi2_dimli_add_two_alcohol_to_drink',
    );
  keep(state, [replace, modifier]);
  state.phase = 'DRINK';
  state.activePlayerId = state.players[2]!.id;
  drinkPile(state, 2, ['wine']);
  let pending = until(send(state, 2, 'TAKE_DRINK').state, (s) =>
    projectPrivatePlayer(s, s.players[1]!.id).legalPlays.some(
      (p) => p.cardId === replace,
    ),
  );
  pending = play(pending, replace).state;
  pending = until(
    pending,
    (s) =>
      s.resolutionStack.length === 1 &&
      projectPrivatePlayer(s, s.players[0]!.id).legalPlays.some(
        (p) => p.cardId === modifier,
      ),
  );
  const final = settle(play(pending, modifier).state);
  expect(final.players[2]!.alcoholContent).toBe(6);
});

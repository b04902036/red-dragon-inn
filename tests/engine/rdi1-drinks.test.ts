import { expect, it } from 'vitest';
import { applyCommand } from '../../src/engine/commands';
import {
  projectPrivatePlayer,
  projectPublicGame,
} from '../../src/protocol/projections';
import { rdi1Pack } from '../fixtures/rdi1-content';
import {
  rdi1Match,
  rdi1Keep,
  rdi1DrinkPile,
  rdi1InnOrder,
  rdi1Send,
  rdi1Play,
  rdi1Until,
  rdi1Settle,
  rdi1Pass,
} from '../fixtures/rdi1-match';
import { intent, mutable } from '../fixtures/core-match';
import type { CoreGameState } from '../../src/engine/types';

for (const definition of rdi1Pack.cards.filter(
  (c) => c.type === 'DRINK' || c.type === 'DRINK_EVENT',
)) {
  it(`${definition.id}: revealed Drink legality, wrong-phase rejection and numeric/Event resolution`, () => {
    const state = rdi1Match(rdi1Pack);
    rdi1Keep(state, []);
    state.phase = 'DRINK';
    state.players[0]!.fortitude = 18;
    state.players[0]!.alcoholContent = 5;
    rdi1DrinkPile(state, 0, [definition.id.replace('carddef_rdi1_drink_', '')]);
    if (definition.type === 'DRINK_EVENT')
      rdi1InnOrder(
        state,
        definition.effects[0]!.op === 'DRINKING_CONTEST'
          ? ['dragon_breath', 'elven_wine', 'dark_ale', 'water']
          : ['wizards_brew'],
      );
    else if (definition.chaser) rdi1InnOrder(state, ['water']);
    const id = state.players[0]!.drinkPile[0]!;
    const negative = mutable(state);
    negative.phase = 'ACTION';
    expect(
      applyCommand(negative, intent(negative, 'TAKE_DRINK'), {
        actorId: negative.players[0]!.id,
        clock: { now: () => 1000 },
      }),
    ).toMatchObject({ status: 'REJECTED', state: negative, events: [] });
    const result = rdi1Send(state, 0, 'TAKE_DRINK');
    const final = rdi1Settle(result.state);
    expect(final.innDrinkDiscard).toContain(id);
    if (definition.type === 'DRINK') {
      expect(final.players[0]!.alcoholContent).toBe(
        5 + definition.alcoholContent,
      );
      expect(final.players[0]!.fortitude).toBe(
        Math.min(20, 18 + definition.fortitudeChange),
      );
      if (definition.chaser)
        expect(
          result.events.filter((e) => e.type === 'DRINK_REVEALED'),
        ).toHaveLength(2);
    } else if (definition.effects[0]!.op === 'DRINKING_CONTEST') {
      expect(final.players.map((p) => p.gold)).toEqual([13, 9, 9, 9]);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: 'DRINK_CONTEST_ROUND',
          round: 1,
          scores: [
            { playerId: state.players[0]!.id, score: 4 },
            { playerId: state.players[1]!.id, score: 3 },
            { playerId: state.players[2]!.id, score: 1 },
            { playerId: state.players[3]!.id, score: 0 },
          ],
        }),
      );
    } else {
      expect(final.players.map((p) => p.alcoholContent)).toEqual([7, 2, 2, 2]);
      expect(final.players.map((p) => p.fortitude)).toEqual([20, 20, 20, 20]);
      expect(final.innDrinkDiscard).toHaveLength(2);
    }
  });
}

it.each(['ORC', 'TROLL'] as const)(
  'real %s replacement values apply only to synthetic trait fixtures',
  (trait) => {
    const definition = rdi1Pack.cards.find(
      (c) =>
        c.type === 'DRINK' &&
        c.traitReplacements?.some((r) => r.trait === trait),
    )!;
    if (definition.type !== 'DRINK') throw new Error('Missing trait Drink');
    for (const traits of [[trait], []]) {
      const state = rdi1Match(rdi1Pack);
      rdi1Keep(state, []);
      state.phase = 'DRINK';
      state.players[0]!.fortitude = 18;
      state.players[0]!.traits = traits;
      rdi1DrinkPile(state, 0, [
        definition.id.replace('carddef_rdi1_drink_', ''),
      ]);
      const result = rdi1Settle(rdi1Send(state, 0, 'TAKE_DRINK').state);
      const values = traits.length
        ? definition.traitReplacements![0]!
        : definition;
      expect(result.players[0]!.alcoholContent).toBe(values.alcoholContent);
      expect(result.players[0]!.fortitude).toBe(
        Math.min(20, 18 + values.fortitudeChange),
      );
    }
  },
);

it('real Drinking Contest loops tied contestants, floors sober-down scores at zero and pays once', () => {
  const state = rdi1Match(rdi1Pack);
  rdi1Keep(state, []);
  state.phase = 'DRINK';
  rdi1DrinkPile(state, 0, ['drinking_contest']);
  rdi1InnOrder(state, [
    'dark_ale',
    'light_ale',
    'water',
    'cutting_off',
    'dragon_breath',
    'elven_wine',
  ]);
  const result = rdi1Send(state, 0, 'TAKE_DRINK');
  expect(result.state.players.map((p) => p.gold)).toEqual([13, 9, 9, 9]);
  const rounds = result.events.filter((e) => e.type === 'DRINK_CONTEST_ROUND');
  expect(rounds).toHaveLength(2);
  expect(rounds[0]).toMatchObject({
    round: 1,
    scores: [{ score: 1 }, { score: 1 }, { score: 0 }, { score: 0 }],
  });
  expect(rounds[1]).toMatchObject({
    round: 2,
    scores: [
      { playerId: state.players[0]!.id, score: 4 },
      { playerId: state.players[1]!.id, score: 3 },
    ],
  });
});

for (const op of [
  'IGNORE',
  'PASS_CURRENT_DRINK',
  'SPLIT_CURRENT_DRINK',
] as const) {
  it(`real Contest retains the original revealed score after ${op}`, () => {
    const definition = rdi1Pack.cards.find(
      (c) =>
        c.type === 'SOMETIMES' &&
        c.effects[0]?.op === op &&
        c.responseTrigger?.event === 'DRINK',
    )!;
    const state = rdi1Match(rdi1Pack);
    const card = Object.values(state.cards).find(
      (c) => c.definitionId === definition.id,
    )!.id;
    const seat = state.players.findIndex((p) => p.hand.includes(card));
    rdi1Keep(state, [card]);
    state.phase = 'DRINK';
    rdi1DrinkPile(state, 0, ['drinking_contest']);
    const drinks = ['light_ale', 'dark_ale', 'elven_wine'];
    rdi1InnOrder(
      state,
      state.players.map((p) =>
        p.seat === seat ? 'dragon_breath' : drinks.shift()!,
      ),
    );
    const result = rdi1Send(state, 0, 'TAKE_DRINK');
    const pending = rdi1Until(result.state, (s) =>
      projectPrivatePlayer(s, s.players[seat]!.id).legalPlays.some(
        (p) => p.cardId === card,
      ),
    );
    const played = rdi1Play(pending, card);
    let final: CoreGameState = played.state;
    const events = [...result.events, ...played.events];
    for (
      let i = 0;
      i < 128 && (final.responseWindow || final.control.phaseEnd);
      i++
    ) {
      const passed = rdi1Pass(final);
      events.push(...passed.events);
      final = passed.state;
    }
    expect(final.resolutionStack).toEqual([]);
    expect(final.players[seat]!.gold).toBe(13);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'WORKFLOW_CHANGED',
        operation: 'CONTEST_WINNER',
        playerId: state.players[seat]!.id,
        amount: 4,
      }),
    );
  });
}

it('real Round for the House copies are independently interruptible and never duplicate physical cards', () => {
  const state = rdi1Match(rdi1Pack);
  const ignore = rdi1Pack.cards.find(
    (c) =>
      c.type === 'SOMETIMES' &&
      c.effects[0]?.op === 'IGNORE' &&
      c.responseTrigger?.event === 'DRINK',
  )!;
  const card = Object.values(state.cards).find(
    (c) => c.definitionId === ignore.id,
  )!.id;
  const seat = state.players.findIndex((p) => p.hand.includes(card));
  rdi1Keep(state, [card]);
  state.phase = 'DRINK';
  rdi1DrinkPile(state, 0, ['round_on_house']);
  rdi1InnOrder(state, ['wizards_brew']);
  const pending = rdi1Until(rdi1Send(state, 0, 'TAKE_DRINK').state, (s) =>
    projectPrivatePlayer(s, s.players[seat]!.id).legalPlays.some(
      (p) => p.cardId === card,
    ),
  );
  expect(JSON.stringify(projectPublicGame(pending))).not.toContain(
    state.innDrinkDeck.cardIds[1]!,
  );
  const final = rdi1Settle(rdi1Play(pending, card).state);
  expect(final.players.map((p) => p.alcoholContent)).toEqual(
    state.players.map((p) => (p.seat === seat ? 0 : 2)),
  );
  expect(final.innDrinkDiscard).toHaveLength(2);
  expect(new Set(final.innDrinkDiscard).size).toBe(2);
});

import { expect, it } from 'vitest';
import { createMatch } from '../../src/engine/setup';
import {
  replayFromBeginning,
  replayFromSnapshot,
} from '../../src/engine/replay';
import { rdi1Pack, rdi1PublishedV1 } from '../fixtures/rdi1-content';
import { setupInput } from '../fixtures/core-match';
import {
  rdi1Card,
  rdi1DrinkPile,
  rdi1Keep,
  rdi1InnOrder,
  rdi1Match,
  rdi1Play,
  rdi1Send,
  rdi1Settle,
} from '../fixtures/rdi1-match';

it.each([18, 19, 20])(
  'a healing Drink at %i Fortitude stops at 20',
  (fortitude) => {
    const state = rdi1Match(rdi1Pack);
    rdi1Keep(state, []);
    state.phase = 'DRINK';
    state.players[0]!.fortitude = fortitude;
    rdi1DrinkPile(state, 0, ['wizards_brew']);
    const result = rdi1Send(state, 0, 'TAKE_DRINK');
    expect(rdi1Settle(result.state).players[0]!.fortitude).toBe(20);
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: 'FORTITUDE_CHANGED',
        value: 20,
        delta: 20 - fortitude,
      }),
    );
  },
);

it('Alcohol stops at 20 and emits the actual increase before pass-out', () => {
  const state = rdi1Match(rdi1Pack);
  rdi1Keep(state, []);
  state.phase = 'DRINK';
  state.players[0]!.alcoholContent = 19;
  rdi1DrinkPile(state, 0, ['dragon_breath']);
  const result = rdi1Send(state, 0, 'TAKE_DRINK');
  const final = rdi1Settle(result.state);
  expect(final.players[0]).toMatchObject({
    alcoholContent: 20,
    eliminated: true,
  });
  expect(result.events).toContainEqual(
    expect.objectContaining({
      type: 'ALCOHOL_CHANGED',
      value: 20,
      delta: 1,
    }),
  );
});

it('healing at the cap still charges the target Gold', () => {
  const state = rdi1Match(rdi1Pack);
  const card = rdi1Card(state, 'heal_other_charge_gold');
  rdi1Keep(state, [card]);
  const target = state.players[1]!;
  const result = rdi1Settle(rdi1Play(state, card, target.id).state);
  expect(result.players[1]).toMatchObject({ fortitude: 20, gold: 9 });
  expect(result.players[0]!.gold).toBe(11);
});

it('a capped Alcohol increase does not reduce the revealed contest score', () => {
  const state = rdi1Match(rdi1Pack);
  rdi1Keep(state, []);
  state.phase = 'DRINK';
  state.players[0]!.alcoholContent = 19;
  rdi1DrinkPile(state, 0, ['drinking_contest']);
  rdi1InnOrder(state, ['dragon_breath', 'elven_wine', 'dark_ale', 'water']);
  const result = rdi1Send(state, 0, 'TAKE_DRINK');
  expect(result.state.players[0]).toMatchObject({
    alcoholContent: 20,
    eliminated: true,
  });
  expect(result.events).toContainEqual(
    expect.objectContaining({
      type: 'DRINK_CONTEST_ROUND',
      scores: [
        { playerId: state.players[0]!.id, score: 4 },
        { playerId: state.players[1]!.id, score: 3 },
        { playerId: state.players[2]!.id, score: 1 },
        { playerId: state.players[3]!.id, score: 0 },
      ],
    }),
  );
  expect(result.events).toContainEqual(
    expect.objectContaining({
      type: 'GOLD_REDISTRIBUTED',
      playerId: state.players[0]!.id,
      amount: 13,
    }),
  );
});

it('new match defaults cap both stats while Gold has no maximum', () => {
  const setup = setupInput();
  delete setup.rules;
  expect(createMatch(setup).rules.statBounds).toEqual({
    fortitude: { min: 0, max: 20 },
    alcoholContent: { min: 0, max: 20 },
    gold: null,
  });
});

it('historical v1 snapshots replay their pinned 100-point bounds unchanged', () => {
  const state = rdi1Match(rdi1PublishedV1);
  state.rules.statBounds.fortitude = { min: 0, max: 100 };
  state.rules.statBounds.alcoholContent = { min: 0, max: 100 };
  rdi1Keep(state, []);
  state.phase = 'DRINK';
  rdi1DrinkPile(state, 0, ['wizards_brew']);
  const result = rdi1Send(state, 0, 'TAKE_DRINK');
  expect(result.state.players[0]!.fortitude).toBe(22);
  expect(
    replayFromSnapshot(JSON.parse(JSON.stringify(state)), 0, [
      {
        actorId: result.actorId,
        command: result.command,
        clockTime: result.now,
        acceptedAt: new Date(result.now).toISOString(),
        firstSequence: 1,
        lastSequence: result.events.length,
        events: result.events,
      },
    ]).state,
  ).toEqual(result.state);
});

it('historical manifests retain explicit bounds when replayed from the beginning', () => {
  const setup = setupInput();
  setup.rules!.statBounds = {
    fortitude: { min: 0, max: 100 },
    alcoholContent: { min: 0, max: 100 },
    gold: null,
  };
  setup.rules!.initialStats = { fortitude: 22, alcoholContent: 21, gold: 50 };
  const replay = replayFromBeginning({ schemaVersion: 1, setup }, []);
  expect(replay.state.players[0]).toMatchObject({
    fortitude: 22,
    alcoholContent: 21,
    gold: 50,
  });
  expect(replay.state.rules).toEqual(setup.rules);
});

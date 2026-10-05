import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { compileRdi1Source } from '../../src/content/rdi1-compiler';
import { projectPrivatePlayer } from '../../src/protocol/projections';
import {
  rdi1Card,
  rdi1DrinkPile,
  rdi1InnOrder,
  rdi1Keep,
  rdi1Match,
  rdi1Play,
  rdi1Send,
  rdi1Settle,
  rdi1Until,
  rdi1Pass,
} from '../fixtures/rdi1-match';
import type { CoreGameState } from '../../src/engine/types';
import { coreStateSchema, replayFromSnapshot } from '../../src/engine/replay';
import { rdi1PublishedV1 } from '../fixtures/rdi1-content';

const source: unknown = JSON.parse(
  readFileSync('content-private/imports/rdi1/source-normalized.json', 'utf8'),
);
const pack = compileRdi1Source(source);

function contest(drinks: string[], keep: string[] = []) {
  const state = rdi1Match(pack);
  rdi1Keep(state, keep);
  state.phase = 'DRINK';
  rdi1DrinkPile(state, 0, ['drinking_contest']);
  rdi1InnOrder(state, drinks);
  return state;
}
function finishWithEvents(state: CoreGameState) {
  const events = [];
  while (state.responseWindow || state.control.phaseEnd) {
    const result = rdi1Pass(state);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

it('a numeric Drink modifier changes the contest winner and survives reconnect/replay', () => {
  const card = rdi1Card(rdi1Match(pack), 'reduce_drink_alcohol_two');
  const state = contest(['elven_wine', 'wine', 'light_ale', 'water'], [card]);
  let pending = rdi1Send(state, 0, 'TAKE_DRINK').state;
  pending = rdi1Until(pending, (s) =>
    projectPrivatePlayer(s, s.cards[card]!.ownerId!).legalPlays.some(
      (p) => p.cardId === card,
    ),
  );
  const restored = coreStateSchema.parse(JSON.parse(JSON.stringify(pending)));
  const played = rdi1Play(restored, card);
  expect(
    replayFromSnapshot(restored, 0, [
      {
        actorId: played.actorId,
        command: played.command,
        clockTime: played.now,
        acceptedAt: new Date(played.now).toISOString(),
        firstSequence: 1,
        lastSequence: played.events.length,
        events: played.events,
      },
    ]).state,
  ).toEqual(played.state);
  pending = played.state;
  const final = rdi1Settle(pending);
  expect(final.players.map((p) => p.alcoholContent)).toEqual([1, 2, 1, 0]);
  expect(final.players.map((p) => p.gold)).toEqual([9, 13, 9, 9]);
});

it('a negative contest Drink scores zero while its real sobering effect applies', () => {
  const state = contest(['cutting_off', 'dragon_breath', 'light_ale', 'water']);
  state.players[0]!.alcoholContent = 5;
  const result = rdi1Send(state, 0, 'TAKE_DRINK');
  expect(
    result.events.filter((e) => e.type === 'DRINK_CONTEST_ROUND'),
  ).toMatchObject([
    { scores: [{ score: 0 }, { score: 4 }, { score: 1 }, { score: 0 }] },
  ]);
  expect(rdi1Settle(result.state).players[0]!.alcoholContent).toBe(4);
});

it.each([false, true])(
  'tied pass-outs end the contest without another Drink (all tied out: %s)',
  (allOut) => {
    const state = contest(['light_ale', 'dark_ale', 'water', 'cutting_off']);
    state.players[0]!.fortitude = 1;
    if (allOut) state.players[1]!.fortitude = 1;
    const result = rdi1Send(state, 0, 'TAKE_DRINK');
    const finished = finishWithEvents(result.state);
    const events = [...result.events, ...finished.events];
    expect(events.filter((e) => e.type === 'DRINK_CONTEST_ROUND')).toHaveLength(
      1,
    );
    expect(
      events.filter(
        (e) =>
          e.type === 'WORKFLOW_CHANGED' &&
          e.operation === (allOut ? 'CONTEST_NO_WINNER' : 'CONTEST_WINNER'),
      ),
    ).toHaveLength(1);
    expect(finished.state.players[0]!.eliminated).toBe(true);
    expect(finished.state.players[1]!.eliminated).toBe(allOut);
    if (!allOut) expect(finished.state.players[1]!.gold).toBe(14);
  },
);

it('a winning Drink that passes its owner out collects contest Gold before redistribution', () => {
  const state = contest(['dragon_breath', 'elven_wine', 'light_ale', 'water']);
  state.players[0]!.fortitude = 4;
  const result = rdi1Send(state, 0, 'TAKE_DRINK');
  const finished = finishWithEvents(result.state);
  const events = [...result.events, ...finished.events];
  const redistribution = events.find((e) => e.type === 'GOLD_REDISTRIBUTED');
  expect(redistribution).toMatchObject({
    playerId: state.players[0]!.id,
    amount: 13,
  });
  expect(finished.state.players.map((p) => p.gold)).toEqual([0, 11, 11, 11]);
  expect(finished.state.players[0]!.eliminated).toBe(true);
});

it('a contestant with zero Gold can win payment before the elimination check', () => {
  const state = contest(['dragon_breath', 'elven_wine', 'light_ale', 'water']);
  state.players[0]!.gold = 0;
  const final = rdi1Settle(rdi1Send(state, 0, 'TAKE_DRINK').state);
  expect(final.players[0]).toMatchObject({ gold: 3, eliminated: false });
});

it('the contest reshuffles the Inn discard, charges one Gold each, and lets a broke contestant win before elimination', () => {
  const state = contest(['dragon_breath', 'water', 'light_ale', 'dark_ale']);
  const [winner, ...replacement] = state.innDrinkDeck.cardIds.splice(0, 4);
  const remaining = state.innDrinkDeck.cardIds.splice(0);
  state.players[0]!.drinkPile.push(...remaining);
  for (const id of remaining)
    state.cards[id]!.location = {
      zone: 'DRINK_PILE',
      playerId: state.players[0]!.id,
    };
  state.innDrinkDeck.cardIds = [winner!];
  state.innDrinkDiscard = replacement;
  for (const id of replacement)
    state.cards[id]!.location = {
      zone: 'INN_DRINK_DISCARD',
      deckId: state.innDrinkDeck.deckId,
    };
  state.players[0]!.gold = 1;
  const result = rdi1Send(state, 0, 'TAKE_DRINK');
  expect(
    result.events.filter(
      (e) => e.type === 'DECK_SHUFFLED' && e.reason === 'EXHAUSTED',
    ),
  ).toHaveLength(1);
  expect(
    result.events.filter((e) => e.type === 'GOLD_CHANGED' && e.delta === -1),
  ).toHaveLength(7);
  const final = rdi1Settle(result.state);
  expect(final.players.map((p) => p.gold)).toEqual([3, 8, 8, 8]);
  expect(final.players[0]!.eliminated).toBe(false);
});

it('the corrected all-player action drinks from the Inn and leaves every personal pile unchanged', () => {
  const state = rdi1Match(pack);
  const card = rdi1Card(state, 'all_players_drink_now');
  rdi1Keep(state, [card]);
  for (const player of state.players)
    rdi1DrinkPile(state, player.seat, [
      ['wizards_brew', 'holy_water', 'cutting_off', 'orcish_rotgut'][
        player.seat
      ]!,
    ]);
  const piles = state.players.map((player) => [...player.drinkPile]);
  rdi1InnOrder(state, ['light_ale', 'dark_ale', 'elven_wine', 'wine']);
  const before = state.innDrinkDeck.cardIds.length;
  const result = rdi1Settle(rdi1Play(state, card).state);
  expect(result.players.map((player) => player.drinkPile)).toEqual(piles);
  expect(result.players.map((player) => player.alcoholContent)).toEqual([
    1, 1, 3, 2,
  ]);
  expect(result.innDrinkDeck.cardIds).toHaveLength(before - 4);
});

it('the drink-change counter explicitly requires a Sometimes source and allows only the hard-counter family to affect it', () => {
  const card = pack.cards.find((entry) =>
    entry.id.endsWith('_deirdre_negate_drink_change_card'),
  )!;
  expect(card).toMatchObject({
    counterFamily: 'rdi_core_drink_change',
    allowedCounterFamilies: ['rdi_core_hard_no'],
  });
  if (card.type !== 'SOMETIMES') throw new Error('Expected Sometimes counter');
  expect(
    card.responseTrigger?.alternatives.every((branch) =>
      branch.some(
        (condition) =>
          condition.kind === 'SOURCE_TYPE' &&
          condition.types.length === 1 &&
          condition.types[0] === 'SOMETIMES',
      ),
    ),
  ).toBe(true);
});

it('a contest Event has no effect and does not launch another Drink workflow', () => {
  const state = rdi1Match(pack);
  rdi1Keep(state, []);
  state.phase = 'DRINK';
  rdi1DrinkPile(state, 0, ['drinking_contest']);
  rdi1InnOrder(state, [
    'round_on_house',
    'dragon_breath',
    'light_ale',
    'water',
    'wizards_brew',
  ]);
  const final = rdi1Settle(rdi1Send(state, 0, 'TAKE_DRINK').state);
  expect(final.players.map((player) => player.alcoholContent)).toEqual([
    0, 4, 1, 0,
  ]);
  expect(final.players.map((player) => player.fortitude)).toEqual([
    20, 20, 20, 20,
  ]);
  expect(final.players.map((player) => player.gold)).toEqual([9, 13, 9, 9]);
  expect(final.innDrinkDiscard).toHaveLength(5);
  expect(final.innDrinkDeck.cardIds[0]).toBe(state.innDrinkDeck.cardIds[4]);
});

it('post-Chaser source timing is explicit and the extra-Drink highlight starts only after the complete compound reveal', () => {
  const raw = source as { mechanics: { id: string; legality: unknown }[] };
  expect(
    raw.mechanics.find((entry) => entry.id === 'force_extra_drink_on_reveal')!
      .legality,
  ).toMatchObject({ trigger: { timing: 'AFTER_CHASERS_BEFORE_RESOLVE' } });
  const state = rdi1Match(pack);
  const card = rdi1Card(state, 'force_extra_drink_on_reveal');
  rdi1Keep(state, [card]);
  state.phase = 'DRINK';
  rdi1DrinkPile(state, 0, ['light_ale_chaser']);
  rdi1InnOrder(state, ['wine_chaser', 'water']);
  const result = rdi1Send(state, 0, 'TAKE_DRINK');
  expect(
    result.events.filter((event) => event.type === 'DRINK_REVEALED'),
  ).toHaveLength(3);
  const revealIndex = result.events
    .map((event) => event.type)
    .lastIndexOf('DRINK_REVEALED');
  const windowIndex = result.events.findIndex(
    (event) => event.type === 'RESPONSE_WINDOW_OPENED',
  );
  expect(windowIndex).toBeGreaterThan(revealIndex);
  const owner = result.state.players.find((player) =>
    player.hand.includes(card),
  )!;
  expect(
    projectPrivatePlayer(result.state, owner.id).legalPlays.some(
      (play) => play.cardId === card,
    ),
  ).toBe(true);
  const prompt = result.state.control.timedPrompt!;
  expect(prompt.kind).toBe('RESPONSE_DECISION');
  expect(prompt.deadlineAt! - prompt.openedAt).toBe(30000);
});

it.each([
  { base: 'wine', inn: [] },
  { base: 'light_ale_chaser', inn: ['water'] },
  { base: 'light_ale_chaser', inn: ['round_on_house'] },
])(
  'extra-Drink legality begins after the complete $base chain ($inn)',
  ({ base, inn }) => {
    const state = rdi1Match(pack);
    const card = rdi1Card(state, 'force_extra_drink_on_reveal');
    rdi1Keep(state, [card]);
    state.phase = 'DRINK';
    rdi1DrinkPile(state, 0, [base]);
    rdi1InnOrder(state, inn);
    const result = rdi1Send(state, 0, 'TAKE_DRINK');
    const types = result.events.map((e) => e.type);
    expect(types.indexOf('RESPONSE_WINDOW_OPENED')).toBeGreaterThan(
      types.lastIndexOf('DRINK_REVEALED'),
    );
    expect(
      projectPrivatePlayer(
        result.state,
        result.state.cards[card]!.ownerId!,
      ).legalPlays.some((p) => p.cardId === card),
    ).toBe(true);
    expect(result.state.resolutionStack.at(-1)!.sourceCardIds).toHaveLength(
      1 + inn.length,
    );
    if (inn.includes('round_on_house'))
      expect(
        result.events.some(
          (e) => e.type === 'DRINK_EVENT_DISCARDED' && e.context === 'CHASER',
        ),
      ).toBe(true);
  },
);

it('the central all-player action resolves Chasers and Events and replays every command deterministically', () => {
  const state = rdi1Match(pack);
  const card = rdi1Card(state, 'all_players_drink_now');
  rdi1Keep(state, [card]);
  rdi1InnOrder(state, [
    'light_ale_chaser',
    'water',
    'round_on_house',
    'wine_chaser',
    'dark_ale',
    'wine',
    'elven_wine',
  ]);
  const result = rdi1Play(state, card);
  expect(result.state.players.map((p) => p.alcoholContent)).toEqual([
    4, 3, 6, 5,
  ]);
  expect(result.state.players.map((p) => p.drinkPile)).toEqual([
    [],
    [],
    [],
    [],
  ]);
  expect(
    replayFromSnapshot(state, 0, [
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

it('Round on the House skips Events and creates every complete independent copy before a modifier can be played', () => {
  const state = rdi1Match(pack);
  const modifier = rdi1Card(state, 'add_two_alcohol_to_drink');
  rdi1Keep(state, [modifier]);
  state.phase = 'DRINK';
  rdi1DrinkPile(state, 0, ['round_on_house']);
  rdi1InnOrder(state, [
    'drinking_contest',
    'light_ale_chaser',
    'wine_chaser',
    'water',
  ]);
  const result = rdi1Send(state, 0, 'TAKE_DRINK');
  const batch = result.state.resolutionStack.find(
    (f) => f.task?.kind === 'DRINK_BATCH',
  )!;
  expect(batch.pendingDrinks).toHaveLength(3);
  expect(batch.heldDrinkCardIds).toHaveLength(3);
  expect(
    batch.pendingDrinks!.every((work) => work.provenanceCardIds.length === 3),
  ).toBe(true);
  const types = result.events.map((e) => e.type);
  expect(types.indexOf('RESPONSE_WINDOW_OPENED')).toBeGreaterThan(
    types.lastIndexOf('DRINK_REVEALED'),
  );
  expect(
    result.events.filter(
      (e) =>
        e.type === 'DRINK_EVENT_DISCARDED' && e.context === 'SOURCE_SELECTION',
    ),
  ).toHaveLength(1);
  const pending = rdi1Until(result.state, (s) =>
    projectPrivatePlayer(s, s.cards[modifier]!.ownerId!).legalPlays.some(
      (p) => p.cardId === modifier,
    ),
  );
  const final = rdi1Settle(rdi1Play(pending, modifier).state);
  expect(final.players.map((p) => p.alcoholContent)).toEqual([5, 3, 3, 3]);
  expect(final.innDrinkDiscard).toHaveLength(5);
});

it.each(['ignore_drink', 'pass_own_drink', 'split_own_drink'])(
  'current-policy contest keeps the original score after %s',
  (mechanic) => {
    const state = rdi1Match(pack);
    const card = rdi1Card(state, mechanic);
    const seat = state.players.findIndex((p) => p.hand.includes(card));
    rdi1Keep(state, [card]);
    state.phase = 'DRINK';
    rdi1DrinkPile(state, 0, ['drinking_contest']);
    const other = ['light_ale', 'dark_ale', 'elven_wine'];
    rdi1InnOrder(
      state,
      state.players.map((p) =>
        p.seat === seat ? 'dragon_breath' : other.shift()!,
      ),
    );
    let pending = rdi1Send(state, 0, 'TAKE_DRINK').state;
    pending = rdi1Until(pending, (s) =>
      projectPrivatePlayer(s, s.players[seat]!.id).legalPlays.some(
        (p) => p.cardId === card,
      ),
    );
    const final = rdi1Settle(rdi1Play(pending, card).state);
    expect(final.players[seat]!.gold).toBe(13);
  },
);

it('an extra Drink affects stats but cannot replace a contestant’s original score', () => {
  const state = rdi1Match(pack);
  const card = rdi1Card(state, 'force_extra_drink_on_reveal');
  rdi1Keep(state, [card]);
  state.phase = 'DRINK';
  rdi1DrinkPile(state, 0, ['drinking_contest']);
  rdi1DrinkPile(state, 2, ['dragon_breath']);
  rdi1InnOrder(state, ['wine', 'dark_ale', 'light_ale', 'water']);
  let pending = rdi1Send(state, 0, 'TAKE_DRINK').state;
  pending = rdi1Until(
    pending,
    (s) =>
      s.resolutionStack.at(-1)?.actorId === state.players[2]!.id &&
      projectPrivatePlayer(s, s.cards[card]!.ownerId!).legalPlays.some(
        (p) => p.cardId === card,
      ),
  );
  const final = rdi1Settle(rdi1Play(pending, card).state);
  expect(final.players.map((p) => p.alcoholContent)).toEqual([2, 1, 5, 0]);
  expect(final.players.map((p) => p.gold)).toEqual([13, 9, 9, 9]);
});

it('contest participants finish modifying their revealed Drinks before any contestant consumes one', () => {
  const state = rdi1Match(pack);
  const card = rdi1Card(state, 'add_two_alcohol_to_drink');
  rdi1Keep(state, [card]);
  state.phase = 'DRINK';
  rdi1DrinkPile(state, 0, ['drinking_contest']);
  rdi1InnOrder(state, ['light_ale', 'dark_ale', 'elven_wine', 'water']);
  let pending = rdi1Send(state, 0, 'TAKE_DRINK').state;
  pending = rdi1Until(
    pending,
    (s) =>
      s.resolutionStack.at(-1)?.actorId === state.players[2]!.id &&
      projectPrivatePlayer(s, s.cards[card]!.ownerId!).legalPlays.some(
        (p) => p.cardId === card,
      ),
  );
  expect(pending.players.map((p) => p.alcoholContent)).toEqual([0, 0, 0, 0]);
  expect(pending.innDrinkDiscard).toEqual([]);
  const final = rdi1Settle(rdi1Play(pending, card).state);
  expect(final.players.map((p) => p.alcoholContent)).toEqual([1, 1, 5, 0]);
});

it('a v1 snapshot retains its pinned personal-pile all-player action and replays unchanged', () => {
  const state = rdi1Match(rdi1PublishedV1);
  const card = rdi1Card(state, 'all_players_drink_now');
  rdi1Keep(state, [card]);
  for (const player of state.players)
    rdi1DrinkPile(state, player.seat, [
      ['light_ale', 'dark_ale', 'wine', 'elven_wine'][player.seat]!,
    ]);
  const deck = [...state.innDrinkDeck.cardIds];
  const restored = coreStateSchema.parse(JSON.parse(JSON.stringify(state)));
  const result = rdi1Play(restored, card);
  expect(result.state.contentVersionId).toBe('content_rdi1_mechanics_v1');
  expect(result.state.players.map((p) => p.alcoholContent)).toEqual([
    1, 1, 2, 3,
  ]);
  expect(result.state.innDrinkDeck.cardIds).toEqual(deck);
  expect(
    replayFromSnapshot(restored, 0, [
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

import { expect, it } from 'vitest';
import { genericState, putCard, legal } from '../fixtures/generic-match';
import { NarrationMatch } from '../fixtures/public-narration-match';
import { projectPublicNarration } from '../../src/protocol/public-narration-projector';
import { publicNarrationEventSchema } from '../../src/protocol/public-narration';
import { eventWriter } from '../../src/engine/event-writer';
import { domainEventSchema } from '../../src/protocol/events';
import { resolutionIdSchema } from '../../src/shared/ids';
import { commandIdSchema } from '../../src/shared/ids';
import { stateVersionSchema } from '../../src/shared/version';
import { combinedPack, rdi2Pack } from '../fixtures/rdi2-content';
import {
  selectedMatch,
  definitionCard,
  keep,
  drinkPile,
  innOrder,
} from '../fixtures/rdi2-match';
import { createMatch } from '../../src/engine/setup';
import { setupInput } from '../fixtures/core-match';
import { replayFromBeginning } from '../../src/engine/replay';
import { applyCommand } from '../../src/engine/commands';
import { intent } from '../fixtures/core-match';

function state() {
  const state = genericState();
  state.publicNarrationVersion = 1;
  return state;
}
it('internal narration adds no 32-frame/effect gameplay limit and remains private in the public projection', () => {
  const source = state();
  const writer = eventWriter(
    source,
    commandIdSchema.parse('command_deep_metadata'),
    stateVersionSchema.parse(source.version + 1),
  );
  writer.emit({
    type: 'TURN_STARTED',
    playerId: source.players[0]!.id,
    turnNumber: 2,
  });
  const event = domainEventSchema.parse({
    ...writer.events[0],
    narration: {
      resolutionId: null,
      frames: Array.from({ length: 40 }, (_, index) => ({
        resolutionId: resolutionIdSchema.parse(`resolution_deep_${index}`),
        parentId: index
          ? resolutionIdSchema.parse(`resolution_deep_${index - 1}`)
          : null,
        kind: 'SYSTEM',
        playerId: source.players[0]!.id,
        definitionId: null,
        targetPlayerIds: [],
        operations: Array(40).fill('CHANGE_STAT'),
      })),
    },
  });
  const projected = projectPublicNarration([{ sequence: 1, event }]);
  expect(projected.events).toHaveLength(1);
  expect(JSON.stringify(projected.events)).not.toMatch(
    /frames|operations|resolution_deep/,
  );
});
it('an unchanged capped stat produces no fabricated change or delta animation event', () => {
  const source = state();
  const writer = eventWriter(
    source,
    commandIdSchema.parse('command_no_delta'),
    stateVersionSchema.parse(source.version + 1),
  );
  writer.emit({
    type: 'FORTITUDE_CHANGED',
    playerId: source.players[0]!.id,
    delta: 0,
    value: 20,
  });
  expect(
    projectPublicNarration(
      writer.events.map((event, index) => ({ sequence: index + 1, event })),
    ).events,
  ).toEqual([]);
});
function hiddenSafe(match: NarrationMatch) {
  const serialized = JSON.stringify(match.narration);
  for (const id of Object.keys(match.state.cards))
    expect(serialized).not.toContain(JSON.stringify(id));
  const visit = (item: unknown): void => {
    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }
    if (item && typeof item === 'object')
      for (const [key, value] of Object.entries(item)) {
        expect([
          'cardId',
          'cardIds',
          'cardInstanceId',
          'rngSeed',
          'rng',
          'hand',
          'deckOrder',
          'drinkPile',
          'pendingChoice',
          'selections',
          'options',
        ]).not.toContain(key);
        visit(value);
      }
  };
  visit(match.narration);
  for (const event of match.narration)
    expect(publicNarrationEventSchema.safeParse(event).success).toBe(true);
}
it('ordinary real Action has public targets, resolution and each actual stat change with an exact cause', () => {
  const source = state();
  const hit = putCard(
    source,
    0,
    [
      {
        op: 'CHANGE_STAT',
        target: 'CHOSEN_PLAYER',
        stat: 'FORTITUDE',
        delta: -2,
      },
    ],
    { type: 'ACTION' },
  );
  const match = new NarrationMatch(source);
  match.play(0, hit, source.players[1]!.id);
  match.settle();
  const played = match.narration.find((event) => event.type === 'CARD_PLAYED')!;
  expect(played).toMatchObject({
    playerId: source.players[0]!.id,
    targetPlayerIds: [source.players[1]!.id],
  });
  expect(match.narration).toContainEqual(
    expect.objectContaining({
      type: 'STAT_CHANGED',
      stat: 'FORTITUDE',
      before: 20,
      after: 18,
      delta: -2,
      resolutionId: played.resolutionId,
    }),
  );
  expect(
    match.narration.filter((event) => event.type === 'RESOLUTION_COMPLETED'),
  ).toContainEqual(
    expect.objectContaining({
      resolutionId: played.resolutionId,
      canceled: false,
    }),
  );
  hiddenSafe(match);
});
it('three actual character plays retain A <- B <- C, C resolves, B cancels and A resolves across batches', () => {
  const source = state();
  const hit = putCard(
    source,
    0,
    [
      {
        op: 'CHANGE_STAT',
        target: 'CHOSEN_PLAYER',
        stat: 'FORTITUDE',
        delta: -2,
      },
    ],
    { type: 'ACTION' },
  );
  const trigger = {
    event: 'CARD' as const,
    alternatives: [
      [
        {
          kind: 'SOURCE_TYPE' as const,
          types: ['ACTION' as const, 'SOMETIMES' as const],
        },
      ],
    ],
  };
  const b = putCard(source, 1, [{ op: 'NEGATE', scope: 'TOP_STACK' }], {
    trigger,
  });
  const c = putCard(source, 2, [{ op: 'NEGATE', scope: 'TOP_STACK' }], {
    trigger,
  });
  const match = new NarrationMatch(source);
  match.play(0, hit, source.players[1]!.id);
  match.until((s) => !!legal(s, 1, b));
  match.play(1, b);
  match.until((s) => !!legal(s, 2, c));
  match.play(2, c);
  match.settle();
  const plays = match.narration.filter((event) => event.type === 'CARD_PLAYED');
  expect(plays.map((event) => event.parentId)).toEqual([
    null,
    plays[0]!.resolutionId,
    plays[1]!.resolutionId,
  ]);
  expect(plays.slice(1).map((event) => event.responseRelation)).toEqual([
    'NEGATES',
    'NEGATES',
  ]);
  const done = match.narration
    .filter((event) => event.type === 'RESOLUTION_COMPLETED')
    .filter((event) =>
      plays.some((card) => card.resolutionId === event.resolutionId),
    );
  expect(done.map((event) => [event.resolutionId, event.canceled])).toEqual([
    [plays[2]!.resolutionId, false],
    [plays[1]!.resolutionId, true],
    [plays[0]!.resolutionId, false],
  ]);
  expect(match.narration).toContainEqual(
    expect.objectContaining({
      type: 'RELATION_RESOLVED',
      sourceResolutionId: plays[2]!.resolutionId,
      targetResolutionId: plays[1]!.resolutionId,
      relation: 'NEGATES',
    }),
  );
  expect(match.state.players[1]!.fortitude).toBe(18);
  expect(projectPublicNarration(match.domain).events).toEqual(match.narration);
  hiddenSafe(match);
});
it('compiled gambling preserves actual ante, raise, control, pass, leave and final payout', () => {
  const source = selectedMatch(rdi2Pack, [
    'rdi2-dimli',
    'rdi2-eve',
    'rdi2-fleck',
    'rdi2-gog',
  ]);
  source.publicNarrationVersion = 1;
  const start = definitionCard(
      source,
      'carddef_rdi2_dimli_gambling_start_or_control',
    ),
    raise = definitionCard(source, 'carddef_rdi2_dimli_gambling_raise_one'),
    cheat = definitionCard(source, 'carddef_rdi2_fleck_cheat_take_control');
  keep(source, [start, raise, cheat]);
  const match = new NarrationMatch(source);
  match.play(0, start);
  match.settle();
  match.send('GAMBLING_LEAVE', {}, 1);
  match.play(2, cheat);
  match.settle();
  match.until((s) => !!legal(s, 0, raise));
  match.play(0, raise);
  match.settle();
  match.until((s) => s.gambling === null);
  for (const type of [
    'GAMBLING_STARTED',
    'GAMBLING_ANTE',
    'GAMBLING_RAISED',
    'GAMBLING_CONTROL_CHANGED',
    'GAMBLING_PLAYER_LEFT',
    'GAMBLING_PASSED',
    'GAMBLING_PAYOUT',
  ])
    expect(
      match.narration.some((event) => event.type === type),
      type,
    ).toBe(true);
  expect(
    match.narration.filter((event) => event.type === 'GAMBLING_PAYOUT'),
  ).toContainEqual(
    expect.objectContaining({ playerId: source.players[0]!.id, amount: 7 }),
  );
  hiddenSafe(match);
});
it('actual Drink modification logs the responder and scalar change before final consumption', () => {
  const source = selectedMatch(rdi2Pack, ['rdi2-dimli', 'rdi2-eve']);
  source.publicNarrationVersion = 1;
  source.phase = 'DRINK';
  const modifier = definitionCard(
    source,
    'carddef_rdi2_dimli_add_two_alcohol_to_drink',
  );
  keep(source, [modifier]);
  drinkPile(source, 0, ['wine']);
  const match = new NarrationMatch(source);
  match.send('TAKE_DRINK');
  match.until((s) => !!legal(s, 0, modifier));
  match.play(0, modifier);
  match.settle();
  const card = match.narration.find((event) => event.type === 'CARD_PLAYED')!;
  expect(card.responseRelation).toBe('MODIFIES');
  expect(match.narration).toContainEqual(
    expect.objectContaining({
      type: 'DRINK_MODIFIED',
      sourceResolutionId: card.resolutionId,
      alcoholDelta: 2,
      fortitudeDelta: 0,
    }),
  );
  expect(match.narration).toContainEqual(
    expect.objectContaining({
      type: 'STAT_CHANGED',
      stat: 'ALCOHOL',
      delta: 4,
    }),
  );
  hiddenSafe(match);
});
it('Challenge accepts publicly, skips leading Events, and preserves only revealed identities', () => {
  const source = selectedMatch(rdi2Pack, ['rdi2-dimli', 'rdi2-eve']);
  source.publicNarrationVersion = 1;
  source.phase = 'DRINK';
  keep(source, []);
  drinkPile(source, 0, ['the_challenge']);
  innOrder(source, ['round_on_house', 'wine', 'water']);
  const match = new NarrationMatch(source);
  match.send('TAKE_DRINK');
  match.settle();
  expect(match.narration).toContainEqual(
    expect.objectContaining({ type: 'CHALLENGE_DECIDED', accepted: true }),
  );
  expect(match.narration).toContainEqual(
    expect.objectContaining({
      type: 'DRINK_EVENT_DISCARDED',
      cardDefinitionId: 'carddef_rdi2_drink_round_on_house',
      context: 'SOURCE_SELECTION',
    }),
  );
  hiddenSafe(match);
});
it('Ignore identifies its actual responder and preserves other public target effects', () => {
  const source = state();
  const hit = putCard(
    source,
    0,
    [
      {
        op: 'CHANGE_STAT',
        target: 'EACH_OTHER_PLAYER',
        stat: 'FORTITUDE',
        delta: -2,
      },
    ],
    { type: 'ACTION' },
  );
  const ignore = putCard(
    source,
    1,
    [{ op: 'IGNORE', scope: 'CURRENT_EFFECT' }],
    {
      trigger: {
        event: 'CARD',
        alternatives: [
          [
            {
              kind: 'PENDING_STAT',
              stat: 'FORTITUDE',
              direction: 'LOSS',
              relation: 'SELF',
            },
          ],
        ],
      },
    },
  );
  const match = new NarrationMatch(source);
  match.play(0, hit);
  match.until((s) => !!legal(s, 1, ignore));
  match.play(1, ignore);
  match.settle();
  expect(match.state.players.map((player) => player.fortitude)).toEqual([
    20, 20, 18, 18,
  ]);
  const played = match.narration.filter(
    (event) => event.type === 'CARD_PLAYED',
  );
  expect(match.narration).toContainEqual(
    expect.objectContaining({
      type: 'RELATION_RESOLVED',
      relation: 'IGNORES',
      sourceResolutionId: played[1]!.resolutionId,
      targetResolutionId: played[0]!.resolutionId,
      playerId: source.players[1]!.id,
    }),
  );
  hiddenSafe(match);
});
it('actual compiled Drink with Chaser retains both public definitions and their exact chain context', () => {
  const source = selectedMatch(rdi2Pack, ['rdi2-dimli', 'rdi2-eve']);
  source.publicNarrationVersion = 1;
  keep(source, []);
  source.phase = 'DRINK';
  drinkPile(source, 0, ['wine_chaser']);
  innOrder(source, ['light_ale']);
  const match = new NarrationMatch(source);
  match.send('TAKE_DRINK');
  match.settle();
  const reveals = match.narration.filter(
    (event) => event.type === 'DRINK_REVEALED',
  );
  expect(
    reveals.map((event) => [event.cardDefinitionId, event.chainRole]),
  ).toEqual([
    ['carddef_rdi2_drink_wine_chaser', 'BASE'],
    ['carddef_rdi2_drink_light_ale', 'CHASER'],
  ]);
  expect(reveals[1]!.resolutionId).toBe(reveals[0]!.resolutionId);
  expect(match.narration).toContainEqual(
    expect.objectContaining({
      type: 'STAT_CHANGED',
      stat: 'ALCOHOL',
      delta: 3,
      resolutionId: reveals[0]!.resolutionId,
    }),
  );
  hiddenSafe(match);
});
it('compiled four-player contest publishes final scores, exact tie, second round, winner and actual payout in order', () => {
  const source = selectedMatch(
    combinedPack,
    ['rdi1-deirdre', 'rdi2-dimli', 'rdi2-eve', 'rdi2-gog'],
    true,
  );
  source.publicNarrationVersion = 1;
  keep(source, []);
  source.phase = 'DRINK';
  drinkPile(source, 0, ['drinking_contest']);
  innOrder(source, [
    'wine_chaser',
    'light_ale',
    'elven_wine',
    'dark_ale',
    'water',
    'dragon_breath_ale',
    'light_ale',
  ]);
  const match = new NarrationMatch(source);
  match.send('TAKE_DRINK');
  match.settle();
  const rounds = match.narration.filter(
    (event) => event.type === 'CONTEST_ROUND_STARTED',
  );
  expect(rounds.map((event) => event.round)).toEqual([1, 2]);
  const results = match.narration.filter(
    (event) => event.type === 'CONTEST_RESULT',
  );
  expect(results[0]).toMatchObject({
    highestScore: 3,
    winnerIds: [source.players[0]!.id, source.players[1]!.id],
  });
  expect(results[1]).toMatchObject({
    highestScore: 4,
    winnerIds: [source.players[0]!.id],
  });
  expect(match.state.players.map((player) => player.gold)).toEqual([
    13, 9, 9, 9,
  ]);
  const firstReveal = match.narration.findIndex(
    (event) =>
      event.type === 'DRINK_REVEALED' &&
      event.cardDefinitionId !== 'carddef_rdi2_drink_drinking_contest',
  );
  expect(match.narration.indexOf(rounds[0]!)).toBeLessThan(firstReveal);
  const payments = match.narration
    .filter((event) => event.type === 'PAYMENT_SETTLED')
    .filter((event) => event.destination === 'PLAYER');
  expect(payments).toHaveLength(3);
  expect(
    payments.every(
      (event) =>
        event.recipientPlayerId === source.players[0]!.id && event.amount === 1,
    ),
  ).toBe(true);
  hiddenSafe(match);
});
it('hidden draw, discard, initial dealing, shuffle and private selection expose counts only', () => {
  const setup = { ...setupInput(42, 3), publicNarrationVersion: 1 as const };
  const source = createMatch(setup),
    match = new NarrationMatch(source);
  const command = intent(source, 'START_MATCH');
  const result = applyCommand(source, command, {
    actorId: source.control.hostPlayerId,
    clock: { now: () => 1000 },
  });
  expect(result.status).toBe('ACCEPTED');
  if (result.status !== 'ACCEPTED') throw new Error('Expected start');
  match.accept(result);
  expect(
    match.narration
      .filter((event) => event.type === 'CHARACTER_CARDS_DRAWN')
      .map((event) => event.count),
  ).toEqual([3, 3, 3, 3]);
  expect(
    match.narration
      .filter((event) => event.type === 'DRINK_DEALT')
      .map((event) => event.count),
  ).toEqual([1, 1, 1, 1]);
  const hidden = match.state.players[0]!.hand[0]!;
  const writer = eventWriter(
    match.state,
    commandIdSchema.parse('command_private_choice'),
    stateVersionSchema.parse(match.state.version + 1),
  );
  writer.emit({
    type: 'CHOICE_SELECTED',
    resolutionId: 'resolution_private' as never,
    playerId: match.state.players[0]!.id,
    selections: [hidden],
  });
  const projected = projectPublicNarration(
    writer.events.map((event) => ({ sequence: ++match.sequence, event })),
    match.context,
  );
  expect(projected.events).toEqual([]);
  hiddenSafe(match);
  expect(
    replayFromBeginning({ schemaVersion: 1, setup }, [
      {
        actorId: source.control.hostPlayerId,
        command,
        firstSequence: 1,
        lastSequence: result.events.length,
        events: result.events,
        acceptedAt: new Date(1000).toISOString(),
        clockTime: 1000,
      },
    ]).state,
  ).toEqual(result.state);
});
it('face-down order publishes only the actor, recipient and count while current pile grows', () => {
  const source = state();
  source.phase = 'ORDER_DRINK';
  const match = new NarrationMatch(source);
  const before = source.players[1]!.drinkPile.length;
  match.send('ORDER_DRINK', { targetPlayerId: source.players[1]!.id });
  expect(match.state.players[1]!.drinkPile).toHaveLength(before + 1);
  expect(match.narration).toContainEqual(
    expect.objectContaining({
      type: 'DRINK_ORDERED',
      playerId: source.players[0]!.id,
      targetPlayerId: source.players[1]!.id,
      count: 1,
    }),
  );
  expect(match.narration.some((event) => event.type === 'DRINK_REVEALED')).toBe(
    false,
  );
  hiddenSafe(match);
});
it('non-public resources remain hidden, and public resources need an explicit server allowlist', () => {
  const source = state(),
    writer = eventWriter(
      source,
      commandIdSchema.parse('command_resource_narration'),
      stateVersionSchema.parse(source.version + 1),
    );
  writer.emit({
    type: 'RESOURCE_CHANGED',
    playerId: source.players[0]!.id,
    resource: 'mana',
    delta: 1,
    value: 2,
  });
  const batch = writer.events.map((event, i) => ({ sequence: i + 1, event }));
  expect(projectPublicNarration(batch).events).toEqual([]);
  expect(
    projectPublicNarration(
      batch,
      undefined,
      new Map([[source.players[0]!.id, new Set(['mana'])]]),
    ).events,
  ).toContainEqual(
    expect.objectContaining({
      type: 'RESOURCE_CHANGED',
      resource: 'mana',
      before: 1,
      after: 2,
    }),
  );
});
it('historical setup retains its exact event bytes and omits all opt-in metadata', () => {
  const source = createMatch(setupInput(42, 3)),
    command = intent(source, 'START_MATCH');
  const result = applyCommand(source, command, {
    actorId: source.control.hostPlayerId,
    clock: { now: () => 1000 },
  });
  expect(result.status).toBe('ACCEPTED');
  if (result.status !== 'ACCEPTED') throw new Error('Expected start');
  expect(result.events.every((event) => event.narration === undefined)).toBe(
    true,
  );
  expect(
    replayFromBeginning({ schemaVersion: 1, setup: setupInput(42, 3) }, [
      {
        actorId: source.control.hostPlayerId,
        command,
        firstSequence: 1,
        lastSequence: result.events.length,
        events: result.events,
        acceptedAt: new Date(1000).toISOString(),
        clockTime: 1000,
      },
    ]).state,
  ).toEqual(result.state);
});
it('rejects sequence gaps/duplicates and privacy fields added to public events', () => {
  const source = state(),
    writer = eventWriter(
      source,
      commandIdSchema.parse('command_ordering'),
      stateVersionSchema.parse(source.version + 1),
    );
  writer.emit({
    type: 'TURN_STARTED',
    playerId: source.players[0]!.id,
    turnNumber: 2,
  });
  const batch = writer.events.map((event, i) => ({ sequence: i + 1, event }));
  const projected = projectPublicNarration(batch);
  expect(() => projectPublicNarration(batch, projected.context)).toThrow();
  expect(() =>
    projectPublicNarration([{ ...batch[0]!, sequence: 3 }]),
  ).toThrow();
  expect(
    publicNarrationEventSchema.safeParse({
      ...projected.events[0],
      cardIds: ['card_secret'],
    }).success,
  ).toBe(false);
});

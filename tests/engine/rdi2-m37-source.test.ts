import { expect, it } from 'vitest';
import type { CoreGameState } from '../../src/engine/types';
import type { MutableFrame } from '../../src/engine/effect-operations';
import { applyCommand } from '../../src/engine/commands';
import { intent, mutable } from '../fixtures/core-match';
import { coreStateSchema } from '../../src/engine/replay';
import { recordFortitudeMitigationPlay } from '../../src/engine/fortitude-loss-provenance';
import { cardDefinitionSchema } from '../../src/content/cards';
import { drinkState } from '../fixtures/drink-match';
import {
  projectPublicGame,
  projectPrivatePlayer,
} from '../../src/protocol/projections';
import {
  genericState,
  putCard,
  play,
  send,
  settle,
  until,
  legal,
  systemTrigger,
  reconnectAndReplay,
} from '../fixtures/generic-match';
const trigger = systemTrigger('FORTITUDE_LOSS_RESOLVED', [
  {
    kind: 'ACTUAL_STAT_LOSS',
    stat: 'FORTITUDE',
    relation: 'SELF',
    minAmount: 1,
    requirePlayerCard: true,
    excludeMitigationCardsPlayed: true,
  },
  { kind: 'ORIGINAL_SOURCE_PLAYER', relation: 'OTHER' },
]);
const incoming = {
  event: 'CARD' as const,
  alternatives: [
    [
      {
        kind: 'PENDING_STAT' as const,
        stat: 'FORTITUDE' as const,
        direction: 'LOSS' as const,
        relation: 'SELF' as const,
      },
    ],
  ],
};
function setup(amount = 4) {
  const state = genericState();
  const attack = putCard(
    state,
    0,
    [
      {
        op: 'CHANGE_STAT',
        target: 'CHOSEN_PLAYER',
        stat: 'FORTITUDE',
        delta: -amount,
      },
    ],
    { type: 'ACTION' },
  );
  const retaliation = putCard(
    state,
    1,
    [
      {
        op: 'CHANGE_STAT',
        target: 'ORIGINAL_SOURCE_PLAYER',
        stat: 'FORTITUDE',
        delta: -2,
      },
    ],
    { trigger },
  );
  return { state, attack, retaliation };
}
function postLoss(s: CoreGameState) {
  return until(s, (x) => x.resolutionStack.at(-1)?.task?.kind === 'POST_LOSS');
}
function observer(state: ReturnType<typeof genericState>) {
  putCard(
    state,
    3,
    [{ op: 'CHANGE_STAT', target: 'SELF', stat: 'GOLD', delta: 1 }],
    { trigger: systemTrigger('FORTITUDE_LOSS_RESOLVED') },
  );
}
it('A: clean hit opens only after loss and retaliates against the source; reconnect/replay preserves it', () => {
  const { state, attack, retaliation } = setup(2);
  const played = play(state, 0, attack, state.players[1]!.id).state;
  expect(legal(played, 1, retaliation)).toBeUndefined();
  const pending = postLoss(played);
  expect(pending.players[1]!.fortitude).toBe(state.players[1]!.fortitude - 2);
  expect(pending.resolutionStack.at(-1)!.task).toMatchObject({
    sourceKind: 'CARD',
    playedReduction: false,
    playedIgnore: false,
    originalCard: attack,
    originalPlayer: state.players[0]!.id,
  });
  reconnectAndReplay(pending);
  expect(
    settle(play(pending, 1, retaliation).state).players[0]!.fortitude,
  ).toBe(state.players[0]!.fortitude - 2);
});
it.each([
  [
    'B partial reduction',
    4,
    { op: 'MODIFY_PENDING_EFFECT', effectIndex: 0, delta: 2 },
    false,
    2,
  ],
  [
    'C reduction to zero',
    2,
    { op: 'MODIFY_PENDING_EFFECT', effectIndex: 0, delta: 2 },
    false,
    0,
  ],
  ['D Ignore', 4, { op: 'IGNORE', scope: 'CURRENT_EFFECT' }, false, 0],
  ['E Negated Ignore', 4, { op: 'IGNORE', scope: 'CURRENT_EFFECT' }, true, 4],
  [
    'F Negated reduction',
    4,
    { op: 'MODIFY_PENDING_EFFECT', effectIndex: 0, delta: 2 },
    true,
    4,
  ],
] as const)(
  '%s disqualifies retaliation even when mitigation is Negated',
  (_name, amount, effect, counter, loss) => {
    const { state, attack, retaliation } = setup(amount);
    observer(state);
    const response = putCard(state, 1, [effect], {
      suffix: 'shove',
      trigger: incoming,
    });
    const negate = counter
      ? putCard(state, 2, [{ op: 'NEGATE', scope: 'TOP_STACK' }], {
          trigger: {
            event: 'CARD',
            alternatives: [[{ kind: 'SOURCE_TYPE', types: ['SOMETIMES'] }]],
          },
        })
      : null;
    let pending = until(
      play(state, 0, attack, state.players[1]!.id).state,
      (s) => legal(s, 1, response) !== undefined,
    );
    pending = play(pending, 1, response).state;
    if (negate !== null) {
      pending = until(pending, (s) => legal(s, 2, negate) !== undefined);
      pending = play(pending, 2, negate).state;
    }
    if (loss > 0) {
      pending = postLoss(pending);
      expect(legal(pending, 1, retaliation)).toBeUndefined();
      expect(
        applyCommand(
          pending,
          intent(pending, 'PLAY_RESPONSE', {
            cardId: retaliation,
            responseWindowId: pending.responseWindow!.id,
          }),
          { actorId: state.players[1]!.id },
        ).status,
      ).toBe('REJECTED');
      const task = pending.resolutionStack.at(-1)!.task!;
      expect(task).toMatchObject({
        playedReduction: effect.op === 'MODIFY_PENDING_EFFECT',
        playedIgnore: effect.op === 'IGNORE',
      });
      reconnectAndReplay(pending);
    }
    const final = settle(pending);
    expect(final.players[1]!.fortitude).toBe(
      state.players[1]!.fortitude - loss,
    );
    expect(final.players[0]!.fortitude).toBe(state.players[0]!.fortitude);
    expect(legal(final, 1, retaliation)).toBeUndefined();
    expect(final.players[1]!.hand).toContain(retaliation);
  },
);
it('G: unrelated response does not disqualify retaliation', () => {
  const { state, attack, retaliation } = setup();
  const response = putCard(
    state,
    1,
    [{ op: 'CHANGE_STAT', target: 'SELF', stat: 'ALCOHOL', delta: 1 }],
    { suffix: 'shove', trigger: incoming },
  );
  let pending = until(
    play(state, 0, attack, state.players[1]!.id).state,
    (s) => legal(s, 1, response) !== undefined,
  );
  pending = postLoss(play(pending, 1, response).state);
  expect(legal(pending, 1, retaliation)).toBeDefined();
});
it('H: redirect preserves the original player and is not mitigation by the recipient', () => {
  const { state, attack, retaliation } = setup();
  const redirect = putCard(
    state,
    2,
    [{ op: 'REDIRECT_FORTITUDE_LOSS', target: 'CHOSEN_PLAYER' }],
    { trigger: incoming },
  );
  let pending = until(
    play(state, 0, attack, state.players[2]!.id).state,
    (s) => legal(s, 2, redirect) !== undefined,
  );
  pending = postLoss(play(pending, 2, redirect, state.players[1]!.id).state);
  const final = settle(play(pending, 1, retaliation).state);
  expect(final.players[0]!.fortitude).toBe(state.players[0]!.fortitude - 2);
  expect(final.players[2]!.fortitude).toBe(state.players[2]!.fortitude);
});
it('I: own-card damage does not qualify', () => {
  const { state, retaliation } = setup();
  observer(state);
  const own = putCard(
    state,
    1,
    [{ op: 'CHANGE_STAT', target: 'SELF', stat: 'FORTITUDE', delta: -2 }],
    { suffix: 'shove', type: 'ANYTIME' },
  );
  const pending = postLoss(play(state, 1, own).state);
  expect(legal(pending, 1, retaliation)).toBeUndefined();
  const final = settle(pending);
  expect(final.players[1]!.fortitude).toBe(state.players[1]!.fortitude - 2);
  expect(legal(final, 1, retaliation)).toBeUndefined();
});
it.each(['DRINK', 'DRINK_EVENT'] as const)(
  'J: %s loss has no player-played card provenance',
  (kind) => {
    const state = drinkState([kind === 'DRINK' ? 'fizz' : 'toast']);
    observer(state);
    const retaliation = putCard(
      state,
      0,
      [
        {
          op: 'CHANGE_STAT',
          target: 'ORIGINAL_SOURCE_PLAYER',
          stat: 'FORTITUDE',
          delta: -2,
        },
      ],
      { trigger },
    );
    const id = state.cards[state.players[0]!.drinkPile[0]!]!.definitionId;
    state.definitions[id] = cardDefinitionSchema.parse({
      ...state.definitions[id],
      ...(kind === 'DRINK'
        ? { fortitudeChange: -2 }
        : {
            effects: [
              {
                op: 'CHANGE_STAT',
                target: 'SELF',
                stat: 'FORTITUDE',
                delta: -2,
              },
            ],
          }),
    });
    const pending = postLoss(send(state, 'TAKE_DRINK', {}, 0).state);
    expect(pending.resolutionStack.at(-1)!.task).toMatchObject({
      sourceKind: kind,
    });
    expect(legal(pending, 0, retaliation)).toBeUndefined();
    expect(settle(pending).players[0]!.fortitude).toBe(
      state.players[0]!.fortitude - 2,
    );
  },
);
it('history is scoped to the reduced operation; a later clean loss remains eligible', () => {
  const { state, attack, retaliation } = setup(4);
  observer(state);
  state.definitions[state.cards[attack]!.definitionId]!.effects.push({
    op: 'CHANGE_STAT',
    target: 'CHOSEN_PLAYER',
    stat: 'FORTITUDE',
    delta: -1,
  });
  const response = putCard(
    state,
    1,
    [{ op: 'MODIFY_PENDING_EFFECT', effectIndex: 0, delta: 2 }],
    { suffix: 'shove', trigger: incoming },
  );
  let pending = until(
    play(state, 0, attack, state.players[1]!.id).state,
    (s) => legal(s, 1, response) !== undefined,
  );
  pending = postLoss(play(pending, 1, response).state);
  expect(legal(pending, 1, retaliation)).toBeUndefined();
  pending = until(pending, (s) => {
    const task = s.resolutionStack.at(-1)?.task;
    return task?.kind === 'POST_LOSS' && task.effectIndex === 1;
  });
  expect(legal(pending, 1, retaliation)).toBeDefined();
});
it('another player reducing the loss does not count as the affected player playing mitigation', () => {
  const { state, attack, retaliation } = setup(4);
  const response = putCard(
    state,
    2,
    [{ op: 'MODIFY_PENDING_EFFECT', effectIndex: 0, delta: 2 }],
    {
      trigger: {
        event: 'CARD',
        alternatives: [[{ kind: 'SOURCE_TYPE', types: ['ACTION'] }]],
      },
    },
  );
  let pending = until(
    play(state, 0, attack, state.players[1]!.id).state,
    (s) => legal(s, 2, response) !== undefined,
  );
  pending = postLoss(play(pending, 2, response).state);
  expect(pending.players[1]!.fortitude).toBe(state.players[1]!.fortitude - 2);
  expect(legal(pending, 1, retaliation)).toBeDefined();
});
it('serialized history rejects duplicate, unknown-player and non-Fortitude operation records', () => {
  const { state, attack } = setup();
  const response = putCard(
    state,
    1,
    [{ op: 'MODIFY_PENDING_EFFECT', effectIndex: 0, delta: 2 }],
    { suffix: 'shove', trigger: incoming },
  );
  const pending = until(
    play(state, 0, attack, state.players[1]!.id).state,
    (s) => legal(s, 1, response) !== undefined,
  );
  const played = play(pending, 1, response).state;
  for (const change of ['duplicate', 'player', 'index', 'empty']) {
    const broken = mutable(played),
      frame = broken.resolutionStack[0]!,
      record = frame.fortitudeMitigationPlays![0]!;
    if (change === 'duplicate')
      frame.fortitudeMitigationPlays!.push({ ...record });
    if (change === 'player')
      record.playerId = state.players[3]!.id.replace(
        '3',
        'unknown',
      ) as typeof record.playerId;
    if (change === 'index') record.effectIndex = 31;
    if (change === 'empty') record.playedReduction = false;
    expect(coreStateSchema.safeParse(broken).success).toBe(false);
  }
});
it('strict retaliation fails closed for legacy context without history and keeps hidden IDs private', () => {
  const { state, attack, retaliation } = setup();
  const pending = postLoss(play(state, 0, attack, state.players[1]!.id).state);
  const unknown = mutable(pending),
    task = unknown.resolutionStack.at(-1)!.task!;
  if (task.kind === 'POST_LOSS') {
    delete task.playedReduction;
    delete task.playedIgnore;
  }
  expect(legal(unknown, 1, retaliation)).toBeUndefined();
  expect(JSON.stringify(projectPublicGame(pending))).not.toContain(retaliation);
  expect(
    JSON.stringify(projectPrivatePlayer(pending, pending.players[2]!.id)),
  ).not.toContain(retaliation);
});
it('mitigation history follows redirected recipient and combines multiple attempts once per loss', () => {
  const { state, attack, retaliation } = setup();
  const redirect = putCard(
    state,
    2,
    [{ op: 'REDIRECT_FORTITUDE_LOSS', target: 'CHOSEN_PLAYER' }],
    { trigger: incoming },
  );
  const reduce = putCard(
    state,
    1,
    [{ op: 'MODIFY_PENDING_EFFECT', effectIndex: 0, delta: 1 }],
    { suffix: 'shove', trigger: incoming },
  );
  const ignore = putCard(
    state,
    1,
    [{ op: 'IGNORE', scope: 'CURRENT_EFFECT' }],
    { suffix: 'gamble', trigger: incoming },
  );
  const counter = putCard(state, 3, [{ op: 'NEGATE', scope: 'TOP_STACK' }], {
    suffix: 'shove',
    trigger: {
      event: 'CARD',
      alternatives: [[{ kind: 'SOURCE_TYPE', types: ['SOMETIMES'] }]],
    },
  });
  observer(state);
  let pending = until(
    play(state, 0, attack, state.players[2]!.id).state,
    (s) => legal(s, 2, redirect) !== undefined,
  );
  pending = until(
    play(pending, 2, redirect, state.players[1]!.id).state,
    (s) => legal(s, 1, reduce) !== undefined,
  );
  pending = until(
    play(pending, 1, reduce).state,
    (s) => legal(s, 1, ignore) !== undefined,
  );
  pending = until(
    play(pending, 1, ignore).state,
    (s) => legal(s, 3, counter) !== undefined,
  );
  pending = postLoss(play(pending, 3, counter).state);
  expect(pending.resolutionStack[0]!.fortitudeMitigationPlays).toEqual([
    {
      playerId: state.players[1]!.id,
      effectIndex: 0,
      playedReduction: true,
      playedIgnore: true,
    },
  ]);
  expect(pending.players[1]!.fortitude).toBe(state.players[1]!.fortitude - 3);
  expect(legal(pending, 1, retaliation)).toBeUndefined();
});
it('ignored redirected loss and canceled sources do not accumulate mitigation history', () => {
  const { state, attack } = setup();
  const pending = mutable(play(state, 0, attack, state.players[1]!.id).state),
    source = pending.resolutionStack[0]!;
  const response: MutableFrame = {
    ...source,
    actorId: state.players[1]!.id,
    effects: [{ op: 'IGNORE' as const, scope: 'CURRENT_EFFECT' as const }],
  };
  source.redirectedFortitudePlayerId = state.players[1]!.id;
  source.ignoredPlayerIds.push(state.players[1]!.id);
  recordFortitudeMitigationPlay(pending, response, source);
  expect(source.fortitudeMitigationPlays).toBeUndefined();
  source.ignoredPlayerIds = [];
  source.canceled = true;
  recordFortitudeMitigationPlay(pending, response, source);
  expect(source.fortitudeMitigationPlays).toBeUndefined();
  source.canceled = false;
  response.actorId = null;
  recordFortitudeMitigationPlay(pending, response, source);
  expect(source.fortitudeMitigationPlays).toBeUndefined();
});

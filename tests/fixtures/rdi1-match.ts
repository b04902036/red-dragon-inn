import type { ContentPack } from '../../src/content/pack';
import type { CoreGameState, MutableGameState } from '../../src/engine/types';
import { createMatch } from '../../src/engine/setup';
import { applyCommand } from '../../src/engine/commands';
import { DEFAULT_RULES } from '../../src/engine/rules';
import { assertCoreInvariants } from '../../src/engine/invariants';
import { projectPrivatePlayer } from '../../src/protocol/projections';
import {
  matchIdSchema,
  playerIdSchema,
  roomIdSchema,
} from '../../src/shared/ids';
import type { CardDefinition } from '../../src/content/cards';

const baselines = new WeakMap<ContentPack, Map<string, CoreGameState>>();
export function rdi1Match(content: ContentPack, handSize = 40, seed = 21) {
  const key = `${handSize}:${seed}`;
  const cached = baselines.get(content)?.get(key);
  if (cached) return structuredClone(cached) as MutableGameState;
  const setup = {
    roomId: roomIdSchema.parse('room_rdi1_verification'),
    matchId: matchIdSchema.parse('match_rdi1_verification'),
    hostPlayerId: playerIdSchema.parse('player_0'),
    seed,
    content,
    rules: { ...DEFAULT_RULES, handSize, initialDrinkCount: 0 },
    players: content.characters.map((character, seat) => ({
      id: playerIdSchema.parse(`player_${seat}`),
      characterId: character.id,
      seat: seat as 0 | 1 | 2 | 3,
      displayName: character.name,
    })),
  };
  let state = rdi1Send(createMatch(setup), 0, 'START_MATCH').state;
  state = rdi1Send(state, 0, 'DISCARD', { cardIds: [] }).state;
  const baseline = rdi1Settle(state);
  const values = baselines.get(content) ?? new Map<string, CoreGameState>();
  values.set(key, baseline);
  baselines.set(content, values);
  return structuredClone(baseline) as MutableGameState;
}

export function rdi1Send(
  state: CoreGameState,
  seat: number,
  type: string,
  fields: Record<string, unknown> = {},
  now = state.control.timedPrompt?.openedAt ?? 1000,
) {
  const command = {
    type,
    roomId: state.roomId,
    expectedStateVersion: state.version,
    commandId: `command_rdi1_${state.version + 1}`,
    ...fields,
  };
  const actorId = state.players[seat]!.id;
  const result = applyCommand(state, command, {
    actorId,
    clock: { now: () => now },
  });
  if (result.status !== 'ACCEPTED')
    throw new Error(
      `${type} rejected: ${result.status === 'REJECTED' ? result.code : result.status}`,
    );
  assertCoreInvariants(result.state);
  return { ...result, command, actorId, now };
}

export function rdi1Play(
  state: CoreGameState,
  cardId: string,
  target?: string,
  now?: number,
) {
  const seat = state.players.findIndex((p) =>
    p.hand.some((id) => id === cardId),
  );
  const legal = projectPrivatePlayer(
    state,
    state.players[seat]!.id,
  ).legalPlays.find((p) => p.cardId === cardId);
  if (!legal)
    throw new Error(
      `Missing legalPlay ${state.cards[cardId as keyof typeof state.cards]?.definitionId}`,
    );
  return rdi1Send(
    state,
    seat,
    legal.commandType,
    {
      cardId,
      ...(legal.commandType === 'PLAY_RESPONSE'
        ? { responseWindowId: state.responseWindow!.id }
        : {}),
      ...(legal.promptId ? { promptId: legal.promptId } : {}),
      ...(legal.requiresTarget
        ? { targetPlayerId: target ?? legal.legalTargetPlayerIds[0] }
        : {}),
    },
    now,
  );
}

export function rdi1Pass(state: CoreGameState) {
  const choice = state.responseWindow?.pendingChoice;
  if (choice) {
    const seat = state.players.findIndex((p) => p.id === choice.playerId);
    const fields =
      choice.kind === 'TARGET'
        ? {
            targetPlayerIds: choice.options
              .slice(0, choice.min)
              .map((o) => o.id),
          }
        : choice.kind === 'CARD'
          ? { cardIds: choice.options.slice(0, choice.min).map((o) => o.id) }
          : { optionId: choice.options[0]!.id };
    return rdi1Send(
      state,
      seat,
      choice.kind === 'TARGET'
        ? 'CHOOSE_TARGET'
        : choice.kind === 'CARD'
          ? 'CHOOSE_CARDS'
          : 'CHOOSE_OPTION',
      { responseWindowId: state.responseWindow!.id, ...fields },
    );
  }
  const window = state.responseWindow ?? state.control.phaseEnd;
  const playerId = window?.priorityPlayerId ?? state.gambling?.priorityPlayerId;
  const seat = state.players.findIndex((p) => p.id === playerId);
  if (seat < 0) throw new Error('No decision to pass');
  return rdi1Send(
    state,
    seat,
    state.responseWindow
      ? 'PASS_RESPONSE'
      : state.control.phaseEnd
        ? 'PASS_ANYTIME'
        : 'GAMBLING_PASS',
    window ? { responseWindowId: window.id } : {},
  );
}

export function rdi1Until(
  state: CoreGameState,
  stop: (s: CoreGameState) => boolean,
  limit = 256,
) {
  for (let i = 0; i < limit && !stop(state); i++) state = rdi1Pass(state).state;
  if (!stop(state)) throw new Error('Scenario did not reach its checkpoint');
  return state;
}
export function rdi1Settle(state: CoreGameState) {
  return rdi1Until(state, (s) => !s.responseWindow && !s.control.phaseEnd);
}
export function rdi1Card(
  state: CoreGameState,
  mechanic: string,
  excludedSeat = -1,
) {
  const card = Object.values(state.cards).find(
    (c) =>
      c.definitionId.endsWith(`_${mechanic}`) &&
      c.ownerId !== state.players[excludedSeat]?.id,
  );
  if (!card) throw new Error(`Missing mechanic ${mechanic}`);
  return card.id;
}
export function rdi1Keep(state: MutableGameState, ids: readonly string[]) {
  for (const player of state.players) {
    const removed = player.hand.filter((id) => !ids.includes(id));
    player.hand = player.hand.filter((id) => ids.includes(id));
    player.characterDeck.cardIds.push(...removed);
    for (const id of removed)
      state.cards[id]!.location = {
        zone: 'CHARACTER_DECK',
        playerId: player.id,
        deckId: player.characterDeck.deckId,
      };
  }
}
export function rdi1Activate(state: MutableGameState, cardId: string) {
  state.activePlayerId =
    state.cards[cardId as keyof typeof state.cards]!.ownerId!;
  state.phase = 'ACTION';
}
export function rdi1DrinkPile(
  state: MutableGameState,
  seat: number,
  suffixes: string[],
) {
  const player = state.players[seat]!;
  for (const suffix of suffixes) {
    const index = state.innDrinkDeck.cardIds.findIndex(
      (id) => state.cards[id]!.definitionId === `carddef_rdi1_drink_${suffix}`,
    );
    if (index < 0) throw new Error(`Missing Drink ${suffix}`);
    const [id] = state.innDrinkDeck.cardIds.splice(index, 1);
    player.drinkPile.push(id!);
    state.cards[id!]!.location = { zone: 'DRINK_PILE', playerId: player.id };
  }
}
export function rdi1InnOrder(state: MutableGameState, suffixes: string[]) {
  const chosen = [];
  for (const suffix of suffixes) {
    const index = state.innDrinkDeck.cardIds.findIndex(
      (id) => state.cards[id]!.definitionId === `carddef_rdi1_drink_${suffix}`,
    );
    if (index < 0) throw new Error(`Missing Inn Drink ${suffix}`);
    chosen.push(state.innDrinkDeck.cardIds.splice(index, 1)[0]!);
  }
  state.innDrinkDeck.cardIds.unshift(...chosen);
}

/** Actual compiled definitions, isolated hands; only checkpoint setup is test-owned. */
export function rdi1SometimesContext(
  content: ContentPack,
  definition: CardDefinition,
) {
  if (definition.type !== 'SOMETIMES')
    throw new Error('Expected a Sometimes definition');
  const state = rdi1Match(content);
  const cardId = Object.values(state.cards).find(
    (c) => c.definitionId === definition.id,
  )!.id;
  const seat = state.players.findIndex(
    (p) => p.id === state.cards[cardId]!.ownerId,
  );
  const otherSeat = (seat + 1) % 4;
  const actor = state.players[seat]!.id;
  const alternative = definition.responseTrigger!.alternatives[0]!;
  const events = alternative.find((c) => c.kind === 'SYSTEM_EVENT');
  const sourceType = alternative.find((c) => c.kind === 'SOURCE_TYPE');
  const op = definition.effects[0]!.op;
  let pending: CoreGameState;
  if (definition.phaseOpportunity) {
    rdi1Keep(state, [cardId]);
    state.activePlayerId = actor;
    state.phase = 'ORDER_DRINK';
    pending = rdi1Send(state, seat, 'ORDER_DRINK', {
      targetPlayerId: state.players[otherSeat]!.id,
    }).state;
  } else if (
    events?.kind === 'SYSTEM_EVENT' &&
    events.events.includes('FORTITUDE_LOSS_RESOLVED')
  ) {
    const source = rdi1Card(state, 'damage_two', seat);
    rdi1Keep(state, [cardId, source]);
    rdi1Activate(state, source);
    pending = rdi1Play(state, source, actor).state;
  } else if (
    events?.kind === 'SYSTEM_EVENT' &&
    events.events.includes('GAMBLING_WIN_BEFORE_PAYOUT')
  ) {
    const source = rdi1Card(state, 'gambling_start_or_control', seat);
    rdi1Keep(state, [cardId, source]);
    rdi1Activate(state, source);
    pending = rdi1Play(state, source).state;
  } else if (events?.kind === 'SYSTEM_EVENT' || op === 'CONTEXT_BRANCH') {
    const source = rdi1Card(state, 'gambling_start_or_control', seat);
    rdi1Keep(state, [cardId, source]);
    rdi1Activate(state, source);
    pending = rdi1Play(state, source).state;
  } else if (
    sourceType?.kind === 'SOURCE_TYPE' &&
    sourceType.types.includes('CHEATING')
  ) {
    const start = rdi1Card(state, 'gambling_start_or_control', seat);
    const cheat = rdi1Card(state, 'cheat_take_control', seat);
    rdi1Keep(state, [cardId, start, cheat]);
    rdi1Activate(state, start);
    pending = rdi1Settle(rdi1Play(state, start).state);
    const cheater = state.cards[cheat]!.ownerId!;
    pending = rdi1Until(
      pending,
      (s) => s.gambling?.priorityPlayerId === cheater && !s.responseWindow,
    );
    pending = rdi1Play(pending, cheat).state;
  } else if (
    sourceType?.kind === 'SOURCE_TYPE' &&
    sourceType.types.includes('SOMETIMES') &&
    op === 'NEGATE'
  ) {
    const source = rdi1Card(state, 'add_two_alcohol_to_drink', seat);
    rdi1Keep(state, [cardId, source]);
    state.phase = 'DRINK';
    state.activePlayerId = state.players[otherSeat]!.id;
    rdi1DrinkPile(state, otherSeat, ['wine']);
    pending = rdi1Send(state, otherSeat, 'TAKE_DRINK').state;
    pending = rdi1Until(pending, (s) =>
      projectPrivatePlayer(s, s.cards[source]!.ownerId!).legalPlays.some(
        (p) => p.cardId === source,
      ),
    );
    pending = rdi1Play(pending, source).state;
  } else if (alternative.some((c) => c.kind === 'SOURCE_CAPABILITY')) {
    const source = rdi1Card(state, 'add_two_alcohol_to_drink', seat);
    rdi1Keep(state, [cardId, source]);
    state.phase = 'DRINK';
    state.activePlayerId = state.players[otherSeat]!.id;
    rdi1DrinkPile(state, otherSeat, ['wine']);
    pending = rdi1Send(state, otherSeat, 'TAKE_DRINK').state;
    pending = rdi1Until(pending, (s) =>
      projectPrivatePlayer(s, s.cards[source]!.ownerId!).legalPlays.some(
        (p) => p.cardId === source,
      ),
    );
    pending = rdi1Play(pending, source).state;
  } else if (
    definition.responseTrigger!.event === 'DRINK' ||
    definition.responseTrigger!.event === 'ANY'
  ) {
    rdi1Keep(state, [cardId]);
    const drinkerSeat = op === 'QUEUE_EXTRA_DRINK' ? otherSeat : seat;
    state.phase = 'DRINK';
    state.activePlayerId = state.players[drinkerSeat]!.id;
    rdi1DrinkPile(state, drinkerSeat, ['wine', 'light_ale']);
    pending = rdi1Send(state, drinkerSeat, 'TAKE_DRINK').state;
  } else {
    const source = rdi1Card(state, 'damage_two', seat);
    rdi1Keep(state, [cardId, source]);
    rdi1Activate(state, source);
    pending = rdi1Play(state, source, actor).state;
  }
  pending = rdi1Until(pending, (s) =>
    projectPrivatePlayer(s, actor).legalPlays.some((p) => p.cardId === cardId),
  );
  return { state: pending, cardId, seat };
}

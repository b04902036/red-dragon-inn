import type { ContentPack } from '../../src/content/pack';
import type { CardDefinition } from '../../src/content/cards';
import type { CoreGameState, MutableGameState } from '../../src/engine/types';
import { projectPrivatePlayer } from '../../src/protocol/projections';
import {
  rdi1Match,
  rdi1Send,
  rdi1Play,
  rdi1Keep,
  rdi1Activate,
  rdi1Until,
  rdi1Settle,
  rdi1Card,
} from './rdi1-match';
import { createMatch } from '../../src/engine/setup';
import { DEFAULT_RULES } from '../../src/engine/rules';
import {
  roomIdSchema,
  matchIdSchema,
  playerIdSchema,
} from '../../src/shared/ids';

export {
  rdi1Send as send,
  rdi1Play as play,
  rdi1Keep as keep,
  rdi1Until as until,
  rdi1Settle as settle,
  rdi1Activate as activate,
  rdi1Card as card,
};
export const match = (pack: ContentPack) => rdi1Match(pack);
export function selectedMatch(pack: ContentPack, slugs: string[], bar = false) {
  const ids = slugs.map((slug) => {
    const character = pack.characters.find((c) => c.slug === slug);
    if (!character) throw new Error(`Missing selected character ${slug}`);
    return character;
  });
  const state = createMatch({
    roomId: roomIdSchema.parse('room_rdi2_verification'),
    matchId: matchIdSchema.parse('match_rdi2_verification'),
    hostPlayerId: playerIdSchema.parse('player_0'),
    seed: 24,
    content: pack,
    innDrinkDeckIds: bar
      ? pack.decks.filter((d) => d.type === 'INN_DRINK').map((d) => d.id)
      : ['deck_rdi2_inn'],
    rules: { ...DEFAULT_RULES, handSize: 40, initialDrinkCount: 0 },
    players: ids.map((c, seat) => ({
      id: playerIdSchema.parse(`player_${seat}`),
      characterId: c.id,
      seat: seat as 0 | 1 | 2 | 3,
      displayName: c.name,
    })),
  });
  return structuredClone(
    rdi1Settle(
      rdi1Send(rdi1Send(state, 0, 'START_MATCH').state, 0, 'DISCARD', {
        cardIds: [],
      }).state,
    ),
  ) as MutableGameState;
}
export function definitionCard(state: CoreGameState, id: string) {
  const instance = Object.values(state.cards).find(
    (c) => c.definitionId === id,
  );
  if (!instance) throw new Error(`Missing compiled copy ${id}`);
  return instance.id;
}
function innIndex(state: MutableGameState, definition: string) {
  let index = state.innDrinkDeck.cardIds.findIndex(
    (id) => state.cards[id]!.definitionId === definition,
  );
  if (index < 0 && state.barDrinkDeck) {
    const reserved = state.barDrinkDeck.findIndex(
      (id) => state.cards[id]!.definitionId === definition,
    );
    if (reserved >= 0) {
      const id = state.barDrinkDeck.splice(reserved, 1)[0]!;
      const swap = state.innDrinkDeck.cardIds.pop();
      if (swap) {
        state.barDrinkDeck.push(swap);
        state.cards[swap]!.location = {
          zone: 'INN_BAR_DECK',
          deckId: state.innDrinkDeck.deckId,
        };
      }
      state.innDrinkDeck.cardIds.push(id);
      state.cards[id]!.location = {
        zone: 'INN_DRINK_DECK',
        deckId: state.innDrinkDeck.deckId,
      };
      index = state.innDrinkDeck.cardIds.length - 1;
    }
  }
  return index;
}
export function drinkPile(
  state: MutableGameState,
  seat: number,
  suffixes: string[],
  prefix = 'rdi2',
) {
  for (const suffix of suffixes) {
    const index = innIndex(state, `carddef_${prefix}_drink_${suffix}`);
    if (index < 0) throw new Error(`Missing ${prefix} Drink ${suffix}`);
    const id = state.innDrinkDeck.cardIds.splice(index, 1)[0]!;
    state.players[seat]!.drinkPile.push(id);
    state.cards[id]!.location = {
      zone: 'DRINK_PILE',
      playerId: state.players[seat]!.id,
    };
  }
}
export function innOrder(
  state: MutableGameState,
  suffixes: string[],
  prefix = 'rdi2',
) {
  const ids = suffixes.map((suffix) => {
    const index = innIndex(state, `carddef_${prefix}_drink_${suffix}`);
    if (index < 0) throw new Error(`Missing ${prefix} Inn Drink ${suffix}`);
    return state.innDrinkDeck.cardIds.splice(index, 1)[0]!;
  });
  state.innDrinkDeck.cardIds.unshift(...ids);
}
/** Real compiled sources and commands; only the initial checkpoint/hands are test-owned. */
export function sometimesContext(
  pack: ContentPack,
  definition: CardDefinition,
) {
  if (definition.type !== 'SOMETIMES') throw new Error('Expected Sometimes');
  const base = match(pack),
    cardId = definitionCard(base, definition.id);
  const seat = base.players.findIndex((p) => p.hand.includes(cardId)),
    actor = base.players[seat]!.id;
  const other = (seat + 1) % 4;
  base.players.forEach((p) => {
    p.fortitude = 18;
  });
  const op = definition.effects[0]!.op;
  const conditions = definition.responseTrigger!.alternatives[0]!;
  const events = conditions.find((c) => c.kind === 'SYSTEM_EVENT');
  const sourceType = conditions.find((c) => c.kind === 'SOURCE_TYPE');
  let pending: CoreGameState;
  if (op === 'ORDER_EXTRA_DRINKS' || op === 'ORDER_EXTRA_OR_WAIVE_REFILL') {
    rdi1Keep(base, [cardId]);
    base.activePlayerId = actor;
    base.phase = 'ORDER_DRINK';
    pending = rdi1Send(base, seat, 'ORDER_DRINK', {
      targetPlayerId: base.players[other]!.id,
    }).state;
  } else if (
    op === 'QUEUE_EXTRA_DRINK' &&
    definition.responseTrigger!.event === 'SYSTEM'
  ) {
    rdi1Keep(base, [cardId]);
    base.phase = 'ORDER_DRINK';
    base.activePlayerId = base.players[other]!.id;
    drinkPile(base, other, ['wine', 'light_ale']);
    pending = rdi1Send(base, other, 'ORDER_DRINK', {
      targetPlayerId: base.players[(other + 1) % 4]!.id,
    }).state;
  } else if (
    sourceType?.kind === 'SOURCE_TYPE' &&
    sourceType.types.includes('CHEATING')
  ) {
    const start = rdi1Card(base, 'gambling_start_or_control', seat),
      cheat = rdi1Card(base, 'cheat_take_control', seat);
    rdi1Keep(base, [cardId, start, cheat]);
    rdi1Activate(base, start);
    pending = rdi1Settle(rdi1Play(base, start).state);
    pending = rdi1Until(
      pending,
      (s) =>
        !s.responseWindow &&
        s.gambling?.priorityPlayerId === base.cards[cheat]!.ownerId,
    );
    pending = rdi1Play(pending, cheat).state;
  } else if (
    sourceType?.kind === 'SOURCE_TYPE' &&
    sourceType.types.includes('SOMETIMES') &&
    op === 'NEGATE'
  ) {
    const source = Object.values(base.cards).find(
      (c) =>
        c.ownerId !== actor &&
        base.definitions[c.definitionId]!.effects.some(
          (e) => e.op === 'MODIFY_DRINK' || e.op === 'REPLACE_DRINK_BASE',
        ),
    )!.id;
    rdi1Keep(base, [cardId, source]);
    base.phase = 'DRINK';
    base.activePlayerId = actor;
    drinkPile(base, seat, ['wine']);
    pending = rdi1Send(base, seat, 'TAKE_DRINK').state;
    pending = rdi1Until(pending, (s) =>
      projectPrivatePlayer(s, s.cards[source]!.ownerId!).legalPlays.some(
        (p) => p.cardId === source,
      ),
    );
    pending = rdi1Play(pending, source).state;
  } else if (definition.responseTrigger!.event === 'DRINK') {
    rdi1Keep(base, [cardId]);
    const drinker = ['REPLACE_DRINK_BASE', 'QUEUE_EXTRA_DRINK'].includes(op)
      ? other
      : seat;
    base.phase = 'DRINK';
    base.activePlayerId = base.players[drinker]!.id;
    drinkPile(base, drinker, ['wine', 'light_ale']);
    pending = rdi1Send(base, drinker, 'TAKE_DRINK').state;
  } else if (
    (events?.kind === 'SYSTEM_EVENT' &&
      !events.events.includes('FORTITUDE_LOSS_RESOLVED')) ||
    [
      'CONTEXT_BRANCH',
      'SUBSTITUTE_PAYMENT_FROM_INN',
      'PREVENT_CURRENT_GOLD_LOSS',
    ].includes(op)
  ) {
    const start = rdi1Card(base, 'gambling_start_or_control', seat);
    rdi1Keep(base, [cardId, start]);
    rdi1Activate(base, start);
    pending = rdi1Play(base, start).state;
  } else {
    const source = rdi1Card(base, 'damage_two', seat);
    rdi1Keep(base, [cardId, source]);
    rdi1Activate(base, source);
    pending = rdi1Play(base, source, actor).state;
  }
  pending = rdi1Until(pending, (s) =>
    projectPrivatePlayer(s, actor).legalPlays.some((p) => p.cardId === cardId),
  );
  return { state: pending, cardId, seat };
}

import { sampleContentPack } from '../../src/content/sample';
import { contentPackSchema } from '../../src/content/pack';
import { createMatch } from '../../src/engine/setup';
import type { MatchSetup } from '../../src/engine/setup';
import { DEFAULT_RULES } from '../../src/engine/rules';
import { applyCommand } from '../../src/engine/commands';
import type { CoreGameState, MutableGameState } from '../../src/engine/types';
import type { Seat } from '../../src/engine/model';
import {
  matchIdSchema,
  playerIdSchema,
  roomIdSchema,
} from '../../src/shared/ids';
import type { PlayerId } from '../../src/shared/ids';

export function setupInput(
  seed = 1,
  handSize = 3,
  seats: Seat[] = [0, 1, 2, 3],
): MatchSetup {
  return {
    roomId: roomIdSchema.parse('room_core'),
    matchId: matchIdSchema.parse('match_core'),
    hostPlayerId: playerIdSchema.parse(`player_${seats[0]}`),
    seed,
    content: contentPackSchema.parse(sampleContentPack),
    // Existing rule fixtures isolate untimed mechanics; timed-prompt tests inject real deadlines.
    rules: {
      ...DEFAULT_RULES,
      handSize,
      timing: { responseMs: 0, phaseEndMs: 0 },
    },
    players: seats.map((seat) => ({
      id: playerIdSchema.parse(`player_${seat}`),
      characterId: sampleContentPack.characters[seat]!.id,
      seat,
      displayName: `Sample player ${seat}`,
    })),
  };
}
export function intent(
  state: CoreGameState,
  type: string,
  fields: Record<string, unknown> = {},
) {
  return {
    type,
    commandId: `command_${state.version + 1}`,
    roomId: state.roomId,
    expectedStateVersion: state.version,
    ...fields,
  };
}
export function accepted(
  state: CoreGameState,
  type: string,
  fields: Record<string, unknown> = {},
  actorId: PlayerId = state.activePlayerId ?? state.control.hostPlayerId,
) {
  const result = applyCommand(state, intent(state, type, fields), { actorId });
  if (result.status !== 'ACCEPTED')
    throw new Error(
      `Expected accepted ${type}: ${JSON.stringify(result.status === 'REJECTED' ? result.code : result.status)}`,
    );
  return result;
}
export function started(seed = 1, handSize = 3, seats: Seat[] = [0, 1, 2, 3]) {
  return accepted(createMatch(setupInput(seed, handSize, seats)), 'START_MATCH')
    .state;
}
export function mutable(state: CoreGameState): MutableGameState {
  return structuredClone(state) as MutableGameState;
}
export function withAction(state: CoreGameState, emptyEffects = false) {
  const copy = mutable(state);
  const player = copy.players.find((p) => p.id === copy.activePlayerId)!;
  const card = Object.values(copy.cards).find(
    (c) =>
      c.ownerId === player.id &&
      copy.definitions[c.definitionId]!.type === 'ACTION',
  )!;
  if (!player.hand.includes(card.id)) {
    const replaced = player.hand.pop()!;
    player.characterDeck.cardIds.splice(
      player.characterDeck.cardIds.indexOf(card.id),
      1,
      replaced,
    );
    copy.cards[replaced]!.location = {
      zone: 'CHARACTER_DECK',
      playerId: player.id,
      deckId: player.characterDeck.deckId,
    };
    player.hand.push(card.id);
    card.location = { zone: 'HAND', playerId: player.id };
  }
  if (emptyEffects) copy.definitions[card.definitionId]!.effects = [];
  return { state: copy, cardId: card.id };
}
export function fullTurn(state: CoreGameState) {
  const results = [];
  const phaseResults = [];
  const discards = state.players
    .find((p) => p.id === state.activePlayerId)!
    .hand.slice(0, 2);
  let result = accepted(state, 'DISCARD', { cardIds: discards });
  results.push(result);
  phaseResults.push(result);
  result = accepted(result.state, 'SKIP_ACTION');
  results.push(result);
  phaseResults.push(result);
  const target = result.state.players.find(
    (p) => !p.eliminated && p.id !== result.state.activePlayerId,
  )!;
  result = accepted(result.state, 'ORDER_DRINK', { targetPlayerId: target.id });
  results.push(result);
  while (result.state.responseWindow !== null) {
    result = accepted(
      result.state,
      'PASS_RESPONSE',
      { responseWindowId: result.state.responseWindow.id },
      result.state.responseWindow.priorityPlayerId!,
    );
    results.push(result);
  }
  phaseResults.push(result);
  for (let i = 0; i < 3; i += 1) {
    result = accepted(result.state, 'ADVANCE_PHASE');
    results.push(result);
    if (result.state.responseWindow !== null) {
      while (result.state.responseWindow !== null) {
        result = accepted(
          result.state,
          'PASS_RESPONSE',
          { responseWindowId: result.state.responseWindow.id },
          result.state.responseWindow.priorityPlayerId!,
        );
        results.push(result);
      }
    }
    phaseResults.push(result);
  }
  return {
    state: result.state,
    events: results.flatMap((r) => r.events),
    results,
    phaseResults,
  };
}

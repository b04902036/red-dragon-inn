import type { StateChangingCommand } from '../protocol/commands';
import { requireCommand, CommandError } from './errors';
import { drawHand } from './card-moves';
import { playAction, startDrink } from './timing';
import type { PlayerId } from '../shared/ids';

import { drawFromPiles } from './decks';
import { shuffle } from './rng';
import type { RandomSource } from './rng';
import type { EmitEvent } from './event-writer';
import type { TurnPhase } from './model';
import type { MutableGameState } from './types';

function setPhase(state: MutableGameState, phase: TurnPhase, emit: EmitEvent) {
  state.phase = phase;
  emit({ type: 'PHASE_CHANGED', phase, activePlayerId: state.activePlayerId! });
}
function dealDrinks(
  state: MutableGameState,
  target: MutableGameState['players'][number],
  count: number,
  emit: EmitEvent,
  rng: RandomSource,
) {
  const draw = drawFromPiles(
    state.innDrinkDeck.cardIds,
    state.innDrinkDiscard,
    count,
    state.rng,
    rng,
  );
  state.innDrinkDeck.cardIds = draw.deck;
  state.innDrinkDiscard = draw.discard;
  state.rng = draw.rng;
  for (const step of draw.steps) {
    if (step.kind === 'RESHUFFLE') {
      for (const id of step.cardIds)
        state.cards[id]!.location = {
          zone: 'INN_DRINK_DECK',
          deckId: state.innDrinkDeck.deckId,
        };
      emit({
        type: 'DECK_SHUFFLED',
        deckId: state.innDrinkDeck.deckId,
        playerId: null,
        reason: 'EXHAUSTED',
        cardIds: step.cardIds,
      });
    } else
      for (const id of step.cardIds) {
        state.cards[id]!.location = { zone: 'DRINK_PILE', playerId: target.id };
        target.drinkPile.unshift(id);
      }
  }
  return draw.drawn;
}
function startMatch(
  state: MutableGameState,
  emit: EmitEvent,
  source: RandomSource,
) {
  emit({
    type: 'MATCH_CONFIGURED',
    contentVersionId: state.contentVersionId,
    rngSeed: state.rng.seed,
    rules: state.rules,
  });
  for (const player of state.players) {
    Object.assign(player, state.rules.initialStats);
    emit({
      type: 'PLAYER_STATS_INITIALIZED',
      playerId: player.id,
      fortitude: player.fortitude,
      alcoholContent: player.alcoholContent,
      gold: player.gold,
    });
    const shuffled = shuffle(player.characterDeck.cardIds, state.rng, source);
    player.characterDeck.cardIds = shuffled.cards;
    state.rng = shuffled.state;
    emit({
      type: 'DECK_SHUFFLED',
      deckId: player.characterDeck.deckId,
      playerId: player.id,
      reason: 'INITIAL',
      cardIds: shuffled.cards,
    });
    drawHand(state, player, emit, source);
  }
  const shuffled = shuffle(state.innDrinkDeck.cardIds, state.rng, source);
  state.innDrinkDeck.cardIds = shuffled.cards;
  state.rng = shuffled.state;
  emit({
    type: 'DECK_SHUFFLED',
    deckId: state.innDrinkDeck.deckId,
    playerId: null,
    reason: 'INITIAL',
    cardIds: shuffled.cards,
  });
  for (const player of state.players) {
    const cardIds = dealDrinks(
      state,
      player,
      state.rules.initialDrinkCount,
      emit,
      source,
    );
    if (cardIds.length > 0)
      emit({ type: 'DRINK_DEALT', playerId: player.id, cardIds });
  }
  state.lifecycle = 'PLAYING';
  state.activePlayerId = state.players[0]!.id;
  state.control.turnNumber = 1;
  emit({ type: 'LIFECYCLE_CHANGED', lifecycle: 'PLAYING' });
  emit({
    type: 'MATCH_STARTED',
    playerIds: state.players.map((p) => p.id),
    activePlayerId: state.activePlayerId,
  });
  emit({ type: 'TURN_STARTED', playerId: state.activePlayerId, turnNumber: 1 });
  setPhase(state, 'DISCARD_DRAW', emit);
}
/** Normal turn commands suspend while the independent resolution stack is active. */
export function executeTurnCommand(
  state: MutableGameState,
  command: StateChangingCommand,
  actorId: PlayerId,
  emit: EmitEvent,
  rng: RandomSource,
) {
  requireCommand(
    state.gambling === null &&
      state.responseWindow === null &&
      state.resolutionStack.length === 0,
    'RESOLUTION_PENDING',
  );
  if (command.type === 'START_MATCH') {
    requireCommand(state.lifecycle === 'SETUP', 'WRONG_LIFECYCLE');
    requireCommand(actorId === state.control.hostPlayerId, 'NOT_HOST');
    startMatch(state, emit, rng);
    return;
  }
  requireCommand(state.lifecycle === 'PLAYING', 'WRONG_LIFECYCLE');
  requireCommand(state.activePlayerId === actorId, 'NOT_ACTIVE_PLAYER');
  const player = state.players.find((p) => p.id === actorId)!;
  switch (command.type) {
    case 'DISCARD': {
      requireCommand(state.phase === 'DISCARD_DRAW', 'WRONG_PHASE');
      requireCommand(
        command.cardIds.every((id) => player.hand.includes(id)),
        'CARD_NOT_IN_HAND',
      );
      for (const id of command.cardIds) {
        player.hand.splice(player.hand.indexOf(id), 1);
        player.characterDiscard.push(id);
        state.cards[id]!.location = {
          zone: 'CHARACTER_DISCARD',
          playerId: actorId,
          deckId: player.characterDeck.deckId,
        };
      }
      if (command.cardIds.length > 0)
        emit({
          type: 'CARDS_DISCARDED',
          playerId: actorId,
          cardIds: command.cardIds,
        });
      drawHand(state, player, emit, rng);
      setPhase(state, 'ACTION', emit);
      return;
    }
    case 'PLAY_CARD':
      playAction(state, command, actorId, emit);
      return;
    case 'SKIP_ACTION':
      requireCommand(state.phase === 'ACTION', 'WRONG_PHASE');
      setPhase(state, 'ORDER_DRINK', emit);
      return;
    case 'ORDER_DRINK': {
      requireCommand(state.phase === 'ORDER_DRINK', 'WRONG_PHASE');
      const target = state.players.find((p) => p.id === command.targetPlayerId);
      requireCommand(
        target !== undefined && !target.eliminated && target.id !== actorId,
        'INVALID_TARGET',
      );
      const drawn = dealDrinks(state, target, 1, emit, rng);
      if (drawn.length === 0)
        emit({
          type: 'DRINK_ORDER_SKIPPED',
          playerId: actorId,
          targetPlayerId: target.id,
          reason: 'EMPTY_INN',
        });
      else
        emit({
          type: 'DRINK_ORDERED',
          playerId: actorId,
          targetPlayerId: target.id,
          cardId: drawn[0]!,
        });
      setPhase(state, 'DRINK', emit);
      return;
    }
    case 'TAKE_DRINK':
      requireCommand(state.phase === 'DRINK', 'WRONG_PHASE');
      startDrink(state, actorId, emit, rng);
      return;
    case 'ADVANCE_PHASE': {
      if (state.phase === 'DRINK') startDrink(state, actorId, emit, rng);
      else if (state.phase === 'ELIMINATION_CHECK')
        setPhase(state, 'NEXT_TURN', emit);
      else {
        requireCommand(state.phase === 'NEXT_TURN', 'WRONG_PHASE');
        requireCommand(
          state.control.turnNumber < Number.MAX_SAFE_INTEGER,
          'TURN_LIMIT',
        );
        const seats = [...state.players].sort((a, b) => a.seat - b.seat);
        const current = seats.findIndex((p) => p.id === actorId);
        const next = [
          ...seats.slice(current + 1),
          ...seats.slice(0, current + 1),
        ].find((p) => !p.eliminated)!;
        state.activePlayerId = next.id;
        state.control.turnNumber += 1;
        emit({
          type: 'TURN_STARTED',
          playerId: next.id,
          turnNumber: state.control.turnNumber,
        });
        setPhase(state, 'DISCARD_DRAW', emit);
      }
      return;
    }
    default:
      throw new CommandError('UNSUPPORTED_COMMAND');
  }
}

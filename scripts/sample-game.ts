import { applyCommand } from '../src/engine/commands';
import { createMatch } from '../src/engine/setup';
import { sampleContentPack } from '../src/content/sample';
import { DEFAULT_RULES } from '../src/engine/rules';
import { matchIdSchema, roomIdSchema, playerIdSchema } from '../src/shared/ids';
import type { CoreGameState } from '../src/engine/types';
import type { PlayerId } from '../src/shared/ids';
import type { DomainEvent } from '../src/protocol/events';
import { projectPublicGame } from '../src/protocol/projections';

export function sampleGameSetup(seed = 1) {
  return createMatch({
    roomId: roomIdSchema.parse('room_complete'),
    matchId: matchIdSchema.parse('match_complete'),
    hostPlayerId: playerIdSchema.parse('player_0'),
    seed,
    content: sampleContentPack,
    rules: {
      ...DEFAULT_RULES,
      initialStats: { ...DEFAULT_RULES.initialStats, fortitude: 4 },
    },
    players: sampleContentPack.characters.map((character, seat) => ({
      id: playerIdSchema.parse(`player_${seat}`),
      characterId: character.id,
      seat: seat as 0 | 1 | 2 | 3,
      displayName: `Sample player ${seat + 1}`,
    })),
  });
}
/** Command-only sample match: no authoritative edits or bespoke card definitions. */
export function runSampleGame(initial: CoreGameState = sampleGameSetup()) {
  let state = initial;
  const commands: { payload: Record<string, unknown>; actorId: PlayerId }[] =
    [];
  const events: DomainEvent[] = [];
  const rows: { label: string; view: ReturnType<typeof projectPublicGame> }[] =
    [];
  const accept = (
    type: string,
    fields: Record<string, unknown> = {},
    actorId = state.activePlayerId ?? state.control.hostPlayerId,
  ) => {
    const payload = {
      type,
      ...fields,
      roomId: state.roomId,
      commandId: `command_${state.version + 1}`,
      expectedStateVersion: state.version,
    };
    const result = applyCommand(state, payload, { actorId });
    if (result.status !== 'ACCEPTED')
      throw new Error(
        `Sample game failed: ${type} ${result.status === 'REJECTED' ? result.code : result.status}`,
      );
    commands.push({ payload, actorId });
    events.push(...result.events);
    state = result.state;
    if (
      type === 'START_MATCH' ||
      result.events.some(
        (event) =>
          event.type === 'DRINK_DISCARDED' ||
          event.type === 'GAMBLING_FINISHED' ||
          event.type === 'PLAYER_ELIMINATED',
      )
    )
      rows.push({
        label:
          type === 'START_MATCH'
            ? 'Start match'
            : result.events.some((event) => event.type === 'GAMBLING_FINISHED')
              ? 'Gambling settles'
              : 'Drink resolves',
        view: projectPublicGame(state),
      });
  };
  if (state.lifecycle === 'SETUP') accept('START_MATCH');
  let startedGambling =
    events.some((event) => event.type === 'GAMBLING_STARTED') ||
    state.control.turnNumber > 1;
  while (state.lifecycle !== 'FINISHED') {
    if (commands.length >= 1000) throw new Error('Sample game command limit');
    if (state.responseWindow !== null) {
      accept(
        'PASS_RESPONSE',
        { responseWindowId: state.responseWindow.id },
        state.responseWindow.priorityPlayerId!,
      );
      continue;
    }
    if (state.gambling !== null) {
      accept('GAMBLING_PASS', {}, state.gambling.priorityPlayerId!);
      continue;
    }
    const actor = state.players.find(
      (player) => player.id === state.activePlayerId,
    )!;
    switch (state.phase) {
      case 'DISCARD_DRAW':
        accept('DISCARD', { cardIds: [] });
        break;
      case 'ACTION': {
        const gamble = actor.hand.find(
          (id) =>
            state.definitions[state.cards[id]!.definitionId]!.type ===
            'GAMBLING',
        );
        if (!startedGambling && gamble !== undefined) {
          startedGambling = true;
          accept('PLAY_CARD', { cardId: gamble });
        } else accept('SKIP_ACTION');
        break;
      }
      case 'ORDER_DRINK': {
        const living = state.players
          .filter((player) => !player.eliminated)
          .sort((a, b) => a.seat - b.seat);
        const target =
          living[
            (living.findIndex((player) => player.id === actor.id) + 1) %
              living.length
          ]!;
        accept('ORDER_DRINK', { targetPlayerId: target.id });
        break;
      }
      case 'DRINK':
        accept('TAKE_DRINK');
        break;
      default:
        accept('ADVANCE_PHASE');
    }
  }
  return { state, events, commands, rows };
}

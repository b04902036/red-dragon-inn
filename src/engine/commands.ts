import { clientCommandSchema } from '../protocol/commands';
import type { DomainEvent } from '../protocol/events';
import { playerIdSchema } from '../shared/ids';
import type { PlayerId } from '../shared/ids';
import { nextStateVersion } from '../shared/version';
import type { StateVersion } from '../shared/version';
import { assertCoreInvariants } from './invariants';
import { eventWriter } from './event-writer';
import { mulberry32 } from './rng';
import type { RandomSource } from './rng';
import { executeTurnCommand } from './turn';
import { executeTimingCommand } from './timing';
import { checkEliminations } from './elimination';
import { CommandError } from './errors';
import type { RejectionCode } from './errors';
import type { CoreGameState, MutableGameState } from './types';

export type CommandResult =
  | {
      status: 'ACCEPTED';
      state: CoreGameState;
      events: DomainEvent[];
      acceptedVersion: StateVersion;
    }
  | {
      status: 'DUPLICATE';
      state: CoreGameState;
      events: [];
      acceptedVersion: StateVersion;
    }
  | {
      status: 'REJECTED';
      state: CoreGameState;
      events: [];
      code: RejectionCode;
    };
export interface CommandContext {
  actorId: PlayerId;
  rng?: RandomSource;
}
/** actorId is trusted server session context. Untrusted payloads pass strict parsing here. */
export function applyCommand(
  state: CoreGameState,
  input: unknown,
  context: CommandContext,
): CommandResult {
  assertCoreInvariants(state);
  const reject = (code: RejectionCode): CommandResult => ({
    status: 'REJECTED',
    state,
    events: [],
    code,
  });
  const parsed = clientCommandSchema.safeParse(input);
  if (!parsed.success) return reject('INVALID_COMMAND');
  const command = parsed.data;
  if (command.roomId !== state.roomId) return reject('WRONG_ROOM');
  const actor = playerIdSchema.safeParse(context.actorId);
  if (!actor.success || !state.players.some((p) => p.id === actor.data))
    return reject('UNKNOWN_PLAYER');
  const fingerprint = JSON.stringify(command);
  const receipt = state.control.acceptedCommands[command.commandId];
  if (receipt !== undefined) {
    if (receipt.actorId !== actor.data || receipt.fingerprint !== fingerprint)
      return reject('COMMAND_ID_CONFLICT');
    return {
      status: 'DUPLICATE',
      state,
      events: [],
      acceptedVersion: receipt.acceptedVersion,
    };
  }
  if (command.type === 'JOIN_ROOM') return reject('UNSUPPORTED_COMMAND');
  if (command.expectedStateVersion !== state.version)
    return reject('VERSION_CONFLICT');
  if (state.version === Number.MAX_SAFE_INTEGER)
    return reject('VERSION_EXHAUSTED');
  const version = nextStateVersion(state.version);
  // Work on a detached transaction draft. Errors cannot partially mutate the caller's state or RNG.
  const draft = JSON.parse(JSON.stringify(state)) as MutableGameState;
  draft.version = version;
  const writer = eventWriter(draft, command.commandId, version);
  try {
    if (
      !executeTimingCommand(
        draft,
        command,
        actor.data,
        writer.emit,
        context.rng ?? mulberry32,
      )
    )
      executeTurnCommand(
        draft,
        command,
        actor.data,
        writer.emit,
        context.rng ?? mulberry32,
      );
    checkEliminations(draft, writer.emit);
  } catch (error) {
    if (error instanceof CommandError) return reject(error.code);
    throw error;
  }
  draft.control.acceptedCommands[command.commandId] = {
    actorId: actor.data,
    fingerprint,
    acceptedVersion: version,
  };
  assertCoreInvariants(draft);
  return {
    status: 'ACCEPTED',
    state: draft,
    events: writer.events,
    acceptedVersion: version,
  };
}

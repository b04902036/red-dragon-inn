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
import {
  executeTimingCommand,
  drain,
  maintainPhaseOpportunity,
} from './timing';
import { checkEliminations } from './elimination';
import { CommandError } from './errors';
import type { RejectionCode } from './errors';
import type { CoreGameState, MutableGameState } from './types';
import { synchronizePrompt } from './timed-prompts';
import type { Clock } from './timed-prompts';
import { systemActionSchema } from './system-actions';

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
  clock?: Clock;
}
/** actorId is trusted server session context. Untrusted payloads pass strict parsing here. */
export function applyCommand(
  state: CoreGameState,
  input: unknown,
  context: CommandContext,
): CommandResult {
  return transact(state, input, context, false);
}
/** This boundary is callable only by the server alarm/replay, never by the socket parser. */
export function applyTimeout(
  state: CoreGameState,
  input: unknown,
): CommandResult {
  const parsed = systemActionSchema.safeParse(input);
  const prompt = state.control.timedPrompt;
  if (
    !parsed.success ||
    prompt === null ||
    prompt.deadlineAt === null ||
    parsed.data.promptId !== prompt.promptId ||
    parsed.data.now < prompt.deadlineAt
  )
    return { status: 'REJECTED', state, events: [], code: 'WRONG_WINDOW' };
  return transact(
    state,
    parsed.data,
    { actorId: prompt.priorityPlayerId, clock: { now: () => parsed.data.now } },
    true,
  );
}
function transact(
  state: CoreGameState,
  input: unknown,
  context: CommandContext,
  system: boolean,
): CommandResult {
  assertCoreInvariants(state);
  const reject = (code: RejectionCode): CommandResult => ({
    status: 'REJECTED',
    state,
    events: [],
    code,
  });
  const parsed = system
    ? systemActionSchema.safeParse(input)
    : clientCommandSchema.safeParse(input);
  if (!parsed.success) return reject('INVALID_COMMAND');
  const command = parsed.data;
  const now = context.clock?.now() ?? 0;
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
  if (
    'promptId' in command &&
    command.type !== 'EXPIRE_PROMPT' &&
    command.promptId !== undefined &&
    command.promptId !== state.control.timedPrompt?.promptId
  )
    return reject('WRONG_WINDOW');
  if (state.version === Number.MAX_SAFE_INTEGER)
    return reject('VERSION_EXHAUSTED');
  if (
    !system &&
    context.clock !== undefined &&
    state.control.timedPrompt !== null &&
    state.control.timedPrompt.deadlineAt !== null &&
    now >= state.control.timedPrompt.deadlineAt
  )
    return reject('WRONG_WINDOW');
  const version = nextStateVersion(state.version);
  // Work on a detached transaction draft. Errors cannot partially mutate the caller's state or RNG.
  const draft = JSON.parse(JSON.stringify(state)) as MutableGameState;
  draft.version = version;
  const writer = eventWriter(draft, command.commandId, version);
  try {
    const dispatched =
      command.type === 'EXPIRE_PROMPT'
        ? {
            type:
              draft.control.timedPrompt!.kind === 'RESPONSE_DECISION'
                ? ('PASS_RESPONSE' as const)
                : ('PASS_ANYTIME' as const),
            commandId: command.commandId,
            roomId: command.roomId,
            expectedStateVersion: command.expectedStateVersion,
            responseWindowId: draft.control.timedPrompt!.windowId,
          }
        : command;
    if (command.type === 'EXPIRE_PROMPT')
      writer.emit({
        type: 'TIMED_PROMPT_EXPIRED',
        promptId: command.promptId,
        expiredAt: now,
      });
    if (
      !executeTimingCommand(
        draft,
        dispatched,
        actor.data,
        writer.emit,
        context.rng ?? mulberry32,
      )
    )
      executeTurnCommand(
        draft,
        dispatched,
        actor.data,
        writer.emit,
        context.rng ?? mulberry32,
      );
    drain(draft, writer.emit, context.rng ?? mulberry32);
    maintainPhaseOpportunity(draft, writer.emit);
    synchronizePrompt(draft, now, writer.emit);
    if (maintainPhaseOpportunity(draft, writer.emit))
      synchronizePrompt(draft, now, writer.emit);
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

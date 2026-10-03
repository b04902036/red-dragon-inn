import { z } from 'zod';
import { createMatch, matchSetupSchema } from './setup';
import { applyCommand, applyTimeout } from './commands';
import { systemActionSchema } from './system-actions';
import { assertCoreInvariants } from './invariants';
import type { CoreGameState } from './types';
import { playerIdSchema } from '../shared/ids';
import { clientCommandSchema } from '../protocol/commands';
import { domainEventSchema } from '../protocol/events';

export const replaySequenceSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
export const coreStateSchema = z.custom<CoreGameState>((value) => {
  try {
    z.json().parse(value);
    assertCoreInvariants(value as CoreGameState);
    return true;
  } catch {
    return false;
  }
});
export const replayManifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  setup: matchSetupSchema,
});
export const replayEntrySchema = z
  .strictObject({
    actorId: playerIdSchema,
    command: z
      .union([clientCommandSchema, systemActionSchema])
      .refine(
        (command) => command.type !== 'JOIN_ROOM',
        'Join is not a match command',
      ),
    firstSequence: replaySequenceSchema.min(1),
    lastSequence: replaySequenceSchema.min(1),
    events: z.array(domainEventSchema).min(1).max(1000),
    acceptedAt: z.iso.datetime(),
    clockTime: z.number().int().nonnegative().safe().optional(),
  })
  .refine(
    (entry) =>
      entry.lastSequence - entry.firstSequence + 1 === entry.events.length,
    'Invalid event sequence range',
  );
export type ReplayManifest = z.infer<typeof replayManifestSchema>;
export type ReplayEntry = z.infer<typeof replayEntrySchema>;

/** Replay accepted commands and verify every regenerated event, including hidden events. Server only. */
export function replayFromSnapshot(
  snapshot: unknown,
  afterSequence: number,
  history: readonly unknown[],
) {
  let state = coreStateSchema.parse(snapshot);
  let sequence = replaySequenceSchema.parse(afterSequence);
  for (const raw of history) {
    const entry = replayEntrySchema.parse(raw);
    if (entry.firstSequence !== sequence + 1)
      throw new RangeError('Replay history sequence gap or duplicate');
    const result =
      entry.command.type === 'EXPIRE_PROMPT'
        ? applyTimeout(state, entry.command)
        : applyCommand(state, entry.command, {
            actorId: entry.actorId,
            ...(entry.clockTime === undefined
              ? {}
              : { clock: { now: () => entry.clockTime! } }),
          });
    if (result.status !== 'ACCEPTED')
      throw new RangeError('Replay command was not accepted');
    if (JSON.stringify(result.events) !== JSON.stringify(entry.events))
      throw new RangeError('Replay event mismatch');
    state = result.state;
    sequence = entry.lastSequence;
  }
  return {
    state: JSON.parse(JSON.stringify(state)) as CoreGameState,
    sequence,
  };
}
export function replayFromBeginning(
  manifest: unknown,
  history: readonly unknown[],
) {
  const source = replayManifestSchema.parse(manifest);
  return replayFromSnapshot(createMatch(source.setup), 0, history);
}
export function shouldSaveSnapshot(
  before: CoreGameState,
  after: CoreGameState,
) {
  return (
    after.version % 10 === 0 ||
    before.lifecycle !== after.lifecycle ||
    before.phase !== after.phase ||
    before.responseWindow?.id !== after.responseWindow?.id ||
    before.gambling?.stage !== after.gambling?.stage
  );
}

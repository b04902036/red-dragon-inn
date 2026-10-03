import { z } from 'zod';
import { MATCH_LIFECYCLES } from '../../src/engine/model';
import { domainEventSchema } from '../../src/protocol/events';
import {
  characterIdSchema,
  contentVersionIdSchema,
  matchIdSchema,
  playerIdSchema,
  roomIdSchema,
} from '../../src/shared/ids';
import { stateVersionSchema } from '../../src/shared/version';

export const sequenceSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
export const matchPlayerSchema = z.strictObject({
  playerId: playerIdSchema,
  characterId: characterIdSchema,
  seat: z.number().int().min(0).max(3),
  displayName: z.string().min(1).max(80),
});
export const matchCreateSchema = z.strictObject({
  id: matchIdSchema,
  roomId: roomIdSchema,
  contentVersionId: contentVersionIdSchema,
  rngSeed: z.number().int().min(0).max(4294967295),
  players: z
    .array(matchPlayerSchema)
    .min(2)
    .max(4)
    .refine(
      (players) =>
        new Set(players.map((player) => player.playerId)).size ===
        players.length,
      'Duplicate player ID',
    )
    .refine(
      (players) =>
        new Set(players.map((player) => player.seat)).size === players.length,
      'Duplicate seat',
    ),
});
export const matchRecordSchema = z.strictObject({
  ...matchCreateSchema.shape,
  lifecycle: z.enum(MATCH_LIFECYCLES),
  version: stateVersionSchema,
  createdAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
});
export const storedEventSchema = z.strictObject({
  sequence: sequenceSchema.min(1),
  event: domainEventSchema,
});
export const snapshotDataSchema = z
  .looseObject({
    schemaVersion: z.literal(1),
    roomId: roomIdSchema,
    matchId: matchIdSchema,
    version: stateVersionSchema,
  })
  .catchall(z.json());
export const snapshotInputSchema = z
  .strictObject({
    sequence: sequenceSchema,
    stateVersion: stateVersionSchema,
    snapshot: snapshotDataSchema,
  })
  .refine(
    (input) => input.stateVersion === input.snapshot.version,
    'Snapshot version mismatch',
  );
export const storedSnapshotSchema = z.strictObject({
  ...snapshotInputSchema.shape,
  matchId: matchIdSchema,
  createdAt: z.iso.datetime(),
});

export function parseJsonColumn(value: unknown): unknown {
  return JSON.parse(z.string().parse(value)) as unknown;
}

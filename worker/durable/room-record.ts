import { z } from 'zod';
import { assertCoreInvariants } from '../../src/engine/invariants';
import type { CoreGameState } from '../../src/engine/types';
import {
  characterIdSchema,
  matchIdSchema,
  contentVersionIdSchema,
  playerIdSchema,
  roomIdSchema,
} from '../../src/shared/ids';
import { sessionIdSchema } from '../../src/protocol/rooms';
import { stateVersionSchema } from '../../src/shared/version';
import { socketAbuseSchema } from './abuse';

export const roomRecordSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    devCardSelection: z.literal(true).optional(),
    roomId: roomIdSchema,
    contentVersionId: contentVersionIdSchema,
    version: stateVersionSchema,
    hostPlayerId: playerIdSchema,
    seed: z.number().int().min(0).max(0xffffffff),
    players: z
      .array(
        z.strictObject({
          id: playerIdSchema,
          seat: z.union([
            z.literal(0),
            z.literal(1),
            z.literal(2),
            z.literal(3),
          ]),
          displayName: z.string().min(1).max(80),
          characterId: characterIdSchema,
          tokenHash: z.string().regex(/^[a-f0-9]{64}$/),
          activeSessionId: sessionIdSchema.nullable(),
        }),
      )
      .min(1)
      .max(4),
    game: z
      .custom<CoreGameState>((value) => {
        try {
          assertCoreInvariants(value as CoreGameState);
          return true;
        } catch {
          return false;
        }
      })
      .nullable(),
  })
  .superRefine((room, ctx) => {
    if (
      new Set(room.players.map((player) => player.id)).size !==
        room.players.length ||
      new Set(room.players.map((player) => player.seat)).size !==
        room.players.length ||
      !room.players.some((player) => player.id === room.hostPlayerId) ||
      (room.game !== null &&
        (room.game.roomId !== room.roomId ||
          room.game.contentVersionId !== room.contentVersionId ||
          room.game.version !== room.version ||
          room.game.control.hostPlayerId !== room.hostPlayerId ||
          JSON.stringify(room.game.players.map((player) => player.id)) !==
            JSON.stringify(room.players.map((player) => player.id))))
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid authoritative room record',
      });
  });
export type RoomRecord = z.infer<typeof roomRecordSchema>;
export const attachmentSchema = z.strictObject({
  timelineMatchId: matchIdSchema.optional(),
  timelineSequence: z.number().int().safe().nonnegative().optional(),
  abuse: socketAbuseSchema.optional(),
  playerId: playerIdSchema,
  sessionId: sessionIdSchema,
  privateSignature: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
});
export type SessionAttachment = z.infer<typeof attachmentSchema>;
export const ROOM_STORAGE_KEY = 'room';

export function opaqueId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;
}
export function issueToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}
export async function digest(value: string) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

import { z } from 'zod';
import { clientCommandSchema } from './commands';
import { playerIdSchema, roomIdSchema } from '../shared/ids';
import { publicGameViewSchema } from './views';

export const resumeTokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const sessionIdSchema = z.string().regex(/^session_[a-f0-9]{32}$/);
export const roomJoinSchema = z.strictObject({
  displayName: z.string().trim().min(1).max(80),
});
export const clientRoomMessageSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('HELLO'),
    roomId: roomIdSchema,
    playerId: playerIdSchema,
    resumeToken: resumeTokenSchema,
  }),
  z.strictObject({ type: z.literal('COMMAND'), command: clientCommandSchema }),
  z.strictObject({ type: z.literal('PING'), nonce: z.string().min(1).max(64) }),
]);
export type ClientRoomMessage = z.infer<typeof clientRoomMessageSchema>;
export const roomMetadataSchema = z.strictObject({
  roomId: roomIdSchema,
  hostPlayerId: playerIdSchema,
  maxPlayers: z.literal(4),
  view: publicGameViewSchema,
});
export const roomCredentialsSchema = z.strictObject({
  roomId: roomIdSchema,
  playerId: playerIdSchema,
  resumeToken: resumeTokenSchema,
});
export const roomJoinResponseSchema = z.strictObject({
  ...roomMetadataSchema.shape,
  credentials: roomCredentialsSchema,
});

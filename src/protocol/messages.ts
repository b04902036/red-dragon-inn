import { z } from 'zod';
import { commandIdSchema, playerIdSchema, roomIdSchema } from '../shared/ids';
import { sessionIdSchema } from './rooms';
import { presenceSchema } from './presentation';
import { stateVersionSchema } from '../shared/version';
import { privatePlayerViewSchema, publicGameViewSchema } from './views';

// There is deliberately no raw DOMAIN_EVENT or authoritative-state socket variant.
export const serverMessageSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('ROOM_PRESENCE'),
    roomId: roomIdSchema,
    players: presenceSchema,
  }),
  z.strictObject({
    type: z.literal('SESSION_ACCEPTED'),
    roomId: roomIdSchema,
    playerId: playerIdSchema,
    hostPlayerId: playerIdSchema,
    sessionId: sessionIdSchema,
    stateVersion: stateVersionSchema,
  }),
  z.strictObject({ type: z.literal('PONG'), nonce: z.string().min(1).max(64) }),
  z.strictObject({
    type: z.literal('PUBLIC_STATE'),
    view: publicGameViewSchema,
  }),
  z.strictObject({
    type: z.literal('PRIVATE_STATE'),
    view: privatePlayerViewSchema,
  }),
  z.strictObject({
    type: z.literal('COMMAND_ACCEPTED'),
    commandId: commandIdSchema,
    stateVersion: stateVersionSchema,
  }),
  z.strictObject({
    type: z.literal('COMMAND_REJECTED'),
    commandId: commandIdSchema.nullable(),
    stateVersion: stateVersionSchema,
    code: z.enum([
      'INVALID_COMMAND',
      'VERSION_CONFLICT',
      'NOT_ALLOWED',
      'ROOM_FULL',
      'AUTH_REQUIRED',
      'INVALID_SESSION',
      'NOT_ENOUGH_PLAYERS',
      'MATCH_STARTED',
      'PERSISTENCE_UNAVAILABLE',
      'RATE_LIMITED',
    ]),
    reason: z.string().max(80).optional(),
  }),
]);

export type ServerMessage = z.infer<typeof serverMessageSchema>;

import { z } from 'zod';
import {
  cardInstanceIdSchema,
  commandIdSchema,
  playerIdSchema,
  responseWindowIdSchema,
  roomIdSchema,
} from '../shared/ids';
import { stateVersionSchema } from '../shared/version';

const cardIds = z
  .array(cardInstanceIdSchema)
  .max(64)
  .refine(
    (ids) => new Set(ids).size === ids.length,
    'Duplicate card instance ID',
  );
const playerIds = z
  .array(playerIdSchema)
  .min(1)
  .max(4)
  .refine(
    (ids) => new Set(ids).size === ids.length,
    'Duplicate target player ID',
  );
const mutationFields = {
  commandId: commandIdSchema,
  roomId: roomIdSchema,
  expectedStateVersion: stateVersionSchema,
};

// Identity after joining is supplied by the authenticated connection, never by a payload actorId.
export const clientCommandSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('JOIN_ROOM'),
    commandId: commandIdSchema,
    roomId: roomIdSchema,
    displayName: z
      .string()
      .min(1)
      .max(80)
      .refine((name) => name.trim().length > 0, 'Display name is blank'),
  }),
  z.strictObject({ type: z.literal('START_MATCH'), ...mutationFields }),
  z.strictObject({ type: z.literal('DISCARD'), ...mutationFields, cardIds }),
  z.strictObject({
    type: z.literal('PLAY_CARD'),
    ...mutationFields,
    cardId: cardInstanceIdSchema,
    targetPlayerId: playerIdSchema.optional(),
  }),
  z.strictObject({ type: z.literal('SKIP_ACTION'), ...mutationFields }),
  z.strictObject({ type: z.literal('ADVANCE_PHASE'), ...mutationFields }),
  z.strictObject({ type: z.literal('TAKE_DRINK'), ...mutationFields }),
  z.strictObject({
    type: z.literal('PLAY_RESPONSE'),
    ...mutationFields,
    responseWindowId: responseWindowIdSchema,
    cardId: cardInstanceIdSchema,
    targetPlayerId: playerIdSchema.optional(),
  }),
  z.strictObject({
    type: z.literal('CHOOSE_CARDS'),
    ...mutationFields,
    responseWindowId: responseWindowIdSchema,
    cardIds: cardIds.min(1),
  }),
  z.strictObject({
    type: z.literal('CHOOSE_TARGET'),
    ...mutationFields,
    responseWindowId: responseWindowIdSchema,
    targetPlayerIds: playerIds,
  }),
  z.strictObject({
    type: z.literal('PASS_RESPONSE'),
    ...mutationFields,
    responseWindowId: responseWindowIdSchema,
  }),
  z.strictObject({
    type: z.literal('ORDER_DRINK'),
    ...mutationFields,
    targetPlayerId: playerIdSchema,
  }),
  z.strictObject({
    type: z.literal('GAMBLING_PLAY'),
    ...mutationFields,
    cardId: cardInstanceIdSchema,
    targetPlayerId: playerIdSchema.optional(),
  }),
  z.strictObject({ type: z.literal('GAMBLING_PASS'), ...mutationFields }),
  z.strictObject({ type: z.literal('GAMBLING_LEAVE'), ...mutationFields }),
  z.strictObject({
    type: z.literal('CHOOSE_OPTION'),
    ...mutationFields,
    responseWindowId: responseWindowIdSchema,
    optionId: z.string().min(1).max(128),
  }),
]);

export type ClientCommand = z.infer<typeof clientCommandSchema>;
export type StateChangingCommand = Exclude<
  ClientCommand,
  { type: 'JOIN_ROOM' }
>;

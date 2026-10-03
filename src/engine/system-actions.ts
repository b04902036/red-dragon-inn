import { z } from 'zod';
import { commandIdSchema, roomIdSchema } from '../shared/ids';
import { stateVersionSchema } from '../shared/version';
export const systemActionSchema = z.strictObject({
  type: z.literal('EXPIRE_PROMPT'),
  commandId: commandIdSchema,
  roomId: roomIdSchema,
  expectedStateVersion: stateVersionSchema,
  promptId: z.string().min(1).max(128),
  now: z.number().int().nonnegative().safe(),
});

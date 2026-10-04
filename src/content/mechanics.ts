import { z } from 'zod';

export const mechanicKeySchema = z.string().regex(/^[a-z][a-z0-9_.-]{0,63}$/);
export const systemEventSchema = z.enum([
  'ANTE_REQUIRED',
  'PAYMENT_REQUIRED',
  'GAMBLING_CHECKPOINT',
  'GAMBLING_WIN_BEFORE_PAYOUT',
  'FORTITUDE_LOSS_RESOLVED',
  'PHASE_OPPORTUNITY',
]);
export const sourceCapabilitySchema = z.enum([
  'CHANGES_DRINK_EFFECT',
  'ORDERS_DRINK',
  'FORCES_DRINK',
  'DIRECT_ALCOHOL_STAT',
  'AFFECTS_DRINK_EVENT',
  'AVOIDS_ANTE',
]);
export const traitSchema = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,31}$/);
export const cardMechanics = {
  targetPolicy: z.enum(['OTHER_PLAYER', 'ANY_LIVING_PLAYER']).optional(),
  phaseOpportunity: z.literal('ORDER_DRINK').optional(),
  counterFamily: mechanicKeySchema.optional(),
  counterPolicy: z.literal('SAME_FAMILY_ONLY').optional(),
  capabilities: z.array(sourceCapabilitySchema).max(6).optional(),
  mandatoryGoldCost: z.number().int().min(1).max(64).optional(),
};

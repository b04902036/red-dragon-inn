import { z } from 'zod';

// Prefixes distinguish namespaces at runtime as well as through TypeScript brands.
const suffix = '[A-Za-z0-9][A-Za-z0-9_-]{0,63}$';
const id = (prefix: string) =>
  z.string().regex(new RegExp(`^${prefix}_${suffix}`));

export const playerIdSchema = id('player').brand<'PlayerId'>();
export const roomIdSchema = id('room').brand<'RoomId'>();
export const matchIdSchema = id('match').brand<'MatchId'>();
export const cardDefinitionIdSchema = id('carddef').brand<'CardDefinitionId'>();
export const cardInstanceIdSchema = id('card').brand<'CardInstanceId'>();
export const characterIdSchema = id('character').brand<'CharacterId'>();
export const deckIdSchema = id('deck').brand<'DeckId'>();
export const commandIdSchema = id('command').brand<'CommandId'>();
export const eventIdSchema = id('event').brand<'EventId'>();
export const resolutionIdSchema = id('resolution').brand<'ResolutionId'>();
export const responseWindowIdSchema = id('window').brand<'ResponseWindowId'>();
export const contentVersionIdSchema = id('content').brand<'ContentVersionId'>();
export const productIdSchema = id('product').brand<'ProductId'>();
export const ruleModuleIdSchema = id('rule').brand<'RuleModuleId'>();
export const assetIdSchema = id('asset').brand<'AssetId'>();

export type PlayerId = z.infer<typeof playerIdSchema>;
export type RoomId = z.infer<typeof roomIdSchema>;
export type MatchId = z.infer<typeof matchIdSchema>;
export type CardDefinitionId = z.infer<typeof cardDefinitionIdSchema>;
export type CardInstanceId = z.infer<typeof cardInstanceIdSchema>;
export type CharacterId = z.infer<typeof characterIdSchema>;
export type DeckId = z.infer<typeof deckIdSchema>;
export type CommandId = z.infer<typeof commandIdSchema>;
export type EventId = z.infer<typeof eventIdSchema>;
export type ResolutionId = z.infer<typeof resolutionIdSchema>;
export type ResponseWindowId = z.infer<typeof responseWindowIdSchema>;
export type ContentVersionId = z.infer<typeof contentVersionIdSchema>;
export type ProductId = z.infer<typeof productIdSchema>;
export type RuleModuleId = z.infer<typeof ruleModuleIdSchema>;
export type AssetId = z.infer<typeof assetIdSchema>;

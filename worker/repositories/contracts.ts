import type { z } from 'zod';
import type { CardDefinition } from '../../src/content/cards';
import type {
  Asset,
  Character,
  ContentPack,
  ContentVersion,
  Deck,
  Product,
  RuleModule,
} from '../../src/content/pack';
import type {
  CharacterId,
  ContentVersionId,
  DeckId,
  MatchId,
} from '../../src/shared/ids';
import type {
  matchCreateSchema,
  matchRecordSchema,
  snapshotInputSchema,
  storedEventSchema,
  storedSnapshotSchema,
} from './schemas';

export interface DeckGraph {
  deck: Deck;
  cards: { definition: CardDefinition; quantity: number }[];
  totalQuantity: number;
}
export interface CharacterGraph {
  version: ContentVersion;
  product: Product;
  character: Character;
  decks: DeckGraph[];
  ruleModules: RuleModule[];
  assets: Asset[];
}

export interface ContentRepository {
  saveDraft(pack: ContentPack): Promise<void>;
  publishVersion(versionId: ContentVersionId): Promise<void>;
  getVersion(versionId: ContentVersionId): Promise<ContentVersion | null>;
  loadCharacter(
    versionId: ContentVersionId,
    characterId: CharacterId,
  ): Promise<CharacterGraph | null>;
  loadDeck(
    versionId: ContentVersionId,
    deckId: DeckId,
  ): Promise<DeckGraph | null>;
}

export type MatchCreate = z.infer<typeof matchCreateSchema>;
export type MatchRecord = z.infer<typeof matchRecordSchema>;
export type StoredEvent = z.infer<typeof storedEventSchema>;
export type SnapshotInput = z.infer<typeof snapshotInputSchema>;
export type StoredSnapshot = z.infer<typeof storedSnapshotSchema>;

export interface MatchRepository {
  create(input: MatchCreate): Promise<void>;
  get(matchId: MatchId): Promise<MatchRecord | null>;
}

export interface EventRepository {
  append(matchId: MatchId, events: readonly StoredEvent[]): Promise<void>;
  list(
    matchId: MatchId,
    afterSequence?: number,
    limit?: number,
  ): Promise<StoredEvent[]>;
  saveSnapshot(matchId: MatchId, input: SnapshotInput): Promise<void>;
  getLatestSnapshot(matchId: MatchId): Promise<StoredSnapshot | null>;
}

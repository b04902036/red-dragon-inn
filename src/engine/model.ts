import type { CardInstance } from '../content/cards';
import type { Effect } from '../content/effects';
import type {
  CardInstanceId,
  CharacterId,
  DeckId,
  MatchId,
  PlayerId,
  ResolutionId,
  ResponseWindowId,
  RoomId,
} from '../shared/ids';
import type { StateVersion } from '../shared/version';
import type { WorkflowTask, DrinkWork } from './workflow-state';

export const MATCH_LIFECYCLES = [
  'LOBBY',
  'SETUP',
  'PLAYING',
  'FINISHED',
] as const;
export const TURN_PHASES = [
  'DISCARD_DRAW',
  'ACTION',
  'ORDER_DRINK',
  'DRINK',
  'ELIMINATION_CHECK',
  'NEXT_TURN',
] as const;
export const RESPONSE_KINDS = [
  'SOMETIMES',
  'ANYTIME',
  'IGNORE',
  'NEGATE',
] as const;

export type MatchLifecycle = (typeof MATCH_LIFECYCLES)[number];
export type TurnPhase = (typeof TURN_PHASES)[number];
export type ResponseKind = (typeof RESPONSE_KINDS)[number];
export type Seat = 0 | 1 | 2 | 3;

export interface CardPile {
  readonly deckId: DeckId;
  /** Internal top-first order; never project this array to a client. */
  readonly cardIds: readonly CardInstanceId[];
}

export interface CharacterResource {
  readonly value: number;
  readonly visibility: 'PUBLIC' | 'OWNER' | 'SERVER';
}

export interface SpecialDeck {
  readonly deck: CardPile;
  readonly discard: readonly CardInstanceId[];
  readonly visibility: 'PUBLIC' | 'OWNER' | 'SERVER';
}

export interface PlayerState {
  readonly traits?: readonly string[];
  readonly id: PlayerId;
  readonly seat: Seat;
  readonly displayName: string;
  readonly characterId: CharacterId | null;
  readonly fortitude: number;
  readonly alcoholContent: number;
  readonly gold: number;
  readonly eliminated: boolean;
  readonly hand: readonly CardInstanceId[];
  readonly characterDeck: CardPile;
  readonly characterDiscard: readonly CardInstanceId[];
  readonly drinkPile: readonly CardInstanceId[];
  readonly special: {
    readonly resources: Readonly<Record<string, CharacterResource>>;
    readonly sideDecks: Readonly<Record<string, SpecialDeck>>;
  };
}

/** Non-null while a round suspends its initiating source and normal turn. */
export interface GamblingState {
  readonly stage: 'ANTE' | 'ROUND' | 'SETTLING';
  readonly checkpointReady?: boolean;
  readonly settlementReady?: boolean;
  readonly settlementReason?: 'ALL_PASSED' | 'IMMEDIATE_WIN';
  readonly potRemoved?: number;
  readonly initiatorPlayerId: PlayerId;
  readonly priorityPlayerId: PlayerId | null;
  readonly controlPlayerId: PlayerId;
  readonly participants: readonly PlayerId[];
  readonly passedPlayerIds: readonly PlayerId[];
  readonly leftPlayerIds: readonly PlayerId[];
  readonly excludedPlayerIds: readonly PlayerId[];
  readonly pot: number;
  readonly anteAmount: number;
  readonly contributions: readonly {
    readonly playerId: PlayerId;
    readonly amount: number;
  }[];
  readonly controlSourceCardId: CardInstanceId | null;
  readonly allowedControlCategories: readonly ('GAMBLING' | 'CHEATING')[];
  readonly winnerPlayerId: PlayerId | null;
  readonly suspended: {
    readonly resolutionId: ResolutionId;
    readonly activePlayerId: PlayerId;
    readonly phase: TurnPhase;
  };
}

export interface ResolutionFrame {
  readonly task?: WorkflowTask;
  readonly pendingTasks?: readonly WorkflowTask[];
  readonly afterTasks?: readonly WorkflowTask[];
  readonly pendingDrinks?: readonly DrinkWork[];
  readonly pendingDrinkResolutions?: readonly DrinkWork[];
  readonly batchResponseComplete?: boolean;
  readonly heldDrinkCardIds?: readonly CardInstanceId[];
  readonly drinkProvenance?: readonly CardInstanceId[];
  readonly drinkRecipientId?: PlayerId;
  readonly alcoholAsFortitude?: boolean;
  readonly contestScore?: number;
  readonly origin?: {
    readonly playerId: PlayerId | null;
    readonly cardId: CardInstanceId | null;
  };
  readonly responseToOrigin?: {
    readonly playerId: PlayerId | null;
    readonly cardId: CardInstanceId | null;
  };
  readonly redirectedFortitudePlayerId?: PlayerId;
  readonly id: ResolutionId;
  readonly kind: 'CARD' | 'DRINK' | 'DRINK_EVENT' | 'SYSTEM';
  readonly actorId: PlayerId | null;
  readonly sourceCardId: CardInstanceId | null;
  /** Physical revealed compound source; omitted for ordinary character-card frames. */
  readonly sourceCardIds?: readonly CardInstanceId[];
  readonly sourceRevealed: boolean;
  readonly targetPlayerIds: readonly PlayerId[];
  readonly effects: readonly Effect[];
  readonly nextEffectIndex: number;
  readonly parentId: ResolutionId | null;
  readonly stage: 'RESPONSES' | 'OPERATIONS' | 'CHOICE';
  readonly canceled: boolean;
  readonly ignoredPlayerIds: readonly PlayerId[];
  readonly window: ResponseWindow | null;
  readonly continuation: 'ORDER_DRINK' | 'ELIMINATION_CHECK' | 'RESUME';
  readonly selectedOptionId: string | null;
}

export interface PendingChoice {
  readonly playerId: PlayerId;
  readonly kind: 'TARGET' | 'OPTION' | 'CARD';
  readonly options: readonly { readonly id: string; readonly label: string }[];
  readonly min: number;
  readonly max: number;
}

export interface ResponseWindow {
  readonly id: ResponseWindowId;
  readonly kind: ResponseKind;
  readonly resolutionId: ResolutionId;
  readonly eligiblePlayerIds: readonly PlayerId[];
  readonly passedPlayerIds: readonly PlayerId[];
  readonly priorityPlayerId: PlayerId | null;
  readonly submittedResponses: readonly ResolutionId[];
  readonly pendingChoice: PendingChoice | null;
}

export interface DeterministicRngState {
  readonly algorithm: 'MULBERRY32_V1';
  /** Server-owned unsigned 32-bit seed and generator state. */
  readonly seed: number;
  readonly state: number;
  readonly draws: number;
}

/** Internal only: never serialize this object directly to a client. */
export interface AuthoritativeGameState {
  readonly schemaVersion: 1;
  readonly roomId: RoomId;
  readonly matchId: MatchId | null;
  readonly version: StateVersion;
  readonly lifecycle: MatchLifecycle;
  readonly phase: TurnPhase | null;
  readonly activePlayerId: PlayerId | null;
  readonly players: readonly PlayerState[];
  readonly cards: Readonly<Record<CardInstanceId, CardInstance>>;
  readonly innDrinkDeck: CardPile;
  readonly innDrinkDiscard: readonly CardInstanceId[];
  readonly gambling: GamblingState | null;
  readonly resolutionStack: readonly ResolutionFrame[];
  readonly responseWindow: ResponseWindow | null;
  readonly rng: DeterministicRngState | null;
  readonly winners: readonly PlayerId[];
}

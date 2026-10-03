import type { CardDefinition } from '../content/cards';
import type {
  CardDefinitionId,
  CommandId,
  ContentVersionId,
  MatchId,
  PlayerId,
} from '../shared/ids';
import type { StateVersion } from '../shared/version';
import type { AuthoritativeGameState, DeterministicRngState } from './model';
import type { RulesConfig } from './rules';

export interface CommandReceipt {
  readonly actorId: PlayerId;
  readonly fingerprint: string;
  readonly acceptedVersion: StateVersion;
}
export interface CoreGameState extends AuthoritativeGameState {
  readonly matchId: MatchId;
  readonly contentVersionId: ContentVersionId;
  readonly rules: RulesConfig;
  readonly definitions: Readonly<Record<CardDefinitionId, CardDefinition>>;
  readonly rng: DeterministicRngState;
  readonly initialCardCount: number;
  readonly control: {
    readonly hostPlayerId: PlayerId;
    readonly turnNumber: number;
    readonly eliminationCheckPending: boolean;
    readonly acceptedCommands: Readonly<Record<CommandId, CommandReceipt>>;
  };
}
export type Mutable<T> = T extends
  string | number | boolean | bigint | null | undefined
  ? T
  : T extends readonly (infer Item)[]
    ? Mutable<Item>[]
    : T extends object
      ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
      : T;
export type MutableGameState = Mutable<CoreGameState>;

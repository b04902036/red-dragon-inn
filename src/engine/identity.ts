import type { MatchId } from '../shared/ids';

export function compareIds(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

/** Stable match-scoped correlation namespace, not a secret or authorization token. */
export function matchNamespace(matchId: MatchId): string {
  let hash = 0xcbf29ce484222325n;
  for (const char of matchId)
    hash = BigInt.asUintN(
      64,
      (hash ^ BigInt(char.charCodeAt(0))) * 0x100000001b3n,
    );
  return hash.toString(16).padStart(16, '0');
}

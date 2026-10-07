import type { MutableGameState } from './types';
import type { MutableFrame } from './effect-operations';
import { fortitudeTargets } from './fortitude-routing';

/** Record play history before counters resolve; Negating a response cannot undo its play. */
export function recordFortitudeMitigationPlay(
  state: MutableGameState,
  response: MutableFrame,
  source: MutableFrame | undefined,
) {
  if (source === undefined || source.canceled || response.actorId === null)
    return;
  for (
    let index = source.nextEffectIndex;
    index < source.effects.length;
    index++
  ) {
    const effect = source.effects[index]!;
    if (
      effect.op !== 'CHANGE_STAT' ||
      effect.stat !== 'FORTITUDE' ||
      effect.delta >= 0
    )
      continue;
    const targets = fortitudeTargets(state, source, effect, index)!.map(
      (entry) => entry.playerId,
    );
    if (!targets.includes(response.actorId)) continue;
    const playedIgnore = response.effects.some((e) => e.op === 'IGNORE');
    const playedReduction = response.effects.some(
      (e) =>
        e.op === 'MODIFY_PENDING_EFFECT' &&
        e.effectIndex === index &&
        e.delta > 0,
    );
    if (!playedIgnore && !playedReduction) continue;
    source.fortitudeMitigationPlays ??= [];
    const prior = source.fortitudeMitigationPlays.find(
      (p) => p.playerId === response.actorId && p.effectIndex === index,
    );
    if (prior !== undefined) {
      prior.playedIgnore ||= playedIgnore;
      prior.playedReduction ||= playedReduction;
    } else
      source.fortitudeMitigationPlays.push({
        playerId: response.actorId,
        effectIndex: index,
        playedIgnore,
        playedReduction,
      });
  }
}

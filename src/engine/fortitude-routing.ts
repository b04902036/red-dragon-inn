import type { Effect } from '../content/effects';
import type { CoreGameState, MutableGameState } from './types';
import type { ResolutionFrame } from './model';
import type { MutableFrame } from './effect-operations';
import { effectTargets } from './effect-operations';
import { requireCommand } from './errors';

export function fortitudeTargets(
  state: CoreGameState,
  frame: ResolutionFrame,
  effect: Effect,
  index: number,
) {
  if (
    effect.op !== 'CHANGE_STAT' ||
    effect.stat !== 'FORTITUDE' ||
    effect.delta >= 0
  )
    return null;
  const override = frame.fortitudeLossOverrides?.find(
    (entry) => entry.effectIndex === index,
  );
  const targets =
    override?.targets ??
    (frame.redirectedFortitudePlayerId === undefined
      ? effectTargets(
          state as MutableGameState,
          frame as MutableFrame,
          effect.target,
        ).map((p) => ({ playerId: p.id, delta: effect.delta }))
      : [{ playerId: frame.redirectedFortitudePlayerId, delta: effect.delta }]);
  return targets.filter(
    (target) =>
      target.delta < 0 &&
      state.players.some((p) => p.id === target.playerId && !p.eliminated) &&
      !frame.ignoredPlayerIds.includes(target.playerId),
  );
}

export function pendingSelfLosses(
  state: CoreGameState,
  parent: ResolutionFrame,
  actorId: string,
) {
  return parent.effects.flatMap((effect, index) =>
    index < parent.nextEffectIndex
      ? []
      : (fortitudeTargets(state, parent, effect, index) ?? [])
          .filter((target) => target.playerId === actorId && target.delta < 0)
          .map((target) => ({ ...target, effectIndex: index })),
  );
}

export function routeFortitudeLoss(
  state: MutableGameState,
  frame: MutableFrame,
  parent: MutableFrame,
  share: boolean,
) {
  const original = parent.origin?.playerId ?? parent.actorId;
  const losses = pendingSelfLosses(state, parent, frame.actorId!);
  requireCommand(losses.length > 0 && original !== null, 'ILLEGAL_TIMING');
  parent.fortitudeLossOverrides ??= [];
  for (const loss of losses) {
    const current = parent.fortitudeLossOverrides.find(
      (entry) => entry.effectIndex === loss.effectIndex,
    );
    const targets = fortitudeTargets(
      state,
      parent,
      parent.effects[loss.effectIndex]!,
      loss.effectIndex,
    )!;
    const retained = targets.filter(
      (target) => target.playerId !== frame.actorId,
    );
    const routed = share
      ? [
          { playerId: frame.actorId!, delta: -Math.ceil(-loss.delta / 2) },
          { playerId: original, delta: -Math.ceil(-loss.delta / 2) },
        ]
      : [{ playerId: frame.targetPlayerIds[0]!, delta: loss.delta }];
    const merged = new Map<string, (typeof routed)[number]>();
    for (const target of [...retained, ...routed]) {
      const existing = merged.get(target.playerId);
      merged.set(target.playerId, {
        ...target,
        delta: target.delta + (existing?.delta ?? 0),
      });
    }
    const replacement = {
      effectIndex: loss.effectIndex,
      targets: [...merged.values()],
      mitigationLockedPlayerIds: [
        ...(current?.mitigationLockedPlayerIds ?? []),
      ],
    };
    if (
      share &&
      !replacement.mitigationLockedPlayerIds.includes(frame.actorId!)
    )
      replacement.mitigationLockedPlayerIds.push(frame.actorId!);
    if (current) Object.assign(current, replacement);
    else parent.fortitudeLossOverrides.push(replacement);
  }
}

export function selfMitigationLocked(
  parent: ResolutionFrame | undefined,
  frame: ResolutionFrame,
) {
  if (
    !parent?.fortitudeLossOverrides?.some((entry) =>
      entry.mitigationLockedPlayerIds.includes(frame.actorId!),
    )
  )
    return false;
  return frame.effects.some(
    (effect) =>
      effect.op === 'IGNORE' ||
      effect.op === 'SHARE_FORTITUDE_LOSS' ||
      effect.op === 'REDIRECT_FORTITUDE_LOSS' ||
      (effect.op === 'MODIFY_PENDING_EFFECT' &&
        effect.delta > 0 &&
        parent.effects[effect.effectIndex]?.op === 'CHANGE_STAT' &&
        parent.fortitudeLossOverrides?.some(
          (entry) =>
            entry.effectIndex === effect.effectIndex &&
            entry.mitigationLockedPlayerIds.includes(frame.actorId!),
        )),
  );
}

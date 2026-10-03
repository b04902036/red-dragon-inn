import { z } from 'zod';
import { effectSchema } from '../content/effects';
import {
  cardInstanceIdSchema,
  playerIdSchema,
  resolutionIdSchema,
  responseWindowIdSchema,
} from '../shared/ids';
import { RESPONSE_KINDS } from './model';
import type { CoreGameState } from './types';

const playerIds = z
  .array(playerIdSchema)
  .max(4)
  .refine((ids) => new Set(ids).size === ids.length);
export const responseWindowSchema = z.strictObject({
  id: responseWindowIdSchema,
  kind: z.enum(RESPONSE_KINDS),
  resolutionId: resolutionIdSchema,
  eligiblePlayerIds: playerIds,
  passedPlayerIds: playerIds,
  priorityPlayerId: playerIdSchema.nullable(),
  submittedResponses: z
    .array(resolutionIdSchema)
    .max(256)
    .refine((ids) => new Set(ids).size === ids.length),
  pendingChoice: z
    .strictObject({
      playerId: playerIdSchema,
      kind: z.enum(['TARGET', 'OPTION', 'CARD']),
      options: z
        .array(
          z.strictObject({
            id: z.string().min(1).max(128),
            label: z.string().min(1).max(500),
          }),
        )
        .min(1)
        .max(64)
        .refine(
          (options) =>
            new Set(options.map((option) => option.id)).size === options.length,
        ),
      min: z.number().int().min(1).max(64),
      max: z.number().int().min(1).max(64),
    })
    .nullable(),
});
export const resolutionFrameSchema = z.strictObject({
  id: resolutionIdSchema,
  kind: z.enum(['CARD', 'DRINK', 'DRINK_EVENT', 'SYSTEM']),
  actorId: playerIdSchema.nullable(),
  sourceCardId: cardInstanceIdSchema.nullable(),
  sourceCardIds: z.array(cardInstanceIdSchema).max(32).optional(),
  sourceRevealed: z.boolean(),
  targetPlayerIds: playerIds,
  effects: z.array(effectSchema).max(32),
  nextEffectIndex: z.number().int().min(0).max(32),
  parentId: resolutionIdSchema.nullable(),
  stage: z.enum(['RESPONSES', 'OPERATIONS', 'CHOICE']),
  canceled: z.boolean(),
  ignoredPlayerIds: playerIds,
  window: responseWindowSchema.nullable(),
  continuation: z.enum(['ORDER_DRINK', 'ELIMINATION_CHECK', 'RESUME']),
  selectedOptionId: z.string().min(1).max(128).nullable(),
});
function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new RangeError(`Engine invariant: ${message}`);
}
export function assertResolutionState(state: CoreGameState) {
  const ids = new Set(state.players.map((player) => player.id));
  const living = state.players
    .filter((player) => !player.eliminated)
    .map((player) => player.id);
  assert(state.resolutionStack.length <= 32, 'stack limit');
  const frames = state.resolutionStack.map((frame) =>
    resolutionFrameSchema.parse(frame),
  );
  assert(
    new Set(frames.map((frame) => frame.id)).size === frames.length,
    'duplicate resolution',
  );
  for (let i = 0; i < frames.length; i += 1) {
    const frame = frames[i]!;
    if (frame.kind === 'DRINK' || frame.kind === 'DRINK_EVENT') {
      const cards = frame.sourceCardIds;
      assert(
        cards !== undefined &&
          new Set(cards).size === cards.length &&
          frame.sourceCardId === (cards[0] ?? null) &&
          frame.parentId === null &&
          frame.continuation === 'ELIMINATION_CHECK',
        'invalid drink source',
      );
      assert(
        cards.every(
          (id) =>
            state.cards[id] !== undefined &&
            state.cards[id]!.ownerId === null &&
            ['DRINK', 'DRINK_EVENT'].includes(
              state.definitions[state.cards[id]!.definitionId]!.type,
            ),
        ),
        'invalid drink card',
      );
      assert(
        frame.kind !== 'DRINK_EVENT' ||
          (cards.length === 1 &&
            state.definitions[state.cards[cards[0]!]!.definitionId]!.type ===
              'DRINK_EVENT'),
        'invalid event source',
      );
    } else
      assert(frame.sourceCardIds === undefined, 'unexpected compound source');
    assert(
      frame.parentId === (frames[i - 1]?.id ?? null),
      'invalid parent frame',
    );
    assert(
      frame.actorId === null || ids.has(frame.actorId),
      'unknown frame actor',
    );
    assert(
      [...frame.targetPlayerIds, ...frame.ignoredPlayerIds].every((id) =>
        ids.has(id),
      ),
      'unknown frame target',
    );
    assert(
      frame.nextEffectIndex <= frame.effects.length,
      'effect cursor beyond operations',
    );
    const window = frame.window;
    assert(
      (frame.stage === 'OPERATIONS') === (window === null),
      'frame stage/window mismatch',
    );
    if (window === null) continue;
    assert(window.resolutionId === frame.id, 'window source mismatch');
    assert(
      window.eligiblePlayerIds.every((id) => living.includes(id)) &&
        window.passedPlayerIds.every((id) =>
          window.eligiblePlayerIds.includes(id),
        ),
      'invalid response eligibility',
    );
    if (window.pendingChoice === null) {
      assert(
        frame.stage === 'RESPONSES' &&
          window.eligiblePlayerIds.length === living.length,
        'response eligibility must include every living player',
      );
      assert(
        window.priorityPlayerId !== null &&
          window.eligiblePlayerIds.includes(window.priorityPlayerId) &&
          !window.passedPlayerIds.includes(window.priorityPlayerId),
        'invalid response priority',
      );
    } else {
      const choice = window.pendingChoice;
      assert(
        frame.stage === 'CHOICE' &&
          window.priorityPlayerId === null &&
          window.eligiblePlayerIds.length === 0 &&
          window.passedPlayerIds.length === 0,
        'choice is not a response opportunity',
      );
      assert(
        ids.has(choice.playerId) &&
          choice.min <= choice.max &&
          choice.max <= choice.options.length &&
          frame.nextEffectIndex < frame.effects.length,
        'invalid pending choice',
      );
      if (choice.kind === 'CARD')
        assert(
          choice.options.every((option) =>
            state.players
              .find((player) => player.id === choice.playerId)!
              .hand.some((id) => id === option.id),
          ),
          'choice exposes unowned card',
        );
      if (choice.kind === 'TARGET')
        assert(
          choice.options.every(
            (option) =>
              living.some((id) => id === option.id) &&
              option.id !== choice.playerId,
          ),
          'choice contains invalid target',
        );
    }
  }
  const activeWindow =
    state.responseWindow === null
      ? null
      : responseWindowSchema.parse(state.responseWindow);
  assert(
    JSON.stringify(activeWindow) ===
      JSON.stringify(frames.at(-1)?.window ?? null),
    'active window differs from top frame',
  );
}

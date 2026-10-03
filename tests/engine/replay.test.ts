import { describe, expect, it } from 'vitest';
import { createMatch } from '../../src/engine/setup';
import { applyCommand } from '../../src/engine/commands';
import {
  coreStateSchema,
  replayEntrySchema,
  replayManifestSchema,
  replayFromBeginning,
  replayFromSnapshot,
  shouldSaveSnapshot,
} from '../../src/engine/replay';
import { setupInput, accepted, started } from '../fixtures/core-match';
import { playAction } from '../fixtures/timing-match';
import { startRound } from '../fixtures/gambling-match';
import { runSampleGame } from '../../scripts/sample-game';
import { stateVersionSchema } from '../../src/shared/version';

function trace() {
  const setup = setupInput(1, 7);
  setup.rules = {
    ...setup.rules!,
    initialStats: { fortitude: 4, alcoholContent: 0, gold: 10 },
  };
  const initial = createMatch(setup);
  const complete = runSampleGame(initial);
  let state = initial;
  let sequence = 0;
  const entries = complete.commands.map(({ payload, actorId }) => {
    const result = applyCommand(state, payload, { actorId });
    expect(result.status).toBe('ACCEPTED');
    state = result.state;
    const entry = replayEntrySchema.parse({
      actorId,
      command: payload,
      firstSequence: sequence + 1,
      lastSequence: sequence + result.events.length,
      events: result.events,
      acceptedAt: '2026-10-03T00:00:00.000Z',
    });
    sequence = entry.lastSequence;
    return { entry, state };
  });
  return {
    manifest: replayManifestSchema.parse({ schemaVersion: 1, setup }),
    initial,
    complete,
    entries,
    sequence,
  };
}
describe('verified deterministic replay', () => {
  it('reproduces a complete match from its pinned content and seed, including identical command receipts and RNG', () => {
    const result = trace();
    const replay = replayFromBeginning(
      result.manifest,
      result.entries.map((item) => item.entry),
    );
    expect(replay).toEqual({
      state: result.complete.state,
      sequence: result.sequence,
    });
    expect(replay.state.contentVersionId).toBe(
      result.manifest.setup.content.version.id,
    );
    expect(replay.state.rng).toEqual(result.complete.state.rng);
  });
  it('restores a versioned snapshot and replays the remaining accepted commands to the same final state', () => {
    const result = trace();
    const checkpoint = result.entries[14]!;
    expect(
      replayFromSnapshot(
        JSON.parse(JSON.stringify(checkpoint.state)),
        checkpoint.entry.lastSequence,
        result.entries.slice(15).map((item) => item.entry),
      ),
    ).toEqual(
      replayFromBeginning(
        result.manifest,
        result.entries.map((item) => item.entry),
      ),
    );
    const empty = replayFromSnapshot(
      checkpoint.state,
      checkpoint.entry.lastSequence,
      [],
    );
    expect(empty.state).toEqual(checkpoint.state);
    expect(empty.state).not.toBe(checkpoint.state);
  });
  it('fails closed on corrupt, duplicate, reordered, foreign-actor or altered event history', () => {
    const result = trace();
    const first = result.entries[0]!.entry;
    const second = result.entries[1]!.entry;
    expect(() =>
      coreStateSchema.parse({ ...result.initial, rng: { seed: 'bad' } }),
    ).toThrow();
    expect(() => replayFromSnapshot(result.initial, -1, [])).toThrow();
    expect(() =>
      replayFromBeginning({ ...result.manifest, schemaVersion: 2 }, []),
    ).toThrow();
    expect(() => replayFromSnapshot(result.initial, 0, [second])).toThrow(
      'sequence',
    );
    expect(() => replayFromSnapshot(result.initial, 0, [first, first])).toThrow(
      'sequence',
    );
    expect(() =>
      replayFromSnapshot(result.initial, 0, [
        { ...first, actorId: 'player_missing' },
      ]),
    ).toThrow('not accepted');
    const altered = structuredClone(first);
    altered.events[0]!.eventId =
      'event_modified' as (typeof altered.events)[0]['eventId'];
    expect(() => replayFromSnapshot(result.initial, 0, [altered])).toThrow(
      'event mismatch',
    );
    expect(() =>
      replayEntrySchema.parse({
        ...first,
        lastSequence: first.lastSequence + 1,
      }),
    ).toThrow('sequence range');
    expect(() =>
      replayEntrySchema.parse({
        ...first,
        command: {
          type: 'JOIN_ROOM',
          commandId: 'command_join',
          roomId: result.initial.roomId,
          displayName: 'Injected',
        },
      }),
    ).toThrow('not a match command');
  });
  it('snapshots periodic versions and phase, lifecycle, response and gambling transitions', () => {
    const before = started(1, 7);
    const after = accepted(before, 'DISCARD', { cardIds: [] }).state;
    expect(shouldSaveSnapshot(before, before)).toBe(false);
    expect(
      shouldSaveSnapshot(before, {
        ...before,
        version: stateVersionSchema.parse(10),
      }),
    ).toBe(true);
    expect(shouldSaveSnapshot(createMatch(setupInput(1, 7)), before)).toBe(
      true,
    );
    expect(shouldSaveSnapshot(before, after)).toBe(true);
    const response = playAction(after).state;
    expect(shouldSaveSnapshot(after, response)).toBe(true);
    const round = startRound(after).state;
    expect(shouldSaveSnapshot(after, round)).toBe(true);
  });
});

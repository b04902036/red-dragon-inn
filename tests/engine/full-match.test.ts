import { expect, it } from 'vitest';
import { runSampleGame, sampleGameSetup } from '../../scripts/sample-game';
import { applyCommand } from '../../src/engine/commands';
import { assertCoreInvariants } from '../../src/engine/invariants';
import { domainEventSchema } from '../../src/protocol/events';

it.each([0, 1, 7])(
  'plays an unmodified sample-content game from setup through gambling, Drinks, elimination, and a winner (seed %i)',
  (seed) => {
    const result = runSampleGame(sampleGameSetup(seed));
    expect(result.state.lifecycle).toBe('FINISHED');
    expect(result.state.winners).toHaveLength(1);
    expect(
      result.state.players.filter((player) => player.eliminated),
    ).toHaveLength(3);
    expect(
      result.events.some((event) => event.type === 'GAMBLING_FINISHED'),
    ).toBe(true);
    expect(result.events.some((event) => event.type === 'DRINK_REVEALED')).toBe(
      true,
    );
    expect(result.events.at(-1)).toMatchObject({
      type: 'MATCH_FINISHED',
      winnerIds: result.state.winners,
    });
    let replay = sampleGameSetup(seed);
    const events = [];
    for (const { payload, actorId } of result.commands) {
      const applied = applyCommand(replay, payload, { actorId });
      expect(applied.status).toBe('ACCEPTED');
      replay = applied.state;
      events.push(...applied.events);
      assertCoreInvariants(replay);
    }
    expect(replay).toEqual(result.state);
    expect(events).toEqual(result.events);
    for (const event of events)
      expect(domainEventSchema.parse(event)).toEqual(event);
  },
  20000,
);

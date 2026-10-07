import { env } from 'cloudflare:workers';
import { expect, it } from 'vitest';
import { contentPackSchema } from '../../src/content/pack';
import { coreStateSchema, replayFromSnapshot } from '../../src/engine/replay';
import { assertCoreInvariants } from '../../src/engine/invariants';
import {
  projectPrivatePlayer,
  projectPublicGame,
} from '../../src/protocol/projections';
import {
  selectedMatch,
  definitionCard,
  keep,
  play,
  until,
  settle,
} from '../fixtures/rdi2-match';
import { verificationScenario } from '../fixtures/rdi2-verification';
const pack = () =>
  contentPackSchema.parse(JSON.parse(env.TEST_RDI1_RDI2_PACK_JSON) as unknown);
it.each([
  'nested',
  'anytime',
  'grace',
  'gambling',
  'redirect',
  'modifier',
  'mead',
  'contest',
  'challenge',
  'winner',
])(
  'mixed production checkpoint %s preserves physical ownership and hidden reserve in workerd',
  (scenario) => {
    const state = verificationScenario(pack(), scenario);
    assertCoreInvariants(state);
    expect(coreStateSchema.parse(JSON.parse(JSON.stringify(state)))).toEqual(
      state,
    );
    expect(Object.keys(state.cards)).toHaveLength(220);
    expect(
      Object.values(state.definitions).every(
        (d) => d.source === 'PUBLIC_RULES_PARAPHRASE',
      ),
    ).toBe(true);
    const publicState = JSON.stringify(projectPublicGame(state));
    for (const id of state.barDrinkDeck!)
      expect(publicState).not.toContain(JSON.stringify(id));
  },
);
it('compiled Eve Share Pain responds to a pending RDI1 source and replays identically inside workerd', () => {
  const state = selectedMatch(pack(), ['rdi1-deirdre', 'rdi2-eve']);
  const hit = definitionCard(state, 'carddef_rdi1_deirdre_damage_two'),
    share = definitionCard(state, 'carddef_rdi2_eve_share_pain');
  keep(state, [hit, share]);
  const pending = until(play(state, hit, state.players[1]!.id).state, (s) =>
    projectPrivatePlayer(s, s.players[1]!.id).legalPlays.some(
      (p) => p.cardId === share,
    ),
  );
  const prompt = projectPrivatePlayer(
    pending,
    pending.players[1]!.id,
  ).responsePrompt!;
  expect(prompt.hasLegalSometimes).toBe(true);
  expect(prompt.deadlineAt).toBe(prompt.openedAt + 30000);
  const result = play(pending, share);
  const restored = coreStateSchema.parse(JSON.parse(JSON.stringify(pending)));
  expect(
    replayFromSnapshot(restored, 0, [
      {
        actorId: result.actorId,
        command: result.command,
        firstSequence: 1,
        lastSequence: result.events.length,
        events: result.events,
        acceptedAt: new Date(result.now).toISOString(),
        clockTime: result.now,
      },
    ]).state,
  ).toEqual(result.state);
  expect(settle(result.state).players.map((p) => p.fortitude)).toEqual([
    19, 19,
  ]);
});

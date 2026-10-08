import { expect, it } from 'vitest';
import assignments from '../../content/presentation/card-title-assignments.json';
import {
  titleAssignmentsSchema,
  physicalTitleVariants,
} from '../../src/content/title-variants';
import { combinedPack } from '../fixtures/rdi2-content';
import { createMatch, type MatchSetup } from '../../src/engine/setup';
import { setupInput, accepted } from '../fixtures/core-match';
import {
  coreStateSchema,
  replayEntrySchema,
  replayFromBeginning,
  replayManifestSchema,
} from '../../src/engine/replay';
import {
  projectPublicGame,
  projectPrivatePlayer,
} from '../../src/protocol/projections';
import {
  projectPublicNarration,
  emptyNarrationContext,
} from '../../src/protocol/public-narration-projector';
import { drawFromPiles } from '../../src/engine/decks';
import { shuffle } from '../../src/engine/rng';
import { eventWriter } from '../../src/engine/event-writer';
import { commandIdSchema } from '../../src/shared/ids';
import { rdi1Send, rdi1Play, rdi1Settle } from '../fixtures/rdi1-match';

const variants = titleAssignmentsSchema.parse(assignments.entries);
function setup(): MatchSetup {
  const input = setupInput(7, 7);
  return {
    ...input,
    publicNarrationVersion: 1,
    content: combinedPack,
    innDrinkDeckIds: [
      combinedPack.decks.find((deck) => deck.type === 'INN_DRINK')!.id,
    ],
    presentationVariants: variants,
    players: input.players.map((player, index) => ({
      ...player,
      characterId: combinedPack.characters[index]!.id,
    })),
  };
}
it('assigns exactly the owned per-definition variant quantities before shuffling', () => {
  const state = createMatch(setup());
  for (const player of state.players)
    for (const assignment of variants.filter(
      (entry) => entry.characterId === player.characterId,
    )) {
      const cards = Object.values(state.cards).filter(
        (card) =>
          card.ownerId === player.id &&
          card.definitionId === assignment.cardDefinitionId,
      );
      for (const variant of assignment.variants)
        expect(
          cards.filter(
            (card) => card.presentationVariantId === variant.variantId,
          ),
        ).toHaveLength(variant.quantity);
    }
  expect(
    Object.values(state.cards)
      .filter((card) => card.ownerId === null)
      .every((card) => card.presentationVariantId === undefined),
  ).toBe(true);
});
it('draw/discard/reshuffle and seeded setup preserve physical identity without consuming extra RNG', () => {
  const input = setup();
  const initial = createMatch(input);
  const identity = Object.fromEntries(
    Object.values(initial.cards).map((card) => [
      card.id,
      card.presentationVariantId,
    ]),
  );
  const started = accepted(initial, 'START_MATCH').state;
  expect(
    Object.fromEntries(
      Object.values(started.cards).map((card) => [
        card.id,
        card.presentationVariantId,
      ]),
    ),
  ).toEqual(identity);
  expect(started.rng).toEqual(
    accepted(
      createMatch({ ...input, presentationVariants: undefined }),
      'START_MATCH',
    ).state.rng,
  );
  const player = started.players[0]!;
  const moved = drawFromPiles([], player.hand, player.hand.length, started.rng);
  expect(moved.steps[0]!.kind).toBe('RESHUFFLE');
  for (const id of moved.drawn)
    expect(started.cards[id]!.presentationVariantId).toBe(identity[id]);
  for (const id of shuffle(player.characterDeck.cardIds, started.rng).cards)
    expect(started.cards[id]!.presentationVariantId).toBe(identity[id]);
});
it('snapshot serialization, reconnect projection and deterministic replay preserve identity while hiding it before play', () => {
  const input = setup();
  const initial = createMatch(input);
  const result = accepted(initial, 'START_MATCH');
  expect(
    coreStateSchema.parse(JSON.parse(JSON.stringify(result.state))),
  ).toEqual(result.state);
  const entry = replayEntrySchema.parse({
    actorId: initial.control.hostPlayerId,
    command: {
      type: 'START_MATCH',
      commandId: 'command_1',
      roomId: initial.roomId,
      expectedStateVersion: initial.version,
    },
    firstSequence: 1,
    lastSequence: result.events.length,
    events: result.events,
    acceptedAt: '2026-10-08T00:00:00.000Z',
  });
  const manifest = replayManifestSchema.parse({
    schemaVersion: 1,
    setup: input,
  });
  expect(replayFromBeginning(manifest, [entry]).state).toEqual(result.state);
  expect(JSON.stringify(projectPublicGame(result.state))).not.toContain(
    'presentationVariantId',
  );
  expect(
    JSON.stringify(
      projectPrivatePlayer(result.state, result.state.players[1]!.id),
    ),
  ).not.toContain('presentationVariantId');
});
it('only a revealed CARD_PLAYED publishes the physical title identity; legacy events parse unchanged', () => {
  const state = accepted(createMatch(setup()), 'START_MATCH').state;
  const player = state.players[0]!;
  const card = state.cards[player.hand[0]!]!;
  const writer = eventWriter(
    state,
    commandIdSchema.parse('command_voice'),
    state.version,
  );
  writer.emit({
    type: 'CARD_PLAYED',
    playerId: player.id,
    cardId: card.id,
    definitionId: card.definitionId,
  });
  const projected = projectPublicNarration(
    writer.events.map((event, index) => ({ sequence: index + 1, event })),
    emptyNarrationContext(),
  );
  expect(projected.events[0]).toMatchObject({
    type: 'CARD_PLAYED',
    presentationVariantId: card.presentationVariantId,
  });
  expect(JSON.stringify(projected.events)).not.toContain('spokenText');
  expect(() =>
    coreStateSchema.parse(
      accepted(createMatch(setupInput()), 'START_MATCH').state,
    ),
  ).not.toThrow();
});
it('accepted draw/discard/reshuffle and actual card play preserve and narrate the assigned variant', () => {
  const input = setup();
  input.rules = { ...input.rules!, handSize: 40 };
  let state = accepted(createMatch(input), 'START_MATCH').state;
  const initial = structuredClone(state.cards);
  const result = accepted(state, 'DISCARD', {
    cardIds: [...state.players[0]!.hand],
  });
  expect(
    result.events.some(
      (event) => event.type === 'DECK_SHUFFLED' && event.reason === 'EXHAUSTED',
    ),
  ).toBe(true);
  state = rdi1Settle(result.state);
  for (const [id, card] of Object.entries(initial))
    expect(
      state.cards[id as keyof typeof state.cards]!.presentationVariantId,
    ).toBe(card.presentationVariantId);
  const player = state.players.find(
    (player) => player.id === state.activePlayerId,
  )!;
  const card = player.hand
    .map((id) => state.cards[id]!)
    .find((card) => card.definitionId.endsWith('_damage_two'))!;
  const played = rdi1Play(
    state,
    card.id,
    state.players.find((other) => other.id !== player.id)!.id,
  );
  const event = played.events.find((event) => event.type === 'CARD_PLAYED')!;
  expect(event).toMatchObject({
    presentationVariantId: card.presentationVariantId,
  });
  const projected = projectPublicNarration(
    played.events.map((event, index) => ({ sequence: index + 1, event })),
    emptyNarrationContext(),
  );
  expect(
    projected.events.find((event) => event.type === 'CARD_PLAYED'),
  ).toMatchObject({ presentationVariantId: card.presentationVariantId });
  state = rdi1Settle(played.state);
  expect(state.cards[card.id]!.location.zone).toBe('CHARACTER_DISCARD');
  expect(state.cards[card.id]!.presentationVariantId).toBe(
    card.presentationVariantId,
  );
  // A second fresh setup consumes the same seed and repeats the same draw cycle.
  const duplicate = accepted(createMatch(input), 'START_MATCH').state;
  const again = rdi1Send(duplicate, 0, 'DISCARD', {
    cardIds: [...duplicate.players[0]!.hand],
  });
  expect(again.state.rng).toEqual(result.state.rng);
  expect(again.state.cards).toEqual(result.state.cards);
});
it('rejects foreign ownership, duplicate variants and quantity mismatches', () => {
  const first = variants[0]!;
  expect(() => physicalTitleVariants(combinedPack, [first, first])).toThrow(
    /ownership/,
  );
  expect(() =>
    physicalTitleVariants(combinedPack, [
      {
        ...first,
        characterId: combinedPack.characters.find(
          (character) => character.id !== first.characterId,
        )!.id,
      },
    ]),
  ).toThrow(/ownership/);
  expect(() =>
    physicalTitleVariants(combinedPack, [
      { ...first, variants: [...first.variants, first.variants[0]!] },
    ]),
  ).toThrow(/Duplicate/);
  expect(() =>
    physicalTitleVariants(combinedPack, [
      {
        ...first,
        variants: first.variants.map((variant) => ({
          ...variant,
          quantity: variant.quantity + 1,
        })),
      },
    ]),
  ).toThrow(/quantity/);
});

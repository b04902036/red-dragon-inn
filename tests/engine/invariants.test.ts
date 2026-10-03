import { describe, expect, it } from 'vitest';
import { assertCoreInvariants } from '../../src/engine/invariants';
import { applyCommand } from '../../src/engine/commands';
import { DEFAULT_RULES } from '../../src/engine/rules';
import {
  cardInstanceIdSchema,
  commandIdSchema,
  resolutionIdSchema,
} from '../../src/shared/ids';
import { stateVersionSchema } from '../../src/shared/version';
import type { MutableGameState } from '../../src/engine/types';
import { intent, mutable, started, accepted } from '../fixtures/core-match';

describe('runtime engine invariants', () => {
  it.each([
    [
      'duplicate hand reference',
      (s: MutableGameState) => {
        s.players[1]!.hand[0] = s.players[0]!.hand[0]!;
      },
    ],
    [
      'two zones',
      (s: MutableGameState) => {
        s.players[0]!.characterDeck.cardIds.push(s.players[0]!.hand[0]!);
      },
    ],
    [
      'owner mismatch',
      (s: MutableGameState) => {
        s.cards[s.players[0]!.hand[0]!]!.ownerId = s.players[1]!.id;
      },
    ],
    [
      'location mismatch',
      (s: MutableGameState) => {
        s.cards[s.players[0]!.hand[0]!]!.location = {
          zone: 'DRINK_PILE',
          playerId: s.players[0]!.id,
        };
      },
    ],
    [
      'missing zone',
      (s: MutableGameState) => {
        s.players[0]!.hand.pop();
      },
    ],
    [
      'missing registry entry',
      (s: MutableGameState) => {
        delete s.cards[s.players[0]!.hand[0]!];
      },
    ],
    [
      'unknown pile reference',
      (s: MutableGameState) => {
        s.players[0]!.hand[0] = cardInstanceIdSchema.parse('card_missing');
      },
    ],
    [
      'duplicate registry identity',
      (s: MutableGameState) => {
        s.cards[cardInstanceIdSchema.parse('card_alias')] =
          s.cards[s.players[0]!.hand[0]!]!;
      },
    ],
    [
      'definition key mismatch',
      (s: MutableGameState) => {
        s.definitions[s.cards[s.players[0]!.hand[0]!]!.definitionId]!.id =
          s.cards[s.players[1]!.hand[0]!]!.definitionId;
      },
    ],
    [
      'missing definition',
      (s: MutableGameState) => {
        delete s.definitions[s.cards[s.players[0]!.hand[0]!]!.definitionId];
      },
    ],
    [
      'duplicate player',
      (s: MutableGameState) => {
        s.players[1]!.id = s.players[0]!.id;
      },
    ],
    [
      'duplicate seat',
      (s: MutableGameState) => {
        s.players[1]!.seat = s.players[0]!.seat;
      },
    ],
    [
      'unknown host',
      (s: MutableGameState) => {
        s.control.hostPlayerId =
          'player_unknown' as typeof s.control.hostPlayerId;
      },
    ],
    [
      'negative gold',
      (s: MutableGameState) => {
        s.players[0]!.gold = -1;
      },
    ],
    [
      'stat above bounds',
      (s: MutableGameState) => {
        s.players[0]!.fortitude = 101;
      },
    ],
    [
      'stat below bounds',
      (s: MutableGameState) => {
        s.players[0]!.alcoholContent = -1;
      },
    ],
    [
      'oversized hand',
      (s: MutableGameState) => {
        s.rules.handSize = 1;
      },
    ],
    [
      'no active player',
      (s: MutableGameState) => {
        s.activePlayerId = null;
      },
    ],
    [
      'eliminated active player',
      (s: MutableGameState) => {
        s.players[0]!.eliminated = true;
      },
    ],
    [
      'invalid phase',
      (s: MutableGameState) => {
        s.phase = null;
      },
    ],
    [
      'inactive match with active phase',
      (s: MutableGameState) => {
        s.lifecycle = 'FINISHED';
      },
    ],
    [
      'zero turn while playing',
      (s: MutableGameState) => {
        s.control.turnNumber = 0;
      },
    ],
    [
      'receipt actor missing',
      (s: MutableGameState) => {
        s.control.acceptedCommands[
          commandIdSchema.parse('command_1')
        ]!.actorId = 'player_unknown' as typeof s.control.hostPlayerId;
      },
    ],
    [
      'receipt wrong command',
      (s: MutableGameState) => {
        s.control.acceptedCommands[
          commandIdSchema.parse('command_1')
        ]!.fingerprint = JSON.stringify({
          ...intent(s, 'DISCARD', { cardIds: [] }),
          commandId: 'command_different',
        });
      },
    ],
    [
      'receipt wrong room',
      (s: MutableGameState) => {
        const r =
          s.control.acceptedCommands[commandIdSchema.parse('command_1')]!;
        r.fingerprint = JSON.stringify({
          ...(JSON.parse(r.fingerprint) as Record<string, unknown>),
          roomId: 'room_other',
        });
      },
    ],
    [
      'receipt future version',
      (s: MutableGameState) => {
        s.control.acceptedCommands[
          commandIdSchema.parse('command_1')
        ]!.acceptedVersion = stateVersionSchema.parse(100);
        const receipt =
          s.control.acceptedCommands[commandIdSchema.parse('command_1')]!;
        receipt.fingerprint = JSON.stringify({
          ...(JSON.parse(receipt.fingerprint) as Record<string, unknown>),
          expectedStateVersion: 99,
        });
      },
    ],
    [
      'receipt wrong accepted version',
      (s: MutableGameState) => {
        s.control.acceptedCommands[
          commandIdSchema.parse('command_1')
        ]!.acceptedVersion = stateVersionSchema.parse(0);
      },
    ],
    [
      'receipt for unsupported join',
      (s: MutableGameState) => {
        s.control.acceptedCommands[
          commandIdSchema.parse('command_1')
        ]!.fingerprint = JSON.stringify({
          type: 'JOIN_ROOM',
          commandId: 'command_1',
          roomId: s.roomId,
          displayName: 'Sample',
        });
      },
    ],
  ] as const)(
    'fails closed on %s before command mutation',
    (_name, corrupt) => {
      const state = mutable(started());
      corrupt(state);
      const before = JSON.stringify(state);
      expect(() => assertCoreInvariants(state)).toThrow();
      expect(() =>
        applyCommand(state, intent(state, 'DISCARD', { cardIds: [] }), {
          actorId: state.control.hostPlayerId,
        }),
      ).toThrow();
      expect(JSON.stringify(state)).toBe(before);
    },
  );
  it('allows omitted bounds while always requiring nonnegative Gold', () => {
    const state = mutable(started());
    state.rules.statBounds = {
      fortitude: null,
      alcoholContent: null,
      gold: null,
    };
    state.players[0]!.fortitude = -500;
    state.players[0]!.alcoholContent = 500;
    expect(() => assertCoreInvariants(state)).not.toThrow();
    state.rules.statBounds.gold = { min: 0, max: 10 };
    state.players[0]!.gold = 11;
    expect(() => assertCoreInvariants(state)).toThrow('bounds');
    expect(DEFAULT_RULES.initialStats.fortitude).toBe(20);
  });
  it('conserves reserved special-deck/discard zones and resolution sources without counting revealed discards twice', () => {
    const state = mutable(started());
    const player = state.players[0]!;
    const [deckCard, discardCard] = player.characterDeck.cardIds.splice(0, 2);
    player.special.sideDecks.extra = {
      visibility: 'OWNER',
      deck: { deckId: player.characterDeck.deckId, cardIds: [deckCard!] },
      discard: [discardCard!],
    };
    state.cards[deckCard!]!.location = {
      zone: 'SPECIAL_DECK',
      playerId: player.id,
      deckId: player.characterDeck.deckId,
    };
    state.cards[discardCard!]!.location = {
      zone: 'SPECIAL_DISCARD',
      playerId: player.id,
      deckId: player.characterDeck.deckId,
    };
    const id = resolutionIdSchema.parse('resolution_fixture');
    state.resolutionStack = [
      {
        id,
        kind: 'SYSTEM',
        actorId: null,
        sourceCardId: null,
        sourceRevealed: true,
        targetPlayerIds: [],
        effects: [],
        nextEffectIndex: 0,
        parentId: null,
        stage: 'OPERATIONS',
        canceled: false,
        ignoredPlayerIds: [],
        window: null,
        continuation: 'RESUME',
        selectedOptionId: null,
      },
      {
        id,
        kind: 'CARD',
        actorId: player.id,
        sourceCardId: discardCard!,
        sourceRevealed: true,
        targetPlayerIds: [],
        effects: [],
        nextEffectIndex: 0,
        parentId: null,
        stage: 'OPERATIONS',
        canceled: false,
        ignoredPlayerIds: [],
        window: null,
        continuation: 'RESUME',
        selectedOptionId: null,
      },
    ];
    state.resolutionStack[1]!.id = resolutionIdSchema.parse('resolution_child');
    state.resolutionStack[1]!.parentId = id;
    expect(() => assertCoreInvariants(state)).not.toThrow();
    state.resolutionStack[1]!.sourceCardId =
      cardInstanceIdSchema.parse('card_unknown');
    expect(() => assertCoreInvariants(state)).toThrow('resolution source');
    const valid = accepted(started(), 'DISCARD', { cardIds: [] });
    expect(() => assertCoreInvariants(valid.state)).not.toThrow();
  });
});

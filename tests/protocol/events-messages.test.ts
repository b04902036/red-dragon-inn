import { describe, expect, it } from 'vitest';
import { domainEventSchema } from '../../src/protocol/events';
import { serverMessageSchema } from '../../src/protocol/messages';
import type { DomainEvent } from '../../src/protocol/events';
import type { ServerMessage } from '../../src/protocol/messages';
import {
  decodeDomainEvent,
  decodeServerMessage,
  encodeDomainEvent,
  encodeServerMessage,
} from '../../src/protocol/codec';
import {
  projectPrivatePlayer,
  projectPublicGame,
} from '../../src/protocol/projections';
import { makeGameState } from '../fixtures/game-state';
import { DEFAULT_RULES } from '../../src/engine/rules';

const metadata = {
  eventId: 'event_sample',
  commandId: 'command_sample',
  roomId: 'room_sample',
  matchId: 'match_sample',
  stateVersion: 8,
  eventIndex: 0,
};
const events = [
  {
    ...metadata,
    type: 'PLAYER_JOINED',
    matchId: null,
    playerId: 'player_0',
    seat: 0,
    displayName: 'Sample player',
  },
  {
    ...metadata,
    type: 'MATCH_STARTED',
    playerIds: ['player_0', 'player_1'],
    activePlayerId: 'player_0',
  },
  {
    ...metadata,
    type: 'CARDS_DISCARDED',
    playerId: 'player_0',
    cardIds: ['card_sample'],
  },
  {
    ...metadata,
    type: 'CARDS_DRAWN',
    playerId: 'player_0',
    cardIds: ['card_sample'],
  },
  {
    ...metadata,
    type: 'CARD_PLAYED',
    playerId: 'player_0',
    cardId: 'card_sample',
    definitionId: 'carddef_sample',
  },
  {
    ...metadata,
    type: 'RESPONSE_WINDOW_OPENED',
    responseWindowId: 'window_sample',
    resolutionId: 'resolution_sample',
    kind: 'SOMETIMES',
    eligiblePlayerIds: ['player_1'],
    priorityPlayerId: 'player_1',
  },
  {
    ...metadata,
    type: 'RESPONSE_PASSED',
    playerId: 'player_1',
    responseWindowId: 'window_sample',
  },
  {
    ...metadata,
    type: 'EFFECT_RESOLVED',
    resolutionId: 'resolution_sample',
    effectIndex: 0,
  },
  {
    ...metadata,
    type: 'DRINK_ORDERED',
    playerId: 'player_0',
    targetPlayerId: 'player_1',
    cardId: 'card_sample',
  },
  {
    ...metadata,
    type: 'DRINK_REVEALED',
    playerId: 'player_1',
    cardId: 'card_sample',
    definitionId: 'carddef_sample',
  },
  {
    ...metadata,
    type: 'GOLD_CHANGED',
    playerId: 'player_0',
    delta: -1,
    value: 9,
  },
  {
    ...metadata,
    type: 'FORTITUDE_CHANGED',
    playerId: 'player_0',
    delta: -2,
    value: 18,
  },
  {
    ...metadata,
    type: 'ALCOHOL_CHANGED',
    playerId: 'player_0',
    delta: 3,
    value: 3,
  },
  {
    ...metadata,
    type: 'PHASE_CHANGED',
    phase: 'ORDER_DRINK',
    activePlayerId: 'player_0',
  },
  {
    ...metadata,
    type: 'PLAYER_ELIMINATED',
    playerId: 'player_0',
    reason: 'BROKE',
  },
  { ...metadata, type: 'MATCH_FINISHED', winnerIds: ['player_1'] },
  { ...metadata, type: 'LIFECYCLE_CHANGED', lifecycle: 'PLAYING' },
  {
    ...metadata,
    type: 'MATCH_CONFIGURED',
    contentVersionId: 'content_sample_v1',
    rngSeed: 1,
    rules: DEFAULT_RULES,
  },
  {
    ...metadata,
    type: 'PLAYER_STATS_INITIALIZED',
    playerId: 'player_0',
    fortitude: 20,
    alcoholContent: 0,
    gold: 10,
  },
  {
    ...metadata,
    type: 'DECK_SHUFFLED',
    deckId: 'deck_sample',
    playerId: null,
    reason: 'INITIAL',
    cardIds: ['card_sample'],
  },
  {
    ...metadata,
    type: 'DRINK_DEALT',
    playerId: 'player_0',
    cardIds: ['card_sample'],
  },
  {
    ...metadata,
    type: 'DRAW_SHORTFALL',
    playerId: 'player_0',
    requested: 3,
    drawn: 1,
  },
  {
    ...metadata,
    type: 'DRINK_ORDER_SKIPPED',
    playerId: 'player_0',
    targetPlayerId: 'player_1',
    reason: 'EMPTY_INN',
  },
  { ...metadata, type: 'TURN_STARTED', playerId: 'player_0', turnNumber: 1 },
  {
    ...metadata,
    type: 'ACTION_QUEUED',
    playerId: 'player_0',
    cardId: 'card_sample',
    resolutionId: 'resolution_sample',
    targetPlayerIds: ['player_1'],
  },
  {
    ...metadata,
    type: 'RESPONSE_PRIORITY_CHANGED',
    responseWindowId: 'window_sample',
    priorityPlayerId: 'player_1',
  },
  {
    ...metadata,
    type: 'RESPONSE_WINDOW_CLOSED',
    responseWindowId: 'window_sample',
    reason: 'ALL_PASSED',
  },
  {
    ...metadata,
    type: 'RESPONSE_SUBMITTED',
    responseWindowId: 'window_sample',
    playerId: 'player_1',
    resolutionId: 'resolution_child',
  },
  {
    ...metadata,
    type: 'RESOLUTION_STARTED',
    resolutionId: 'resolution_sample',
    parentId: null,
    playerId: 'player_0',
    cardId: 'card_sample',
  },
  {
    ...metadata,
    type: 'RESOLUTION_COMPLETED',
    resolutionId: 'resolution_sample',
    canceled: false,
  },
  {
    ...metadata,
    type: 'SOURCE_IGNORED',
    resolutionId: 'resolution_sample',
    playerId: 'player_1',
  },
  {
    ...metadata,
    type: 'SOURCE_NEGATED',
    resolutionId: 'resolution_sample',
    byResolutionId: 'resolution_child',
  },
  {
    ...metadata,
    type: 'PENDING_EFFECT_MODIFIED',
    resolutionId: 'resolution_sample',
    effectIndex: 0,
    delta: -2,
  },
  {
    ...metadata,
    type: 'CHOICE_OPENED',
    resolutionId: 'resolution_sample',
    responseWindowId: 'window_sample',
    playerId: 'player_1',
    kind: 'CARD',
  },
  {
    ...metadata,
    type: 'CHOICE_SELECTED',
    resolutionId: 'resolution_sample',
    playerId: 'player_1',
    selections: ['card_sample'],
  },
  {
    ...metadata,
    type: 'RESOURCE_CHANGED',
    playerId: 'player_1',
    resource: 'tokens',
    delta: 1,
    value: 1,
  },
  {
    ...metadata,
    type: 'GAMBLING_REQUESTED',
    playerId: 'player_0',
    resolutionId: 'resolution_sample',
  },
  {
    ...metadata,
    type: 'ELIMINATION_CHECK_REQUESTED',
    playerId: 'player_0',
    reason: 'BROKE',
  },
  {
    ...metadata,
    type: 'GAMBLING_START_CANCELED',
    resolutionId: 'resolution_sample',
    reason: 'NOT_ELIGIBLE',
  },
  { ...metadata, type: 'GAMBLING_ANTE_PAID', playerId: 'player_0', amount: 1 },
  {
    ...metadata,
    type: 'GAMBLING_STARTED',
    initiatorPlayerId: 'player_0',
    controlPlayerId: 'player_0',
    participants: ['player_0', 'player_1'],
    excludedPlayerIds: [],
    anteAmount: 1,
    pot: 2,
    resolutionId: 'resolution_sample',
  },
  {
    ...metadata,
    type: 'GAMBLING_PRIORITY_CHANGED',
    priorityPlayerId: 'player_1',
  },
  {
    ...metadata,
    type: 'GAMBLING_CONTROL_CHANGED',
    playerId: 'player_1',
    cardId: 'card_sample',
    allowedControlCategories: ['CHEATING'],
  },
  {
    ...metadata,
    type: 'GAMBLING_WIN_REQUESTED',
    playerId: 'player_1',
    resolutionId: 'resolution_sample',
  },
  { ...metadata, type: 'GAMBLING_PLAYER_LEFT', playerId: 'player_1' },
  { ...metadata, type: 'GAMBLING_LEAVE_SKIPPED', playerId: 'player_1' },
  { ...metadata, type: 'GAMBLING_PASSED', playerId: 'player_1' },
  {
    ...metadata,
    type: 'GAMBLING_FINISHED',
    winnerPlayerId: 'player_0',
    pot: 2,
    reason: 'ALL_PASSED',
  },
  { ...metadata, type: 'DRINK_EMPTY', playerId: 'player_0', rule: 'SOBER' },
  {
    ...metadata,
    type: 'DRINK_CHAIN_STOPPED',
    resolutionId: 'resolution_sample',
    reason: 'LIMIT',
  },
  {
    ...metadata,
    type: 'DRINK_EVENT_DISCARDED',
    playerId: 'player_0',
    cardId: 'card_sample',
    context: 'CHASER',
  },
  {
    ...metadata,
    type: 'DRINK_QUEUED',
    playerId: 'player_0',
    resolutionId: 'resolution_sample',
    cardIds: ['card_sample'],
    kind: 'DRINK',
  },
  {
    ...metadata,
    type: 'DRINK_DISCARDED',
    resolutionId: 'resolution_sample',
    cardIds: ['card_sample'],
  },
  {
    ...metadata,
    type: 'DRINK_MODIFIED',
    resolutionId: 'resolution_sample',
    alcoholDelta: 1,
    fortitudeDelta: 0,
  },
  { ...metadata, type: 'ELIMINATION_CHECKED', playerIds: ['player_0'] },
  {
    ...metadata,
    type: 'GOLD_REDISTRIBUTED',
    playerId: 'player_0',
    amount: 7,
    innGold: 4,
    payments: [{ playerId: 'player_1', amount: 3 }],
  },
];

describe('internal domain events', () => {
  it.each(events)(
    'retains $type discriminator, payload, causation, version, and event order through JSON',
    (example) => {
      const event = domainEventSchema.parse(example);
      expect(decodeDomainEvent(encodeDomainEvent(event))).toEqual(example);
      expect(event.commandId).toBe(metadata.commandId);
      expect(event.stateVersion).toBe(8);
      expect(event.eventIndex).toBe(0);
    },
  );

  it.each([
    'eventId',
    'commandId',
    'roomId',
    'matchId',
    'stateVersion',
    'eventIndex',
  ])('requires event metadata %s', (field) => {
    const example: Record<string, unknown> = { ...events[2] };
    delete example[field];
    expect(domainEventSchema.safeParse(example).success).toBe(false);
  });

  it.each([
    { ...metadata, type: 'UNKNOWN_EVENT' },
    { ...events[0], seat: '0' },
    { ...events[0], seat: 4 },
    { ...events[1], matchId: null },
    { ...events[1], playerIds: ['player_0'] },
    { ...events[2], cardIds: ['carddef_sample'] },
    { ...events[4], definitionId: 'card_sample' },
    { ...events[5], kind: 'ACTION' },
    { ...events[7], effectIndex: -1 },
    { ...events[10], delta: '-1' },
    { ...events[13], phase: 'LOBBY' },
    { ...events[14], reason: 'UNKNOWN' },
    { ...events[16], lifecycle: 'ACTION' },
    { ...events[2], stateVersion: '8' },
    { ...events[2], stateVersion: -1 },
    { ...events[2], eventIndex: -1 },
    { ...events[2], eventId: 'command_sample' },
    { ...events[2], extra: 'hidden' },
    { ...metadata, type: 'TURN_STARTED', playerId: 'player_0', turnNumber: 0 },
    {
      ...metadata,
      type: 'DECK_SHUFFLED',
      deckId: 'deck_sample',
      playerId: null,
      reason: 'ARBITRARY',
      cardIds: ['card_sample'],
    },
    {
      ...metadata,
      type: 'PLAYER_STATS_INITIALIZED',
      playerId: 'player_0',
      fortitude: 20,
      alcoholContent: 0,
      gold: -1,
    },
  ])('rejects corrupt event shapes or discriminators %#', (example) => {
    expect(domainEventSchema.safeParse(example).success).toBe(false);
    expect(() => decodeDomainEvent(JSON.stringify(example))).toThrow();
  });

  it('supports an ordered event batch sharing the accepted command version', () => {
    const batch = [events[2]!, events[3]!].map((event, eventIndex) =>
      domainEventSchema.parse({ ...event, eventIndex }),
    );
    expect(batch.map((event) => event.eventIndex)).toEqual([0, 1]);
    expect(batch.map((event) => event.stateVersion)).toEqual([8, 8]);
    expect(batch.map((event) => event.commandId)).toEqual([
      'command_sample',
      'command_sample',
    ]);
  });

  it('supports a draw without exposing the internal event as a server message', () => {
    const event = domainEventSchema.parse(events[3]);
    expect(event).toHaveProperty('cardIds', ['card_sample']);
    expect(serverMessageSchema.safeParse(event).success).toBe(false);
    expect(
      serverMessageSchema.safeParse({ type: 'DOMAIN_EVENT', event }).success,
    ).toBe(false);
  });

  it('revalidates events passed to encoders instead of trusting TypeScript assertions', () => {
    expect(() =>
      encodeDomainEvent({ type: 'CARDS_DRAWN' } as DomainEvent),
    ).toThrow();
    expect(() => decodeDomainEvent('null')).toThrow();
  });
});

describe('client-safe server message envelopes', () => {
  it('round-trips public/private projections and command acknowledgements', () => {
    const state = makeGameState();
    const messages = [
      { type: 'PUBLIC_STATE', view: projectPublicGame(state) },
      {
        type: 'PRIVATE_STATE',
        view: projectPrivatePlayer(state, state.players[0]!.id),
      },
      {
        type: 'COMMAND_ACCEPTED',
        commandId: 'command_sample',
        stateVersion: 8,
      },
      {
        type: 'COMMAND_REJECTED',
        commandId: 'command_sample',
        stateVersion: 7,
        code: 'VERSION_CONFLICT',
      },
      {
        type: 'COMMAND_REJECTED',
        commandId: null,
        stateVersion: 7,
        code: 'INVALID_COMMAND',
      },
    ];
    for (const message of messages) {
      const parsed = serverMessageSchema.parse(message);
      expect(decodeServerMessage(encodeServerMessage(parsed))).toEqual(message);
    }
  });

  it('rejects raw internal state, extra hidden fields, and unrecognized acknowledgements', () => {
    const state = makeGameState();
    const publicView = projectPublicGame(state);
    const privateView = projectPrivatePlayer(state, state.players[0]!.id);
    const invalid = [
      { type: 'PUBLIC_STATE', view: state },
      { type: 'PUBLIC_STATE', view: { ...publicView, rng: state.rng } },
      {
        type: 'PUBLIC_STATE',
        view: {
          ...publicView,
          players: [{ ...publicView.players[0], hand: state.players[0]!.hand }],
        },
      },
      {
        type: 'PRIVATE_STATE',
        view: {
          ...privateView,
          deckOrder: state.players[0]!.characterDeck.cardIds,
        },
      },
      { type: 'COMMAND_ACCEPTED', commandId: 'event_sample', stateVersion: 8 },
      {
        type: 'COMMAND_REJECTED',
        commandId: null,
        stateVersion: '7',
        code: 'INVALID_COMMAND',
      },
      {
        type: 'COMMAND_REJECTED',
        commandId: null,
        stateVersion: 7,
        code: 'UNKNOWN',
      },
      {
        type: 'COMMAND_REJECTED',
        commandId: null,
        stateVersion: 7,
        code: 'INVALID_COMMAND',
        originalInput: state,
      },
    ];
    for (const message of invalid) {
      expect(serverMessageSchema.safeParse(message).success).toBe(false);
      expect(() => decodeServerMessage(JSON.stringify(message))).toThrow();
      expect(() => encodeServerMessage(message as ServerMessage)).toThrow();
    }
  });

  it('refuses to encode a server frame that the bounded decoder cannot accept', () => {
    const state = makeGameState();
    const view = projectPrivatePlayer(state, state.players[0]!.id);
    view.pendingChoice!.options = Array.from({ length: 200 }, (_, i) => ({
      id: `sample-${i}`,
      label: 'a'.repeat(500),
    }));
    const message = serverMessageSchema.parse({ type: 'PRIVATE_STATE', view });
    expect(() => encodeServerMessage(message)).toThrow();
  });
});

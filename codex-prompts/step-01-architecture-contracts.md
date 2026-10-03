# Step 01 — Architecture contracts, protocol, and game-state model

## Goal

Define the domain contracts before implementing game rules.

No significant UI work in this step.

## Model these concepts

### Identity
- `PlayerId`
- `RoomId`
- `MatchId`
- `CardDefinitionId`
- `CardInstanceId`
- `CharacterId`
- `DeckId`

Prefer branded/string types or another method that reduces accidental mixing.

### Match lifecycle

```text
LOBBY
SETUP
PLAYING
FINISHED
```

### Normal turn phases

```text
DISCARD_DRAW
ACTION
ORDER_DRINK
DRINK
ELIMINATION_CHECK
NEXT_TURN
```

Do not yet implement all phase transitions; define contracts.

### Core game state

At minimum model:
- players/seats
- active player
- lifecycle
- phase
- Fortitude
- Alcohol Content
- Gold
- hand card instance IDs
- character deck
- character discard
- Drink Me! pile
- Inn Drink deck
- Inn Drink discard
- current gambling state placeholder
- resolution stack placeholder
- response window placeholder
- state version
- deterministic RNG state/seed reference
- winner(s)
- special-character resource container

### Card definitions

Create schemas/types for:
- Action
- Sometimes
- Anytime
- Gambling
- Cheating
- Drink
- Drink Event
- character/special cards

A card definition is not a card instance.

Card instance should include only runtime identity + definition reference + ownership/location metadata needed by the engine.

## Command protocol

Define a discriminated union for client commands.

At minimum reserve/define:
- JOIN_ROOM
- START_MATCH
- DISCARD
- PLAY_CARD
- CHOOSE_TARGET
- PASS_RESPONSE
- ORDER_DRINK
- GAMBLING_PLAY
- GAMBLING_PASS
- CHOOSE_OPTION

Every state-changing command after joining must support:
- command ID for idempotency
- expected state version

## Server event protocol

Define domain/server events such as:
- PLAYER_JOINED
- MATCH_STARTED
- CARDS_DISCARDED
- CARDS_DRAWN
- CARD_PLAYED
- RESPONSE_WINDOW_OPENED
- RESPONSE_PASSED
- EFFECT_RESOLVED
- DRINK_ORDERED
- DRINK_REVEALED
- GOLD_CHANGED
- FORTITUDE_CHANGED
- ALCOHOL_CHANGED
- PHASE_CHANGED
- PLAYER_ELIMINATED
- MATCH_FINISHED

Do not force the final complete list yet.

## Projection contracts

Define:
- internal authoritative state
- `PublicGameView`
- `PrivatePlayerView`

Explicitly document hidden-data rules:
- opponents cannot see hand identities
- opponents cannot see hidden Drink contents
- clients cannot see future deck order
- owner can see their own hand
- public view can contain counts

## Runtime validation

Use a runtime schema library already in the repo, or add a well-supported one such as Zod, for:
- inbound WebSocket commands
- content JSON
- effect params where practical

## Documentation

Create `docs/architecture.md` and `docs/protocol.md`.

Document why The Inn / Foundry is reference-only:
- it provides useful action/deck concepts,
- but it does not provide the server-authoritative rules engine required here.

## Tests — mandatory

Test:
1. Valid command schemas accept correct input.
2. Invalid command shapes are rejected.
3. Wrong IDs/types do not silently coerce where runtime validation is expected.
4. Public projection never exposes another player's hand.
5. Public projection never exposes deck order.
6. Private view exposes only the requesting player's private data.
7. Serialization/deserialization retains command/event discriminator correctness.
8. State version exists and is monotonic-compatible by contract.

If using compile-time-only branded IDs, add runtime tests around boundaries where strings enter the system.

## Verification

Run all standard checks from `AGENTS.md`.

No actual room server is required yet.

Stop after this step.

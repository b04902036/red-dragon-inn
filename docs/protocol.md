# Protocol contracts through step 12

Local development rooms add `DEV_DISCARD_DRAW` (discarded `cardIds`, requested `definitionIds`) and `DEV_ORDER_DRINK` (`targetPlayerId`, requested `definitionId`). They select existing copies under server validation and only work with pinned development rules and an enabled runtime. Optional private `devChoices` exposes aggregated owner character/Inn supply; production and public snapshots omit it. See [development card selection](development-card-selection.md).

Step 19 adds public `timedPrompt` and a minimal `phaseEnd` window, private `responsePrompt`/`legalAnytime`, explicit `PASS_ANYTIME`, and optional prompt identity on mutations. Deadlines are persisted server state. New matches set `timing.turnOwnerUntimed: true`, with `deadlineAt: null` in public/private owner prompts; other players retain numeric deadlines. Untimed prompts preserve identity, priority and legal cards, reject expiry, and wait for an explicit play/pass. Older pinned rules without the flag retain historical deadlines. The server-only `EXPIRE_PROMPT` schema and reserved `command_system_` IDs cannot be submitted through the socket command contract. Recorded `clockTime` enables deterministic replay of timed commands. See [timed prompts](timed-prompts.md).

Step 07 transports existing intents inside validated HELLO/COMMAND/PING envelopes. SESSION_ACCEPTED binds the server-assigned player/session/host; PONG answers an authenticated heartbeat. Rejections add AUTH_REQUIRED, INVALID_SESSION, NOT_ENOUGH_PLAYERS, and MATCH_STARTED, with optional server-selected engine reason codes. Private snapshots are unicast; raw domain events remain forbidden. See [realtime rooms](realtime-rooms.md) for HTTP/session, version, and recovery semantics.

The live API includes health, room creation/join/metadata, and WebSocket upgrades. The Durable Object invokes pure core, timing, gambling, and Drink/elimination command handlers with the authenticated connection's player identity.

## Identifiers and versions

IDs are opaque namespaced strings with TypeScript brands. The suffix is 1–64 ASCII letters, digits, underscores, or hyphens and must begin with a letter or digit. Namespaces are:

| Type               | Example            |
| ------------------ | ------------------ |
| `PlayerId`         | `player_a1`        |
| `RoomId`           | `room_a1`          |
| `MatchId`          | `match_a1`         |
| `CardDefinitionId` | `carddef_sample`   |
| `CardInstanceId`   | `card_a1`          |
| `CharacterId`      | `character_sample` |
| `DeckId`           | `deck_a1`          |
| `CommandId`        | `command_a1`       |
| `EventId`          | `event_a1`         |
| `ResolutionId`     | `resolution_a1`    |
| `ResponseWindowId` | `window_a1`        |
| `ContentVersionId` | `content_a1`       |
| `ProductId`        | `product_a1`       |
| `RuleModuleId`     | `rule_a1`          |
| `AssetId`          | `asset_a1`         |

Schemas do not trim or coerce IDs. `player_a1` cannot be used where `RoomId` is required. IDs are references, not credentials; the room server issues unpredictable identities and validates a separate seat-bound resume credential.

`StateVersion` is a branded nonnegative safe integer (0 through `Number.MAX_SAFE_INTEGER`). It is the room's monotonic authoritative counter, independent of `schemaVersion: 1`. The server increments it once per accepted state-changing command; rejected or repeated commands must not increment it. `nextStateVersion` defines bounded increment semantics without mutating game state. Resetting the counter between matches would break stale-command detection and is prohibited within the same room lifetime.

## Client commands

`clientCommandSchema` is a strict discriminated union on `type`. Every command includes `commandId` and `roomId`. Every command after `JOIN_ROOM` also requires `expectedStateVersion`. No command accepts an actor/player identity to impersonate the current connection, authoritative stats, hand contents, deck order, RNG, lifecycle, or phase. Unknown fields are rejected rather than silently dropped.

| Type             | Additional fields                                             |
| ---------------- | ------------------------------------------------------------- |
| `JOIN_ROOM`      | `displayName` (1–80 characters, not blank)                    |
| `START_MATCH`    | Optional `drinkDeckIds` (1–8 unique deck IDs)                 |
| `DISCARD`        | `cardIds` (0–64 unique card instance IDs)                     |
| `PLAY_CARD`      | `cardId`, optional `targetPlayerId`                           |
| `PLAY_RESPONSE`  | `responseWindowId`, `cardId`, optional `targetPlayerId`       |
| `CHOOSE_CARDS`   | `responseWindowId`, `cardIds` (1–64 unique instance IDs)      |
| `SKIP_ACTION`    | None                                                          |
| `ADVANCE_PHASE`  | None                                                          |
| `TAKE_DRINK`     | None                                                          |
| `CHOOSE_TARGET`  | `responseWindowId`, `targetPlayerIds` (1–4 unique player IDs) |
| `PASS_RESPONSE`  | `responseWindowId`                                            |
| `ORDER_DRINK`    | `targetPlayerId`                                              |
| `GAMBLING_PLAY`  | `cardId`, optional `targetPlayerId`                           |
| `GAMBLING_PASS`  | None                                                          |
| `GAMBLING_LEAVE` | None                                                          |
| `CHOOSE_OPTION`  | `responseWindowId`, `optionId` (1–128 characters)             |

These size limits are distinct from configured hand size. `DISCARD` permits zero discards and performs the core redraw/phase transition. `SKIP_ACTION` passes the action phase. `TAKE_DRINK` reveals and queues the server-owned top Drink/Chaser chain or Event. `ADVANCE_PHASE` performs the same Drink resolution in DRINK, or advances ELIMINATION_CHECK/NEXT_TURN; it cannot bypass pending effects. `PLAY_CARD` supplies an optional target for a chosen-player Action; the engine checks whether it is required/allowed and whether the target is another living player. `PLAY_CARD` also supports Anytime sources between commands. Response and choice commands validate the active window, priority or designated chooser, card ownership, and offered selections. Gambling intents execute the configured ante/control/pass/leave/payout flow while normal turns suspend; see [the gambling guide](gambling-engine.md). See [the timing guide](timing-engine.md). `JOIN_ROOM` reserves a membership request; player identity and seat will be assigned by the server. It has no expected version because the joining client has not received room state, and it is not executed by the core engine.

Step 24C requires an explicit host-selected `drinkDeckIds` list when the pinned edition has multiple Inn decks. The server verifies every ID belongs to that edition and persists the selection in the replay manifest. The combined lobby offers either single deck or both as a Bar Deck. Optional presentation `innDrinkDecks` lists public deck IDs/names; optional public `barDrinkDeckCount` exposes only reserve size. Server-only `DRINK_DECK_REFILLED` records the active batch and remaining reserve for history; hidden order is never broadcast. See [RDI2 compilation/publication](rdi2-compile-publish.md).

Step 06 adds internal DRINK_EMPTY, DRINK_CHAIN_STOPPED, DRINK_EVENT_DISCARDED (CHASER context), DRINK_QUEUED, DRINK_DISCARDED, DRINK_MODIFIED, ELIMINATION_CHECKED, and GOLD_REDISTRIBUTED batches. ELIMINATION_CHECK_REQUESTED includes BROKE or PASSED_OUT. RESOLUTION_STARTED.cardId is nullable for an empty-pile fallback. Public resolution kinds include DRINK_EVENT; optional `sourceCards` contains at most 32 explicitly revealed references for a compound source. It excludes unrevealed cards. None of these additions permit raw internal event broadcasts or client stat/payout inputs.

Example intent:

```json
{
  "type": "PLAY_CARD",
  "commandId": "command_a1",
  "roomId": "room_a1",
  "expectedStateVersion": 7,
  "cardId": "card_a1"
}
```

Parsing checks format only. The room transport authenticates the session and authorizes room membership. The core engine validates trusted actor context, version/idempotency, card ownership/location, targets, and implemented phase timing. A schema-valid command does not imply acceptance. Exact retries return their original accepted version without new events/mutations; changed payloads or actors under the same ID are rejected. See [the engine boundary](engine.md#command-boundary).

## Internal domain events

`domainEventSchema` is a strict union on `type`. Every event has `eventId`, `commandId`, `roomId`, nullable `matchId`, `stateVersion`, and nonnegative safe-integer `eventIndex`. `MATCH_STARTED` requires a non-null match ID. The core event writer assigns a shared resulting version and sequential indexes starting at zero. D1 enforces immutable history and uniqueness. Persisted accepted-command replay verifies regenerated events against the immutable event batches.

| Type                       | Payload fields                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| `PLAYER_JOINED`            | `playerId`, `seat` (0–3), `displayName`                                                       |
| `MATCH_STARTED`            | `playerIds` (2–4), `activePlayerId`                                                           |
| `CARDS_DISCARDED`          | `playerId`, `cardIds`                                                                         |
| `CARDS_DRAWN`              | `playerId`, `cardIds` (hidden internal data)                                                  |
| `CARD_PLAYED`              | `playerId`, `cardId`, `definitionId`                                                          |
| `RESPONSE_WINDOW_OPENED`   | `responseWindowId`, `resolutionId`, `kind`, `eligiblePlayerIds`, `priorityPlayerId`           |
| `RESPONSE_PASSED`          | `playerId`, `responseWindowId`                                                                |
| `EFFECT_RESOLVED`          | `resolutionId`, `effectIndex`                                                                 |
| `DRINK_ORDERED`            | `playerId`, `targetPlayerId`, `cardId` (hidden internal data)                                 |
| `DRINK_REVEALED`           | `playerId`, `cardId`, `definitionId`                                                          |
| `GOLD_CHANGED`             | `playerId`, `delta`, `value`                                                                  |
| `FORTITUDE_CHANGED`        | `playerId`, `delta`, `value`                                                                  |
| `ALCOHOL_CHANGED`          | `playerId`, `delta`, `value`                                                                  |
| `PHASE_CHANGED`            | `phase`, `activePlayerId`                                                                     |
| `PLAYER_ELIMINATED`        | `playerId`, `reason` (`PASSED_OUT` or `BROKE`)                                                |
| `MATCH_FINISHED`           | `winnerIds` (0–4, allowing a draw/tie)                                                        |
| `LIFECYCLE_CHANGED`        | `lifecycle`                                                                                   |
| `MATCH_CONFIGURED`         | `contentVersionId`, `rngSeed`, `rules` (internal data)                                        |
| `PLAYER_STATS_INITIALIZED` | `playerId`, `fortitude`, `alcoholContent`, `gold`                                             |
| `DECK_SHUFFLED`            | `deckId`, nullable `playerId`, `reason` (`INITIAL`/`EXHAUSTED`), ordered `cardIds` (internal) |
| `DRINK_DEALT`              | `playerId`, `cardIds` (face-down internal data)                                               |
| `DRAW_SHORTFALL`           | `playerId`, `requested`, `drawn`                                                              |
| `DRINK_ORDER_SKIPPED`      | `playerId`, `targetPlayerId`, `reason: EMPTY_INN`                                             |
| `TURN_STARTED`             | `playerId`, `turnNumber`                                                                      |
| `ACTION_QUEUED`            | `playerId`, `cardId`, `resolutionId`, `targetPlayerIds`                                       |

The discriminator selects its payload schema; wrong IDs, numeric strings, missing metadata, or unrelated fields are rejected. Event payloads will expand with implemented mechanics, including sufficient setup/RNG outcomes for deterministic replay. No raw event is a server-message variant; logging/storing an event does not authorize broadcasting it.

## Views and socket messages

`PublicGameView` includes room/match/version references, lifecycle/phase/active player, up to four public player entries, Inn pile counts, public gambling/stack/window summaries, and winners. Player entries include stats, character identity, pile counts, public resources, and permitted side-deck counts. Pile identities/orders are omitted. Resolution cards are visible only when the server-owned frame explicitly marks the source revealed. Response windows expose priority, eligible/pass lists, and submitted public frame IDs. Choices expose only the designated chooser's ID.

`PrivatePlayerView` is scoped to one authenticated player and the same room/match/version. It includes their own hand card/definition references, `PUBLIC` or `OWNER` resource values, `PUBLIC` or `OWNER` side-deck counts, and only their own pending choice options. `SERVER` resources/side decks are never projected. The owner also cannot see future character/Inn/side-deck order or face-down Drink contents.

Projections do not expose internal card ownership/location metadata, card registries, RNG seed/state, queued effect params, or newly added internal fields. Their values are detached from authoritative state. Unknown private requesters or corrupt hand ownership fail closed. Discard identities are currently represented as counts; a later rules/UI step can add explicitly public revealed-discard references without exposing hidden piles.

`serverMessageSchema` permits:

| Type               | Fields and delivery                                                                  |
| ------------------ | ------------------------------------------------------------------------------------ |
| `PUBLIC_STATE`     | `view: PublicGameView`; broadcast/spectator-safe                                     |
| `PRIVATE_STATE`    | `view: PrivatePlayerView`; unicast to that player's authenticated connection         |
| `COMMAND_ACCEPTED` | `commandId`, `stateVersion`; acknowledgement to issuer                               |
| `COMMAND_REJECTED` | nullable `commandId`, current `stateVersion`, `code`; response to issuer             |
| `SESSION_ACCEPTED` | room/player/host IDs, session ID, and current version; authenticated connection only |
| `PONG`             | matching heartbeat nonce; authenticated requester only                               |
| `ROOM_PRESENCE`    | room ID and public player IDs with connection booleans; authenticated peers          |

Socket rejection codes include `INVALID_COMMAND`, `VERSION_CONFLICT`, `NOT_ALLOWED`, `ROOM_FULL`, `AUTH_REQUIRED`, `INVALID_SESSION`, `NOT_ENOUGH_PLAYERS`, `MATCH_STARTED`, `PERSISTENCE_UNAVAILABLE`, and `RATE_LIMITED`. Persistence failures retain the durable outbox and close the socket with 1013 for reconnect recovery. The room adapter maps precise engine errors to safe codes and optional engine reason identifiers. An invalid command can have a null command ID. Rejections never echo raw input or internal exceptions. Schema validation cannot authenticate recipients; the room selects each private requester from its authenticated attachment and enforces unicast delivery.

## Serialization and content boundaries

Step 13 replaces the sample endpoint with `GET /api/rooms/:roomId/presentation?locale=en-US` (also accepts `zh-TW`, with English fallback until localization). It loads the room-pinned published edition and validates character names/card display metadata (name, supplied rules text, type, response category, target/self-effect hints). It carries no physical card IDs, deck quantities/order, effect DSL, private choices, or credentials. Published definitions remain unchanged; explicit fixture mode may derive original stat guidance. Display hints describe cards; Step 20 uses private server legal plays for buttons and targets. See [production content](production-content.md) and [the game UI guide](game-ui.md).

`decodeClientCommand`, `decodeDomainEvent`, and `decodeServerMessage` parse JSON and validate the selected schema. Matching encoders revalidate runtime values before serialization, even if a caller bypasses TypeScript with a cast. All codecs bound text to 65,536 UTF-16 code units in both directions; malformed JSON or invalid/oversized shapes throw. The future transport must catch these failures, return an intentional protocol error, and enforce its own byte/frame/rate limits before accepting commands. Numeric strings are not coerced, unknown discriminators are rejected, and JSON round trips preserve discriminator/payload correctness.

`contentCatalogSchema` validates `{schemaVersion: 1, cards: [...]}` with unique definition IDs. Definition categories are `ACTION`, `SOMETIMES`, `ANYTIME`, `GAMBLING`, `CHEATING`, `DRINK`, `DRINK_EVENT`, and `SPECIAL`. Each has a name, rules text, `SAMPLE` or `PRIVATE` source, optional character reference, and bounded JSON effects. Drinks additionally specify Alcohol Content, Fortitude change, and chaser metadata; special cards require a character reference. An instance has only an ID, definition reference, nullable owner, and discriminated location metadata. Definitions and instances cannot be interchanged.

Effects execute validated JSON operations and a closed server-side handler registry. CUSTOM permits effect_key: sample.adjust-resource with {resource, delta} params and a target selector. Neither arbitrary code nor unknown handler params are accepted. See [timing-engine.md](timing-engine.md) for operation semantics and choice privacy. Schema validity does not establish licensing; private user-owned/licensed content remains in ignored directories.

The project uses [Zod's strict objects, discriminated unions, and branded types](https://zod.dev/api) for these runtime/type boundaries.

Step 04 adds internal RESPONSE_PRIORITY_CHANGED, RESPONSE_WINDOW_CLOSED, RESPONSE_SUBMITTED, RESOLUTION_STARTED, RESOLUTION_COMPLETED, SOURCE_IGNORED, SOURCE_NEGATED, PENDING_EFFECT_MODIFIED, CHOICE_OPENED, CHOICE_SELECTED, RESOURCE_CHANGED, and GAMBLING_REQUESTED events. Their strict schemas in src/protocol/events.ts define payloads; choice selections and resource changes may be private and remain internal.

Step 05 adds internal GAMBLING_START_CANCELED, GAMBLING_ANTE_PAID, GAMBLING_STARTED, GAMBLING_PRIORITY_CHANGED, GAMBLING_CONTROL_CHANGED, GAMBLING_WIN_REQUESTED, GAMBLING_PLAYER_LEFT, GAMBLING_LEAVE_SKIPPED, GAMBLING_PASSED, GAMBLING_FINISHED, and ELIMINATION_CHECK_REQUESTED events. Public gambling state whitelists stage, initiator, controller/source, priority, participants/exclusions, current pass consensus, departures, pot/ante/contributions, allowed control categories, and any settling winner. It excludes the private suspended continuation. Taking control resets passes; leaving permanently prevents further control play while preserving reaction eligibility. See [the gambling guide](gambling-engine.md).
Presentation accepts `?locale=en-US` or `?locale=zh-TW`. It returns the same card/character IDs and gameplay type enums with localized display fields, canonical English metadata, and translation provenance. Strict production Chinese presentation returns 503 for incomplete translations. Locale is never part of a gameplay command. See [localization](localization.md).
Step 15 adds optional public `attention: { key, playerId, kind } | null`. It identifies an actionable server prompt without exposing hidden cards or tying attention to state version. Clients use it solely for sound deduplication; it grants no command authority. See [audio behavior](audio.md).

Step 18 adds private `legalResponses: [{ cardId, commandType: 'PLAY_RESPONSE', requiresTarget, legalTargetPlayerIds }]`. Only the authenticated current priority holder receives this list. It is computed by the same trigger/effect/target evaluator used by server validation; clients cannot submit or authorize a legal-response list. Public `eligiblePlayerIds` is a living-seat roster, not the private response eligibility calculation. Auto-skip exposes only current priority. When a child completes, `RESPONSE_WINDOW_CLOSED` with reason `REEVALUATED` precedes a fresh parent window starting at its persisted source actor, with reset passes and current legality. Reconnect restores the same nested stack, source actors and deterministic predicates. Step 18 introduces no deadlines.

Step 20 adds authenticated private `legalPlayVersion` and `legalPlays: [{ cardId, commandType: 'PLAY_CARD' | 'PLAY_RESPONSE' | 'GAMBLING_PLAY', requiresTarget, legalTargetPlayerIds, promptId? }]`. The server shares command context/category checks, automatic Gambling effects, trigger evaluation and effect/target validation with card queuing. Only owned, currently valid plays are listed; root/response/Gambling timing and current priority are checked. Lists are recomputed after accepted commands, system expiry, nested resolution and phase changes, and restored by normal reconnect projections. Every accepted version delivers fresh private legality even when the hand itself is unchanged. Public state and public events contain neither these entries nor another player's private card IDs. Clients discard stale highlights when `legalPlayVersion` differs from public `version` or `promptId` differs from the current prompt. A submitted legal list is an unknown field and is rejected; every play still passes authenticated server command validation.

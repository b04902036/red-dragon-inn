# Architecture through step 12

The browser entry is `index.html` → `src/client/main.tsx`. React owns display state only; the home screen fetches `/api/health` and represents checking, healthy, and unavailable states. It validates the response and cancels obsolete requests when the component unmounts or retries. `src/shared/health.ts` contains the small public API type and no runtime-specific code.

Step 08 adds create/join/lobby and a responsive game table. `use-room.ts` authenticates a WebSocket with per-tab session-storage credentials, reduces validated projections, disables pending/disconnected commands, and reconnects without optimistic game-state edits. `game-actions.ts` derives presentation controls from projected phase, response/gambling priority, and original sample metadata. Native dialogs provide keyboard focus containment. Opponents receive counts only; own private resources and hand references render exclusively in the owning table. Invite URLs contain only a room ID. See [the UI guide](game-ui.md).

`worker/index.ts` is an ES module Worker entry. It serves health and intentional JSON API errors, and delegates non-API requests to the assets binding. The Cloudflare Vite plugin runs the Worker in workerd during development and preview, and builds separate browser assets and Worker output. Wrangler's `run_worker_first` routes `/api` and `/api/*` to the Worker so SPA fallback cannot mask API errors, including browser navigation requests.

Separate strict TypeScript configurations prevent the Worker from relying on browser DOM globals. The domain/content/protocol configuration uses only the ES2022 library and no ambient browser, Node, or Cloudflare types. ESLint checks TypeScript and React hooks; Prettier enforces formatting. The lockfile makes npm installs reproducible. Generated Worker types, local runtime storage, build output, test artifacts, local secrets, and private content are ignored.

## Domain and runtime boundaries

- `src/engine/`: pure deterministic match setup, RNG/shuffle/draw helpers, immutable command transactions/dedupe, core turn transitions, nested response windows/stack execution, effect operations and validated handlers, and runtime invariants. `model.ts` defines shared match/player/gambling/resolution/response contracts; `types.ts` extends them with internal rules, content version, definitions, and receipts. Four seats are represented by `0 | 1 | 2 | 3`.
- `src/content/`: runtime schemas for card definitions, instances, catalogs, JSON effect DSL, and validated sample handler params. Definitions contain content; instances contain identity, a definition reference, and ownership/location metadata.
- `src/protocol/`: strict client intent schemas, internal event schemas, safe server-message schemas, JSON codecs, and pure public/private projections.
- `src/shared/ids.ts` and `version.ts`: namespaced branded identities and the safe monotonic version counter contract. Brands prevent accidental mixing in TypeScript; runtime validation also distinguishes ID namespaces.
- `worker/durable/`: authoritative rooms, persisted membership/state, and session-bound WebSocket Hibernation API handlers.
- `worker/repositories/`: server-only interfaces and D1 content, match, and append-only event/snapshot repositories.
- `migrations/` and `seeds/`: fifteen D1 tables, version/ownership/history guards, and original sample data.
- `tests/engine/`, `tests/content/`, `tests/protocol/`, `tests/worker/`, `tests/client/`, `tests/e2e/`: contract/version, content/effects, protocol/privacy, Workers runtime, React, and browser tests respectively. `tests/fixtures/` contains original sample state only.
- `public/`: public static assets only.

The public-asset directory supplies static response headers without private content or card artwork. `gambling.ts` handles rounds, `gambling-state.ts` validates their snapshots, and `gold.ts` centralizes post-setup Gold mutations. `drinks.ts`, `stats.ts`, and `elimination.ts` complete the pure engine loop. Step 07 adds the Worker room router and GameRoom Durable Object, coordinating engine commands and saving authoritative snapshots/events before acknowledging. Session attachments and token hashes bind connections to seats. See [realtime rooms](realtime-rooms.md). `scripts/engine-demo.ts` and its helpers generate an ignored public-projection report, including a command-only complete match. Local development uses Cloudflare's local runtime without external infrastructure.

## Authority and determinism

The Worker/Durable Object room owns `CoreGameState`/`AuthoritativeGameState`, including all hands, ordered decks, face-down Drink piles, card-instance registry, private resources, and RNG seed/state. The engine implements an injectable `MULBERRY32_V1` service with unsigned 32-bit seed/state and a safe draw counter. Neither RNG metadata nor authoritative state is a permitted client command or socket message.

After joining, every state-changing command requires a command ID and an expected room-state version. The room resolves identity from the authenticated connection. `applyCommand` validates the supplied trusted actor, ownership/location, lifecycle, phase, target, expected version, and deterministic receipts for implemented intents. Parsing alone establishes shape and type validity. Accepted commands advance a safe integer once; rejected/duplicate commands leave state/version/RNG unchanged. The room carries lobby versions into match setup and persists command receipts/history for dedupe and reconnect.

Every accepted core command produces an ordered batch of deterministic domain events. Events carry a command ID for causation, an event ID, room/match references, the resulting state version, and a zero-based index within the batch. All events in one batch share the same version. The room assigns increasing event sequences and persists accepted commands/events transactionally through a durable outbox before acknowledgement. Immutable manifests pin content, rules, roster and RNG seed. Recovery replays commands after the latest snapshot and verifies generated events against history. Final results are persisted once. See [persistence and replay](persistence-replay.md) and [the engine guide](engine.md).

Gambling is a separate nullable sub-state that suspends the initiating source and normal phase. It records escrow, contributions, controller/source, clockwise priority, pass consensus, departures, and a private continuation. Taking control resets pass consensus; leaving preserves the ante and prevents further control play. The central Gold ledger reserves payout capacity and requests deferred elimination checks on zero Gold, without eliminating during gambling. See [the gambling model](gambling-engine.md). The resolution stack stores pending operations, cancellation/Ignore state, choices, saved parent windows, and continuations. Windows expose clockwise priority based only on living seats. Nested children resolve first, then restore parent priority. See [the timing model](timing-engine.md). Special-character resources and side decks have `PUBLIC`, `OWNER`, or `SERVER` visibility so later characters can extend the engine without leaking private state.

## Hidden information and serialization

Public and private projections construct whitelists and validate their output. They never spread internal objects and return detached data. Public state shows stats and pile counts, public resources/side-deck counts, gambling participants/pot, response eligibility/priority, and explicitly revealed resolution cards. Public projections contain no player's hand identities, face-down Drink identities, future deck order, RNG state, effect params, or private choice options. This applies to the hand owner as well; their hand is sent separately.

`PrivatePlayerView` gives only the authenticated requester their own hand references, permitted resource values, permitted side-deck counts, and their own pending choice. It does not expose even the owner's deck order or face-down Drinks. Unknown players and corrupt hand ownership fail closed. No admin/debug HTTP endpoint is introduced; a local CLI inspector writes ignored private replay exports and a public-state HTML report.

Internal domain events can contain hidden draws and ordered Drink identity. They must never be broadcast directly. Socket messages permit only public snapshots, a unicast private player snapshot, and command acknowledgements/errors. Delivery binds a private view to its authenticated recipient; runtime schemas alone cannot authenticate a connection. See [the protocol](protocol.md) for exact fields and boundary limits.

Compound Drink frames hold all revealed sources through nested responses and private choices, then discard once. Elimination waits for an empty stack/window and settled gambling, evaluates all victims before paying anyone, and ends with a winner or tie. Public projections expose only revealed compound source references. See [Drinks and elimination](drinks-elimination.md) for configuration, boundaries, and deterministic redistribution.

## Content and reference material

The effect DSL stores strictly validated JSON operations for stats, Gold, draws/discards, Ignore/Negate, choices, pending-effect modification, and gambling start/control/win/leave hooks. A closed TypeScript registry implements the sample.adjust-resource key with independently validated resource/delta params. Unknown effect keys or params are rejected. Future unusual mechanics must add server-side handlers and explicit param schemas; D1 must never store executable JavaScript. `SAMPLE` and `PRIVATE` content origins are distinguished, and test data is original. The local JSON import pipeline validates complete packs, reports compatibility and writes an atomic version/graph. Original fixtures live in `content/samples/`; private inputs stay under ignored `content-private/imports/`. See [content import](content-import.md).

Published content versions are immutable in D1. Content identities and deck/card associations use composite version-scoped keys, so a new edition can reuse IDs without altering old definitions. Matches lock their published content version and RNG seed; match-player FKs ensure characters come from the same edition. The [database guide](database.md) documents migration, seed, graph-loading, JSON, and history contracts. The [content format](content-format.md) documents fixtures and the private-import boundary.

[The Inn](https://github.com/HaxxonHax/the-inn) is reference-only under the repository's architecture policy. Its action/deck/discard/Drink concepts may inform the data model, but its Foundry integration does not provide the server-authoritative deterministic engine required here. This project must implement that engine natively and must not copy Foundry-specific architecture or import copyrighted card content/artwork.

## Validation and coverage

The Node suites exercise every command/event discriminator, ID namespace, malformed inputs, content/effect params, version bounds, JSON round trips, pack references, private-content exclusion, and projection privacy/invariance. Engine tests add known RNG vectors, setup, turn/seat order, rejection/dedupe atomicity, exhaustion, corrupt-state checks, conservation, and deterministic replay across seeds/turns. Workers tests exercise the engine plus real D1 through `@cloudflare/vitest-plugin`. React/browser suites verify lobby/table controls, reactions, gambling, Drinks, reconnect, privacy, mobile layout and keyboard focus; browser tests also inspect the generated engine trace and replay report.

`npm run test:coverage` uses Istanbul because native V8 coverage is [unsupported by the Workers Vitest plugin](https://developers.cloudflare.com/workers/testing/vitest-integration/known-issues/). Executable engine/schema/projection/codec/version modules, repositories, and the Worker entry have 90% per-file statement, branch, function, and line gates, exceeding the 80% Worker target. Type-only declarations, test fixtures, and generated development reports are excluded.

## Tooling references

- [Cloudflare React + Vite guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/react/)
- [Cloudflare Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/)
- [Cloudflare Vitest integration](https://developers.cloudflare.com/workers/testing/vitest-integration/write-your-first-test/)

Step 11 adds native Cloudflare create/entry throttles, durable per-seat command budgets, hibernatable socket abuse counters, streamed HTTP body limits and browser security headers. See [security and deployment](security-deployment.md) for policies and account setup. Production artifacts are checked for repeat-build equality; CI remains sample-only.

# Step 07 — Cloudflare Durable Object room server + realtime protocol

## Goal

Connect the deterministic engine to a real server-authoritative multiplayer room.

No public IP or self-hosted server must be required.

## Cloudflare architecture

Use:
- Worker as HTTP/API/router entry
- one Durable Object instance per room/match
- Durable Objects WebSocket Hibernation API
- D1 bindings for persistent content/history where needed

Do not add Redis.

## HTTP routes

Implement at least:
- health
- create room
- join/room metadata as needed
- WebSocket upgrade endpoint

Use opaque room IDs/codes that do not expose internal Durable Object identifiers directly unless intentionally designed.

## Durable Object responsibilities

Room Durable Object owns:
- authoritative game state
- connected sessions
- seat/player mapping
- command validation dispatch
- state version
- engine invocation
- broadcast
- reconnect token/session handling skeleton
- snapshot hooks

Do not make React authoritative.

## WebSocket messages

Client -> server:
- HELLO/JOIN
- command envelope
- ACK/heartbeat if needed

Server -> client:
- connection/session accepted
- public/private state snapshot
- domain event(s)
- state patch or refreshed projection
- command rejection with safe reason/code
- version mismatch requiring resync

Use runtime schema validation on every inbound message.

## Projection/broadcast

For each connected player, derive the correct view.
Do not broadcast one internal object to everybody.

## Concurrency

Use Durable Object single-instance coordination correctly.
Still defend against:
- duplicate command IDs
- stale expected state version
- reconnect duplicates
- malformed messages

## Hibernation

Use the hibernation APIs rather than pinning the object in memory unnecessarily.

Persist enough session metadata/state so the room can recover after hibernation/restart.

## Tests — mandatory

Use Workers runtime tests for Durable Objects.

At minimum:
1. room creation
2. two players join same room
3. different room gets different state
4. malformed WebSocket message rejected safely
5. valid command reaches engine
6. invalid command rejected without mutation
7. stale version rejected
8. duplicate command is idempotent
9. player A receives own private hand
10. player B does not receive A's hand
11. deck order never sent
12. accepted command updates all clients' public view
13. only relevant private view changes for affected player
14. reconnect can restore projection
15. room state survives object lifecycle/storage round-trip
16. concurrent-looking duplicate submissions do not double-apply
17. WebSocket close cleans session metadata appropriately
18. authorization/session token cannot be reused to impersonate another seat

Because current Workers Vitest WebSocket isolation has limitations, use the best supported combination of:
- direct Durable Object runtime tests
- protocol/unit tests
- integration harness
- Playwright real dev-server tests

Document any test-framework limitation rather than silently skipping coverage.

Run standard verification and applicable E2E.

Stop after this step.

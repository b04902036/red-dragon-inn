# Authoritative realtime rooms through step 11

The Worker routes requests to one SQLite-backed `GameRoom` Durable Object per opaque room ID. Its WebSockets use `ctx.acceptWebSocket`, attachment serialization, and class event handlers, following [Cloudflare's Hibernation API](https://developers.cloudflare.com/durable-objects/best-practices/websockets/). No home server, Redis, public IP, or external account is needed for local play.

## HTTP and session contract

| Route                          | Method           | Behavior                                                 |
| ------------------------------ | ---------------- | -------------------------------------------------------- |
| `/api/health`                  | GET              | Existing health response                                 |
| `/api/rooms`                   | POST             | Create a room with `{ "displayName": "Host" }`           |
| `/api/rooms/:roomId/join`      | POST             | Join an unstarted room with `{ "displayName": "Guest" }` |
| `/api/rooms/:roomId`           | GET              | Public metadata and current projection                   |
| `/api/rooms/:roomId/ws`        | GET with Upgrade | Open a hibernatable WebSocket                            |
| `/api/rooms/:roomId/character` | PATCH            | Select an available character before starting            |
| `/api/content/sample`          | GET              | Public character/card display metadata                   |

Character selection uses `Authorization: Bearer <resumeToken>` and strict JSON `{characterId, expectedStateVersion}`. The token identifies the acting seat; callers cannot submit a player ID. Stale, occupied, unknown or post-start choices reject without mutations. New joins receive unused sample characters. Successful selection persists an incremented lobby version and broadcasts its public projection. Authenticated `ROOM_PRESENCE` messages describe which seats have active sessions after join/authentication/close; they contain no credentials.

Creation/join return validated metadata plus credentials `{ roomId, playerId, resumeToken }`. Each uses an opaque random ID; the internal Durable Object ID is never returned. Seats and original sample characters are assigned server-side, maximum four. The creator is host; only the host can start, with at least two players. Joining after the match starts is rejected. Creation/join requests are strict JSON with bounded names and request size; clients cannot select a seat, host identity, seed, rules, or stats. Browser origins must match the request origin. Responses containing credentials disable caching.

Connect without placing the credential in the URL, then send:

```json
{
  "type": "HELLO",
  "roomId": "room_opaque",
  "playerId": "player_opaque",
  "resumeToken": "64 lowercase hexadecimal characters"
}
```

The server stores only a SHA-256 token digest. It compares the credential against the requested seat in that room before assigning a fresh session ID and sending SESSION_ACCEPTED, PUBLIC_STATE, and the owner's PRIVATE_STATE. A token for player A cannot authenticate player B or a different room. Sending HELLO again on an authenticated connection is rejected. Resuming a seat replaces its previous connection; the previous socket loses its authenticated attachment. Close/error handlers clear the active session while retaining membership and the resume credential.

Authenticated messages use `{ "type": "COMMAND", "command": { ...client intent... } }`, or `{ "type": "PING", "nonce": "bounded string" }` for a matching PONG. Commands never carry an actor; the connection supplies it. Every inbound message is runtime-validated, including UTF-8 size limits; malformed text/binary frames receive a safe rejection. At most sixteen sockets can await/connect within a room.

## Coordination, projection, and durability

Room requests and messages run through an explicit Durable Object concurrency gate. The engine validates lifecycle, phase, ownership, priority, target, version, and command receipts. Stale commands receive VERSION_CONFLICT and fresh public/private projections. Exact retries acknowledge their original accepted version and resync the caller; reused IDs with different payloads reject. Concurrent-looking duplicates cannot double-apply effects.

The server derives every client's projection separately. Accepted commands send the same public view to connected players. A private snapshot is sent only when that player's hand, resources, side-deck counts, match identity, or pending choice changes; HELLO/resync always sends it. Its version marks its last refresh, so an unchanged private view may precede the current public version. Clients must use the public version for new commands.

Hidden domain events are persisted server-side and never broadcast. Durable storage atomically records the latest room/engine snapshot, event batch and D1 outbox before acknowledgement. The outbox then commits transactional D1 command/event history, periodic or transition snapshots and final results. Failed persistence retains the outbox and requests reconnect; the next request retries it before continuing gameplay. Runtime state, RNG, command receipts, membership, and hashed credentials survive restarts. WebSocket attachments retain seat/session identity and a digest of the last private projection across hibernation. No interval or background socket listener pins the object in memory. See [persistence and replay](persistence-replay.md) for recovery, token renewal and the local inspector.

## Verification

Workers-runtime tests exercise all eighteen prompt criteria with actual Durable Objects, real paired WebSockets, direct lifecycle inspection, and storage checks. The installed plugin supports [evictDurableObject](https://developers.cloudflare.com/workers/testing/vitest-integration/test-apis/), so tests evict an object, resume its live socket attachments, then reconnect and retry a command. No hibernation test is silently skipped. A Playwright test uses two independent browser contexts against the real production preview server to verify joining, private hands, shared updates, stale rejection, and reconnect.

For manual inspection, use the [game UI checklist](game-ui.md). Create a room in one tab and join its invite in another. DevTools Network shows validated Fetch and WebSocket frames: both public views agree and private hands contain different physical instances. The engine visual report remains available with `npm run demo:engine`.

Anonymous resume credentials are bearer credentials; keep them in the owning browser and share only the room ID. Token renewal/revocation, rate limits, payload bounds, CSP and deployment preparation are implemented; account authentication and token expiration remain later product work. See [security and deployment](security-deployment.md). The implementation here establishes the seat binding and durable recovery contract needed by those steps.

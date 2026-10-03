# Persistence and replay through step 09

Accepted gameplay commands have two durable records: authoritative room storage and transactional D1 history. The room atomically stores its new state, event batch, next event sequence, and a pending history outbox. It then commits that outbox to D1 before acknowledging the command. A failed D1 commit retains the outbox, rejects subsequent work with `PERSISTENCE_UNAVAILABLE`, and closes gameplay sockets with code 1013. Reconnect or the next request retries the outbox before serving the recovered table. Exact command retries acknowledge the original version and cannot append history or results twice.

D1 writes the match, roster, immutable replay manifest, ordered events, accepted-command record, optional snapshot, and final results in one batch. Sequence numbers start at one and increase across accepted event batches; command IDs, state versions, event sequences and event positions have uniqueness guards. SQL triggers prevent rewriting manifests, commands, events and final results. The room assigns sequences; clients cannot supply them. [D1 batches are transactional](https://developers.cloudflare.com/d1/worker-api/d1-database/), so a failed statement rolls back the complete batch.

## Recovery and deterministic replay

The manifest pins the complete validated content edition, initial roster/rules, initial room version and RNG seed. Publishing a later edition cannot alter a match's replay. An initial sequence-zero snapshot is saved at start, followed by snapshots every ten state versions and at lifecycle, phase, response-window or gambling-stage transitions. Each snapshot contains the internal engine state, schema version, state version and last included event sequence.

Recovery uses the latest snapshot plus subsequent accepted commands. The pure replay module applies each command as its recorded actor and compares every generated event with its recorded batch. Gaps, duplicate entries, rejected commands or differing events fail recovery. Replay from the original manifest uses the same process from sequence zero. Engine decisions never depend on stored timestamps.

The Durable Object's authoritative snapshot also preserves membership, token digests and command receipts across eviction. D1 can reconstruct the game independently; it does not reconstruct deleted room membership or credentials. No public route exposes internal snapshots, manifests or command/event exports.

## Reconnect and credential policy

A resume token remains bound to one room and seat. HELLO always sends fresh public and owner-only private projections. Stale commands force a resync. A new connection for the same seat replaces and deauthenticates its previous socket (code 1008); the old browser requires explicit reconnect to avoid a reconnect loop.

The binding-only `renewResumeToken` operation accepts a valid current token, issues a replacement for the same seat, and revokes the old token and connection. Invalid credentials return null. This operation has no HTTP route. Token expiration and public account/session policy are later hardening work.

## Visual verification

Prepare the local database and start the app:

```sh
npm run db:migrate
npm run db:seed
npm run dev
```

Create a room and join its invite in a separate browser context. Start and discard/draw, then refresh the guest. Confirm the same seat and exact private hand return. Stop and restart the development server; both tabs should reconnect to the same table and version. Inspect WebSocket frames: projections contain only public information and the receiving player's hand.

Read the match ID from `GET /api/rooms/<roomId>` in DevTools, then run:

```sh
npm run replay:inspect -- --match match_ID
```

Open `.tools/replay-inspector/match_ID.html`. It should show the green **Replay verified** message, the pinned content edition, accepted-command/event counts and current public stats/phase. Play another turn and rerun the inspector to see the counts advance. At match finish, the report shows FINISHED and the final public results. The companion JSON contains private authoritative game data; both artifacts stay in ignored local `.tools/` storage. The inspector reads only local D1 and is absent from production routes and assets. Keep local exports private.

## Verification and limits

Workers-runtime tests force a D1 rollback, reconnect and flush the retained outbox, and verify exact retries. Separate tests evict a live room and recover an already-committed outbox without duplicate history. The installed test runtime stalls if eviction is requested immediately after all sockets close during the forced-failure scenario; that scenario verifies reconnect recovery, while actual eviction remains covered independently. A full four-player integration match covers nested responses, gambling, Chasers, disconnect/reconnect, eviction, elimination, finish, paged history and exact replay equality. The browser suite verifies the local inspector against a real played match.

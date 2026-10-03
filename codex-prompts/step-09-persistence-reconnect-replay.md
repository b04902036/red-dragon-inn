# Step 09 — Persistence, reconnect, snapshots, replay

## Goal

Make games recoverable and auditable.

## Event log

Persist accepted domain events with:
- match ID
- strictly increasing sequence
- actor where relevant
- event type
- validated JSON payload
- timestamp
- state version relationship if useful

Important:
Persist domain-safe information. Do not accidentally expose hidden content through public APIs.

## Snapshots

Create periodic/state-transition snapshots.

Requirements:
- snapshot includes enough internal authoritative state to recover
- snapshot is versioned
- store sequence number
- restore = latest snapshot + later events, or another deterministic documented strategy

## Reconnect

Implement:
- stable session/reconnect token
- same seat after reconnect
- fresh public/private projection
- stale client forced to resync
- duplicate active connection policy documented

## Replay

Create engine-level replay:
- given initial content version
- RNG seed
- ordered accepted command/event history
- reproduce final state

For debugging, add a development-only replay inspector/log export that does not leak secrets in production.

## Match finish

Persist:
- winner(s)
- player results
- end time
- final sequence/state version

## Tests — mandatory

At minimum:
1. event sequence monotonic
2. event sequence uniqueness
3. snapshot saved
4. restore from snapshot
5. replay after snapshot reaches same state
6. deterministic replay from beginning reaches same final state
7. reconnect restores correct private hand
8. reconnect cannot take another seat
9. stale reconnect token rejected
10. duplicate connection policy works
11. room restart/storage rehydrate works
12. finished match cannot accept gameplay commands
13. final winner/result persisted once
14. event history cannot be appended twice through command retry
15. content version remains pinned through restore/replay

Add a long integration scenario with:
- multiple turns
- nested response
- gambling
- drink/chaser
- disconnect
- reconnect
- elimination
- game finish
- replay equality

Run standard verification.

Stop after this step.

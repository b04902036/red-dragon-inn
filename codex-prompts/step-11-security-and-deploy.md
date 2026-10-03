# Step 11 — Security hardening and Cloudflare deployment

## Goal

Make the MVP safe enough to expose to friends through a public Cloudflare URL without a home public IP.

## Security

Implement/review:
- all gameplay authorization server-side
- runtime validation of every network payload
- safe maximum payload sizes
- rate limiting/throttling appropriate to room commands
- command ID idempotency
- state-version concurrency guard
- random/unpredictable reconnect/session tokens
- no room/admin secrets in logs
- no hidden cards in error payloads
- no hidden data in public state
- no arbitrary code from content DB
- basic security headers
- origin policy appropriate to deployment
- production debug endpoints disabled

## Abuse controls

At minimum protect:
- create-room spam
- join brute force
- command flood
- oversized WebSocket messages
- repeated malformed messages

Use Cloudflare-native capabilities where practical but keep local tests possible.

## Deployment

Prepare Wrangler/Cloudflare config for:
- Worker/static React assets
- Durable Object binding
- Durable Object migrations
- D1 binding
- environment separation if needed

Provide exact documentation for:
1. Cloudflare login
2. creating D1 database
3. applying migrations
4. configuring bindings
5. deploying
6. obtaining the `workers.dev` URL
7. smoke testing production

Do not require custom domain.

## CI

Add a reasonable CI pipeline if repository hosting supports it:
- install
- typecheck
- lint
- unit/runtime tests
- build
- Playwright where feasible

Never store Cloudflare secrets in repo.

## Tests — mandatory

At minimum:
1. unauthorized gameplay command rejected
2. player cannot control another seat
3. forged stat/state fields ignored/rejected
4. hidden hand absent from public serialization
5. hidden deck order absent
6. malformed schema rejected
7. oversized payload rejected
8. replayed command not double-applied
9. stale version rejected
10. invalid reconnect token rejected
11. unknown effect key cannot execute
12. production debug/admin route disabled
13. rate-limit/abuse guard behavior
14. deployment build is reproducible

Playwright production-like smoke:
- create room
- join second context
- play at least one legal turn interaction

Run all standard verification.

Stop after this step.

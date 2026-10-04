# Security and deployment through step 12

The server authenticates each seat, validates every intent and derives public/private projections. Gameplay data cannot select the acting player or override stats, decks, seed or phase. Command receipts prevent duplicate application; stale versions resync. No production debug/admin/history route exists, and no domain event or raw exception is sent to sockets. Reconnect credentials are random 256-bit bearer tokens, stored only as digests on the server and in the owning tab's session storage.

## Abuse and browser boundaries

HTTP JSON bodies are read incrementally with a 65,536-byte ceiling. Non-JSON media types, invalid UTF-8, missing/malformed bodies and forged fields reject. WebSocket frames use the same byte ceiling and strict schemas. Eight malformed frames in ten seconds close the socket with 1008. More than 240 total frames per socket in ten seconds also closes with a safe `RATE_LIMITED` rejection. These counters survive hibernation in the attachment. Accepted or rejected gameplay intents consume a separate limit of 60 commands per seat per ten seconds, stored in the room so reconnect cannot reset it. These transport counters do not mutate game state.

[Cloudflare rate-limit bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) protect creation (20 attempts/minute/address) and join, socket upgrades and character selection (60/minute/address per operation), before dispatch to a room. Keys hash the Cloudflare-provided connecting address. Local requests without that header share a local bucket. Shared addresses share limits; edge rate-limit counters are permissive and local to a Cloudflare location, while the seat command budget is serialized in its authoritative room. Namespace IDs 31001/31002 should be unique for this application in your account.

Origin headers must exactly match the request's origin, including scheme/port. Cross-origin and opaque `null` origins reject. Non-browser tools without Origin remain supported and still require seat credentials for private/gameplay operations. Credentials never appear in invite URLs, and no permissive CORS header is sent.

API and static asset responses set CSP, `nosniff`, frame denial, no-referrer and a restrictive permissions policy. The CSP permits own scripts/connections and inline styles for the React table, and prohibits plugins, foreign scripts, framing and external form submission. The [static `_headers` file](https://developers.cloudflare.com/workers/static-assets/headers/) protects assets even when the Worker does not run first. No private import or CLI artifact is under public assets.

## Local production verification

```sh
npm run db:migrate
npm run db:seed
npm run typecheck
npm run lint
npm test
npm run test:coverage
npm run build
npm run verify:build
npm run test:e2e
```

`verify:build` builds twice and compares SHA-256 hashes of every generated artifact. Browser tests exercise the production preview, including real create/join/play/reconnect, visible table behavior, response headers and disabled debug/private routes. CI runs the same checks using only original sample content.

## Deploy to your Cloudflare account

The local Step 21C RDI1 edition uses `PUBLIC_RULES_PARAPHRASE`, which is not a distribution license. Public RDI branding, character identities and assets may require permission. Local D1 activation does not grant permission or populate remote storage. Follow [the current production content workflow](rdi1-compile-publish.md); do not seed sample content into a production channel. The all-76-character deployment completeness gate remains unchanged.

Deployment is prepared locally; these remote operations are performed only when you choose an account and are ready to publish. No custom domain or home public IP is required. Follow Cloudflare's [D1 setup](https://developers.cloudflare.com/d1/get-started/) and [React/Vite deployment](https://developers.cloudflare.com/workers/framework-guides/web-apps/react/) guides if your account prompts differ.

1. Authenticate and verify the intended account:

   ```sh
   npx wrangler login
   npx wrangler whoami
   ```

2. Create a separate production database:

   ```sh
   npx wrangler d1 create red-dragon-inn-production
   ```

3. In `wrangler.jsonc`, replace the zero `database_id` with the returned UUID and set `database_name` to `red-dragon-inn-production`. If you have multiple accounts, set the intended non-secret `account_id` from `whoami`. Keep `DB`, `ASSETS`, `ROOMS`, the GameRoom class, migration tag `v1` and `new_sqlite_classes` unchanged. Set a unique Worker name if needed. Check the two rate-limit namespace IDs against your existing applications. Credentials/API tokens remain outside the repository.

4. Apply migrations to that selected remote database:

   ```sh
   npx wrangler d1 migrations apply DB --remote
   ```

   Local D1 storage remains separate from remote data. Populate and activate a validated published edition only when its public use is authorized. Public rooms require the production channel and never fall back to samples. The local importer does not write remote D1.

5. Run the local verification above, then deploy the client and Worker:

   ```sh
   npm run deploy
   ```

   Vite generates the deployment Wrangler configuration with built assets. Deployment creates the configured SQLite Durable Object namespace through migration `v1`. Preserve migration history on subsequent deployments; introduce new tags for future class changes.

6. Copy the HTTPS `workers.dev` URL printed by Wrangler. `workers_dev: true` is configured; if your account has no subdomain yet, follow its setup prompt. See [workers.dev routing](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/). A custom domain is optional.

7. Smoke-test the live URL:

   ```sh
   curl -i https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/api/health
   ```

   Expect 200, the health JSON and security headers. Open the URL in two separate browser contexts, create/join a room, start, discard/draw, play/pass one legal interaction and refresh the guest. Confirm shared stats and the same private seat/hand return. Check `/api/debug`, `/api/admin` and `/api/replay` return JSON 404. Inspect WebSocket frames for owner-only hands and counts for opponents. Never paste resume tokens into public reports.

The zero UUID is for local development; it is not a deployable remote database binding. Production publication, remote migrations and live smoke checks are not automatically performed by the local verification commands.

## Visual verification

Run `npm run build` and `npm run preview`, then open the printed URL. Use DevTools Network to inspect the document and `/api/health` security headers. Play with two contexts using [the game checklist](game-ui.md), refresh a guest and verify the same hand. Open `/api/debug`: it should show only the small JSON 404. The automated abuse tests exercise floods and time windows without making manual gameplay tedious.

This friend-room MVP uses anonymous bearer seats. Accounts, spectator permissions, moderation, automatic idle-room cleanup and global distributed abuse prevention remain future product work. Share invite URLs with intended players: a pre-start invite permits joining an available seat.

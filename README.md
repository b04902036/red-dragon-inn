# Red Dragon Inn

Steps 00–12: a playable React + TypeScript sample game with a Cloudflare Worker API, authoritative Durable Object rooms, validated projections, transactional D1 history, and a deterministic engine with responses, gambling, Drinks/Chasers/Drink Events, elimination, and victory. Create a room, share its invite and play from desktop or mobile. Each player receives only their own private projection. See [the visual checklist](docs/game-ui.md), [the realtime room guide](docs/realtime-rooms.md), and [persistence/replay verification](docs/persistence-replay.md).

## Local development

Install Node.js 24 LTS, version 24.15 or later (with npm), then run:

```sh
npm ci
npx playwright install chromium
npm run db:migrate
npm run db:seed
npm run dev
```

Open the local URL printed by Vite (normally `http://127.0.0.1:5173`). The home screen fetches the same-origin Worker health endpoint and lets you check again. The Worker runs locally in workerd through the Cloudflare Vite plugin. No secrets, Cloudflare login, public IP, or hosted database are needed.

If browser installation needs Linux system libraries, use `npx playwright install --with-deps chromium`.

To create and seed the local content database:

```sh
npm run db:migrate
npm run db:seed
```

These local commands can be repeated. The seed contains four fictional characters and ten sample definitions. See [the database guide](docs/database.md) for inspection commands and [the content format](docs/content-format.md) for JSON packs. Current rooms pin the bundled sample pack and save accepted history, snapshots and final results in D1.

## Visually verify the turn engine

```sh
npm run demo:engine
```

Open `.tools/engine-demo/trace.html` in your browser (PowerShell: `Start-Process .tools/engine-demo/trace.html`). **Drink chain and elimination** reveals Tea → Tea → Fizz as one source: Alcohol/Fortitude remain 18/20 during responses, then become 22/22. Player 1 is eliminated, Gold becomes `0 / 11 / 11 / 11`, and player 2 starts DISCARD_DRAW. **Complete sample match** ends FINISHED with one survivor and a named winner. Green checks confirm replay and conservation. See [the Drink/elimination guide](docs/drinks-elimination.md#visual-verification) for the full checklist.

The report also shows a gambling round, twelve turns, redraws/reshuffles, public-state inspection, and an Action / Ignore / Negate chain. It uses smaller hand/stat settings for concise demonstrations. Default playable rooms use hand size seven and Fortitude twenty. See [the game UI guide](docs/game-ui.md) to verify live play.

See [the audited MVP scope, release evidence and limitations](docs/mvp-status.md).

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm run test:coverage
```

`typecheck` generates Worker runtime/binding types and checks the pure engine/contracts, browser, Worker, tests, and tooling with separate strict TypeScript configurations. `lint` includes ESLint and Prettier checks. `npm run format` formats project files. `npm run test:watch` starts Vitest in watch mode. `test:coverage` measures executable engine/contract/schema/projection code, the Worker entry, and repositories with Istanbul and enforces 90% per-file coverage gates.

Worker tests use `@cloudflare/vitest-plugin` inside the actual Workers runtime, exercising D1 repositories, Durable Objects, real WebSockets, eviction/reconnect and hidden-information boundaries. React tests use Testing Library and jsdom. `test:e2e` checks a production preview: health/routing, engine traces, socket privacy, and two-player gameplay including reactions, Drinks, gambling, refresh and mobile turns with no browser errors.

The pure contract suite tests command/event discriminators, ID and version boundaries, JSON content/effect validation, and public/private projection privacy. Contracts are also exercised inside the Workers runtime. See [the protocol](docs/protocol.md) for reserved command/event/message fields and the distinction between schema validity and server authorization.

To preview the production build manually:

```sh
npm run build
npm run preview
```

## Cloudflare deployment

Before remote deployment, provision D1, replace the local placeholder `database_id` in `wrangler.jsonc`, and apply migrations to that remote database. Then authenticate with `npx wrangler login`, select an account if prompted, and run `npm run deploy`. This builds the client and Worker before deploying the generated Wrangler configuration. See [security, exact deployment commands and live smoke checks](docs/security-deployment.md). Remote provisioning/deployment is not performed by local verification. The Worker name can be changed before deployment.

## API

- `GET /api/health`: HTTP 200, `{"ok":true,"service":"red-dragon-inn"}`, with `Cache-Control: no-store`.
- Other methods on `/api/health`: HTTP 405 with `Allow: GET` and `{"ok":false,"error":{"code":"METHOD_NOT_ALLOWED"}}`.
- Unknown `/api` or `/api/*` route: HTTP 404 and `{"ok":false,"error":{"code":"NOT_FOUND"}}`.
- Non-API paths serve static assets with SPA fallback.

See [the architecture note](docs/architecture.md) for the browser/Worker boundary. Put user-owned/licensed packs in ignored `content-private/imports/` and follow [local content import](docs/content-import.md). Only original sample definitions are included; no artwork is bundled.

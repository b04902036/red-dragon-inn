# Step 00 — Bootstrap the full-stack Cloudflare project

## Goal

Create the development foundation for a single-repository React + TypeScript + Cloudflare Workers application.

The project must run locally without any public IP and be deployable later to Cloudflare.

## Requirements

Use the current Cloudflare React/Vite approach:
- React
- TypeScript
- Vite
- `@cloudflare/vite-plugin`
- Wrangler
- Cloudflare Workers ES module format

Use current testing tools:
- Vitest
- `@cloudflare/vitest-plugin`
- Playwright

Do **not** use deprecated `@cloudflare/vitest-pool-workers`.

## Desired structure

A single repo is preferred:

```text
src/
  client/
  engine/
  content/
  protocol/
  shared/
worker/
  index.ts
  durable/
  repositories/
migrations/
tests/
  engine/
  worker/
  e2e/
public/
docs/
```

You may adjust the exact Vite entry layout if the Cloudflare scaffold requires it, but preserve clear separation between browser code, engine code, and server/runtime code.

## Required package scripts

At minimum:

```json
{
  "dev": "...",
  "build": "...",
  "preview": "...",
  "deploy": "...",
  "typecheck": "...",
  "lint": "...",
  "test": "...",
  "test:watch": "...",
  "test:e2e": "..."
}
```

Add ESLint and formatting configuration appropriate for TypeScript/React.

## Minimal functionality

Implement:
- React home screen.
- Worker `GET /api/health`.
- Response must include a stable machine-readable shape such as:
  - `ok`
  - `service`
  - optional build/runtime metadata.
- UI should fetch and display backend health in development.

Do not build game logic yet.

## Environment

- No required secrets for local development.
- Provide `.dev.vars.example` if future vars are anticipated.
- Add `.gitignore` entries for:
  - `.dev.vars`
  - private content
  - generated local DB data
  - Playwright artifacts where appropriate

## Tests — mandatory

Add enough tests to prove:
1. Worker health endpoint returns 200 and expected JSON.
2. Unknown API route returns an intentional 404 response.
3. Basic React app renders.
4. The health state is represented correctly in UI logic.
5. Production build succeeds.

Where Worker behavior is tested, use `@cloudflare/vitest-plugin`.

Add a minimal Playwright smoke test that loads the app and sees the application shell.

## Verification

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Do not mark complete if any command fails.

## Deliverables

- Working scaffold.
- Testing scaffold.
- README section with local dev commands.
- Short architecture note explaining browser vs Worker separation.
- Git diff review summary.

Stop after this step.

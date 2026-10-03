# AGENTS.md — Red Dragon Inn Web App

## Mission

Build a browser-based, multiplayer card-game engine inspired by the gameplay structure of The Red Dragon Inn, with a server-authoritative architecture that can ultimately support the full product/character catalog.

The first implementation milestone is a **playable RDI-1-style core rules MVP with four character slots and generic/sample content**, not a full copyrighted card database.

## Non-negotiable architecture

- Frontend: React + TypeScript + Vite.
- Runtime/backend: Cloudflare Workers.
- Realtime rooms: Cloudflare Durable Objects.
- WebSocket implementation: Durable Objects **WebSocket Hibernation API**.
- Persistent relational storage: Cloudflare D1.
- Testing:
  - Vitest.
  - `@cloudflare/vitest-plugin` for Worker/Durable Object tests.
  - Playwright for browser E2E.
- Package manager: npm unless the repository already consistently uses another package manager.
- Strict TypeScript.
- Server is authoritative for all hidden/game-critical state.
- Clients send commands/intents only. Clients never submit authoritative Fortitude, Alcohol, Gold, hand, deck order, RNG results, or phase state.
- Do not require a public IP, home server, VPS, Redis, or PostgreSQL for the production design.

## Important implementation principles

1. **Deterministic engine**
   - Game rules must live in pure or near-pure TypeScript modules independent of React and Cloudflare where practical.
   - Randomness must flow through one injectable deterministic RNG service.
   - Every accepted command must produce deterministic domain events.

2. **Event-oriented state**
   - Keep an append-only domain event model for match history.
   - Runtime state may be snapshotted for performance/reconnect.
   - Every mutation must be traceable to an accepted command and emitted event(s).

3. **Hidden information**
   - Never send another player's hand, hidden deck order, or face-down Drink pile contents to clients.
   - Build a server-side projection layer:
     - public state
     - current player's private state
     - admin/debug state only in test/development

4. **Card effects**
   - Do not store executable JavaScript in D1.
   - Implement common effects through a JSON effect DSL.
   - Implement unusual mechanics via server-side `effect_key` handlers with validated params.
   - Keep the engine extensible for character-specific resources and side decks.

5. **Timing/interruptions**
   - Do not model all reactions as giant `if/else` branches.
   - Use a resolution stack and response-window system for Sometimes/Anytime/Ignore/Negate-style interactions.
   - Gambling is a sub-state that suspends the normal turn sequence while active.

6. **Content/IP**
   - Do not scrape or invent a complete copyrighted card database.
   - Repository-safe fixtures should use clearly marked sample/test cards.
   - Support importing user-owned/licensed card data from a private content directory.
   - Add private content paths to `.gitignore`.
   - Do not bundle copyrighted artwork unless the user supplies it and has the right to use it.

7. **No dependency on The Inn**
   - `HaxxonHax/the-inn` is reference material only.
   - Do not copy Foundry-specific architecture.
   - Useful concepts to study: card JSON organization, player actions, deck/discard/drink concepts.
   - Reimplement logic natively.

## Required engineering quality

- No step is considered complete merely because the app starts.
- Every step must add tests for all acceptance criteria introduced in that step.
- When fixing a bug, add a regression test first or in the same change.
- Core engine rule logic should target >= 90% statement/branch coverage where meaningful.
- Worker/Durable Object protocol logic should target >= 80% meaningful coverage.
- Do not game coverage with trivial tests, generated files, type-only modules, or snapshots with no behavioral assertions.
- E2E tests must verify user-visible behavior, not only that a page renders.

## Required checks before declaring ANY step complete

Run the relevant commands and report exact results:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

When the step touches UI or realtime flows also run:

```bash
npm run test:e2e
```

When the step touches Cloudflare bindings/runtime behavior, tests must execute inside the Workers runtime through `@cloudflare/vitest-plugin`, not only Node.js mocks.

If a command does not exist yet and is required by the current step, add it.

## Test categories

Use all applicable categories:

- Pure engine unit tests.
- Property/invariant tests where useful.
- Worker runtime integration tests.
- Durable Object direct tests.
- D1 migration/repository tests.
- WebSocket protocol tests.
- React component tests for nontrivial UI logic.
- Playwright E2E for major user journeys.
- Deterministic replay tests.
- Reconnect/resume tests.
- Security/hidden-information tests.

## Code-review checklist after each step

Before stopping:

1. Inspect `git diff`.
2. Remove dead code and debug logging.
3. Confirm no secrets, copyrighted private content, or local paths are committed.
4. Confirm tests actually exercise the new behavior.
5. Confirm no client can bypass server validation.
6. Update docs if architecture/API/schema changed.
7. Summarize:
   - files changed
   - behavior added
   - tests added
   - commands run/results
   - known limitations
   - whether next step is safe to begin

Do not automatically begin the next step unless explicitly instructed.

# AGENTS production addendum

These rules supersede the earlier MVP/sample-content assumptions.

## Production status

The MVP steps are complete. The repository is now moving from a sample/demo build to a production-content-capable build.

### Sample fixture policy

- `content/samples/` remains valid for automated tests and explicit fixture/demo mode.
- Sample content MUST NOT be the default production runtime content.
- Production Worker/Durable Object code MUST NOT directly import `sampleContentPack` or `samplePresentation`.
- UI strings such as "Sample table", "Start sample match", and "Original sample cards" must not appear in production mode.
- Do not mechanically strip the word `Sample` from test fixture identities. Keep tests explicit and isolated.

## Official/private content policy

- Publicly available product names, character names, rules summaries, and terminology may be used as catalog/reference data.
- Do not scrape or republish a complete proprietary card-text database from websites.
- Complete official card names/text/effects must come from user-owned/licensed input under `content-private/` or another explicitly authorized source.
- Never invent missing official card effects.
- A release must fail content completeness checks when required production content is missing.

## Localization

- UI supports at least `en-US` and `zh-TW`.
- `zh-TW` is Traditional Chinese, not Simplified Chinese.
- Use `reference/zh-TW-glossary.md` as the terminology authority unless a later verified official Traditional Chinese source supersedes a term.
- Game engine identifiers remain locale-independent.
- Player locale is presentation-only and must not alter authoritative game state, RNG, legality, replay, or event semantics.
- Card/character translations must preserve an English canonical identifier/name for debugging and fallback.

## Audio

- Bundle audio locally; do not hotlink runtime game audio.
- Store source URL, author, filename, license, and retrieval date in an audio asset manifest.
- Prefer CC0/public-domain assets.
- Background music and sound effects need separate volume/mute controls.
- Respect browser autoplay policy. Audio must unlock only after a user gesture.
- Turn/attention audio must be event/transition driven and must not replay merely because React rerendered, the client resynced, or the page reconnected.

## UI interaction

- During card-selection modes, clicking/tapping anywhere on an eligible card toggles selection.
- Embedded action buttons must not accidentally toggle selection through event bubbling.
- Desktop pointer hover and keyboard focus automatically expose card details.
- Do not use a hover-triggered blocking modal that causes pointer flicker.
- Mobile/touch must retain an accessible way to inspect a card without depending on hover.
- All card interactions require keyboard-accessible semantics and visible focus.

## Required checks

Every new production-upgrade step must run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

If a step introduces a new validator/script, run it explicitly too.

No step passes while a required production-completeness, localization-consistency, audio-behavior, or accessibility test is failing.

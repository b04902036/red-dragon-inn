# Turn-owner response timing and local content diagnosis

Verified on 2026-10-05.

## Behavior

New matches pin `timing.turnOwnerUntimed: true`. The active turn owner's legal Sometimes/Anytime response and phase-end Anytime opportunities retain their prompt identity and legal cards with `deadlineAt: null`. Explicit play/pass advances resolution; elapsed time, reconnect, hibernation and stale alarms cannot pass an untimed owner prompt. Other players retain 30-second response and 15-second phase-end deadlines. Card legality, authenticated priority and hidden-information boundaries still apply.

Older saved matches without this timing flag preserve their original deadlines for deterministic replay. Start a new match to use the fix. See [the timing contract](timed-prompts.md).

The local D1 inspection found no `content_channels` entries and only the two published sample editions. Normal development runs in production-content mode, so Create correctly returns `CONTENT_UNAVAILABLE`. The ignored private RDI1 normalized source and generated pack are absent from this checkout. Restore those inputs and follow [RDI1 publication](rdi1-compile-publish.md); `npm run content:publish:rdi1` validates, publishes and activates the local edition. `npm run dev:fixture` enables an explicit sample game. No sample production fallback or fabricated content was added.

## Changes and regressions

- `src/engine/rules.ts`, `timed-prompts.ts`, `commands.ts`, `invariants.ts`: pinned owner exemption, nullable deadlines and rejection of invalid expiry/deadline claims.
- `worker/durable/game-room.ts`: preserve untimed decisions on reads/reconnect; schedule gameplay alarms only for finite deadlines; retain the exemption in fixture timing overrides.
- `src/client/PromptCountdown.tsx`, `src/shared/ui-messages.ts`: English/Traditional Chinese no-time-limit message without a countdown.
- Engine, client and actual Workers tests cover late legal play/pass, guest expiry, active-player identity, nested responses, snapshot/replay, hibernation/reconnect, stale alarms and legacy timing. Existing generic and private RDI1 assertions reflect owner-aware deadlines.
- The fixture Chrome journey waits beyond both former owner deadlines, plays a legal card, explicitly passes, and verifies the next player's countdown/expiry. Private RDI1 browser timeout tooling refuses to shorten untimed prompts.
- README, protocol and timing documentation explain content setup and the updated contract. The preceding Chrome buffered-music fix remains intact.

## Command results

| Command                                                                                               | Result                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                                                                   | Exit 0; all projects and Worker binding generation passed.                                                                                                                              |
| `npm run lint`                                                                                        | Exit 1; ESLint passed, Prettier reported 282 existing CRLF-formatting files.                                                                                                            |
| `npm test`                                                                                            | Exit 1 at configuration load: missing private `content-private/imports/rdi1/pack.json`.                                                                                                 |
| `npm run build`                                                                                       | Exit 0; final production Worker/client build passed after fixture browser verification.                                                                                                 |
| `npm run test:e2e`                                                                                    | Exit 1; Playwright's managed Chromium executable is absent. The private production suite was not reached.                                                                               |
| `npx vitest run --config .tools/vitest.available.config.ts`                                           | Exit 0; 1,137 tests in 77 files passed. Supplemental config explicitly excludes suites requiring absent private RDI1 inputs; Workers tests execute through `@cloudflare/vitest-plugin`. |
| `npx playwright test --config .tools/playwright.chrome.config.ts`                                     | 22 fixture Chrome journeys passed; two replay journeys initially used a stale compiled inspector.                                                                                       |
| `npx playwright test --config .tools/playwright.chrome.config.ts --project chromium-replay --no-deps` | Exit 0; both remaining journeys passed after `npm run test:e2e` rebuilt the inspector. All 24 fixture journeys passed across these runs, including native music-loop capture.           |
| Prettier check on all changed/new source and documentation files                                      | Exit 0.                                                                                                                                                                                 |
| `git diff --check`                                                                                    | Exit 0.                                                                                                                                                                                 |

Diff review found no new debug logging, secrets, private card data or machine-specific paths. The standard acceptance gate remains blocked by missing private content/browser setup and existing repository formatting. No new production-upgrade step or deployment was started.

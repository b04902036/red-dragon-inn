# Sample core MVP release gate

This is a playable two-to-four-seat sample core game, with a React/TypeScript table, server-authoritative Cloudflare Worker/Durable Object rooms, hibernatable WebSockets, immutable D1 content/history and a deterministic pure engine. It is intended for friend-room play after account-specific deployment setup. It contains original fictional fixtures, not a complete official card or character catalog.

## Required journey evidence

| Journey                                                                        | Behavioral evidence                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1–5: create, invite/join, both choose characters, start, correct initial state | `tests/e2e/gameplay.spec.ts`: actual browser controls, selected characters, Fortitude 20 / Alcohol 0 / Gold 10, seven own cards and one Drink each; `tests/worker/replay.test.ts`: same initialization in the complete live match                            |
| 6: opponents cannot inspect hidden cards                                       | Browser card-instance/DOM separation; real socket privacy in `tests/worker/rooms.test.ts`; projection invariance and unrevealed compound-source tests in `tests/protocol/projections.test.ts`                                                                |
| 7–10: normal turn, response, pass/respond and nested completion                | Browser Shove/Ignore journey; real four-seat Shove/Ignore/Negate chain; timing tests assert unwind order, priority, effects and source disposal                                                                                                              |
| 11: gambling starts and completes                                              | Browser pot/pass/payout; full live match plus pure gambling tests for control, leaving, restrictions and conservation                                                                                                                                        |
| 12–13: Chaser and Drink Event resolve                                          | Full live match asserts multi-card Drink batches and uncanceled completion of queued Drink Events; Drink unit/runtime tests cover the associated stats, Events and disposal                                                                                  |
| 14–15: reload/disconnect, reconnect, continue                                  | Browser refresh preserves the exact hand; full match disconnect/resume and actual eviction preserve state and continue accepted commands                                                                                                                     |
| 16–19: elimination, winner, persistent result, identical replay                | Full default-stat four-player Workers-runtime match finishes, persists one result, rejects further gameplay, deduplicates finish retries, and proves beginning/snapshot replay equals final authority; browser engine report displays elimination and winner |

The complete live match runs through real room sockets and D1. A controlled Date clock models normal play pacing without delaying the test; command IDs, payload validation, engine transitions, history, evictions and replay all execute normally. Separate security tests exercise actual flood limits.

## Supported sample mechanics

The core includes discard/draw, Action/skip, ordering/taking Drinks, clockwise turns, immutable accepted-command events, seeded shuffling/reshuffling, nested Sometimes/Anytime/Ignore/Negate responses and private choices. Gambling suspends turns, tracks antes/control/passes/departures, supports validated control restrictions and immediate win hooks, and pays once. Drinks combine Chasers, distinguish Drink Events and defer elimination until resolution settles. Broke/passed-out players are eliminated together, Gold redistributes deterministically and a survivor or tie finishes the match.

The JSON effect DSL handles stat/Gold changes, draws/discards, target/option choices, source cancellation, pending-effect/Drink modification and gambling hooks. A registered sample resource handler demonstrates a trusted character extension with validated parameters. PUBLIC/OWNER/SERVER resource and side-deck projections enforce visibility.

## Audit findings

React displays validated projections and sends intents. Only the Durable Object resolves actors and commands; it commits authoritative state/outbox before transactional history acknowledgement. Engine modules have no React, Node or Cloudflare runtime dependency. D1 calls stay in server repositories, Workers tests and local CLI tools. No Redis, VPS, PostgreSQL or home public IP is needed.

Manual searches found no application TODO/FIXME, explicit `any` types, `Math.random`, eval/function execution from content, `.skip`, `.only`, `.todo`, TypeScript-ignore directives or browser D1 access. Unsafe casts in malformed-input tests are deliberate negative fixtures; production inputs use strict schemas. Raw socket messages are decoded by runtime schemas and private output is recipient-bound. Credentials are absent from URLs/error payloads/logging. Private inputs and replay exports are ignored and outside static assets. The only Git-eligible private-directory exception is non-content instructions.

Coverage inspection identified meaningful missing behaviors: a gambling passer leaving during a response removes consensus without refunding the ante; duplicate Ignore operations do not duplicate exclusions; an unrevealed compound frame hides all sources. The audit adds these behavioral regressions. Remaining uncovered core branches are defensive paths bypassed by the public command dispatcher or unreachable source categories in the supported sample flow; no assertion-free coverage tests were added.

## Verification

All release checks passed on 2026-10-03 using Node 24.21.0. Workers/Durable Object integration tests execute in the Workers runtime through `@cloudflare/vitest-plugin`.

| Command                                                      | Result                                                                                 |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `npm run typecheck`                                          | PASS, exit 0; strict engine, client, Worker, tooling and test projects                 |
| `npm run lint`                                               | PASS, exit 0; ESLint and Prettier                                                      |
| `npm test`                                                   | PASS, exit 0; 751 tests in 42 files                                                    |
| `npm run build`                                              | PASS, exit 0; production client and Worker                                             |
| `npm run test:e2e`                                           | PASS, exit 0; 14 Chromium tests                                                        |
| `npm run test:coverage`                                      | PASS, exit 0; 751 tests and all per-file coverage gates                                |
| Dedicated migration, replay, integration and security suites | PASS, exit 0; 50 tests in six files                                                    |
| `npm run verify:build`                                       | PASS, exit 0; identical SHA-256 hashes for nine artifacts across two production builds |

The dedicated command was `npm exec vitest run -- tests/worker/migrations.test.ts tests/worker/replay.test.ts tests/worker/rooms.test.ts tests/worker/security.test.ts tests/worker/content-import.test.ts tests/engine/replay.test.ts`.

Aggregate coverage is 99.73% statements, 99.18% branches, 100% functions and 99.77% lines. The pure engine reaches 99.90% statements and 99.69% branches; Durable Objects reach 98.63% statements and 96.65% branches. All configured 90% per-file gates pass. The generated report is available under ignored `coverage/index.html`.

All 19 required journey checks and all final audit acceptance criteria passed. No critical server-authority or hidden-information issue remains. The sample MVP is ready for account-specific deployment preparation and its documented live smoke check; remote release has not been performed.

## Known limitations and release scope

- Only original sample catalogs are selectable in the public lobby. JSON private imports are validated, versioned and usable by engine setup; catalog-selection UI, CSV adapters and artwork uploads are future work.
- Complex catalog-specific mechanics and character side-deck instantiation are outside this core MVP. Resource visibility and handler extension points exist; unsupported keys fail validation.
- Seats use anonymous bearer tokens. Accounts, token expiration, moderation, spectator roles, idle-room cleanup and global distributed abuse controls are post-MVP work. Share a pre-start invite only with intended players.
- Edge limits are permissive and local to a Cloudflare location; shared addresses share limits. Per-seat command budgets are serialized and survive reconnect/eviction.
- D1 reconstructs engine state; deleted Durable Object membership/credential data is not recreated from D1. Retention/backup/administrative disaster recovery is post-MVP work.
- All release checks run locally in real Workers runtime and Chromium production preview. No account-specific remote provisioning, hosted CI run, publication or live URL smoke has been performed. Replace the local D1 placeholder and follow [the deployment guide](security-deployment.md) before exposing the app.

## Next development order

1. Select the Cloudflare account/database/Worker name, deploy the verified sample app and perform the documented live two-context smoke checks.
2. Validate one user-owned JSON character pack locally, review compatibility and add behavioral fixtures for its unsupported mechanics before registering handlers.
3. Add explicit server-selected catalog loading and safe public presentation for published private editions; retain match-version pinning and replay tests.
4. Implement one special resource or side deck at a time, with invariants, hidden-information checks and deterministic replay coverage.
5. Add account/session policy, moderation, retention/backup and deployment operations according to actual usage.

For visual verification use [the game checklist](game-ui.md), [persistence/replay](persistence-replay.md), [content import](content-import.md), and [security/production preview](security-deployment.md).

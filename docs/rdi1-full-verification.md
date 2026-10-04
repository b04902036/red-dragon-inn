# Step 21D — RDI1 full verification

Step 21D verifies the locally published `content_rdi1_mechanics_v1` edition. The generated [coverage matrix](rdi1-card-coverage.md) accounts for 110 unique definitions, all 160 character copies and all 30 Drink copies. Repeated copies share the same validated definition; tests enumerate every definition, including each character's shared mechanics.

The separate `AGENTS_PRODUCTION_ADDENDUM.md` file is absent. The production addendum embedded in `AGENTS.md` was read and applied.

## Engine correction and timing contract

The per-card suite exposed a generic counter-family error: `COUNTER_FAMILY: DIFFERENT` required the source to have a family. That incorrectly excluded ordinary, untagged Drink-changing sources. The evaluator now treats an untagged source as different, while still excluding the responder's own family. The four actual compiled Drink-change counter definitions exercise the correction. Protected counters still require a matching family to negate them.

A legal Sometimes **or** Anytime during a source/system opportunity creates a 30-second response decision. `hasLegalSometimes` is true only when a legal Sometimes exists, and only that fact enables `/audio/voice/en-US/sometimes-response.mp3`. An Anytime-only 30-second decision remains silent. Separate phase-end grace remains 15 seconds. Playing a response replaces the old prompt, recomputes the remaining response cards and starts a fresh full decision deadline when a response remains. Server projections remain the only client legality authority.

No schema, content edition, published card record, production timer constant or public test-control route is added by this step.

## Behavioral evidence

| Requirement                                  | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every Sometimes definition                   | `tests/engine/rdi1-per-card.test.ts`: positive private legalPlays, negative ordinary-context server rejection, actual compiled effect results, 30-second prompt, pass/timeout, stale window/version, serialized reconnect and event-identical replay. Each definition also creates a fresh silent 30-second opportunity for a remaining legal Anytime.                                                                                                                                                      |
| Every Sometimes highlight and voice          | `tests/client/rdi1-per-card.test.tsx`: real GameTable with server projections; playable indicator, timer, English MP3 exactly once, rerender and remount deduplication.                                                                                                                                                                                                                                                                                                                                     |
| Every Anytime definition                     | Engine and client per-card suites: ordinary checkpoints, source responses without Sometimes, gambling, 15-second grace, stale version rejection, private highlights and no Sometimes voice.                                                                                                                                                                                                                                                                                                                 |
| All Action / Gambling / Cheating definitions | `tests/engine/rdi1-actions-gambling.test.ts`: positive/negative legality and numeric/effect results; explicit start/control, raise, Strong Hand restriction, Cheating restoration/ejection, multi-use Drink branches and all real Inn substitutions at PAYMENT_REQUIRED. Sometimes tests cover anti-cheat wins, pot-to-Inn, winner replacement, ante substitution/avoidance and pot theft.                                                                                                                  |
| Every Drink / Event                          | `tests/engine/rdi1-drinks.test.ts`: all numeric definitions, all Chasers, Water, cutting-off sober-down, Wizard brew, synthetic ORC/TROLL replacements, both Events, Contest ties and scoring after Ignore/Pass/Split, independent House copies and physical-card conservation.                                                                                                                                                                                                                             |
| Matrix completeness                          | `tests/content/rdi1-card-coverage.test.ts` and `npm run content:coverage:rdi1 -- --check`: exact graph, quantities, locale presence and test links.                                                                                                                                                                                                                                                                                                                                                         |
| Production runtime                           | `tests/worker/rdi1-content.test.ts`: four exact 40-card decks, actual seven-card hands, hidden IDs, real Sometimes commands over WebSockets, durable eviction/reconnect and D1 replay from the beginning in the Workers runtime.                                                                                                                                                                                                                                                                            |
| Four production browsers                     | `tests/e2e/rdi1-full-verification.spec.ts`: four isolated contexts and characters, exact production decks and private hands, server highlights, actual Sometimes MP3/timer, protected nested counters, 15-second Anytime, Cheating/Strong Hand/ejection, modifier/counter, Drink pass/split, extra Drink, resolved-loss retaliation, timed reconnect, English/Traditional Chinese, server timeout and elimination/winner. D1 commands replay identically after every checkpoint, including the final state. |

## Browser harness boundary

`scripts/rdi1-e2e-config.mjs` writes an ignored `.tools` configuration pointing to `tests/worker/rdi1-verification-worker.ts`. `vite.rdi1-e2e.config.ts` builds that entry into `.tools/rdi1-e2e-dist` only for the production-content Playwright suite. The normal `vite.config.ts`, `wrangler.jsonc`, `npm run build` and deploy entry remain production code.

The test subclass delegates room creation, character selection, seven-card initial dealing, production D1 loading, hibernating WebSockets, authentication, projections, commands, alarms and history persistence to the real GameRoom. It supplies invariant-checked, isolated server checkpoints to put rare mechanics into hands without random browser retries. It never changes card definitions or grants client-side legality. Test setup can inspect authoritative state server-side; browser pages still receive only their normal private/public views.

Replay in the browser starts at each explicitly injected checkpoint; it does not pretend that checkpoint setup was a player command. The separate production Workers journey also verifies replay from the original match manifest. The browser timeout test shortens the test alarm to 1.5 seconds and injects a clock offset; authoritative 30-second/15-second rule values and recorded timeout timestamps remain intact. Production constants are untouched.

Checkpoint setup advances the isolated test match's D1 state version before subsequent real commands; the monotonic-version database guard remains enabled. The complete Vitest suite limits CPU concurrency to four workers. The new multi-client Worker journey has a 20-second test timeout, covering D1 publication, four WebSocket sessions, eviction and replay; this does not alter game deadlines.

Audio playback calls are observed through the shared browser Audio mock, with real gesture unlock and actual server prompts. This verifies prompt selection and deduplication; hearing/decoding the supplied MP3 is a manual check.

## Visual verification

Run `npm run dev` in normal production-content mode and create a **new room** with four browser contexts. Choose Deirdre, Fiona, Gerki and Zot. Each starts with seven character-specific cards and 33 cards left in its deck. Opponents show counts only. Set one browser to Traditional Chinese.

Play a highlighted attack into a player holding a matching Sometimes: the priority holder sees a 30-second timer, a playable response card and hears the English response voice once after an ordinary gesture has unlocked audio. Refresh during that prompt: the deadline is preserved and the voice does not repeat. Play/counter a response and inspect the new prompt. Anytime-only source/system windows should show 30 seconds without the Sometimes voice; a phase-end Anytime grace should show 15 seconds.

For deterministic rare-card scenarios, run `npx playwright test --config playwright.rdi1.config.ts rdi1-full-verification --headed`. The test performs every required four-browser scenario using the isolated harness. Do not use the test entry as a deployment configuration.

## Verification results

| Command                                    | Exit | Final result                                                                                                                                                   |
| ------------------------------------------ | ---: | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                        |    0 | All engine/client/Worker/Node/test TypeScript projects pass.                                                                                                   |
| `npm run lint`                             |    0 | ESLint and repository-wide Prettier checks pass.                                                                                                               |
| `npm test`                                 |    0 | 82 files; 1,475 tests pass.                                                                                                                                    |
| `npm run test:coverage`                    |    0 | 82 files; 1,475 tests pass; every original per-file 90% threshold passes.                                                                                      |
| `npm run build`                            |    0 | Normal production Worker and client bundles build successfully.                                                                                                |
| `npm run test:e2e`                         |    0 | 25 journeys pass: 23 existing browser tests plus both production RDI1 tests.                                                                                   |
| `npm run content:verify:rdi1`              |    0 | Four 40-card character decks and the 30-card Drink deck; zero unknown mechanics/effects, unstructured Sometimes, missing locales or sample production records. |
| `npm run content:verify:rdi1-source`       |    0 | Source lock valid; 160 character copies, 30 Drink copies, 92 character records, 18 Drink records, 40 mechanics; zero errors.                                   |
| `npm run content:coverage:rdi1 -- --check` |    0 | Checked-in matrix matches all 110 definitions and 190 copies, with both locales present.                                                                       |

Coverage: statements **99.47%** (3,609/3,628), branches **98.25%** (2,823/2,873), functions **99.73%** (744/746), lines **99.64%** (3,391/3,403). Engine statements/branches are **99.46% / 98.49%**; GameRoom statements/branches are **98.48% / 95.92%**.

Initial failures were corrected: the generic Drink-counter family rule, browser command/banner assertions, resource-starved test timeouts, and the old WebSocket close/alarm race. The final complete coverage run exercises the current test code, including the corrected reconnect path. Focused instrumentation also passes all 11 system-opportunity cases.

The isolated test subclass emits a Cloudflare Vite Durable Object discovery warning; its live Worker/browser journeys pass. The normal production build exports the direct GameRoom class and emits no such warning. Its deployment configuration points to `dist/red_dragon_inn/wrangler.json`; the production bundle contains no test-control routes or verification helpers.

`git diff` and all new files were reviewed; `git diff --check` passes. Private inputs, local test builds, credentials and generated execution logs remain ignored. No schema extension, production timer change, hidden-state projection expansion or client legality bypass was introduced. Every Step-21D acceptance criterion passes; the mechanical work is safe for Step 22 to begin when separately authorized.

## Files and tests

The step adds 331 Vitest cases and one four-context Playwright journey:

| Test file                                    |          Added cases |
| -------------------------------------------- | -------------------: |
| `tests/engine/rdi1-per-card.test.ts`         |                  209 |
| `tests/engine/rdi1-actions-gambling.test.ts` |                   37 |
| `tests/engine/rdi1-drinks.test.ts`           |                   25 |
| `tests/client/rdi1-per-card.test.tsx`        |                   58 |
| `tests/content/rdi1-card-coverage.test.ts`   |                    1 |
| `tests/worker/rdi1-content.test.ts`          |                    1 |
| `tests/e2e/rdi1-full-verification.spec.ts`   | 1 Playwright journey |

All 21 changed files:

- Engine: `src/engine/reaction-legality.ts`.
- Scripts and configuration: `package.json`, `vitest.config.ts`, `playwright.config.ts`, `playwright.rdi1.config.ts`, `vite.rdi1-e2e.config.ts`, `scripts/rdi1-card-coverage.mjs`, `scripts/rdi1-e2e-config.mjs`.
- Test files: the seven files listed above, plus `tests/worker/generic-opportunities.test.ts` (drain the old WebSocket before eviction/clock advancement so the alarm test cannot race a stale close callback).
- Test helpers: `tests/fixtures/rdi1-content.ts`, `tests/fixtures/rdi1-match.ts`, `tests/worker/rdi1-verification-worker.ts`.
- Documentation: `docs/rdi1-card-coverage.md`, `docs/rdi1-full-verification.md`.

## Step boundary

Step 22 has not begun. This is mechanical and runtime verification of the authorized, locked paraphrased edition. It does not establish distribution/branding/artwork permission or complete the later release audit. The broader catalog release gate remains intact.

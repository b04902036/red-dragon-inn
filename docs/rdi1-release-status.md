# RDI1 formal-play release audit — Step 22

Audit date: 2026-10-04. Edition: `content_rdi1_mechanics_v1`. Scope: the locked, paraphrased RDI1 mechanics edition and the existing server-authoritative runtime. No RDI2 work, remote publication or deployment is included.

**Status: PASS — RDI1 is formally playable as a local mechanical milestone.** Every hard gate, required verification command and release regression passes. Public distribution and remote deployment remain outside this audit.

The separate `AGENTS_PRODUCTION_ADDENDUM.md` file is absent. The production addendum embedded in `AGENTS.md` applies. Earlier Step 21D changes already present in the working tree are preserved.

## Hard release gates

These counts come from the actual ignored compiled pack, the locked normalized input and the published local production channel. They are recomputed, not inferred from catalog metadata. The entire compiled graph must match the locked source; altered effects, quantities, triggers, translations and added assets fail verification.

| Gate                                  | Actual | Required | Result |
| ------------------------------------- | -----: | -------: | ------ |
| RDI1 characters                       |      4 |        4 | PASS   |
| Deirdre character deck                |     40 |       40 | PASS   |
| Fiona character deck                  |     40 |       40 | PASS   |
| Gerki character deck                  |     40 |       40 | PASS   |
| Zot character deck                    |     40 |       40 | PASS   |
| Character physical copies             |    160 |      160 | PASS   |
| Drink physical copies                 |     30 |       30 | PASS   |
| Unknown effect keys/operations        |      0 |        0 | PASS   |
| Unknown source/compiled mechanics     |      0 |        0 | PASS   |
| Unsupported compiled cards            |      0 |        0 | PASS   |
| Sometimes missing structured triggers |      0 |        0 | PASS   |
| Missing required en-US fields         |      0 |        0 | PASS   |
| Missing required zh-TW fields         |      0 |        0 | PASS   |
| Sample production RDI1 records        |      0 |        0 | PASS   |

There are **110 unique definitions**: 92 character definitions and 18 Drink/Event definitions. Quantities account for all 190 physical copies. Compiled types are 18 Action, 50 Sometimes, 8 Anytime, 12 Gambling, 4 Cheating, 16 numeric Drinks and 2 Drink Events. Every definition has positive, negative and resolution evidence in the [per-card matrix](rdi1-card-coverage.md); the [Step 21D report](rdi1-full-verification.md) records the complete behavioral evidence. Unsupported-card zero requires those executable tests as well as strict DSL validation; an empty compatibility error list alone does not prove runtime support.

The **40 character mechanic families** comprise 9 Action, 23 Sometimes, 3 Anytime, 3 Gambling and 2 Cheating families. They cover targeted/group damage, healing and collection, direct Gold collection, ordinary/Drink Ignore, protected and Drink-change counters, resolved-loss retaliation, Drink modifiers/replacement/pass/split/extra reveal, extra ordering, Gambling start/control/raise/Strong Hand, Cheating control/ejection, anti-cheat victory, ante avoidance/substitution, leave/Drink multi-use branches, pot theft/replacement and pot-to-Inn settlement. The 18 Drink definitions include all numeric/signed/Chaser values, Water, sober-down, Wizard tonic, synthetic ORC/TROLL replacements, Contest and Round for the House. Water's zero-valued numeric effect is intentional and tested.

## Timing, audio and highlight coverage

The latest user timing clarification governs the older Step-22 wording about "no legal Sometimes => no fake wait": **a legal Anytime also creates a legitimate 30-second source/system response window**. A fake wait is absent when neither Sometimes nor Anytime is legal. The separate phase-end grace is 15 seconds.

| Timing requirement                                                      | Evidence                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source actor/revealer begins order; ineligible living seats are skipped | `tests/engine/rdi1-release-timing.test.ts` checks actual Action and Drink sources, with legal cards at different seats.                                                                                                                            |
| Only actually legal Sometimes get their private prompt/highlight        | Every one of the 50 definitions is checked in positive and negative contexts by `tests/engine/rdi1-per-card.test.ts` and rendered through GameTable by `tests/client/rdi1-per-card.test.tsx`. Forged negative commands are rejected by the server. |
| All legal Sometimes get 30 seconds                                      | Per-definition engine/client tests and production WebSocket/browser journeys assert the full deadline and visible countdown.                                                                                                                       |
| Anytime-only response is 30 seconds, with `hasLegalSometimes=false`     | Every Anytime definition is checked in source responses; all five system opportunity families also have Worker/alarm/reconnect/replay regressions.                                                                                                 |
| No response wait when neither card type is legal                        | The release timing audit and `tests/engine/timed-prompts.test.ts` verify immediate resolution.                                                                                                                                                     |
| Playing a card invalidates the old prompt and recomputes legality       | Per-definition response tests verify a new prompt, fresh 30-second deadline, remaining legal Anytime and stale input rejection.                                                                                                                    |
| Every core phase end preserves separate 15-second Anytime grace         | The release timing audit enumerates Discard/Draw, Action, Order Drink and Drink using real RDI1 cards.                                                                                                                                             |
| Anytime remains legal during Gambling                                   | All eight compiled Anytime definitions are exercised by the engine suite; existing multi-browser Gambling/Anytime tests verify the live UI and reconnect.                                                                                          |
| Hit-back happens after actual loss and resolves sequentially            | The release timing audit first holds pending damage with another player's Anytime, proves hit-back is ineligible there, then checks the resolved-loss task and final damage to the original source.                                                |
| Elimination waits for last-chance opportunities                         | The release timing audit checks a player at zero Fortitude remains eligible for a real healing Anytime, then verifies both rescue and elimination after passing.                                                                                   |

Audio uses only `public/audio/voice/en-US/sometimes-response.mp3` for response speech in both UI locales. The voice plays once for a new prompt with a legal Sometimes, never for an Anytime-only window or phase-end grace. Rerenders, resync, reconnect and language changes do not replay the same prompt. Audio is enabled by default, unlocks on an ordinary user gesture, respects saved mute settings, and remains optional if playback fails. Automated tests observe playback calls; human audibility is a manual check. The supplied MP3/WAV files exist locally, and their recorded provenance is in [audio licenses](../public/audio/LICENSES.md).

Highlights and available card commands derive from version-matched, private server `legalPlays`. The countdown only displays the server deadline. Commands, expiry, priority, legality, hidden hands and replay remain authoritative in the Worker/Durable Object. The four-browser production journey covers English/Traditional Chinese, nested protected counters, Gambling/Cheating, Drink operations, timed reconnect, server timeout, elimination/winner and identical checkpoint replay. Separate Workers tests verify replay from the original production match manifest. Rare-card browser checkpoints and shortened injected test alarms are isolated in a test-only entry; production timer constants and routes are unchanged.

## Bilingual audit

Both locales contain **225/225 required content fields** in this edition. `content:verify:zh-TW` reads the actual local production channel and reports `configuredVersion: content_rdi1_mechanics_v1`, `complete: true`, no missing fields and no content/UI issues. Translations are reviewed manual paraphrases, with canonical English identities retained for fallback/debugging. The existing glossary and UI parameter checks pass. Locale remains presentation-only and does not alter RNG, commands, legality or replay. English and Traditional Chinese browser contexts participate in the same game.

## Static audit

| Search                                                    | Finding and disposition                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sampleContentPack`, `/api/content/sample`                | Fixture modules contain sample pack imports. The production runtime dependency-graph test proves the production entry cannot reach them; no sample content endpoint exists.                                                                                                                                                                                                                                |
| Card-title checks, `if (name === ...)` in engine legality | None. The new AST audit rejects display-name/rules comparisons and RDI1-specific definition literals in the engine. Names used for choice labels are presentation. Catalog canonical-name comparisons are metadata validation outside gameplay.                                                                                                                                                            |
| No-op fallback, unknown mechanics/effects                 | Source/pack schemas and exact locked-source comparison fail closed. New regressions reject unknown operations, unknown source mechanics, missing effects and a substituted no-op. Every compiled definition has effect-resolution assertions.                                                                                                                                                              |
| Unvalidated custom effects                                | The RDI1 edition uses validated DSL operations. Generic custom handler keys and params pass strict schema/registry validation; `applyCustomEffect` parses params again. New tests reject unregistered keys and invalid params before import. Legacy `sample.adjust-resource` is a registered alias for the generic resource handler, with no card-title dispatch.                                          |
| Client-authoritative timers/legal plays                   | None. The client audit rejects engine command/legality imports and expiry commands. Countdown intervals update display only. Existing forged/stale command, timeout, hidden-information and projection tests exercise server rejection.                                                                                                                                                                    |
| Original third-party card art                             | Zero RDI1 artwork assets or public card-art files. Published asset metadata must equal the locked empty asset set.                                                                                                                                                                                                                                                                                         |
| Large copied original card-text blocks                    | Display text is the locked source's original labels and paraphrased summaries, declared `PUBLIC_RULES_PARAPHRASE`; original artwork/flavor text/printed-title database is absent. The longest English rules summary is 400 characters / 66 whitespace-delimited words. Source/provenance verification establishes consistency with the supplied lock; it does not independently establish external rights. |

The production Worker build is scanned for test-control routes and verification helpers after the browser suite. The final deployment configuration is restored to the normal production build. Private imports, logs, local D1 state and test bundles remain ignored.

## Required verification results

| Command                              | Exit | Exact result                                                                                                                                      |
| ------------------------------------ | ---: | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run content:verify:rdi1-source` |    0 | Locked source valid: four 40-card character decks, 160 character copies, 30 Drinks, 40 character mechanic families; no errors.                    |
| `npm run content:verify:rdi1`        |    0 | All RDI1 hard content gates pass; unknown effects/mechanics, unstructured Sometimes, missing translations and sample production records are zero. |
| `npm run content:verify:zh-TW`       |    0 | Actual local production edition complete; 225/225 required content fields per locale, no missing fields or UI/content issues.                     |
| `npm run typecheck`                  |    0 | Strict TypeScript checks pass without diagnostics.                                                                                                |
| `npm run lint`                       |    0 | Formatting and ESLint checks pass.                                                                                                                |
| `npm test`                           |    0 | 84 test files, 1,501 tests passed. Includes real Workers/Durable Object/D1/WebSocket execution.                                                   |
| `npm run test:coverage`              |    0 | 84 test files, 1,501 tests passed; every configured coverage threshold passed.                                                                    |
| `npm run build`                      |    0 | Normal production Worker and client built: 149 Worker modules and 155 client modules.                                                             |
| `npm run test:e2e`                   |    0 | 25 browser journeys passed: 23 existing journeys and two production RDI1 journeys.                                                                |

Coverage is **99.47% statements (3,609/3,628)**, **98.25% branches (2,823/2,873)**, **99.73% functions (744/746)** and **99.64% lines (3,391/3,403)**. Engine coverage is 99.46% statements / 98.49% branches; GameRoom coverage is 98.48% statements / 95.92% branches.

The final diff review and whitespace check pass. The normal production build was restored after E2E; Worker/client bundles contain none of the searched test-control routes, checkpoint names or verification-worker imports. No private inputs, secrets or local machine paths were added to tracked files. Every Step-22 acceptance criterion passes. Further work can begin under a separately specified scope; no RDI2 or subsequent step was started.

Step 22 adds **26 regressions**: 16 release/content/static checks in `tests/content/rdi1-release-audit.test.ts` and 10 timing cases in `tests/engine/rdi1-release-timing.test.ts`. Existing per-card, client, Worker/D1/WebSocket, deterministic replay and four-browser tests remain required. The existing D1 publication/pinned-match/reconnect journey in `tests/worker/rdi1-content.test.ts` now has the same 20-second test budget as the four-seat production journey, after hitting the default five-second timeout in the full audit run. All behavioral assertions and game deadlines remain unchanged. The five Step-22 files are these three test files, this status document and the README link to the RDI1 milestone; production rules, schemas, content and deployment configuration are unchanged.

## Known non-RDI1 limitations and distribution note

This is the RDI1-only mechanical milestone. The other 72 catalog characters, RDI2 and later products are outside this audit. The full 76-character production gate remains closed; metadata is not playable content. Character-specific side decks and other later catalog mechanics need their own implementation/import/verification. Private source and pack files must be provisioned for the RDI1 tests; missing inputs fail instead of silently skipping.

The local runtime is tested, but this audit does not provision remote D1, replace the placeholder database ID, deploy a Worker or authorize public distribution. The edition records `PUBLIC_RULES_PARAPHRASE`, not an owned/licensed reproduction of the original cards. The audit grants no copyright/trademark/artwork permission. The user-supplied response MP3 has no supplied creator/source/license metadata; confirm its distribution rights before shipping it publicly. Existing WAV provenance is documented as supplied, with no invented retrieval date.

The isolated test subclass and local D1-only validator proxy emit Cloudflare Durable Object discovery warnings; live production-content Worker/browser tests pass. The ordinary production build exports the direct GameRoom class. This warning and mocked playback do not establish a public-release permission claim.

## Visual verification

Run normal `npm run dev`, create a **new** production room, and join it in four separate browser contexts. Select Deirdre, Fiona, Gerki and Zot. Check seven private starting cards and 33 remaining deck cards each; opponents expose counts only. Set one browser to 繁體中文.

After Discard/Draw, check the 15-second Anytime grace. Play a highlighted attack or Drink into a legal Sometimes opportunity: the priority holder sees a 30-second countdown and hears the English response MP3 once after gesture unlock. Play a response and inspect the new countdown; reload mid-prompt and confirm the deadline/hand stay consistent without repeated speech. An Anytime-only source/system opportunity still shows 30 seconds and remains silent.

For deterministic rare-card scenarios, run `npx playwright test --config playwright.rdi1.config.ts rdi1-full-verification --headed`. It runs the isolated four-browser production-content harness through nested counters, Gambling, Drink operations, retaliation, timeout, reconnect and winner. The test harness is not a deployment entry.

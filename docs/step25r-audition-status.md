# Step 25R progress and audition status

Historical report, superseded on 2026-10-08 by the manual Voice-ID workflow in [voice-generation.md](voice-generation.md). API Voice Design is no longer required and its normal project commands were removed. Current Batch 1 status is tracked separately.

Status: 2026-10-07. Step 25 release audit remains paused. Presentation stages 25R-01 through 25R-07 are implemented and their required checks pass. Stage 25R-08 tooling passes offline tests, but real auditions are incomplete. The original request returned HTTP 401. After the user updated the local key and requested a retry, Voice Design returned HTTP 403 with error code `feature_unavailable`; the diagnostic identifies a paid-subscription restriction. No previews were generated. No candidate has been selected or promoted, and no final card-title speech has been generated. This is not a release-ready declaration.

## Implementation and public narration architecture

Latest replacement-key test: the normal v3 audition run exited 1, with a network failure for Deirdre followed by HTTP 403 for Fiona. The user explicitly authorized a temporary v2 diagnostic. A separate ignored probe requested `eleven_multilingual_ttv_v2` with exactly `mp3_44100_128` and returned HTTP 403, `feature_unavailable`, with zero previews. Neither request used MP3 192 kbps or PCM. The [official Voice Design documentation](https://elevenlabs.io/docs/api-reference/text-to-voice/design) lists Creator restrictions for MP3 192 kbps and Pro restrictions for PCM 44.1 kHz; those formats were not requested.

A read-only subscription request using the replacement key returned HTTP 200 and `tier: free`. This confirms that the credential authenticates for that account endpoint. Voice Design remains unavailable with both tested models. The rejection did not identify missing permissions; this does not establish that all required Voice Design scopes are enabled. Scope restrictions still require verification in the key's dashboard or a successful Voice Design request. No keys or arbitrary account/provider messages were printed or persisted. The permanent model configuration remains v3; no final speech was generated.

Latest commands/evidence: `npm run voice:audition` (exit 1; `.tools/step25r-voice-audition-new-key.log`); `node --env-file-if-exists=.env.local .tools/voice-v2-probe.mjs` (exit 1; `.tools/voice-v2-diagnostic/result.json`); `node --env-file-if-exists=.env.local .tools/voice-account-access-probe.mjs` (exit 0; `.tools/voice-v2-diagnostic/account-access.json`). These diagnostics are ignored local tools. Generation/runtime code is unchanged. This report's formatting/lint and `git diff --check` were repeated after the update, with logs `.tools/step25r-lint-new-key.log` and `.tools/step25r-new-key-diff-check.log`.

Internal append-only events remain server-only. The strict Zod `PublicNarrationEvent` union and explicit server projector provide typed public events, ordered by persisted replay sequence with stable `matchId:sequence` identities. The wire protocol has `PUBLIC_TIMELINE` batches marked LIVE or HISTORY; it has no raw DOMAIN_EVENT message. Physical card IDs, deck order, private choices and unrevealed Drink identities are omitted. Definition IDs are exposed only for publicly played/revealed cards. Hidden draws and deals expose player and count only.

New matches opt into `publicNarrationVersion: 1` in their persisted replay manifest. This adds resolution correlation and observational events for actual payments, raises, challenges and Drink Contest results. Historical manifests without the flag retain their existing replay semantics. No verified card rules, deck counts or source-lock decisions were changed.

D1 replay commands remain the only history authority. A disposable Durable Object cache derives public narration from whole accepted command batches, retaining causal context across batches. Authenticated sockets receive history after persistence; reconnect/hibernation rebuild from D1. Cursor updates follow successful sends. A presentation-history failure cannot block authoritative state delivery or command acceptance; later HISTORY delivery repairs it.

The client replaces snapshot-difference messages with the full typed timeline, deduplicated and sorted by sequence. There is no last-N truncation. Manual upward scrolling stays in place; a new-events button returns to the bottom. HISTORY rebuilds the log without animation or voice. English and Traditional Chinese formatting names actual actors, targets, cards, responses, stat changes, gambling payments and contest results.

The persistent HUD shows large Fortitude, Alcohol and Gold values, hand and Drink Me! pile counts, plus a numeric threshold label and dual bar. Values come directly from authoritative public snapshots. LIVE stat events provide a temporary delta and pulse.

An independent presentation director queues visual beats sequentially. It shows nested response hierarchy and canceled/resolved state, actor/target highlights, card movement from the player's panel, Drink/Chaser chains and face-down draws/orders. Skip, fast mode and reduced motion affect visual pacing only. The director has no command, game-state or response-window access. Server timers and response controls remain active throughout animation.

## Verification and self-review

Behavioral coverage includes:

- ordinary Action damage with causal before/after stats;
- three-level Negate chain, including the inner successful response and canceled middle response;
- Ignore affecting only the ignoring player;
- Drink plus Chaser and actual Drink modifiers;
- compiled four-player Drink Contest tie, subsequent round, winner and payments in both locales;
- hidden draws/deals showing counts only, with recursive leak checks against all physical card IDs;
- full history after reconnect/hibernation, deterministic replay and duplicate-command rejection;
- D1 history failure with successful authoritative state and later HISTORY repair;
- full 150-event log ordering, scroll preservation and duplicate suppression;
- desktop four-player HUD and narrow 390-pixel layout;
- actual browser response accepted during active presentation with a server 30-second deadline;
- no history animation or voice after full browser refresh.

The final focused suite also verifies that 40-level internal resolution metadata does not introduce a new 32-level gameplay limit, and that zero-delta stat/resource observations do not invent visible changes.

Self-review found and fixed: snapshot-log truncation, missing causal correlation, SYSTEM-only completion noise, zero-delta narration, an unnecessary new metadata depth cap, ambiguous status accessibility roles, the four-player test helper's final-pass boundary, missing localized target text, cache repair when a provider repeats the original preview ID, Cloudflare dotenv loading of the offline API key, and already-tracked private imports.

Private-content protection now ignores private imports and excludes them from formatting. Exactly 23 already-tracked files were removed from Git's index only. All remain on disk, with all 23 SHA-256 hashes unchanged. The staged 86,635 deleted lines represent index removal, not physical deletion. Git will no longer transfer those imports; preserve and transfer the private content separately when moving this project. No new private text or key is committed.

## Exact commands and results

User-requested retry: `npm run voice:audition` exited 1 with HTTP 403; 0 previews generated and 0 cache hits. Evidence: `.tools/step25r-voice-audition-retry.log`. A diagnostic confirmed `feature_unavailable` and a paid-subscription restriction; `.tools/voice-auditions/auth-diagnostic.json` contains only the HTTP status, a validated error-code identifier and classification booleans. No credentials or arbitrary provider messages were printed or stored. Final report formatting/lint and diff checks were repeated; logs: `.tools/step25r-lint-retry.log` and `.tools/step25r-retry-diff-check.log`. Runtime source and generation tooling were unchanged during this retry.

| Command                                                                                                                                                                | Result                                                                                             | Evidence                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `npm run typecheck`                                                                                                                                                    | PASS, exit 0                                                                                       | `.tools/step25r-typecheck-last.log`          |
| `npm run lint`                                                                                                                                                         | PASS, exit 0                                                                                       | `.tools/step25r-lint-last.log`               |
| `npm test`                                                                                                                                                             | PASS, exit 0; 2,952 Vitest tests across 32 run groups, plus 8 Node voice tests                     | `.tools/step25r-full-tests-second.log`       |
| `npm run build`                                                                                                                                                        | PASS, exit 0                                                                                       | `.tools/step25r-build-complete.log`          |
| `npm run test:e2e`                                                                                                                                                     | PASS, exit 0; 32 browser journeys: 24 main, 1 development, 2 RDI1, 4 combined RDI2, 1 presentation | `.tools/step25r-full-e2e-second.log`         |
| `npx vitest run tests/protocol/public-narration.test.ts tests/client/public-timeline.test.tsx tests/client/presentation.test.tsx tests/worker/public-timeline.test.ts` | PASS; 26 tests, including final review corrections; Worker tests use the Workers runtime           | `.tools/step25r-final-public-tests.log`      |
| `npm run voice:test`                                                                                                                                                   | PASS; 8 offline tests; included in full npm test                                                   | `.tools/step25r-full-tests-second.log`       |
| `npm run voice:profiles`                                                                                                                                               | PASS; all 8 profiles match the production character catalog                                        | `.tools/step25r-voice-profiles-final.log`    |
| `npm run voice:security`                                                                                                                                               | PASS; 49 runtime source/build files contain no ElevenLabs endpoint, key reference or API header    | `.tools/step25r-voice-security-complete.log` |
| `npm run voice:audition`                                                                                                                                               | FAIL, exit 1; first request HTTP 401; 0 generated, 0 cache hits                                    | `.tools/step25r-voice-audition.log`          |
| `npm run voice:audition:verify`                                                                                                                                        | FAIL, exit 1; Deirdre A missing; prevents false completion                                         | `.tools/step25r-voice-audition-verify.log`   |
| `git diff --check`                                                                                                                                                     | PASS; review final output after report formatting                                                  | `.tools/step25r-diff-check.log`              |

The two final protocol tests were added after the full test run; the focused 26-test suite passes with those additions. Required typecheck/lint/build/security checks were then repeated successfully. Actual audition MP3 browser decoding is pending because no MP3s exist. Final title playback, voice ducking/settings, final voice coverage, post-selection tests and the restarted Step 25 coverage/release audit remain pending.

## Offline ElevenLabs auditions

Implemented commands and configuration are documented in [voice-generation.md](voice-generation.md). The CLI reads the key from ignored `.env.local` using Node's env-file support, and uses the current Voice Design endpoint. Runtime tooling disables Cloudflare dotenv/process-env loading and removes the key from child runtime environments. No gameplay code calls ElevenLabs.

The explicit configured models are `eleven_ttv_v3` for design and `eleven_v4` for later TTS, with `mp3_44100_128`. No model fallback was attempted. HTTP 401 is an authentication rejection; the response does not establish model availability.

Eight original character descriptions/dialogues are in `reference/voice-design-profiles.json`. Profiles are: warm composed Deirdre; bold lively Fiona; sly mischievous Gerki; scholarly theatrical Zot; gravelly jovial Dimli; airy controlled Eve; charismatic rhythmic Fleck; very deep warm goofy Gog. Pooky has no separate voice.

Generation validates variable preview counts, uses bounded retries/request budgets, saves successes immediately, and resumes with input/file hashes. Offline tests verify these behaviors without spending API quota. The actual manifest is `.tools/voice-auditions/manifest.json`; it currently contains no entries and records the latest HTTP 403 failure. The local listening page `.tools/voice-auditions/index.html` shows every candidate unavailable. No generated preview IDs or durations can be reported.

All expected paths below are **pending and do not exist**:

| Character | A                                      | B                                      | C                                      |
| --------- | -------------------------------------- | -------------------------------------- | -------------------------------------- |
| Deirdre   | `.tools/voice-auditions/deirdre/A.mp3` | `.tools/voice-auditions/deirdre/B.mp3` | `.tools/voice-auditions/deirdre/C.mp3` |
| Fiona     | `.tools/voice-auditions/fiona/A.mp3`   | `.tools/voice-auditions/fiona/B.mp3`   | `.tools/voice-auditions/fiona/C.mp3`   |
| Gerki     | `.tools/voice-auditions/gerki/A.mp3`   | `.tools/voice-auditions/gerki/B.mp3`   | `.tools/voice-auditions/gerki/C.mp3`   |
| Zot       | `.tools/voice-auditions/zot/A.mp3`     | `.tools/voice-auditions/zot/B.mp3`     | `.tools/voice-auditions/zot/C.mp3`     |
| Dimli     | `.tools/voice-auditions/dimli/A.mp3`   | `.tools/voice-auditions/dimli/B.mp3`   | `.tools/voice-auditions/dimli/C.mp3`   |
| Eve       | `.tools/voice-auditions/eve/A.mp3`     | `.tools/voice-auditions/eve/B.mp3`     | `.tools/voice-auditions/eve/C.mp3`     |
| Fleck     | `.tools/voice-auditions/fleck/A.mp3`   | `.tools/voice-auditions/fleck/B.mp3`   | `.tools/voice-auditions/fleck/C.mp3`   |
| Gog       | `.tools/voice-auditions/gog/A.mp3`     | `.tools/voice-auditions/gog/B.mp3`     | `.tools/voice-auditions/gog/C.mp3`     |

Resolve the ElevenLabs paid-subscription access restriction for the account associated with the local key, then rerun `npm run voice:audition`. Do not send the key in chat. After all 24 previews exist, run local verification and browser decoding, provide the audition manifest/listening page, then stop for one user A/B/C choice per character. Do not promote voices or generate final title audio before those choices.

## Changed files and Git review

The status below lists all tracked modifications, private-content index removals and new files. New files include the narration schema/projector, Worker history cache, client presentation/log components, offline voice tools/profiles, focused tests and the presentation E2E configuration. No commits were created.

`git diff --stat` excludes untracked additions. The staged diff contains only private index removals. The review snapshot below was captured before adding this report itself (`docs/step25r-audition-status.md`).

```text
M .gitignore
 M .prettierignore
D  content-private/imports/rdi1/compile-report-content_rdi1_mechanics_v2.json
D  content-private/imports/rdi1/compile-report.json
D  content-private/imports/rdi1/pack-content_rdi1_mechanics_v2.json
D  content-private/imports/rdi1/pack.json
D  content-private/imports/rdi1/reaudit-required-corrections.json
D  content-private/imports/rdi1/source-normalized.json
D  content-private/imports/rdi1/versions/content_rdi1_mechanics_v1/content-private/imports/rdi1/source-normalized.json
D  content-private/imports/rdi1/versions/content_rdi1_mechanics_v1/pack.json
D  content-private/imports/rdi1/versions/content_rdi1_mechanics_v1/reference/rdi1/rdi1-card-matrix.md
D  content-private/imports/rdi1/versions/content_rdi1_mechanics_v1/reference/rdi1/rdi1-mechanics-matrix.csv
D  content-private/imports/rdi1/versions/content_rdi1_mechanics_v1/reference/rdi1/required-engine-capabilities.json
D  content-private/imports/rdi1/versions/content_rdi1_mechanics_v1/reference/rdi1/sometimes-legality-fixtures.json
D  content-private/imports/rdi1/versions/content_rdi1_mechanics_v1/reference/rdi1/source-evidence.md
D  content-private/imports/rdi1/versions/content_rdi1_mechanics_v1/source-lock.json
D  content-private/imports/rdi2/README.md
D  content-private/imports/rdi2/compile-report.json
D  content-private/imports/rdi2/final-row-reaudit.json
D  content-private/imports/rdi2/pack-combined.json
D  content-private/imports/rdi2/pack.json
D  content-private/imports/rdi2/source-candidate.json
D  content-private/imports/rdi2/source-lock.json
D  content-private/imports/rdi2/source-normalized.json
D  content-private/imports/rdi2/verification-ledger.json
 M docs/audio.md
 M docs/protocol.md
 M eslint.config.js
 M package.json
 M playwright.config.ts
 M public/audio/LICENSES.md
 M scripts/fixture-preview.mjs
 M scripts/rdi1-pack.ts
 M scripts/rdi2-pack.ts
 M src/client/GameTable.tsx
 M src/client/room-state.ts
 M src/client/styles.css
 M src/engine/drinks.ts
 M src/engine/event-writer.ts
 M src/engine/invariants.ts
 M src/engine/setup.ts
 M src/engine/types.ts
 M src/engine/workflows.ts
 M src/protocol/events.ts
 M src/protocol/messages.ts
 M src/shared/ui-messages.ts
 M tests/e2e/gameplay.spec.ts
 M tests/e2e/timing-helpers.ts
 M vite.config.ts
 M vite.rdi1-e2e.config.ts
 M vite.rdi2-e2e.config.ts
 M vitest.config.ts
 M worker/durable/game-room.ts
 M worker/durable/room-record.ts
?? .env.example
?? codex-prompts/step-25r-presentation-timeline-voice-revision.md
?? docs/voice-generation.md
?? playwright.presentation.config.ts
?? reference/voice-design-profiles.json
?? reference/voice-generation.json
?? scripts/elevenlabs-audition.mjs
?? scripts/elevenlabs-voice-audition.mjs
?? scripts/presentation-e2e-config.mjs
?? scripts/runtime-env.mjs
?? scripts/voice-runtime-security.mjs
?? scripts/worker-types.mjs
?? scripts/wrangler-local.mjs
?? src/client/PresentationDirector.ts
?? src/client/PresentationZone.tsx
?? src/client/PublicTimelineLog.tsx
?? src/client/timeline-text.ts
?? src/client/use-presentation.ts
?? src/protocol/public-narration-projector.ts
?? src/protocol/public-narration.ts
?? tests/client/presentation.test.tsx
?? tests/client/public-timeline.test.tsx
?? tests/e2e/public-presentation.spec.ts
?? tests/fixtures/public-contest-match.ts
?? tests/fixtures/public-narration-match.ts
?? tests/protocol/public-narration.test.ts
?? tests/voice/
?? tests/worker/public-timeline.test.ts
?? vite.presentation-e2e.config.ts
?? worker/durable/public-timeline.ts
 .gitignore                    |   5 +
 .prettierignore               |   1 +
 docs/audio.md                 |   8 ++
 docs/protocol.md              |  12 +++
 eslint.config.js              |   7 +-
 package.json                  |  15 ++-
 playwright.config.ts          |   2 +
 public/audio/LICENSES.md      |   2 +
 scripts/fixture-preview.mjs   |   1 +
 scripts/rdi1-pack.ts          |   1 +
 scripts/rdi2-pack.ts          |   1 +
 src/client/GameTable.tsx      | 113 ++++++++++++++++++---
 src/client/room-state.ts      |  96 +++++-------------
 src/client/styles.css         | 228 ++++++++++++++++++++++++++++++++++++++++++
 src/engine/drinks.ts          |   9 ++
 src/engine/event-writer.ts    |  26 ++++-
 src/engine/invariants.ts      |   1 +
 src/engine/setup.ts           |   4 +
 src/engine/types.ts           |   2 +
 src/engine/workflows.ts       |  59 +++++++++++
 src/protocol/events.ts        |  76 ++++++++++++++
 src/protocol/messages.ts      |   2 +
 src/shared/ui-messages.ts     | 203 +++++++++++++++++++++++++++++++++++++
 tests/e2e/gameplay.spec.ts    |   6 +-
 tests/e2e/timing-helpers.ts   |   2 +-
 vite.config.ts                |   1 +
 vite.rdi1-e2e.config.ts       |   1 +
 vite.rdi2-e2e.config.ts       |   1 +
 vitest.config.ts              |   1 +
 worker/durable/game-room.ts   |  50 ++++++++-
 worker/durable/room-record.ts |   3 +
 31 files changed, 842 insertions(+), 97 deletions(-)
 .../compile-report-content_rdi1_mechanics_v2.json  |    19 -
 content-private/imports/rdi1/compile-report.json   |    19 -
 .../rdi1/pack-content_rdi1_mechanics_v2.json       |  7521 ---------
 content-private/imports/rdi1/pack.json             |  7500 ---------
 .../imports/rdi1/reaudit-required-corrections.json |    63 -
 .../imports/rdi1/source-normalized.json            |  2728 ----
 .../imports/rdi1/source-normalized.json            |  3411 ----
 .../versions/content_rdi1_mechanics_v1/pack.json   |  7500 ---------
 .../reference/rdi1/rdi1-card-matrix.md             |    59 -
 .../reference/rdi1/rdi1-mechanics-matrix.csv       |    41 -
 .../rdi1/required-engine-capabilities.json         |    39 -
 .../rdi1/sometimes-legality-fixtures.json          |   888 --
 .../reference/rdi1/source-evidence.md              |    56 -
 .../content_rdi1_mechanics_v1/source-lock.json     |    12 -
 content-private/imports/rdi2/README.md             |    28 -
 content-private/imports/rdi2/compile-report.json   |    48 -
 .../imports/rdi2/final-row-reaudit.json            |  4682 ------
 content-private/imports/rdi2/pack-combined.json    | 15407 -------------------
 content-private/imports/rdi2/pack.json             |  7910 ----------
 content-private/imports/rdi2/source-candidate.json |  6797 --------
 content-private/imports/rdi2/source-lock.json      |   121 -
 .../imports/rdi2/source-normalized.json            |  6797 --------
 .../imports/rdi2/verification-ledger.json          | 14989 ------------------
 23 files changed, 86635 deletions(-)
```

Safe next work: resolve ElevenLabs subscription access and finish auditions. Selected-voice creation and final title playback remain gated by explicit user selections. The original Step 25 audit remains paused.

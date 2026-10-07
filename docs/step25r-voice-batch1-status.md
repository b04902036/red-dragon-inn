# Step 25R Voice Batch 1 — blocked before paid generation

Date: 2026-10-08. Batch 1 is **not complete**. **It is not safe to delete Gog, Dimli or Fleck from ElevenLabs.** Step 25 remains incomplete. Strict `voice:verify` and RDI3+ were not started.

## Confirmed configuration

`content/presentation/character-voices.json` records only the three user-selected mappings:

| Character | Voice ID             | Model             | Format        |
| --------- | -------------------- | ----------------- | ------------- |
| Gog       | LSaaFXnHBKjbbNrMtOsH | eleven_flash_v2_5 | mp3_44100_128 |
| Dimli     | iDHk3E7ojf3zi6XPDM2o | eleven_flash_v2_5 | mp3_44100_128 |
| Fleck     | kJ1WJLsLiz0CnWmEPesT | eleven_flash_v2_5 | mp3_44100_128 |

Deirdre, Fiona, Gerki, Zot and Eve remain disabled with null Voice IDs.

## Required counts and actual generation

Primary production deck membership establishes 40 physical cards for each character. The immutable combined pack represents multiple physical titles through some shared mechanic definitions.

| Character | Current production definitions | Verified single-title bindings | Unresolved definitions | Distinct printed-title audio requirement                        | Generated | Skipped | TTS failures |
| --------- | -----------------------------: | -----------------------------: | ---------------------: | --------------------------------------------------------------- | --------: | ------: | -----------: |
| Gog       |                             23 |                             13 |                     10 | Cannot be fully verified from the available physical identities |         0 |       0 |            0 |
| Dimli     |                             23 |                             19 |                      4 | 28 distinct canonical titles in verified original 40-card deck  |         0 |       0 |            0 |
| Fleck     |                             24 |                             21 |                      3 | 29 distinct canonical titles in verified original 40-card deck  |         0 |       0 |            0 |

**Total ElevenLabs requests: 0.** All 70 current definition associations remain ungenerated. Zero TTS failures means no TTS request was attempted; it does not mean the batch succeeded. Both requested commands exited 1 during content preflight, before any key-dependent operation.

The initial preflight found 69 absent explicit bindings. The existing immutable evidence and preserved original deck records resolved 52 more bindings, leaving **17 unresolved associations**, of which seven are presentation/physical-title mapping gaps rather than absent original titles.

No canonical title was substituted with a descriptive pack name. No rules, localized text, IDs, Drink or Drink Event titles were sent to TTS. Mocked request tests assert the exact title-only payload and selected model/format.

## Exact blockers

The per-definition list is in ignored `.tools/voice-generation/title-audit.json`. All verified bindings are preserved in ignored `content-private/voice/canonical-titles.json`, with individual source/evidence references.

| Character | Rows               | Missing requirement                                                                                                                                                                  |
| --------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Gog       | M01, M02, M03      | Complete per-copy canonical printed title associations; family/quantity evidence alone does not establish all physical title identities.                                             |
| Gog       | M09, M12, M13      | Exact complete physical printed-title identities. Existing gameplay overrides establish semantics, not all printed titles.                                                           |
| Gog       | M31                | Five physical copies share verified gameplay; four printed identities were explicitly waived, not verified. The named publisher example cannot be assigned to all five copies.       |
| Gog       | M37, M40, M41      | Printed identities remain unavailable/waived. Normalized fallback display labels are explicitly not physical titles.                                                                 |
| Dimli     | M09, M12, M17, M31 | Verified originals contain respectively 2, 2, 2 and 3 different titles inside one current definition per family. All must be preserved, rather than selecting one title arbitrarily. |
| Fleck     | M04, M09, M17      | Verified originals contain respectively 4, 2 and 2 different titles inside one current definition per family. All must be preserved.                                                 |

Dimli and Fleck original source files already exist locally; those seven families do **not** require the user to supply their titles again. A complete physical-card presentation mapping must distinguish them in generation paths, manifests and live played-card narration. The current production protocol identifies only a definition and cannot select the correct title within a combined family. No immutable content pack or source lock was overwritten to force an incomplete title mapping.

The preserved Dimli and Fleck source file SHA-256 values were reproduced:

- Dimli: `7d820fd65ae6eb283d9548e0a932eefa13649444d9236589798e89f2903e5bfe`.
- Fleck: `0eeea03f64b4e787a2766d7a79627a69ce5e1f8709ba2ae5c6d62150dbdea648`.

The existing M07 publisher image was inspected locally to recover its exact shared title. The locked M08 direct-image inspection and original M01–M03 records recovered further safe single-title bindings. Title provenance stays private.

## Files and manifest

Generated managed audio files: **none**. `public/audio/cards/` contains only the empty `manifest.json`.

Intended directories:

- `public/audio/cards/character_rdi_gog_the_half_ogre/`
- `public/audio/cards/character_rdi_dimli_the_dwarf/`
- `public/audio/cards/character_rdi_fleck_the_bard/`

Manifest: `public/audio/cards/manifest.json`. Its schema includes characterId, cardDefinitionId, spokenText, voiceId, modelId, outputFormat, input contentHash, audio SHA-256, assetPath, explicit settings and provenance. Required mappings are incomplete, so verification does not pass. The empty managed directory has no orphan audio, zero-byte audio, stale audio or path collisions.

The user's existing untracked `gog-test.mp3` was preserved. Chromium successfully decoded it (1.764716553 seconds, 44.1 kHz, mono); it was not renamed, copied into managed output or claimed as a production card-title asset.

## Incremental safety and self-review fixes

The offline generator validates primary deck membership, canonical inputs and manifest ownership/path uniqueness before any paid request. Valid unchanged assets skip without a key or HTTP call. Missing/corrupt/changed inputs regenerate individually. Each success is saved immediately with its manifest entry. Retryable HTTP failures have at most three retries; a terminal failure stops and preserves earlier successes. Network timeouts do not automatically retry a potentially charged request.

Mocked failure/recovery tests passed: one successful asset was retained after a later exhausted rate limit; resume generated only missing assets. There were no real provider failures to recover in this batch.

Self-review corrected:

1. Title-family names were unsafe as canonical speech. A separate private provenance input and fail-closed preflight prevent fabricated titles; 53 verifiable single-title associations were recorded.
2. Duplicate/stale manifest ownership could previously be discovered after work began. Whole-manifest ownership/path preflight now rejects it before any request.
3. A catalog arriving late could replay older LIVE events. Events are consumed even without a loaded catalog; late loading stays silent.
4. Eager catalog fetch interfered with startup/network expectations. It now loads only when the game table requests it; landing and health-check regressions pass.
5. Separate title and attention playback could overlap. Both now share a FIFO queue, and the prior attention tests wait for the preceding clip to end.
6. The presentation E2E fixture used a JSON import that failed in Playwright's Node loader. It now reads and validates the explicit sample fixture through Node fs.
7. Valid frame headers alone could allow undecodable compressed data to be cached. The production generator now browser-decodes both cache candidates and returned bytes. A decoding failure preserves previous asset bytes and the manifest; focused tests verify this behavior and sanitized errors.

The unresolved physical-title/source blockers are not masked with guessed labels or a claim that every physical card has audio.

## Runtime verification

Client tests and the four-player browser journey verify:

- Only LIVE CARD_PLAYED events enqueue card-title narration.
- HISTORY, rerender, reconnect and late manifest arrival do not replay speech.
- The full public timeline identity deduplicates events; session remount preserves consumed identities.
- Card titles and the existing attention voice serialize without overlap.
- A response command is accepted while the first title clip is still playing and presentation is active.
- Server response timing remains authoritative and independent of audio.
- Missing assets, playback rejection/error and watchdog expiry advance optional speech without controlling legality.
- Independent voice preferences and temporary music ducking do not alter authoritative state.

Production source and built bundles contain no ElevenLabs endpoint, key reference or API header. The workspace secret scanner passed.

## Required commands

| Command                         | Result                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `npm run typecheck`             | PASS, exit 0                                                                                                       |
| `npm run lint`                  | PASS, exit 0                                                                                                       |
| `npm test`                      | PASS, exit 0: 2,960 Vitest tests across all runtime groups plus 8 offline Node voice tests                         |
| `npm run build`                 | PASS, exit 0                                                                                                       |
| `npm run test:e2e`              | PASS, exit 0: 32 tests across main, development, RDI1, RDI2 and presentation suites                                |
| `npm run voice:test`            | PASS: 8 mocked offline generation/verification tests                                                               |
| `npm run voice:plan`            | PASS: 70 configured definitions; 17 unresolved title associations                                                  |
| `npm run voice:generate`        | BLOCKED, exit 1: canonical title preflight; zero paid requests                                                     |
| `npm run voice:verify:partial`  | FAIL, exit 1: configured-character title coverage incomplete; five unconfigured roles are permitted                |
| `npm run voice:security`        | PASS: 53 runtime source/build files and 1,863 workspace text files checked at the production build checkpoint      |
| Focused client regression rerun | PASS: 6 card-voice tests after adding late-catalog/non-card assertions; earlier broader client run passed 57 tests |
| `git diff --check`              | PASS; normal Windows line-ending notices only                                                                      |

Strict `npm run voice:verify` was **not run**. Required engineering checks pass; Batch 1 generation/verification criteria do not.

## Git review

The working tree includes earlier Step 25R presentation work as well as this batch. `git diff --stat` excludes untracked new files and staged index-only private removals. The 23 staged private removals predate this batch's title work; all 23 files still exist locally and match their saved SHA-256 values. No physical source files were deleted or changed. Cached stat: 23 files, 86,635 removed tracked lines. Keep private content separately when transferring the repository.

`git diff --stat`:

```text
 .gitignore                         |   5 +
 .prettierignore                    |   1 +
 docs/audio.md                      |   8 ++
 docs/protocol.md                   |  12 ++
 eslint.config.js                   |   7 +-
 package.json                       |  16 ++-
 playwright.config.ts               |   2 +
 public/audio/LICENSES.md           |   4 +
 scripts/fixture-preview.mjs        |   1 +
 scripts/rdi1-pack.ts               |   1 +
 scripts/rdi2-pack.ts               |   1 +
 src/client/GameTable.tsx           | 115 +++++++++++++++++--
 src/client/audio/AudioProvider.tsx |  70 +++++++++++-
 src/client/audio/audio-engine.ts   |  71 +++++++++---
 src/client/audio/context.ts        |   4 +
 src/client/audio/settings.ts       |  19 +++-
 src/client/room-state.ts           |  96 +++++-----------
 src/client/styles.css              | 228 +++++++++++++++++++++++++++++++++++++
 src/engine/drinks.ts               |   9 ++
 src/engine/event-writer.ts         |  26 ++++-
 src/engine/invariants.ts           |   1 +
 src/engine/setup.ts                |   4 +
 src/engine/types.ts                |   2 +
 src/engine/workflows.ts            |  59 ++++++++++
 src/protocol/events.ts             |  76 +++++++++++++
 src/protocol/messages.ts           |   2 +
 src/shared/ui-messages.ts          | 211 ++++++++++++++++++++++++++++++++++
 tests/client/audio.test.tsx        |   2 +
 tests/e2e/audio-helpers.ts         |   2 +
 tests/e2e/gameplay.spec.ts         |   6 +-
 tests/e2e/timing-helpers.ts        |   2 +-
 vite.config.ts                     |   1 +
 vite.rdi1-e2e.config.ts            |   1 +
 vite.rdi2-e2e.config.ts            |   1 +
 vitest.config.ts                   |   1 +
 worker/durable/game-room.ts        |  50 +++++++-
 worker/durable/room-record.ts      |   3 +
 37 files changed, 1002 insertions(+), 118 deletions(-)
```

`git status --short`:

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
 M src/client/audio/AudioProvider.tsx
 M src/client/audio/audio-engine.ts
 M src/client/audio/context.ts
 M src/client/audio/settings.ts
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
 M tests/client/audio.test.tsx
 M tests/e2e/audio-helpers.ts
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
?? content/presentation/
?? docs/step25r-audition-status.md
?? docs/step25r-voice-batch1-status.md
?? docs/voice-generation.md
?? gog-test.mp3
?? playwright.presentation.config.ts
?? public/audio/cards/
?? reference/voice-design-profiles.json
?? scripts/card-voice-assets.mjs
?? scripts/card-voices.mjs
?? scripts/presentation-e2e-config.mjs
?? scripts/runtime-env.mjs
?? scripts/voice-decode.mjs
?? scripts/voice-runtime-security.mjs
?? scripts/worker-types.mjs
?? scripts/wrangler-local.mjs
?? src/client/PresentationDirector.ts
?? src/client/PresentationZone.tsx
?? src/client/PublicTimelineLog.tsx
?? src/client/audio/card-voice-catalog.ts
?? src/client/audio/use-card-voices.ts
?? src/client/audio/voice-queue.ts
?? src/client/timeline-text.ts
?? src/client/use-presentation.ts
?? src/protocol/public-narration-projector.ts
?? src/protocol/public-narration.ts
?? tests/client/card-voices.test.tsx
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
```

No commit, deployment, final Step 25 completion or RDI3+ work was performed.

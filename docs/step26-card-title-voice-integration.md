# Step 26 card-title voice integration

Implemented only Step 26. No card mechanics, title wording, BGM, SFX or Sometimes timing/attention behavior changed. No RDI3+ work or deployment was started.

## Architecture and assets

The deterministic importer reads these authoritative inputs:

- `content-private/imports/rdi1/rdi1-deirdre-printed-titles.json`
- `content-private/imports/rdi1/rdi1-fiona-printed-titles.json`
- `content-private/imports/rdi1/rdi1-gerki-printed-titles.json`
- `content-private/imports/rdi1/rdi1-zot-printed-titles.json`
- `content-private/imports/rdi2/rdi2-dimli-printed-titles.json`
- `content-private/imports/rdi2/rdi2-eve-printed-titles.json`
- `content-private/imports/rdi2/rdi2-fleck-printed-titles.json`
- `content-private/imports/rdi2/rdi2-gog-printed-titles.json`

Private title mapping v2 deduplicates exact titles within each owned gameplay definition. Server-only assignments carry IDs/quantities, pinned in match replay setup. Physical instances receive variants before shuffle, without consuming RNG. Only played-card narration exposes the variant; hidden game projections omit it. Client lookup selects the exact character/definition/variant asset, with safe single-variant legacy fallback and silence for ambiguous legacy instances. Manifest v2 includes complete family metadata, SHA-256s and existing attribution fields.

| Character | Physical assignments | Unique title variants | Generated | Initial cache hits | Failed |    Voice assets pending |
| --------- | -------------------: | --------------------: | --------: | -----------------: | -----: | ----------------------: |
| Deirdre   |                   40 |                    28 |         0 |                  0 |      0 |   28; Voice ID required |
| Fiona     |                   40 |                    28 |         0 |                  0 |      0 |   28; Voice ID required |
| Gerki     |                   40 |                    27 |         0 |                  0 |      0 |   27; Voice ID required |
| Zot/Pooky |                   40 |                    28 |         0 |                  0 |      0 |   28; Voice ID required |
| Dimli     |                   40 |                    28 |        28 |                  0 |      0 |                       0 |
| Eve       |                   40 |                    27 |         0 |                  0 |      0 |   27; Voice ID required |
| Fleck     |                   40 |                    29 |        29 |                  0 |      0 |                       0 |
| Gog       |                   40 |                    25 |        25 |                  0 |      0 |                       0 |
| Total     |                  320 |                   220 |        82 |                  0 |      0 | 138 disabled; 0 enabled |

Batch 1 completed 82 HTTP requests with no failures. Every MP3 passed format/hash validation and Chromium decoding. Subsequent planning reports **82 cache hits, zero required API assets, zero mapping errors**. No provider voices were deleted. Five remaining characters need only supplied Voice IDs, `enabled: true` and another generation run.

## Tests added or extended

- `tests/voice/title-variants.test.mjs`: ten import tests covering all sources, exact physical/variant quantities, unchanged titles/overrides, deduplication, stable IDs and invalid/missing/duplicate inputs.
- `tests/voice/card-assets.test.mjs`: updated v2 tests and a new multi-variant test; exact requests, valid-cache silence, individual repair, safe rate-error stop/resume, duplicate rejection, credential isolation and generation after enabling another voice.
- `tests/engine/title-variants.test.ts`: six tests for distribution, unchanged RNG, actual draw/discard/reshuffle/play, hidden projections, narration, serialization/replay and invalid metadata.
- `tests/client/card-voices.test.tsx`: v2 playback for two variants of one definition, missing variant silence, safe legacy fallback, history/rerender/reconnect silence, queue serialization, music ducking and voice mute/volume.
- `tests/worker/rdi2-content.test.ts`: real Workers-runtime assertions for 80 assigned instances, D1 replay setup and Durable Object eviction/reconnect across all three Drink-deck selections.
- `tests/e2e/public-presentation.spec.ts`: v2 fixture catalog; verifies live speech while response controls work, followed by silent history/reconnect.

## Verification

| Command                                                      | Exact final result                                                                                                           |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `npm run voice:titles`                                       | PASS: 8 characters, 40 physical assignments each, 320 total                                                                  |
| `npm run voice:test`                                         | Exit 0: 19 passed, 0 failed                                                                                                  |
| `npm run voice:plan`                                         | Exit 0: 82 required assets, 82 valid cache hits, 0 API assets, 0 mapping errors                                              |
| `npm run voice:generate`                                     | Exit 0: 82 requests, 82 generated, 0 skipped, 0 failed, 0 enabled assets pending                                             |
| `npm run voice:verify:partial`                               | Exit 0: 82 assets complete/current and Chromium-decoded; 5 characters intentionally unconfigured                             |
| `npm run voice:security`                                     | Exit 0: 53 runtime/build files and 4,013 workspace text files checked; no exposed key/runtime TTS calls                      |
| `npm run typecheck`                                          | Exit 0                                                                                                                       |
| `npm run lint`                                               | Exit 0                                                                                                                       |
| `npm test`                                                   | Exit 1: all 32 configured Vitest groups executed; 2,921 tests passed, 1 failed, plus 1 suite could not load missing evidence |
| `npm run build`                                              | Exit 0; restored the normal build after browser-specific builds                                                              |
| `npm run test:e2e`                                           | Exit 0: 32 passed across all five browser configurations                                                                     |
| Focused variant/client/public-narration and hash regressions | Exit 0: 5 files, 36 tests passed                                                                                             |
| `npm run content:verify:rdi2`                                | Exit 0: immutable artifact matches, all four decks have 40 cards, unknown effects/errors empty                               |
| `git diff --check`                                           | Exit 0                                                                                                                       |

`npm test` stops before its chained Node voice command because the older Vitest checks fail; the 19 Node voice tests were run separately and passed. The two final failing checks are detailed below. Earlier Windows-byte and local browser-connection failures were repaired/retested. Strict all-eight voice verification is intentionally not used as a release gate.

All nine Step 26 functional acceptance criteria are implemented and verified: complete mappings, stable new-match identity, revealed narration, exact lookup, successful generation/partial verification, unchanged mechanics/audio behavior and later Voice-ID-only enablement. **Step 26 is not certified complete**, because the mandatory full repository test gate remains blocked. Providing the next Voice IDs is safe; certifying a later development step or release must wait for those checks.

## Repository blockers

The existing release audit needs `.tools/step24a-source-lock-resolution/evidence/{dimli,eve,fleck}.json`; these original files are absent locally. Their hashes must be reproduced from the actual evidence files. No substitute evidence or passing audit was fabricated.

The existing private-content test forbids tracked `content-private/imports` files, but earlier user commits added 33 such files. New private paths are ignored; existing tracked files are preserved pending the user's policy decision.

Windows checkout conversion also changed locked evidence bytes. Those files were restored only when they exactly matched recorded hashes or committed bytes. `.gitattributes` now preserves source evidence bytes. No source lock was rewritten and no card/title content changed. Prettier accepts the checkout's line endings, and generated metadata is excluded from hand-written style checks.

The voice pipeline is ready to accept the next five Voice IDs. Full repository completion remains blocked until the existing evidence/policy checks pass; no later step should be certified yet.

## Manual verification

Start a **new** combined RDI1/RDI2 match with Dimli, Fleck or Gog. Use a normal click/tap to unlock audio, enable card voices and play a card. Its printed English title should speak once. In browser Network tools, the clip URL should contain character, definition and variant directories. Playing another variant of the same definition should request a different MP3. Refresh/reconnect should replay no speech; muting card voices should leave gameplay and the separate audio controls usable. Legacy matches with ambiguous title identity deliberately remain silent.

## Changed files

- `.gitattributes`, `.gitignore`, `.prettierignore`, `.prettierrc.json`
- `package.json`
- `scripts/card-title-variants.mjs`, `scripts/card-voice-assets.mjs`, `scripts/card-voices.mjs`
- `content-private/voice/canonical-titles.json`, `content/presentation/card-title-assignments.json`
- `src/content/cards.ts`, `src/content/title-variants.ts`
- `src/engine/setup.ts`, `src/engine/event-writer.ts`
- `src/protocol/events.ts`, `src/protocol/public-narration.ts`, `src/protocol/public-narration-projector.ts`
- `worker/durable/game-room.ts`
- `src/client/audio/audio-engine.ts`, `src/client/audio/card-voice-catalog.ts`, `src/client/audio/use-card-voices.ts`
- The six test files listed above
- `public/audio/cards/manifest.json` and 82 MP3s under the Dimli/Fleck/Gog character directories, enumerated individually by the manifest
- `docs/voice-generation.md`, this report

There are 112 changed/new files: 30 source/configuration/test/documentation/metadata files and 82 MP3s. The user-added Step 26 prompt was read and preserved. Ignored local check logs, complete changed-file inventory and generation receipts are in `.tools/`.

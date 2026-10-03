# Production upgrade status — Steps 13–17

Audit date: 2026-10-03. All five implementation steps and their acceptance scenarios are complete. No user decision was needed. Further development is safe; production release remains blocked by the explicitly allowed absence of complete owned/licensed official content. Stop after Step 17.

## Runtime and content

Production is the default environment and reads a published immutable D1 edition. Rooms, character selection, match manifests and presentation stay pinned across channel updates and actual Durable Object eviction. Missing/invalid content fails closed. Explicit fixture mode is independently tested and never activates the production channel. No sample pack or presentation is reachable through production runtime imports.

| Metric                                 | Production                                | Explicit original fixture                 |
| -------------------------------------- | ----------------------------------------- | ----------------------------------------- |
| Catalog character metadata             | 76 canonical names with source/provenance | Not official catalog content              |
| Installed published production channel | None (configuredVersion: null)            | content_sample_localized_v1               |
| Playable characters                    | 0 official characters                     | 4                                         |
| Unique imported card definitions       | 0 official cards                          | 10 original test cards                    |
| Total physical cards                   | 0 official cards                          | 37 copies across all fixture decks        |
| Missing required official characters   | 76/76                                     | Not assessed against the official catalog |

Card definitions use validated canonical JSON, a JSON effect DSL and registered server handlers. Unknown effect/special-rule keys are rejected; they never silently become no-ops. Generic resource handlers are supported, including legacy fixture aliases. Official character mechanics and required side-deck initialization beyond the implemented core are unimplemented unless explicitly supported. No installed official pack exists to assess those mechanics: empty unknown/unsupported arrays in the missing-pack report do **not** establish full catalog support. The verifier checks declared components, side decks, deck quantities and known handlers when input is supplied. No official effects were invented.

## Traditional Chinese completeness

- UI: **100% (187/187 keys)** with matching parameters and glossary validation.
- Explicit original fixture public fields: **100% (27/27)**, with reviewed provenance/status. Manual character translations visibly retain canonical English names.
- Official 76-character catalog translation metadata: **0% (0/76)**; entries remain UNTRANSLATED. The worksheet marks only glossary-verified names as verified, without inventing other official names.
- Installed official card-text translations: **N/A**, because no official production pack is installed. The localization command explicitly reports that absence; its UI pass does not override production completeness.

Canonical terminology verified: 耐力值, 酒精值, 金幣, 暢飲區, 賭博, 作弊, 續杯, 酒卡事件. Real Drink/Drink Event projections render the last two terms in component tests. Different-language browsers play the same match; switching locale sends no game command, preserves the socket and hand, leaves D1 accepted history/replay byte-equivalent, and preserves pinned content and RNG. Translation rows remain immutable after publication. Production zh-TW rejects missing/draft text; fixture fallback is explicit.

## Audio and card interactions

One audio engine creates two local media elements only after an explicit gesture; music and SFX have independent persisted volumes/mutes and a master switch. Stable server prompt identity drives local chimes. Actual response and gambling priority transitions are tested for one local chime and no remote chime; rerender, language change, refresh and reconnect do not repeat the same prompt. Disabled, missing-media and rejected-playback paths leave gameplay functional.

**Audio follow-up, 2026-10-03:** the user supplied both local WAV files after the Step 17 audit. They are now bundled at the existing playback paths; source references, receipt date, format and hashes are recorded in [audio provenance](../public/audio/LICENSES.md). Selected source pages list CC0 1.0: RandomMind's [Medieval: The Old Tower Inn](https://opengameart.org/content/medieval-the-old-tower-inn) and Anthousai's [wind chimes – single 01](https://freesound.org/people/Anthousai/sounds/398494/). The original download dates and prior edits were not recorded. Behavior tests continue to mock playback; the supplied files can additionally be verified with native browser decoding/playback. No runtime hotlinks were added. The Step 13–17 test results below remain the original audit record.

Eligible card bodies toggle selection on click/tap or Space/Enter. A checkmark, border, aria-checked and optional lift agree; min/max, busy state and eligibility are enforced. Play/Respond/gambling/Details controls cannot bubble into selection. Desktop hover/focus shows localized nonblocking details; moving into the scrollable preview pins it, and Escape/Close dismiss it. Touch offers separate Details controls. Reduced motion removes the lift while retaining selection cues. Card choices reuse projected own-hand metadata and never invent unavailable definitions.

## Acceptance and checks

| Step                           | Outcome                                                                                         | New Vitest cases | Browser result at completion |
| ------------------------------ | ----------------------------------------------------------------------------------------------- | ---------------- | ---------------------------- |
| 13: production content cutover | All 20 implementation criteria pass; expected absent-content verifier failure recorded          | 29               | 14/14                        |
| 14: zh-TW localization         | All 20 mandatory behaviors pass                                                                 | 27               | 15/15                        |
| 15: audio                      | All 22 mandatory behaviors pass; exact-file manual placement allowed                            | 20               | 16/16                        |
| 16: card interactions          | All 26 mandatory scenarios pass                                                                 | 17               | 17/17                        |
| 17: combined audit             | All required scenarios/static/IP/coverage checks pass with the permitted missing-content result | 7                | 18/18                        |

Every step ran typecheck, lint, test, build and E2E; Steps 13–16 also ran meaningful coverage and applicable new validators. Step 13 applied the local migration; Step 14 ran translation merge plus strict fixture verification. No next step began before the previous step passed.

Final Step 17 results:

| Command                             | Result                   | Exit |
| ----------------------------------- | ------------------------ | ---- |
| `npm run typecheck`                 | PASS                     | 0    |
| `npm run lint`                      | PASS                     | 0    |
| `npm test`                          | PASS                     | 0    |
| `npm run test:coverage`             | PASS                     | 0    |
| `npm run build`                     | PASS                     | 0    |
| `npm run test:e2e`                  | PASS                     | 0    |
| `npm run content:verify:production` | EXPECTED MISSING CONTENT | 1    |
| `npm run content:verify:zh-TW`      | PASS                     | 0    |

Tests: **851/851 in 55 files**, including real Workers/Durable Object/D1 runtime tests through @cloudflare/vitest-plugin. Browser: **18/18 Chromium journeys**, including mixed-locale full turns, accepted replay history, audio, whole-card selection, touch, reduced motion and hidden-information/security flows. Coverage: **99.61% statements / 98.7% branches / 99.8% functions / 99.68% lines**. All 90% per-file thresholds pass. Runtime content loading and preview cleanup branches are 100%; localization branches are 100%; audio engine branches are 96%. Remaining uncovered branches were inspected: optional/default card props, malformed-input reporting and defensive runtime/error guards; no missing critical pinning, translation fallback, deduplication, bubbling or hover/focus cleanup behavior was found.

Two audit failures were corrected before the final run: selected physical IDs are compared exactly as a set because click order differs from shuffled DOM order; a translated fixture control selector was corrected. Concurrent local replay CLI probes caused a real Miniflare/D1 file conflict; their browser project now runs with one worker, keeping all assertions and other browser journeys parallel. No retries, skipped cases or weaker gameplay assertions hide failures.

Production verification exits **1**, reporting expectedCharacters 76, presentCharacters 0, missingCharacters 76, uniqueCards 0 and physicalCards 0. This is the **only allowed production release blocker**. It must exit zero against complete user-owned/licensed data before release; catalog metadata and successful tests do not constitute a full official card database.

## Static/IP and diff review

Reviewed each step's full git diff, including new files; final whitespace checks pass. Production dependency graph/UI scans found no sample runtime imports/endpoints/copy, scattered new Audio calls, old click-only Read controls or nested buttons. One intentional language-selector autonym, English, remains. Legacy fixture aliases live in generic server handlers; sample packs are confined to fixtures/tools/tests. Public projection does not expose other players' hands, hidden deck order, face-down Drink identities or RNG. Clients still submit validated intents only.

Private input and generated local reports remain ignored. No complete scraped proprietary card text, copyrighted artwork, secrets or machine-specific paths were added to distributable files. User-supplied prompts, AGENTS addendum and references remain preserved. Source/status provenance is stored for translations; local audio provenance exists and honestly records absent files.

## Tests added and strengthened

100 new Vitest cases and four new E2E journeys across Steps 13–17. New suites:

- Content: production, presentation, deployment-mode, localization and production-upgrade-audit tests.
- Client: localization, audio, attention-chime and card interaction tests.
- Protocol: stable attention prompt identity tests.
- Workers: production-content, localization and attention tests using the actual runtime.
- E2E: localization, audio, cards and combined production-upgrade journeys.

Existing engine handler, Worker publication/migration/presentation/security, reconnect, replay and gameplay tests were strengthened or updated for the new presentation/API. Step 17 adds seven regressions: three static architecture checks, constructor-failure audio recovery, stale/pinned preview cleanup, Chinese Drink/Chaser and Chinese Drink Event rendering. It additionally verifies real D1 replay before/after locale changes and actual browser gambling chime transitions.

## Visual verification

1. Run npm run db:migrate, npm run db:seed, then npm run dev:fixture. Use two independent browser windows/profiles and join the same room. Select 繁體中文 in one and English in the other, then start.
2. Click two card bodies, deselect one, submit discard; inspect the checkmark and phase change. Hover/focus different cards; read localized rules without a modal. Space/Enter toggles selection, Escape closes details, and embedded actions preserve selection.
3. At a 390px viewport, use Details and card selection separately. Enable reduced motion; selection remains visible. Desktop/mobile and zh-TW browser screenshots were inspected.
4. Adjust Sound volumes/mutes and refresh. The supplied WAV files are now present. The first ordinary click, tap or typing gesture starts audio automatically, preserving saved mute preferences; verify one looping track and chimes only for your own new turn/response/gambling priority. Reconnect or change language during the same prompt; no repeat. Complete a turn with audio disabled.
5. npm run dev uses production mode and must report unavailable content until a complete published owned/licensed edition is installed. Follow [production content setup](production-content.md); do not activate fixture data as production.

## Files changed

105 project and reference files changed across Steps 13–17. User-added prompts and the AGENTS addendum are excluded; three reference documents received formatting changes while their text was preserved. Exact list:

- [README.md](../README.md)
- [content/catalog/characters.json](../content/catalog/characters.json)
- [content/samples/zh-TW.json](../content/samples/zh-TW.json)
- [docs/architecture.md](../docs/architecture.md)
- [docs/audio.md](../docs/audio.md)
- [docs/card-interactions.md](../docs/card-interactions.md)
- [docs/content-format.md](../docs/content-format.md)
- [docs/content-import.md](../docs/content-import.md)
- [docs/database.md](../docs/database.md)
- [docs/game-ui.md](../docs/game-ui.md)
- [docs/localization.md](../docs/localization.md)
- [docs/production-content.md](../docs/production-content.md)
- [docs/production-upgrade-status.md](../docs/production-upgrade-status.md)
- [docs/protocol.md](../docs/protocol.md)
- [docs/realtime-rooms.md](../docs/realtime-rooms.md)
- [migrations/0006_production_content.sql](../migrations/0006_production_content.sql)
- [migrations/0007_content_translations.sql](../migrations/0007_content_translations.sql)
- [package.json](../package.json)
- [playwright.config.ts](../playwright.config.ts)
- [public/audio/LICENSES.md](../public/audio/LICENSES.md)
- [reference/audio-assets.md](../reference/audio-assets.md)
- [reference/source-notes.md](../reference/source-notes.md)
- [reference/zh-TW-glossary.md](../reference/zh-TW-glossary.md)
- [scripts/fixture-dev.mjs](../scripts/fixture-dev.mjs)
- [scripts/fixture-preview.mjs](../scripts/fixture-preview.mjs)
- [scripts/localization.ts](../scripts/localization.ts)
- [scripts/production-content.ts](../scripts/production-content.ts)
- [scripts/require-production.mjs](../scripts/require-production.mjs)
- [seeds/0002_fixture_localized.sql](../seeds/0002_fixture_localized.sql)
- [src/client/App.tsx](../src/client/App.tsx)
- [src/client/GameTable.tsx](../src/client/GameTable.tsx)
- [src/client/Modal.tsx](../src/client/Modal.tsx)
- [src/client/RoomScreen.tsx](../src/client/RoomScreen.tsx)
- [src/client/audio/AudioProvider.tsx](../src/client/audio/AudioProvider.tsx)
- [src/client/audio/audio-engine.ts](../src/client/audio/audio-engine.ts)
- [src/client/audio/context.ts](../src/client/audio/context.ts)
- [src/client/audio/settings.ts](../src/client/audio/settings.ts)
- [src/client/audio/use-attention-chime.ts](../src/client/audio/use-attention-chime.ts)
- [src/client/cards/CardPreview.tsx](../src/client/cards/CardPreview.tsx)
- [src/client/cards/HandCard.tsx](../src/client/cards/HandCard.tsx)
- [src/client/cards/useCardPreview.ts](../src/client/cards/useCardPreview.ts)
- [src/client/cards/useCardSelection.ts](../src/client/cards/useCardSelection.ts)
- [src/client/i18n/LocaleProvider.tsx](../src/client/i18n/LocaleProvider.tsx)
- [src/client/i18n/context.ts](../src/client/i18n/context.ts)
- [src/client/i18n/preference.ts](../src/client/i18n/preference.ts)
- [src/client/room-state.ts](../src/client/room-state.ts)
- [src/client/styles.css](../src/client/styles.css)
- [src/client/use-room.ts](../src/client/use-room.ts)
- [src/content/cards.ts](../src/content/cards.ts)
- [src/content/catalog.ts](../src/content/catalog.ts)
- [src/content/database.ts](../src/content/database.ts)
- [src/content/effects.ts](../src/content/effects.ts)
- [src/content/fixture-localized.ts](../src/content/fixture-localized.ts)
- [src/content/import-statements.ts](../src/content/import-statements.ts)
- [src/content/import.ts](../src/content/import.ts)
- [src/content/localization.ts](../src/content/localization.ts)
- [src/content/pack.ts](../src/content/pack.ts)
- [src/content/presentation.ts](../src/content/presentation.ts)
- [src/content/production.ts](../src/content/production.ts)
- [src/engine/effects/registry.ts](../src/engine/effects/registry.ts)
- [src/protocol/attention.ts](../src/protocol/attention.ts)
- [src/protocol/presentation.ts](../src/protocol/presentation.ts)
- [src/protocol/projections.ts](../src/protocol/projections.ts)
- [src/protocol/views.ts](../src/protocol/views.ts)
- [src/shared/locales.ts](../src/shared/locales.ts)
- [src/shared/ui-messages.ts](../src/shared/ui-messages.ts)
- [tests/client/GameTable.test.tsx](../tests/client/GameTable.test.tsx)
- [tests/client/Landing.test.tsx](../tests/client/Landing.test.tsx)
- [tests/client/attention-chime.test.tsx](../tests/client/attention-chime.test.tsx)
- [tests/client/audio.test.tsx](../tests/client/audio.test.tsx)
- [tests/client/cards.test.tsx](../tests/client/cards.test.tsx)
- [tests/client/localization.test.tsx](../tests/client/localization.test.tsx)
- [tests/client/setup.ts](../tests/client/setup.ts)
- [tests/client/use-room.test.tsx](../tests/client/use-room.test.tsx)
- [tests/content/deployment-mode.test.ts](../tests/content/deployment-mode.test.ts)
- [tests/content/localization.test.ts](../tests/content/localization.test.ts)
- [tests/content/presentation.test.ts](../tests/content/presentation.test.ts)
- [tests/content/production-upgrade-audit.test.ts](../tests/content/production-upgrade-audit.test.ts)
- [tests/content/production.test.ts](../tests/content/production.test.ts)
- [tests/e2e/audio-helpers.ts](../tests/e2e/audio-helpers.ts)
- [tests/e2e/audio.spec.ts](../tests/e2e/audio.spec.ts)
- [tests/e2e/cards.spec.ts](../tests/e2e/cards.spec.ts)
- [tests/e2e/gameplay.spec.ts](../tests/e2e/gameplay.spec.ts)
- [tests/e2e/localization.spec.ts](../tests/e2e/localization.spec.ts)
- [tests/e2e/production-upgrade.spec.ts](../tests/e2e/production-upgrade.spec.ts)
- [tests/e2e/replay-inspector.spec.ts](../tests/e2e/replay-inspector.spec.ts)
- [tests/engine/timing.test.ts](../tests/engine/timing.test.ts)
- [tests/fixtures/production-pack.ts](../tests/fixtures/production-pack.ts)
- [tests/protocol/attention.test.ts](../tests/protocol/attention.test.ts)
- [tests/worker/attention.test.ts](../tests/worker/attention.test.ts)
- [tests/worker/localization.test.ts](../tests/worker/localization.test.ts)
- [tests/worker/migrations.test.ts](../tests/worker/migrations.test.ts)
- [tests/worker/presentation.test.ts](../tests/worker/presentation.test.ts)
- [tests/worker/production-content.test.ts](../tests/worker/production-content.test.ts)
- [tests/worker/room-record.test.ts](../tests/worker/room-record.test.ts)
- [tests/worker/security.test.ts](../tests/worker/security.test.ts)
- [vite.localization.config.ts](../vite.localization.config.ts)
- [vite.production-content.config.ts](../vite.production-content.config.ts)
- [vitest.config.ts](../vitest.config.ts)
- [worker/durable/game-room.ts](../worker/durable/game-room.ts)
- [worker/durable/room-record.ts](../worker/durable/room-record.ts)
- [worker/index.ts](../worker/index.ts)
- [worker/repositories/content.ts](../worker/repositories/content.ts)
- [worker/runtime-content.ts](../worker/runtime-content.ts)
- [wrangler.jsonc](../wrangler.jsonc)

# Reaction upgrade status

The user authorized sequential implementation of steps 18–20, stopping at a required decision, missing required asset/element, or completion of step 20. Steps 21–23 are outside this run. Step 19 uses the existing English MP3 for both UI locales, as explicitly requested; no Chinese voice or WAV conversion is required.

## Step 18: complete

Source-first living-seat order, private trigger/effect/target legality, automatic skipping, and child-first parent re-evaluation are implemented. The persisted source actor is the timing origin. Parent responses receive a fresh window identity and reset passes after a child completes. Public eligibility is a living-seat roster; calculated eligible hands and exact legal cards/targets remain server/private data. Legacy pinned Ignore/Negate cards retain structural predicates; unspecified ordinary Sometimes cards are not universally legal. No timers were added in step 18.

All 22 acceptance criteria pass. The 33 new tests in `tests/engine/reaction-legality.test.ts` cover source-first/seat/elimination order, private-hand auto-skip, relevant/unrelated/missing predicates, live stat and gambling conditions, effect/target validation agreement, parent modifier changes, reset passes/order, new/invalid legality, immediate resolution without fabricated passes, privacy and serialization/replay equality. Existing timing tests retain the depth-four Ignore/Negate chain and Sometimes/Anytime behavior. Actual Workers tests cover D1 nested snapshots and long room replay/reconnect. Browser gameplay/audio/trace tests now assert the corrected priority sequence.

| Command                 | Result                                             | Wall time |
| ----------------------- | -------------------------------------------------- | --------- |
| `npm run typecheck`     | exit 0                                             | 33.104 s  |
| `npm run lint`          | exit 0                                             | 16.072 s  |
| `npm test`              | 891/891 tests, 56/56 files, exit 0                 | 87.682 s  |
| `npm run test:coverage` | 891/891 tests; all per-file 90% gates pass; exit 0 | 95.593 s  |
| `npm run build`         | exit 0                                             | 2.687 s   |
| `npm run test:e2e`      | 20/20 Chromium journeys, exit 0                    | 38.484 s  |

Coverage: 99.51% statements, 98.69% branches, 99.81% functions, 99.57% lines. The new reaction evaluator has 96.19% statement and 98.42% branch coverage. Full test and coverage commands are run separately to avoid competing test processes causing a full-match replay timeout; the unmodified replay test passes in the final runs.

Diff and whitespace reviewed. No secrets, private content, debug logging or machine paths were added to runtime code. Existing sample identities and user-provided prompts/assets were preserved. Step 19 is safe to begin.

Files changed in step 18:

- `docs/protocol.md`, `docs/timing-engine.md`, `docs/reaction-upgrade-status.md`
- `scripts/timing-demo.ts`
- `src/client/GameTable.tsx`
- `src/content/cards.ts`, `src/content/presentation.ts`, `src/content/sample-presentation.ts`, `src/content/reaction-triggers.ts`
- `src/engine/card-effects-validation.ts`, `src/engine/reaction-legality.ts`, `src/engine/commands.ts`, `src/engine/resolution-state.ts`, `src/engine/timing.ts`
- `src/protocol/events.ts`, `src/protocol/projections.ts`, `src/protocol/views.ts`
- `tests/client/audio.test.tsx` (correct the interrupted touch regression's JSDOM event boundary and formatting)
- `tests/engine/reaction-legality.test.ts`, `tests/engine/drinks.test.ts`, `tests/engine/elimination.test.ts`, `tests/engine/gambling.test.ts`, `tests/engine/resolution-state.test.ts`, `tests/engine/timing.test.ts`
- `tests/fixtures/timing-match.ts`
- `tests/worker/core-engine.test.ts`, `tests/worker/replay.test.ts`
- `tests/e2e/audio.spec.ts`, `tests/e2e/engine-trace.spec.ts`, `tests/e2e/gambling-trace.spec.ts`, `tests/e2e/gameplay.spec.ts`, `tests/e2e/production-upgrade.spec.ts`

Plan-only edits: `codex-prompts/step-19-timed-response-windows.md` and `reference/reaction-audio.md`. The existing `reference/current-reaction-review.md` was formatted for the repository lint gate.

## Step 19: complete

All 35 acceptance criteria pass. Persisted server prompts use production 30/15-second deadlines; all four core phases receive legal Anytime grace after their special action or complete resolution. Nested plays reset consensus and timers, and losing players retain their final grace. Durable Object alarms, atomic snapshots/outbox, expiry-before-reconnect/command dispatch, immutable prompt checks, reserved system identities and recorded clock inputs support deterministic recovery/replay. The existing English MP3 serves both locales; no WAV conversion or Chinese asset was needed.

Tests added: 14 engine timer cases in `tests/engine/timed-prompts.test.ts`, four actual Workers/DO tests in `tests/worker/timed-prompts.test.ts`, eight voice/audio cases in `tests/client/audio.test.tsx`, and the synchronized timer journey in `tests/e2e/timed-prompts.spec.ts`. These include all four phase endings, legal/no-legal responses, pass/play/expiry, stale prompts, nested resets, last-chance healing, alarm scheduling, hibernation, reconnect, D1 timeout replay, failed mirror retry, reserved ID rejection, voice locale/remote/Anytime filtering, session deduplication, missing playback and locked/muted consumption. Existing match/replay/browser tests now explicitly pass through grace.

| Command                 | Result                                   | Wall time |
| ----------------------- | ---------------------------------------- | --------- |
| `npm run typecheck`     | exit 0                                   | 32.728 s  |
| `npm run lint`          | exit 0                                   | 15.058 s  |
| `npm test`              | 917/917 tests; 58/58 files; exit 0       | 286.456 s |
| `npm run test:coverage` | 917/917; all per-file gates pass; exit 0 | 299.257 s |
| `npm run build`         | exit 0                                   | 3.345 s   |
| `npm run test:e2e`      | 21/21 browser journeys; exit 0           | 62.801 s  |

Coverage is 99.46% statements, 98.10% branches, 99.82% functions and 99.59% lines. The timer module reaches 98.03% statements/91.89% branches; `GameRoom` reaches 98.48% statements/95.47% branches. Supplemental ignored native Chromium verification passes: the supplied MP3 is served, decodes to 4.152 seconds and plays after an ordinary gesture, with no media error.

Step 19 files changed:

- `src/engine/commands.ts`, `elimination.ts`, `invariants.ts`, `replay.ts`, `rules.ts`, `setup.ts`, `timing.ts`, `turn.ts`, `types.ts`, new `system-actions.ts`, new `timed-prompts.ts`
- `src/protocol/commands.ts`, `events.ts`, `projections.ts`, `views.ts`
- `worker/durable/game-room.ts`, `wrangler.jsonc`, `playwright.config.ts`
- `src/client/GameTable.tsx`, `game-actions.ts`, new `PromptCountdown.tsx`, `audio/audio-engine.ts`, new `audio/use-response-voice.ts`, `src/shared/ui-messages.ts`
- `scripts/engine-demo.ts`, `scripts/sample-game.ts`
- `tests/fixtures/core-match.ts`, `tests/client/audio.test.tsx`, new `tests/engine/timed-prompts.test.ts`
- `tests/worker/core-engine.test.ts`, `replay.test.ts`, `rooms.test.ts`, new `timed-prompts.test.ts`
- `tests/e2e/audio.spec.ts`, `cards.spec.ts`, `gameplay.spec.ts`, `localization.spec.ts`, `production-upgrade.spec.ts`, `replay-inspector.spec.ts`, `rooms.spec.ts`, new `timed-prompts.spec.ts`, new `timing-helpers.ts`
- `docs/audio.md`, `docs/protocol.md`, `docs/timing-engine.md`, new `docs/timed-prompts.md`, `docs/reaction-upgrade-status.md`
- `public/audio/LICENSES.md`, the existing supplied `public/audio/voice/en-US/sometimes-response.mp3`

Diff and whitespace review passed. No secrets, private copyrighted content, machine paths, dead code or debug logging were added. Documentation records the voice's supplied/unknown provenance without inventing creator/license details. Production ignores fixture timer configuration; clients cannot extend timers or forge timeouts. Full live-match bounds were expanded for the additional grace commands, while preserving final-state/replay assertions. It is safe to begin step 20.

## Step 20: complete

Private `legalPlays` now carries exact owned card IDs, command categories, targets and prompt identities. The server shares its command-context and effect validators with this query; automatic Gambling effects also respect the same effect limit. `legalPlayVersion` refreshes every seat after an accepted version even when its hand is unchanged. The client clears old highlights as soon as public state advances, consumes only matching private entries, and closes stale target dialogs. Playable cards use a dashed border, localized badge and accessible description; discard selection remains independent.

Tests added: 11 engine cases in `tests/engine/card-play-legality.test.ts`, 11 React cases in `tests/client/playable-highlighting.test.tsx`, two actual Workers/WebSocket cases in `tests/worker/legal-plays.test.ts`, and the browser journey in `tests/e2e/playable-highlighting.spec.ts`. The existing timed browser journey now also asserts correct Sometimes/Anytime highlights, expiry and nested recomputation. Existing action helper tests now consume real server legality instead of constructing hypothetical client permissions.

| Acceptance criteria                                      | Behavioral evidence                                                                                                              |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1–5: Action/Anytime/Sometimes timing and relevance       | Engine and React legality tests, normal-phase browser journey                                                                    |
| 6–8: nested re-evaluation and stale/new highlights       | Pending loss-to-gain modifier fixture, public-before-private React reset, nested timed browser journey                           |
| 9–11: gambling categories and exact targets              | Shared engine/command validator assertions, target-limited React picker                                                          |
| 12–15: privacy, reconnect and expiry                     | Public/private engine assertions, actual Workers sockets/alarms/hibernation/reconnect, separate browser contexts                 |
| 16–20: locale, selection, keyboard and server validation | English/Traditional Chinese React cases, keyboard and reduced-motion browser checks, strict forged-list/invalid-target rejection |
| 21–27: browser highlighting journeys                     | New playable browser test plus expanded synchronized timer journey                                                               |

Step 20 files changed:

- New `src/engine/card-play-legality.ts`; `src/engine/card-effects-validation.ts`, `reaction-legality.ts`, `timing.ts`
- `src/protocol/projections.ts`, `views.ts`
- `src/client/GameTable.tsx`, `game-actions.ts`, `cards/HandCard.tsx`, `styles.css`; `src/shared/ui-messages.ts`
- New `tests/fixtures/legal-play-match.ts`, `tests/engine/card-play-legality.test.ts`, `tests/client/playable-highlighting.test.tsx`, `tests/worker/legal-plays.test.ts`, `tests/e2e/playable-highlighting.spec.ts`
- `tests/client/GameTable.test.tsx`, `tests/worker/rooms.test.ts`, `tests/e2e/timed-prompts.spec.ts`
- `docs/game-ui.md`, `docs/protocol.md`, `docs/audio.md`, `docs/reaction-upgrade-status.md`

The [visual checklist](game-ui.md#visual-verification-for-steps-1820) uses explicit fixture mode. No production card database was added in these steps; steps 21–23 remain untouched. The supplied English MP3 is used without conversion, and no additional voice asset is required.

All 27 Step 20 acceptance criteria pass. The existing response-history regression retains its `STACK_LIMIT` rejection without mutation; the new capacity test verifies that private legality also becomes empty on a valid bounded-history snapshot. The final test and browser runs use the corrected shared validator.

| Command                 | Result                                               | Wall time |
| ----------------------- | ---------------------------------------------------- | --------- |
| `npm run typecheck`     | exit 0                                               | 33.891 s  |
| `npm run lint`          | exit 0                                               | 14.811 s  |
| `npm test`              | 941/941 tests; 61/61 files; exit 0                   | 269.489 s |
| `npm run test:coverage` | 941/941; every per-file 90% threshold passes; exit 0 | 276.404 s |
| `npm run build`         | exit 0                                               | 2.169 s   |
| `npm run test:e2e`      | 22/22 browser journeys; exit 0                       | 52.619 s  |

Coverage: 99.40% statements, 98.07% branches, 99.82% functions and 99.56% lines. The new legal-play service reaches 97.33% statements/96.92% branches; `GameRoom` reaches 98.48%/95.47%. The browser screenshot was visually inspected and confirms strong dashed outlines, readable badges and ordinary styling for unplayable cards.

Tracked diff, new source/test files and whitespace were reviewed. No secrets, private card content, machine paths or debug logging were introduced. The server still validates every intent; public views omit private legality and exact hand IDs. All acceptance criteria for steps 18–20 pass, and the authorized goal stops here. It is safe to begin Step 21 under a new instruction and that step's own decision/asset checks. Later official-content completion remains outside this implementation.

## Full changed-file inventory

This run edited or added 78 text files. The supplied MP3 is reused byte-for-byte as an existing asset.

- `codex-prompts/step-19-timed-response-windows.md`
- `docs/audio.md`
- `docs/game-ui.md`
- `docs/protocol.md`
- `docs/reaction-upgrade-status.md`
- `docs/timed-prompts.md`
- `docs/timing-engine.md`
- `playwright.config.ts`
- `public/audio/LICENSES.md`
- `reference/current-reaction-review.md`
- `reference/reaction-audio.md`
- `scripts/engine-demo.ts`
- `scripts/sample-game.ts`
- `scripts/timing-demo.ts`
- `src/client/GameTable.tsx`
- `src/client/PromptCountdown.tsx`
- `src/client/audio/audio-engine.ts`
- `src/client/audio/use-response-voice.ts`
- `src/client/cards/HandCard.tsx`
- `src/client/game-actions.ts`
- `src/client/styles.css`
- `src/content/cards.ts`
- `src/content/presentation.ts`
- `src/content/reaction-triggers.ts`
- `src/content/sample-presentation.ts`
- `src/engine/card-effects-validation.ts`
- `src/engine/card-play-legality.ts`
- `src/engine/commands.ts`
- `src/engine/elimination.ts`
- `src/engine/invariants.ts`
- `src/engine/reaction-legality.ts`
- `src/engine/replay.ts`
- `src/engine/resolution-state.ts`
- `src/engine/rules.ts`
- `src/engine/setup.ts`
- `src/engine/system-actions.ts`
- `src/engine/timed-prompts.ts`
- `src/engine/timing.ts`
- `src/engine/turn.ts`
- `src/engine/types.ts`
- `src/protocol/commands.ts`
- `src/protocol/events.ts`
- `src/protocol/projections.ts`
- `src/protocol/views.ts`
- `src/shared/ui-messages.ts`
- `tests/client/GameTable.test.tsx`
- `tests/client/audio.test.tsx`
- `tests/client/playable-highlighting.test.tsx`
- `tests/e2e/audio.spec.ts`
- `tests/e2e/cards.spec.ts`
- `tests/e2e/engine-trace.spec.ts`
- `tests/e2e/gambling-trace.spec.ts`
- `tests/e2e/gameplay.spec.ts`
- `tests/e2e/localization.spec.ts`
- `tests/e2e/playable-highlighting.spec.ts`
- `tests/e2e/production-upgrade.spec.ts`
- `tests/e2e/replay-inspector.spec.ts`
- `tests/e2e/rooms.spec.ts`
- `tests/e2e/timed-prompts.spec.ts`
- `tests/e2e/timing-helpers.ts`
- `tests/engine/card-play-legality.test.ts`
- `tests/engine/drinks.test.ts`
- `tests/engine/elimination.test.ts`
- `tests/engine/gambling.test.ts`
- `tests/engine/reaction-legality.test.ts`
- `tests/engine/resolution-state.test.ts`
- `tests/engine/timed-prompts.test.ts`
- `tests/engine/timing.test.ts`
- `tests/fixtures/core-match.ts`
- `tests/fixtures/legal-play-match.ts`
- `tests/fixtures/timing-match.ts`
- `tests/worker/core-engine.test.ts`
- `tests/worker/legal-plays.test.ts`
- `tests/worker/replay.test.ts`
- `tests/worker/rooms.test.ts`
- `tests/worker/timed-prompts.test.ts`
- `worker/durable/game-room.ts`
- `wrangler.jsonc`

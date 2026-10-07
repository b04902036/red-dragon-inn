# Step 24D — RDI2 and mixed-edition gameplay verification

Step 24D is complete for the source-locked project ruleset as of 2026-10-07. The locked RDI2 edition is tested definition by definition against the shared engine, production projections and client. The combined edition remains `content_rdi1_rdi2_mechanics_v1`. No source wording, override classification, physical quantity or published definition was changed in this step.

## Coverage and changes

[The generated coverage matrix](rdi2-card-coverage.md) contains all 116 unique definitions: 51 Sometimes, 7 Anytime, 19 Action, 12 Gambling, 4 Cheating, 19 Drinks and 4 Drink Events. It accounts for 160 Character cards, four decks of exactly 40, and 30 physical Drinks. Every row records its quantity, mechanic, timing, structured trigger, effect implementation, both locales and positive/negative/resolution test links. Generation and check mode fail on mismatched definitions, missing translations or stale output. Private printed card text and artwork are excluded.

The per-definition suites load the actual private compiled pack. Every Sometimes definition has positive private `legalPlays`, negative legality and server rejection, actual effect resolution, hidden-ID checks, snapshot/replay, stale prompt rejection, fresh opportunity timing and client highlight/audio checks. Every Anytime definition is checked in ordinary play, source responses, gambling and independent phase-end grace. The explicit Sometimes-only / Anytime-only / both / neither matrix checks 30-second opportunities and the Sometimes voice predicate. The accepted turn-owner rule remains untimed; other response opportunities use 30 seconds and phase-end grace uses 15 seconds.

These tests reproduced an engine defect: `ORIGINAL_SOURCE_PLAYER` matched only a post-loss task, so Eve's compiled Share Pain was illegal while its attacking card was pending. The shared predicate now reads pending card origin, with the source actor as fallback, and retains post-loss provenance. No character or title dispatch was added. Compiled odd/even Share Pain, mitigation locking, original-source routing and a mixed RDI1 attack are regression-tested in Node and workerd. A test assertion also now compares complete quoted hidden IDs, avoiding substring matches between IDs ending in `5` and `51`.

The mandatory compiled-content scenarios cover:

- Dimli: restart before payout, preserved pot, new antes, departed participants, controller/priority, departure rejection and incompatibility with a real RDI1 winner-replacement card; Drink pass, split and conversion are checked per definition.
- Eve: both errata Ignore copies, Alcohol/fire attacks, Illusionary Coin for payment/theft/ante, fixed Drink replacement followed by a modifier, odd/even Share Pain and mitigation lock, redirect with multiple players, two-player fallback and original attacker preservation.
- Fleck: all four physical Cheating-control cards, paid/free orders, self-only refill waiver, Inn-deck toast, split, rowdy-song effect order, sober sad-song Gold transfer and theft.
- Gog: all 40 physical cards, anti-cheat win, broad and Fortitude-only defenses, damage families and Inn payment, all-opponent attack, retaliation and off-turn extra Drink. The source-locked Half-Ogre Ogre Brew replacement is Alcohol 3 / Fortitude 0.
- Every Drink/Event: numeric results, Chasers, Water, Cutting Off, Holy Water, Wizard's Brew, all trait replacements, Fine Ambrosia, built-in Mead split with rounding and external-split rejection, Mead restrictions as Chaser/Event results, Round on the House, Drinking Contest and Challenge acceptance/decline.

## Browser and Workers acceptance

The new browser journey uses four independent contexts and the published combined D1 edition. It verifies all eight character choices, mixed character selection, combined Bar Deck, private hands, Action highlighting, Sometimes voice/countdown, silent Anytime response, phase-end grace, nested counters with new prompts, gambling and cross-set Cheating, Dimli restart, redirect from an RDI1 attacker, retaliation against that original attacker, Drink modification, Mead, Contest, Challenge, reconnect, English/Traditional Chinese clients, elimination and winner display. It reads the actual persisted D1 result and compares accepted-command replay with the final authoritative state after each scenario, including timeout and winner.

An isolated test Worker subclasses the production Durable Object to inject invariant-checked scenario checkpoints and a short alarm clock. It reuses production session validation, commands, projections, hibernating WebSockets, D1 persistence and broadcasting. Checkpoint setup is test scaffolding; subsequent browser commands and their saved replay are real. Its routes and clock injection are absent from the production Worker and production build. Worker tests also validate each checkpoint's physical ownership, schema and hidden reserve inside workerd.

Changed files are the shared reaction predicate; per-card engine/client/content and Workers tests; private-pack and scenario fixtures; the isolated browser Worker/configuration; matrix generator; Vitest/Playwright test registration; package script and documentation. Earlier Step 24A–24C edits and private index removals are preserved.

## Final checks

| Command/check                                   | Result                                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| `npm run typecheck`                             | Exit 0                                                                                |
| `npm run lint`                                  | Exit 0                                                                                |
| `npm test`                                      | Exit 0; 2,879 passed across 31 runtime groups                                         |
| `npm run build`                                 | Exit 0                                                                                |
| `npm run test:e2e`                              | Exit 0; 31 passed: 24 main, 1 development, 2 RDI1 production, 4 combined production   |
| `npm run content:verify:rdi2-source`            | Exit 0; all 44 mechanics and 23 Drink records verified for the locked project ruleset |
| `npm run content:verify:rdi2`                   | Exit 0; 40/40/40/40 Character cards and 30 Drinks; no unknown effects                 |
| `npm run content:verify:rdi1-rdi2`              | Exit 0; eight Character decks of 40 and two Drink decks of 30                         |
| `npm run content:verify:zh-TW`                  | Exit 0; 462/462 translated fields, zero issues                                        |
| `npm run content:coverage:rdi2 -- --check`      | Exit 0; 116/116 exact matrix rows, 190/190 physical copies                            |
| `npm run content:verify:rdi1-rdi2 -- --read-d1` | Exit 0; immutable local D1 graph matches; original RDI1 editions preserved            |
| `npm run verify:build`                          | Exit 0; 13 production files have identical SHA-256 hashes                             |

The first full browser run failed the existing preview test's native End-key scroll assertion. That test passed independently and the complete browser suite then passed without changing the test or production preview. Early focused failures corrected test assumptions about the source-locked Ogre Brew value, the preserved gambling participant roster, a browser selection/start race and a settlement checkpoint that had already finished; no source mechanic was inferred or changed.

## Scope

`npm run test:coverage` exits 0 with the same 2,879 passing tests in 31 groups. Aggregate coverage is 99.51% statements, 97.82% branches, 99.72% functions and 99.66% lines. All 96 measured production files satisfy every existing per-file 90% gate. Runtime integrations execute inside workerd through the Cloudflare Vitest plugin.

`git diff --check` and review pass. The isolated test routes are absent from the final production build. No secrets, private card prose, artwork or local machine paths were added to tracked output; private sources, generated packs, logs and coverage artifacts remain ignored. Source and compiled validators pass unchanged.

Team-game runtime and M21 team acceptance remain the user-authorized non-blocking TODO. Edition completeness applies to these eight characters; the separate 76-character full-catalog release gate still requires the other 68 characters. Private inputs are required for CI; missing inputs fail rather than substitute sample content.

Step 25 is safe to begin for this eight-character project ruleset when requested. It has not started.

# RDI1 fresh re-audit — 2026-10-05

**COMPLETE after the user-authorized 20-point cap correction. RDI2 was not started.**

All 40 source mechanic rows and all 18 Drink definitions pass individual comparison with the supplied fresh ledger. Their quantities remain 40 per character / 160 character cards / 30 Drinks. The runtime stat-limit conflict is resolved, all required checks pass, and both immutable versions pass local D1 round-trip verification.

## Stat-limit conflict and authorized correction

The initial re-audit stopped when the [Fifteenth Edition rules](https://slugfestgames.com/wp-content/uploads/2021/10/RDI1-15thEd.pdf), page 4, proved that Fortitude and Alcohol Content must stay between 0 and 20, while production defaults allowed 100. The user then instructed: "cap at 20".

Before editing the defaults, five new regression cases reproduced the conflict: healing at 19 and 20 exceeded the limit, Alcohol reached 23, a healing/payment action healed to 22, and a new match retained 100-point bounds. The initial cap/snapshot run had 5 failures and 30 passes. [DEFAULT_RULES](../src/engine/rules.ts) now sets both maxima to 20. Gold remains nonnegative with no default maximum. The existing generic stat operation clamps each change and emits its actual delta; other operations, including Gold payment for capped healing, still resolve.

New production matches persist the corrected limits. Existing started rooms, snapshots and replay manifests retain their explicitly saved rules, including historical 100-point limits. A regression replays a v1 snapshot in which Wizard's Brew heals to 22; another loads historical manifest values above 20. Workers tests verify that new production bounds survive Durable Object eviction and reconnect. No card definition or published content graph was changed for this runtime correction.

The previous coverage failure is resolved by a behavioral snapshot-validation regression: valid deferred contest pass-out players restore, while duplicate, unknown and oversized lists are rejected. Per-file thresholds remain unchanged. The additional contest-at-cap test proves that a Drink scoring 4 still wins when its owner's actual Alcohol increases by only 1 to reach 20, and that winner Gold is paid before pass-out redistribution.

## Source and immutable versions

- Original source SHA-256: `91357d8e03180e397caf760ac0fbadac9c1260a79a89eeea81751ea5619b2156`.
- Corrected source SHA-256: `12412c1a6deea2729c78667ae7bccead734f0590dcc84c33e4dcd2b50a3982d7`.
- Original immutable version: `content_rdi1_mechanics_v1`; its published graph and original private `pack.json` were not overwritten.
- Corrected version: `content_rdi1_mechanics_v2`; separately compiled to the ignored private `pack-content_rdi1_mechanics_v2.json`.
- The v1 archive preserves the original source, pack, source lock, and all six locked input files. Each archived input matches its original locked hash. Keep this ignored archive with your private content backups.
- The new source lock and v2 artifact were created after the individual source checks, correction regressions, Node/UI suite, typecheck, and lint passed. The stat-limit conflict was identified later during broader review.
- Browser E2E setup published and activated v2 in local D1 before that conflict was identified. The immutable v2 record remains present locally and now passes the completed re-audit. Local production selection was restored to v1. Nothing was remotely deployed.

## Confirmed corrections applied

- New matches cap Fortitude and Alcohol Content at 20, preserving existing pinned room/replay rules and independent contest scores.
- Current rules metadata points to Fifteenth Edition; Twelfth Edition remains historical. Quantity evidence is explicitly secondary.
- The all-player action uses the central Inn deck, including its actor, preserving personal Drink piles. Generic source metadata selects this behavior; central refill payments are enforced.
- The extra-Drink Sometimes specifies the post-Chaser opportunity. The authoritative builder completes the entire chain before exposing response legality or a prompt.
- The Drink-change counter requires a Sometimes source, recognizes numeric modification / Negate / Ignore / pass / split, rejects the specified excluded categories, and permits only the protected hard-counter family to affect it.
- Current-policy contests ignore revealed Events, preserve signed modified original scores until final flooring at zero, exclude extra/copied Drinks from scoring, and defer consumption until every Drink response window closes. Ties exclude passed-out contestants; contest payment precedes deferred pass-out Gold redistribution. Refill payment can leave a contestant broke until winning Gold rescues them.
- Round on the House keeps complete Chasers, skips Events during source selection, creates independent copies before modification, and uses the current Inn refill policy. Its source summary is explicit.
- Each mechanic records a ledger-matched evidence tier. Exactly-one-Gold Inn substitution remains unchanged and retains limited primary wording evidence.
- Optional structured fields preserve legacy operation behavior and old snapshots. Scripts refuse recompiling or republishing historical v1, write v2 separately, verify either D1 version explicitly, and separate publication from activation.

## Independent reproduction before edits

The additive schema fields are `FORCE_SIMULTANEOUS_DRINK.source`, `DRINKING_CONTEST.rules` (`drinkEvents: IGNORE`, `scoring: REVEALED_WITH_MODIFIERS`, `settlement: AFTER_CONTEST`), `ROUND_ON_HOUSE.payForRefill`, and card `allowedCounterFamilies`. Omitted fields retain legacy behavior. Optional snapshot fields preserve deferred Drink consumption and deferred contest pass-outs; clients cannot submit these authoritative fields. The normalized source's explicit `contentVersion` selects v2; historical v1 verification reads its archived source and lock.

The original source SHA matched exactly. Every mechanic’s type, bilingual summary, and four character quantities was compared with the JSON ledger, fresh CSV ledger, and existing mechanics matrix; zero quantities were checked individually. Every Drink’s quantity, type, Alcohol, Fortitude and Chaser value was compared separately. The results were 40 unique mechanics, 18 unique Drinks, 40/40/40/40 character cards and 30 Drinks, with no quantity mismatch. The original source-verification command passed before any source correction.

The supplied JSON ledger is named `verification-ledger (1).json`; the verifier supports that supplied filename and the canonical `verification-ledger.json` name. Its original evidence bytes were retained. The four initial source/behavior regression failures and the additional simultaneous-consumption ordering failure were reproduced before their respective corrections.

## Every mechanic: final source audit status

**PASS below means per-row source/type/quantity/evidence consistency. Runtime regression, coverage, browser and content gates now all pass.** Quantities are ordered Deirdre / Fiona / Gerki / Zot.

| Ledger | Mechanic                                   | Quantities    | Evidence tier                                    | Source audit |
| ------ | ------------------------------------------ | ------------- | ------------------------------------------------ | ------------ |
| M01    | `gambling_start_or_control`                | 6 / 6 / 6 / 6 | CURRENT_OFFICIAL_DIRECT                          | PASS         |
| M02    | `gambling_raise_one`                       | 2 / 2 / 2 / 2 | CURRENT_OFFICIAL_DIRECT                          | PASS         |
| M03    | `gambling_winning_hand`                    | 2 / 2 / 2 / 2 | CURRENT_OFFICIAL_DIRECT                          | PASS         |
| M04    | `cheat_take_control`                       | 0 / 0 / 3 / 3 | FRESH_COMPLETE_MATRIX_PLUS_CURRENT_GENERIC_RULES | PASS         |
| M05    | `cheat_control_and_eject`                  | 0 / 0 / 1 / 1 | FRESH_COMPLETE_MATRIX_PLUS_CURRENT_GENERIC_RULES | PASS         |
| M06    | `anti_cheat_win_round`                     | 1 / 1 / 0 / 0 | FRESH_COMPLETE_MATRIX_PLUS_CURRENT_GENERIC_RULES | PASS         |
| M07    | `dump_gambling_pot_to_inn`                 | 1 / 1 / 1 / 1 | CURRENT_OFFICIAL_DIRECT                          | PASS         |
| M08    | `steal_winners_pot`                        | 0 / 0 / 1 / 0 | CURRENT_OFFICIAL_DIRECT                          | PASS         |
| M09    | `substitute_one_gold_from_inn`             | 2 / 2 / 2 / 1 | LIMITED_PRIMARY_CARD_TEXT                        | PASS         |
| M10    | `take_one_from_pot`                        | 0 / 0 / 1 / 0 | LATER_OFFICIAL_CROSSCHECK                        | PASS         |
| M11    | `avoid_ante_leave`                         | 2 / 2 / 0 / 0 | FRESH_COMPLETE_MATRIX_PLUS_CURRENT_GENERIC_RULES | PASS         |
| M12    | `avoid_ante_leave_or_ignore_drink`         | 1 / 0 / 0 / 2 | FRESH_COMPLETE_MATRIX_PLUS_CURRENT_GENERIC_RULES | PASS         |
| M13    | `avoid_ante_leave_or_ignore_drink_pay_one` | 0 / 0 / 0 / 1 | FRESH_COMPLETE_MATRIX_PLUS_CURRENT_GENERIC_RULES | PASS         |
| M14    | `ignore_card_all_stats_or_drink`           | 0 / 0 / 1 / 0 | FRESH_COMPLETE_MATRIX_PLUS_CURRENT_GENERIC_RULES | PASS         |
| M15    | `ignore_card_all_stats`                    | 0 / 0 / 0 / 1 | CURRENT_OFFICIAL_DIRECT                          | PASS         |
| M16    | `ignore_action_sometimes_fort_alcohol`     | 1 / 0 / 1 / 0 | FRESH_COMPLETE_MATRIX_PLUS_CURRENT_GENERIC_RULES | PASS         |
| M17    | `ignore_action_sometimes_fort_loss`        | 2 / 2 / 0 / 1 | FRESH_COMPLETE_MATRIX_PLUS_CURRENT_GENERIC_RULES | PASS         |
| M18    | `negate_sometimes_counter`                 | 1 / 1 / 1 / 1 | CURRENT_OFFICIAL_DIRECT                          | PASS         |
| M19    | `ignore_drink`                             | 0 / 2 / 3 / 1 | FRESH_COMPLETE_MATRIX_PLUS_CURRENT_GENERIC_RULES | PASS         |
| M20    | `order_two_extra_drinks`                   | 2 / 2 / 2 / 2 | FRESH_COMPLETE_MATRIX_PLUS_CURRENT_GENERIC_RULES | PASS         |
| M21    | `all_players_drink_now`                    | 1 / 0 / 0 / 0 | LATER_OFFICIAL_CROSSCHECK                        | PASS         |
| M22    | `force_extra_drink_on_reveal`              | 0 / 1 / 0 / 0 | CURRENT_OFFICIAL_DIRECT                          | PASS         |
| M23    | `force_other_player_drink_now`             | 0 / 1 / 0 / 1 | FRESH_COMPLETE_MATRIX_PLUS_CURRENT_GENERIC_RULES | PASS         |
| M24    | `pass_own_drink`                           | 1 / 0 / 0 / 1 | CURRENT_OFFICIAL_DIRECT                          | PASS         |
| M25    | `split_own_drink`                          | 0 / 1 / 0 / 0 | CURRENT_OFFICIAL_DIRECT                          | PASS         |
| M26    | `alcohol_to_fortitude`                     | 0 / 1 / 0 / 0 | LATER_OFFICIAL_CROSSCHECK                        | PASS         |
| M27    | `add_two_alcohol_to_drink`                 | 2 / 0 / 2 / 0 | CURRENT_OFFICIAL_DIRECT                          | PASS         |
| M28    | `reduce_drink_alcohol_two`                 | 1 / 0 / 0 / 0 | FRESH_COMPLETE_MATRIX_PLUS_CURRENT_GENERIC_RULES | PASS         |
| M29    | `negate_drink_change_card`                 | 1 / 1 / 1 / 1 | CURRENT_OFFICIAL_DIRECT                          | PASS         |
| M30    | `damage_one`                               | 1 / 3 / 0 / 1 | FRESH_COMPLETE_MATRIX_PLUS_CURRENT_GENERIC_RULES | PASS         |
| M31    | `damage_two`                               | 4 / 3 / 4 / 5 | FRESH_COMPLETE_MATRIX_PLUS_CURRENT_GENERIC_RULES | PASS         |
| M32    | `damage_three`                             | 0 / 1 / 2 / 0 | FRESH_COMPLETE_MATRIX_PLUS_CURRENT_GENERIC_RULES | PASS         |
| M33    | `damage_all_others_one`                    | 0 / 0 / 0 / 2 | FRESH_COMPLETE_MATRIX_PLUS_CURRENT_GENERIC_RULES | PASS         |
| M34    | `hit_back_two_after_loss`                  | 1 / 2 / 0 / 1 | CURRENT_OFFICIAL_DIRECT                          | PASS         |
| M35    | `gain_two_fortitude`                       | 2 / 1 / 0 / 0 | FRESH_COMPLETE_MATRIX_PLUS_CURRENT_GENERIC_RULES | PASS         |
| M36    | `heal_other_charge_gold`                   | 1 / 0 / 0 / 0 | CURRENT_OFFICIAL_DIRECT                          | PASS         |
| M37    | `heal_all_and_collect`                     | 1 / 0 / 0 / 0 | FRESH_COMPLETE_MATRIX_PLUS_CURRENT_GENERIC_RULES | PASS         |
| M38    | `collect_one_from_each_other`              | 0 / 1 / 1 / 1 | FRESH_COMPLETE_MATRIX_PLUS_CURRENT_GENERIC_RULES | PASS         |
| M39    | `take_one_gold`                            | 0 / 0 / 2 / 1 | FRESH_COMPLETE_MATRIX_PLUS_CURRENT_GENERIC_RULES | PASS         |
| M40    | `tip_wench`                                | 1 / 1 / 1 / 1 | CURRENT_OFFICIAL_DIRECT                          | PASS         |

## Every Drink: final source audit status

| Ledger | Drink key           | Copies | Source audit |
| ------ | ------------------- | ------ | ------------ |
| D01    | `light_ale`         | 3      | PASS         |
| D02    | `light_ale_chaser`  | 2      | PASS         |
| D03    | `dark_ale`          | 3      | PASS         |
| D04    | `dark_ale_chaser`   | 1      | PASS         |
| D05    | `dirty_dishwater`   | 1      | PASS         |
| D06    | `wine`              | 3      | PASS         |
| D07    | `wine_chaser`       | 1      | PASS         |
| D08    | `troll_swill`       | 1      | PASS         |
| D09    | `orcish_rotgut`     | 1      | PASS         |
| D10    | `elven_wine`        | 2      | PASS         |
| D11    | `elven_wine_chaser` | 1      | PASS         |
| D12    | `dragon_breath`     | 3      | PASS         |
| D13    | `water`             | 1      | PASS         |
| D14    | `wizards_brew`      | 1      | PASS         |
| D15    | `cutting_off`       | 1      | PASS         |
| D16    | `holy_water`        | 1      | PASS         |
| D17    | `drinking_contest`  | 2      | PASS         |
| D18    | `round_on_house`    | 2      | PASS         |

The two positive-Fortitude Drinks (`wizards_brew`, `holy_water`) expose the newly reported runtime cap conflict at 20 Fortitude. Their numeric source records match the ledger.

## Regression coverage

- [stat-caps.test.ts](../tests/engine/stat-caps.test.ts): 9 tests. Healing at 18/19/20; Alcohol reaching 20 and pass-out; capped healing still charges Gold; contest score and winner payment independent of capped stat deltas; new default bounds and unlimited Gold; historical v1 snapshot replay and historical manifest limits.
- [gambling-state.test.ts](../tests/engine/gambling-state.test.ts): added valid deferred pass-out snapshot restoration and duplicate/unknown/oversized list rejection.
- Existing healing, conversion, compound Drink, gambling and per-card tests use values below 20 when they need to observe an entire gain, or assert the cap when already at 20. Browser tests and the Drink demo assert 20/20 pass-out and healing at the cap. Engine and Drink documentation describes the corrected defaults and historical-rule preservation.

- [rdi1-fresh-reaudit.test.ts](../tests/engine/rdi1-fresh-reaudit.test.ts): 22 tests. Central source / personal-pile preservation / Chasers / nested Event handling / replay; no, one, multiple and Event Chasers / legal 30-second prompt; contest Event suppression / numeric modified winner / signed sober effects / pass / split / Ignore / extra-Drink exclusion / all responses before consumption / one or all tied players passing out / winner payment before redistribution / broke winner / real refill payment; House complete independent copies and individual modification; preserved v1 snapshot/replay behavior.
- [rdi1-reaudit-counters.test.ts](../tests/engine/rdi1-reaudit-counters.test.ts): 13 tests. Five positive source categories; every specified negative category; non-Sometimes sources; protected-family acceptance and forged-command rejection without mutation.
- [rdi1-reaudit.test.ts](../tests/content/rdi1-reaudit.test.ts): 29 tests. Every one of the 58 records; balanced quantity swaps; independent type/summary/evidence/number/Chaser/policy failures; malformed and duplicate ledgers; unresolved markers; limited exactly-one-Gold evidence; exact preserved v1 bytes and graph; separate v2 artifact and unchanged original pack.
- [rdi1-content.test.ts](../tests/worker/rdi1-content.test.ts): actual Workers-runtime D1 and Durable Object checks, including both immutable versions, v2 graph round-trip, old v1 room start, eviction and reconnect after selecting v2.
- Existing per-card engine/UI tests now exercise the corrected source. The per-card UI audio fixture mocks buffered music consistently with the existing audio-policy suite; real decoding/looping remains tested in browser/audio tests.
- The full test harness initializes Workers test files separately after reproducing combined-pool startup stalls. All configured tests run. Coverage maps are merged across all runs and the original per-file 90% gates are enforced on the aggregate; thresholds were not lowered.

## Required command results

These are the final reruns after the cap correction. Five cap failures were reproduced before editing; initial E2E reruns also caught stale demo and healing assertions, which were corrected. All final commands below exited successfully.

| Command                                                                                                    | Exact final result                                                                                                   |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `npm run content:verify:rdi1-source`                                                                       | Exit 0; lock matches; all 40 mechanic and 18 Drink rows PASS; no unresolved markers.                                 |
| `npm run content:compile:rdi1 -- --version content_rdi1_mechanics_v2`                                      | Exit 0; separate private v2 artifact; 160 character / 30 Drink cards.                                                |
| `npm run content:verify:rdi1 -- --version content_rdi1_mechanics_v2`                                       | Exit 0; zero unknown mechanics/effects, missing translations, unstructured Sometimes or sample production records.   |
| `npm run content:verify:zh-TW -- --input content-private/imports/rdi1/pack-content_rdi1_mechanics_v2.json` | Exit 0; content and UI localization valid; no missing fields/issues.                                                 |
| `npm run typecheck`                                                                                        | Exit 0; engine, client, Worker, Node and test configurations.                                                        |
| `npm run lint`                                                                                             | Exit 0; ESLint and Prettier. Supplied audit evidence is excluded from formatting to retain its bytes.                |
| `npm test`                                                                                                 | Exit 0; 1621 tests across 26 sub-runs; all configured projects/files executed.                                       |
| `npm run test:coverage`                                                                                    | Exit 0; aggregate statements 99.45%, branches 98.21%, functions 99.5%, lines 99.61%. Every per-file 90% gate passes. |
| `npm run build`                                                                                            | Exit 0; production build succeeds.                                                                                   |
| `npm run test:e2e`                                                                                         | Exit 0; 24 standard journeys, 1 development selection journey, 2 production RDI1 journeys: 27 total.                 |
| `npm run content:verify:rdi1 -- --activate content_rdi1_mechanics_v1`                                      | Exit 0 after E2E; v1 source/graph verified and local production restored to v1.                                      |
| `npm run content:verify:rdi1 -- --version content_rdi1_mechanics_v1 --read-d1`                             | Exit 0; original v1 D1 graph equals preserved source.                                                                |
| `npm run content:verify:rdi1 -- --version content_rdi1_mechanics_v2 --read-d1`                             | Exit 0; local v2 D1 graph equals corrected source; no activation.                                                    |
| `git diff --check`                                                                                         | Exit 0; diff inspected.                                                                                              |

The local D1 v2 publication occurred through the E2E web-server command, which explicitly runs `content:publish:rdi1 -- --version content_rdi1_mechanics_v2`, followed by explicit activation for testing. Neither command deletes v1. Both versions subsequently passed independent read-only D1 verification. The final selection is v1.

## Review and remaining limitations

Reviewed the source/effect schema, compiler, authoritative timing/counter predicates, batch workflow, replay schemas/invariants, scripts, tests and git diff. No character/card-title dispatch was added to the generic engine. Rejected commands remain mutation-free and hidden state remains server-owned. No secrets, private source/pack/archive, licensed card prose, or artwork were added to tracked files. Existing worktree changes from earlier tasks were retained.

The source audit retains secondary quantity evidence and the explicitly limited primary wording for exactly-one-Gold substitution. Full original printed card prose and artwork were not supplied or republished. The official stat-limit conflict and coverage failure are resolved. The RDI1 re-audit correction step is complete; a later step may begin only when explicitly instructed. RDI2 remains untouched. Existing started matches retain historical bounds; new matches use 20-point limits. The pre-test local production selection remains v1; v2 is separately published and verified locally, ready for explicit activation. No remote deployment was performed.

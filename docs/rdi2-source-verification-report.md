# RDI2 Step 24A source verification report

**Step 24A COMPLETE.** Audit date: 2026-10-07 (Asia/Taipei). No Step 24B work was started.

Mechanics: **44/44**. Drinks: **23/23**. Dimli/Eve/Fleck/Gog: **40 physical cards each**; character total **160**. Drink Deck: **30 physical cards**. Unresolved source blockers: **0**.

## Evidence and new user decisions

The [final user instruction](../codex-prompts/step-24a-final-source-lock-resolution.md) is preserved byte-for-byte with SHA-256 `0e350c803247046aacb5bcdd5928583449bc59bbc38acdcbe588991fcbd4c19a`. Each ten-row resolution is independently checked and labeled:

- **M41 USER OVERRIDE — Gog physical identity and normalized mechanic**: one Action, each other applicable player pays owner one Gold, standard shared collection; printed Gog title unavailable and explicitly waived. Its fallback display is non-physical.
- **M44 USER OVERRIDE — provenance only**: Gog owns one standard Tip the Wench. copy. Publisher-verified Anytime, pick-a-player (including self), and one Gold to Inn are unchanged.
- **D03 USER OVERRIDE**: Dirty Dishwater, normal Drink, Alcohol 0/Fortitude -1, no Chaser or additional effect.
- **D14 USER OVERRIDE**: ordinary +2 Alcohol/-1 Fortitude; OGRE or HALF_OGRE replaces the entire numeric effect with +3 Alcohol/0 Fortitude.
- **D15 USER OVERRIDE**: ordinary 0 Alcohol/-2 Fortitude; ORC replaces the entire numeric effect with +2 Alcohol/0 Fortitude. Publisher ordinary Fortitude loss stays separately verified.
- **D17 USER OVERRIDE**: The Challenge! Event; decline ends without draw/payment/penalty; accept two independent Inn-deck Drinks. Leading Events discard/restart base search; Event as Chaser discards/ends chain. Complete each chain before shared responses. No retroactive Event Ignore; success and payout only after both Drinks/responses/legal rescues and survival check. Modern publisher example/shared timing keep their authority.
- **D18 USER OVERRIDE**: ordinary +1 Alcohol/-1 Fortitude; TROLL replaces the entire effect with +2 Alcohol/0 Fortitude. Publisher ordinary values stay verified.
- **D19 USER OVERRIDE**: Water is a normal no-effect/no-Chaser Drink, printed Alcohol 0.
- **D20 USER OVERRIDE**: We're Cutting You Off!, Alcohol -1/Fortitude 0, no Chaser/extra effect. Signed Drink value, player Alcohol floor 0 and Contest comparison floor 0 retain shared publisher rules.
- **D23 USER OVERRIDE**: Wizard's Brew, +2 Alcohol/+2 Fortitude, no Chaser, trait, cost or additional restriction.

All quantities are one for these eight Drink records. Publisher/shared rules, matrix quantities and user decisions retain distinct authority; no new publisher Gog scan or complete original wording is claimed. Existing overrides and the previously qualified gameplay records are unchanged.

The user's later [team-mode decision](../codex-prompts/step-24a-team-mode-nonblocking-todo.md) states: “keep team mode a TODO, not blocking for any step”. M21 source review is complete; test J and team runtime remain pending, non-blocking for all steps. No team-runtime implementation or passing team test is claimed. No M21 gameplay rule changed.

## Independent re-audit

Fresh original Dimli/Eve/Fleck downloads reproduce the three supplied full-file hashes and each 40-card deck. Every current ledger original-card record hash and cited cached artifact hash reproduces. All 67 rows independently pass their seven mechanic or five Drink checks (423 checks total), evidence/source links, exact quantity distributions, card classifications, effects, targets, timing and current-edition rules. Every source operation is registered, every mechanic/special-mechanic reference resolves, and each Sometimes has structured legality.

The verifier rejects coordinated source/review effect forgery, additive trait replacement, retained normal Fortitude loss after replacement, altered Challenge timing/search/survival/payout, fake printed titles, broadening overrides, fabricated publisher evidence, changed counter restrictions, missing rows and stale locks. The 57 prior source/gameplay rows retain their data; M21 changes only completion/workflow metadata under the explicit new decision.

The detailed private row receipt is `content-private/imports/rdi2/final-row-reaudit.json`. The original/private ledger retains historical blocker reviews separately from current passing reviews.

## Immutable artifacts

- `content-private/imports/rdi2/source-normalized.json`: generated, `SOURCE_LOCKED_FOR_PROJECT_RULESET`, independently verified. SHA-256: `f56289e545573f02db93f6cd51dfa59df388668a0fcaaa938e21b6e56191bc29`.
- `content-private/imports/rdi2/verification-ledger.json`: SHA-256 `5ff240ebacbf2b0cd697f44ff670d21a3c2f099da56d1c4c9f1e05263e6511fe`.
- `reference/rdi2/rdi2-mechanics-matrix.csv`: SHA-256 `7edc87560666234a3dc37007212a6cd8b22a37c5c86d94248bfb738d5bc21e7d`.
- `content-private/imports/rdi2/source-lock.json`: generated using actual byte hashes, current UTC date and source/version identifiers; 44 mechanics, 160 character cards, 30 Drink cards, unresolvedCount 0. Read-back and subsequent separate validation pass.

A repeated lock command is rejected without changing either artifact. The validator and all coverage gates remain strict. Private artifacts stay on disk and are Git-ignored per AGENTS.md; transfer them separately when moving the workspace.

## Required checks

| Command                                                               | Final result                                                                         |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `node .tools/step24a-source-lock-resolution/audit.mjs`                | PASS — every M01–M44/D01–D23 independently rechecked                                 |
| `npm run content:verify:rdi2-source -- --check-lock`                  | PASS — zero errors; no artifact written during preflight                             |
| `npm run content:verify:rdi2-source -- --lock`                        | PASS — actual hashes, exclusive writes, read-back verification                       |
| `npm run content:verify:rdi2-source`                                  | PASS — final normalized source and lock, zero errors                                 |
| `node .tools/step24a-source-lock-resolution/immutable-lock-check.mjs` | PASS — repeated --lock rejected; both files unchanged                                |
| `node .tools/step24a-source-lock-resolution/private-preservation.mjs` | PASS — 17 private files retained; all immutable RDI1 release source hashes match     |
| `npx vitest run --project contracts rdi2`                             | PASS — 62 files, 822 tests                                                           |
| `npm run typecheck`                                                   | PASS                                                                                 |
| `npm run lint`                                                        | PASS                                                                                 |
| `npm test`                                                            | PASS — 2445 tests, 26 subruns including actual Workers/Durable Objects/D1/WebSockets |
| `npm run test:coverage`                                               | PASS — 2445 tests, 91 covered files; unchanged >=90% per-file gates                  |
| `npm run build`                                                       | PASS                                                                                 |
| `npm run test:e2e`                                                    | PASS — 27 browser tests (24 + 1 + 2)                                                 |
| `git diff --check; git diff --cached --check`                         | PASS                                                                                 |

Coverage: statements **99.54%**, branches **98.02%**, functions **99.69%**, lines **99.67%**. All 91 files satisfy all four unchanged per-file 90% thresholds.

Earlier diagnostic source checks correctly failed before the authorized decisions. The first coverage run overlapped verifier changes; the final frozen-code rerun passes and is the result reported here.

## Changes and review

This final instruction changes the candidate/ledger for the ten named rows plus M21 workflow metadata, adds final-resolution and team-decision evidence, adds the strict source-resolution validator, and completes the immutable source CLI workflow. Tests cover exact overrides, classification separation, all trait and Challenge boundaries, graph validity and scoped team deferral; earlier source checkpoint counts are updated. Reference evidence, overrides, capability audit, checklist, the private import README and these reports are updated.

Current-task public files: `.gitignore`, `.prettierignore`, `src/content/rdi2-source.ts`, `src/content/rdi2-final-resolution.ts`, `scripts/rdi2-source.ts`, the two new `codex-prompts/step-24a-*` evidence files, `reference/rdi2/{known-overrides.md,source-evidence.md,verification-checklist.md,rdi2-card-matrix.md,required-engine-capabilities.json}`, `tests/content/rdi2-final-resolution.test.ts`, and the existing RDI2 source checkpoint tests for Drinks/final mechanics/M21/M22/M27/M31/M33/M37/M40/M41/general source.

Private inputs are excluded from Git again to satisfy the existing privacy test and AGENTS.md. **17 index removals are staged; all 17 files remain on disk.** All original RDI1 release source hashes still match their immutable lock. No commit was created. Earlier Step 24A workspace changes remain present. The complete tracked diff, private-input changes, staged index removals and new files were reviewed; no secrets, new copyrighted full-text database, local-user paths, client authority bypass or debug logs are introduced. Production RDI2 compilation/runtime capability work remains for the separately authorized next step.

## All individual rows

Mechanic quantities below are Dimli/Eve/Fleck/Gog; Drink quantities are physical copies. Every row is VERIFIED or VERIFIED_FOR_PROJECT_RULESET with the classification preserved in the ledger.

| Ledger | Mechanic / Drink                              | Type        | Quantity | Checks   |
| ------ | --------------------------------------------- | ----------- | -------- | -------- |
| M01    | `gambling_start_or_control`                   | GAMBLING    | 6/6/6/6  | 7/7 PASS |
| M02    | `gambling_raise_one`                          | GAMBLING    | 2/2/2/2  | 7/7 PASS |
| M03    | `gambling_winning_hand`                       | GAMBLING    | 2/2/2/2  | 7/7 PASS |
| M04    | `cheat_take_control`                          | CHEATING    | 0/3/4/0  | 7/7 PASS |
| M05    | `cheat_control_and_eject`                     | CHEATING    | 0/1/1/0  | 7/7 PASS |
| M06    | `anti_cheat_win_round`                        | SOMETIMES   | 0/0/0/1  | 7/7 PASS |
| M07    | `dump_gambling_pot_to_inn`                    | SOMETIMES   | 1/1/1/1  | 7/7 PASS |
| M08    | `restart_gambling_round`                      | SOMETIMES   | 1/0/0/0  | 7/7 PASS |
| M09    | `substitute_payment_from_inn`                 | SOMETIMES   | 2/0/2/2  | 7/7 PASS |
| M10    | `illusionary_payment`                         | SOMETIMES   | 0/2/0/0  | 7/7 PASS |
| M11    | `take_one_from_pot`                           | SOMETIMES   | 0/1/0/0  | 7/7 PASS |
| M12    | `avoid_ante_leave`                            | SOMETIMES   | 2/0/1/2  | 7/7 PASS |
| M13    | `avoid_ante_leave_or_ignore_drink`            | SOMETIMES   | 1/1/1/1  | 7/7 PASS |
| M14    | `ignore_card_all_stats`                       | SOMETIMES   | 0/2/0/1  | 7/7 PASS |
| M15    | `ignore_card_fortitude`                       | SOMETIMES   | 1/0/0/2  | 7/7 PASS |
| M16    | `negate_sometimes_counter`                    | SOMETIMES   | 1/1/1/1  | 7/7 PASS |
| M17    | `ignore_drink`                                | SOMETIMES   | 2/2/2/2  | 7/7 PASS |
| M18    | `order_two_extra_drinks_paid`                 | SOMETIMES   | 2/2/0/2  | 7/7 PASS |
| M19    | `order_two_extra_drinks_free_or_waive_refill` | SOMETIMES   | 0/0/2/0  | 7/7 PASS |
| M20    | `all_players_drink_from_inn`                  | ACTION      | 0/0/1/0  | 7/7 PASS |
| M21    | `force_extra_drink_during_other_drink_phase`  | SOMETIMES   | 1/0/0/2  | 7/7 PASS |
| M22    | `pass_own_drink`                              | SOMETIMES   | 2/0/0/0  | 7/7 PASS |
| M23    | `split_own_drink`                             | SOMETIMES   | 1/0/2/0  | 7/7 PASS |
| M24    | `alcohol_to_fortitude`                        | SOMETIMES   | 1/0/0/0  | 7/7 PASS |
| M25    | `add_two_alcohol_to_drink`                    | SOMETIMES   | 2/0/0/0  | 7/7 PASS |
| M26    | `replace_drink_with_four_alcohol`             | SOMETIMES   | 0/1/0/0  | 7/7 PASS |
| M27    | `negate_drink_change_card`                    | SOMETIMES   | 1/1/1/1  | 7/7 PASS |
| M28    | `all_lose_one_alcohol_collect_one_each_other` | ACTION      | 0/0/1/0  | 7/7 PASS |
| M29    | `give_two_alcohol`                            | ACTION      | 0/2/0/0  | 7/7 PASS |
| M30    | `damage_one`                                  | ACTION      | 1/2/1/0  | 7/7 PASS |
| M31    | `damage_two`                                  | ACTION      | 5/0/2/5  | 7/7 PASS |
| M32    | `damage_three`                                | ACTION      | 0/2/0/0  | 7/7 PASS |
| M33    | `damage_three_pay_inn_one`                    | ACTION      | 0/0/0/1  | 7/7 PASS |
| M34    | `damage_four`                                 | ACTION      | 0/0/0/1  | 7/7 PASS |
| M35    | `damage_all_others_one`                       | ACTION      | 0/0/0/1  | 7/7 PASS |
| M36    | `rowdy_song`                                  | ACTION      | 0/0/2/0  | 7/7 PASS |
| M37    | `hit_back_two_after_loss`                     | SOMETIMES   | 1/0/1/1  | 7/7 PASS |
| M38    | `share_pain`                                  | SOMETIMES   | 0/1/0/0  | 7/7 PASS |
| M39    | `redirect_fortitude_loss`                     | SOMETIMES   | 0/1/0/0  | 7/7 PASS |
| M40    | `gain_two_fortitude`                          | ANYTIME     | 0/0/1/1  | 7/7 PASS |
| M41    | `collect_one_from_each_other`                 | ACTION      | 1/1/1/1  | 7/7 PASS |
| M42    | `take_one_gold`                               | ANYTIME     | 0/2/0/0  | 7/7 PASS |
| M43    | `take_two_gold`                               | ACTION      | 0/0/1/0  | 7/7 PASS |
| M44    | `tip_wench`                                   | ANYTIME     | 1/1/1/1  | 7/7 PASS |
| D01    | `dark_ale`                                    | DRINK       | 2        | 5/5 PASS |
| D02    | `dark_ale_chaser`                             | DRINK       | 1        | 5/5 PASS |
| D03    | `dirty_dishwater`                             | DRINK       | 1        | 5/5 PASS |
| D04    | `dragon_breath_ale`                           | DRINK       | 1        | 5/5 PASS |
| D05    | `drinking_contest`                            | DRINK_EVENT | 2        | 5/5 PASS |
| D06    | `dwarven_firewater`                           | DRINK       | 2        | 5/5 PASS |
| D07    | `elven_wine`                                  | DRINK       | 2        | 5/5 PASS |
| D08    | `elven_wine_chaser`                           | DRINK       | 1        | 5/5 PASS |
| D09    | `fine_ambrosia`                               | DRINK_EVENT | 1        | 5/5 PASS |
| D10    | `holy_water`                                  | DRINK       | 1        | 5/5 PASS |
| D11    | `light_ale`                                   | DRINK       | 2        | 5/5 PASS |
| D12    | `light_ale_chaser`                            | DRINK       | 1        | 5/5 PASS |
| D13    | `mead`                                        | DRINK       | 1        | 5/5 PASS |
| D14    | `ogre_brew`                                   | DRINK       | 1        | 5/5 PASS |
| D15    | `orcish_rotgut`                               | DRINK       | 1        | 5/5 PASS |
| D16    | `round_on_house`                              | DRINK_EVENT | 2        | 5/5 PASS |
| D17    | `the_challenge`                               | DRINK_EVENT | 1        | 5/5 PASS |
| D18    | `troll_swill`                                 | DRINK       | 1        | 5/5 PASS |
| D19    | `water`                                       | DRINK       | 1        | 5/5 PASS |
| D20    | `cutting_off`                                 | DRINK       | 1        | 5/5 PASS |
| D21    | `wine`                                        | DRINK       | 2        | 5/5 PASS |
| D22    | `wine_chaser`                                 | DRINK       | 1        | 5/5 PASS |
| D23    | `wizards_brew`                                | DRINK       | 1        | 5/5 PASS |

## git status --short

The following is the complete workspace status, including prior Step 24A work. `D` under private imports means an index removal, not a missing on-disk file. Generated private artifacts are intentionally ignored.

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
D  content-private/imports/rdi2/source-candidate.json
D  content-private/imports/rdi2/verification-ledger.json
 M package.json
 M reference/rdi2/known-overrides.md
 M reference/rdi2/rdi2-card-matrix.md
 M reference/rdi2/rdi2-mechanics-matrix.csv
 M reference/rdi2/required-engine-capabilities.json
 M reference/rdi2/source-evidence.md
 M reference/rdi2/verification-checklist.md
 M src/content/reaction-triggers.ts
 M src/engine/card-effects-validation.ts
 M src/engine/model.ts
 M src/engine/reaction-legality.ts
 M src/engine/resolution-state.ts
 M src/engine/source-capabilities.ts
 M src/engine/timing.ts
 M src/engine/workflow-state.ts
 M src/engine/workflows.ts
 M tests/engine/rdi1-reaudit-counters.test.ts
 M tests/worker/replay.test.ts
 M vitest.config.ts
?? codex-prompts/step-24a-complete-audit-skip-unverified.md
?? codex-prompts/step-24a-final-source-lock-resolution.md
?? codex-prompts/step-24a-m09-unblock.md
?? codex-prompts/step-24a-m12-user-override.md
?? codex-prompts/step-24a-m15-user-override.md
?? codex-prompts/step-24a-m18-user-override.md
?? codex-prompts/step-24a-m21-user-override.md
?? codex-prompts/step-24a-m27-gog-provenance-override.md
?? codex-prompts/step-24a-m27-official-evidence-unblock.md
?? codex-prompts/step-24a-m31-gog-identity-normalization.md
?? codex-prompts/step-24a-m33-payment-semantics-resolution.md
?? codex-prompts/step-24a-m37-retaliation-user-override.md
?? codex-prompts/step-24a-m40-gog-healing-user-override.md
?? codex-prompts/step-24a-source-audit-continuation.md
?? codex-prompts/step-24a-team-mode-nonblocking-todo.md
?? docs/rdi2-source-verification-report.md
?? docs/rdi2-step24a-final-audit-pass.md
?? docs/rdi2-step24a-final-source-resolution.md
?? docs/rdi2-step24a-m13-progress.md
?? docs/rdi2-step24a-m14-progress.md
?? docs/rdi2-step24a-m15-blocked.md
?? docs/rdi2-step24a-m15-progress.md
?? docs/rdi2-step24a-m16-progress.md
?? docs/rdi2-step24a-m17-progress.md
?? docs/rdi2-step24a-m18-blocked.md
?? docs/rdi2-step24a-m18-progress.md
?? docs/rdi2-step24a-m19-progress.md
?? docs/rdi2-step24a-m20-progress.md
?? docs/rdi2-step24a-m21-blocked.md
?? docs/rdi2-step24a-m21-progress.md
?? docs/rdi2-step24a-m22-m27-progress.md
?? docs/rdi2-step24a-m27-m31-progress.md
?? docs/rdi2-step24a-m27-progress.md
?? docs/rdi2-step24a-m31-m33-progress.md
?? docs/rdi2-step24a-m33-m40-progress.md
?? docs/rdi2-step24a-m40-m41-progress.md
?? docs/rdi2-step24a-progress.md
?? reference/rdi2/m09-payment-substitution-evidence.json
?? scripts/rdi2-source.ts
?? src/content/rdi2-final-resolution.ts
?? src/content/rdi2-source.ts
?? src/engine/fortitude-loss-provenance.ts
?? tests/content/rdi2-drinks-source.test.ts
?? tests/content/rdi2-final-mechanics-source.test.ts
?? tests/content/rdi2-final-resolution.test.ts
?? tests/content/rdi2-m09-source.test.ts
?? tests/content/rdi2-m10-source.test.ts
?? tests/content/rdi2-m12-source.test.ts
?? tests/content/rdi2-m13-source.test.ts
?? tests/content/rdi2-m14-source.test.ts
?? tests/content/rdi2-m15-source.test.ts
?? tests/content/rdi2-m16-source.test.ts
?? tests/content/rdi2-m17-source.test.ts
?? tests/content/rdi2-m18-source.test.ts
?? tests/content/rdi2-m19-source.test.ts
?? tests/content/rdi2-m20-source.test.ts
?? tests/content/rdi2-m21-source.test.ts
?? tests/content/rdi2-m22-source.test.ts
?? tests/content/rdi2-m23-source.test.ts
?? tests/content/rdi2-m24-source.test.ts
?? tests/content/rdi2-m25-source.test.ts
?? tests/content/rdi2-m26-source.test.ts
?? tests/content/rdi2-m27-source.test.ts
?? tests/content/rdi2-m28-source.test.ts
?? tests/content/rdi2-m29-source.test.ts
?? tests/content/rdi2-m30-source.test.ts
?? tests/content/rdi2-m31-source.test.ts
?? tests/content/rdi2-m32-source.test.ts
?? tests/content/rdi2-m33-source.test.ts
?? tests/content/rdi2-m34-source.test.ts
?? tests/content/rdi2-m35-source.test.ts
?? tests/content/rdi2-m36-source.test.ts
?? tests/content/rdi2-m37-source.test.ts
?? tests/content/rdi2-m38-source.test.ts
?? tests/content/rdi2-m39-source.test.ts
?? tests/content/rdi2-m40-source.test.ts
?? tests/content/rdi2-m41-source.test.ts
?? tests/content/rdi2-source.test.ts
?? tests/engine/rdi2-final-payment-project.test.ts
?? tests/engine/rdi2-m06-project.test.ts
?? tests/engine/rdi2-m12-project.test.ts
?? tests/engine/rdi2-m15-project.test.ts
?? tests/engine/rdi2-m16-source.test.ts
?? tests/engine/rdi2-m17-source.test.ts
?? tests/engine/rdi2-m18-project.test.ts
?? tests/engine/rdi2-m19-source.test.ts
?? tests/engine/rdi2-m20-source.test.ts
?? tests/engine/rdi2-m21-project.test.ts
?? tests/engine/rdi2-m22-source.test.ts
?? tests/engine/rdi2-m23-source.test.ts
?? tests/engine/rdi2-m24-source.test.ts
?? tests/engine/rdi2-m25-source.test.ts
?? tests/engine/rdi2-m27-source.test.ts
?? tests/engine/rdi2-m28-source.test.ts
?? tests/engine/rdi2-m29-source.test.ts
?? tests/engine/rdi2-m30-source.test.ts
?? tests/engine/rdi2-m31-project.test.ts
?? tests/engine/rdi2-m32-source.test.ts
?? tests/engine/rdi2-m33-source.test.ts
?? tests/engine/rdi2-m34-source.test.ts
?? tests/engine/rdi2-m35-source.test.ts
?? tests/engine/rdi2-m36-source.test.ts
?? tests/engine/rdi2-m37-source.test.ts
?? tests/engine/rdi2-m40-project.test.ts
?? tests/fixtures/rdi2-m06-project.ts
?? tests/fixtures/rdi2-m09-source.ts
?? tests/fixtures/rdi2-m12-project.ts
?? tests/fixtures/rdi2-m15-project.ts
?? tests/fixtures/rdi2-m16-source.ts
?? tests/fixtures/rdi2-m17-source.ts
?? tests/fixtures/rdi2-m18-project.ts
?? tests/fixtures/rdi2-m19-source.ts
?? tests/fixtures/rdi2-m20-source.ts
?? tests/fixtures/rdi2-m21-project.ts
?? tests/fixtures/rdi2-m22-source.ts
?? tests/fixtures/rdi2-m27-source.ts
?? vite.rdi2-source.config.ts
```

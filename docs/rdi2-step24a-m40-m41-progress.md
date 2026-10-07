# Step24A: M40 complete; M41 evidence stop

M40 is COMPLETE / VERIFIED_FOR_PROJECT_RULESET under the specific [M40 user override](../codex-prompts/step-24a-m40-gog-healing-user-override.md). Its original bytes and SHA-256 are retained. Gog has one ordinary Anytime card using the existing `gain_two_fortitude`: SELF +2 Fortitude, no additional cost, trigger, target or restriction. The printed Gog title/text remain unavailable; the waived title uses the established explicitly labeled normalized fallback. Fleck's one original record remains separately verified.

The [publisher Ninth Edition](https://slugfestgames.com/wp-content/uploads/2021/11/RDI2-9thEd-Web.pdf), printed pages2/4, independently supports ordinary Anytime timing, final rescue, cap20 and direct-attribute classification even when capped. Gog ownership and normalized wording use the explicit user override and secondary matrix support, with no publisher-direct card-text claim.

Fourteen focused engine tests exercise normal healing, cap19/20, no early resolution or extra benefit/cost, self-only targeting and forged-target rejection, other-player turn, reconnect/replay, phase-end opportunity, active gambling, response interruption, pre-order timing, successful final rescue, insufficient rescue, legal Negate and Fortitude-affecting classification at20. Eleven source tests verify quantity/type/deck counts, original override hash and rejection of semantic/provenance drift. Shared engine behavior already implements every case; no engine, Worker, client or production RDI2 compilation change was needed.

M41 `collect_one_from_each_other` is UNRESOLVED_MISSING_GOG_CARD_EVIDENCE. Original full-file hashes match the user-authorized crosscheck for each of Dimli, Eve and Fleck. Each physical record was inspected independently:

| Character | One physical card                                     | Verified normalized effect                 |
| --------- | ----------------------------------------------------- | ------------------------------------------ |
| Dimli     | Impressive Dwarven War Belch!                         | Action; each other player pays actor1 Gold |
| Eve       | Tip me, I'm the Wench.                                | Action; each other player pays actor1 Gold |
| Fleck     | I've composed a poem about our most recent adventure. | Action; each other player pays actor1 Gold |

The matrix supports Gog quantity1 and mechanic family only. The [publisher Gog page](https://slugfestgames.com/rdi-characters/gog-the-half-ogre/), current RDI2 rules and targeted publisher searches did not supply complete M41 card text. The inspected review photos show other families. Missing evidence is Gog's physical identity, Action type, exact payment amount/recipient and any additional instructions/restrictions. Direct card evidence or an explicit M41-specific decision is required; M40 and earlier overrides do not apply. The ledger retains these gaps and does not claim the generic candidate wording is verified for Gog.

Current source count is40/44 qualified mechanics and0/23 Drink records. All character decks remain40, total160; the Drink deck remains30 physical cards. M42–M44 and all Drinks retain their pending statuses. M21's real team-game acceptance J remains pending under the earlier user scope decision. Step24A remains incomplete; no source-normalized package, source lock, Step24B or Step25 was started. RDI1 immutable content is unchanged.

## Verification

| Command                              | Exit | Result                                                                                                                                                                  |
| ------------------------------------ | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run content:verify:rdi2-source` | 1    | Correctly blocked: 40/44 qualified mechanics, 0/23 Drinks; M41 evidence gap, later pending rows, M21/J and two existing M21 physical-summary mismatches; no source lock |
| `npm run typecheck`                  | 0    | PASS                                                                                                                                                                    |
| `npm run lint`                       | 1    | ESLint passes; same four existing Prettier failures listed below                                                                                                        |
| `npm test`                           | 1    | 2,336 passed / 1 existing failure / 2,337 total; all 26 subruns, including actual Workers runtime suites                                                                |
| `npm run test:coverage`              | 1    | Same 2,336 passed / 1 existing failure across all 26 subruns; all 90 files meet per-file 90% thresholds                                                                 |
| `npm run build`                      | 0    | PASS                                                                                                                                                                    |
| `npm run test:e2e`                   | 0    | PASS 27/27: main browser suite 24, development mode 1, production RDI1 suites 2                                                                                         |

Aggregate coverage: statements99.55%, branches97.95%, functions99.68%, lines99.69%. The 69 focused source/engine regression files pass852/852; M40's focused source/engine files pass25/25. Early fixture assertions and old checkpoint expectations were corrected before the final successful runs; no engine behavior fix was necessary.

The sole full-test/coverage failure is the existing `tests/content/private-content.test.ts` guard: private import files are already tracked and the expected ignore behavior does not hold. Existing Prettier failures remain in `content-private/imports/rdi1/reaudit-required-corrections.json`, the immutable RDI1 v1 nested `source-normalized.json`, its `source-lock.json`, and `content-private/imports/rdi2/README.md`. These pre-existing policy/format failures were not changed in the M40 audit scope. This is not a clean repository-wide release gate or full Step24A completion.

Changed this turn: preserved M40 prompt; private M40/M41 evidence and provenance rows; M40 source-validator guards; M40 content/engine tests and M41 stop regression; updated checkpoint expectations; current progress/evidence/checklist/override docs. No shared engine implementation changed this turn.

Diff review: `git diff --check` passes; tracked diff and new validator/tests were inspected. Comparison against this turn's starting snapshots confirms only M40/M41 mechanic/ledger records and M40 physical-card presentation/provenance changed, with original quantities and all other physical records preserved. M01–M39, M42–M44, M21/J and every Drink record remain unchanged. Nothing was staged or committed; no new artwork, secrets or local attachment paths were introduced into deliverables. Step24B remains unsafe to begin because source verification is incomplete.

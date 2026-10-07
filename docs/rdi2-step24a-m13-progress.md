# Step 24A continuation from M13

The continuation follows the current RDI2 Step 24A audit. RDI1 Step 21A is a separate, earlier milestone. Step 24A remains **INCOMPLETE**; no normalized source, source lock, production RDI2 compilation or Step 24B is introduced.

M13 is **COMPLETE / VERIFIED_FOR_PROJECT_RULESET**. Dimli, Eve, Fleck and Gog each retain one Sometimes copy.

The three original Dimli/Eve/Fleck JSON files were downloaded again. Their SHA-256 hashes reproduce the uploaded crosscheck. Each exact dual-mode record was inspected independently: current ante avoidance and leaving, previous Gold retained, no further Gambling/Cheating this Round, OR Ignore a Drink after inspection. Each character's physical source contains one matching record. The ledger records canonical identity and record/file hashes, without republishing the complete original decks.

The current [official Ninth Edition](https://slugfestgames.com/wp-content/uploads/2021/11/RDI2-9thEd-Web.pdf), printed pages 3–4, establishes post-leave consequences, Fleck's leave example, complete-Chaser Ignore, Eve's Ignore example, self-affected Drink scope and timing. The [publisher clarifications](https://slugfestgames.com/clarifications-and-errata/) agree on affected-Drink scope and reopening responses after modifiers, before resolution.

Gog's exact original wording remains **UNAVAILABLE**. His one dual-mode copy uses the existing, explicitly authorized [M12 Template B override](../codex-prompts/step-24a-m12-user-override.md). This qualification applies only to Gog's M13 semantics, does not claim publisher wording, and does not broaden M09 or authorize any M14/later mechanic.

The shared engine plan selects mutually exclusive current SELF ante/leave or affected whole-Drink Ignore branches. It cancels only the current initial/later ante before deduction, preserves previous pot contributions, leaves other participants' obligations intact, and excludes departed players from future antes. The Drink branch includes Chasers, excludes Drink Events, and does not leave or charge Gold. Existing M12 synthetic behavior tests exercise this exact shared plan; no production engine change is needed.

Changes: M13 candidate/ledger, source validator qualification and fail-closed provenance/semantic checks, 20 validator regression cases, five source alignment/evidence cases, checklist and evidence documentation. Earlier reviews and all later mechanic/Drink reviews retain their data. No private original deck files were added to tracked paths.

Before editing, 148 selected source tests passed. After review, all **332/332** selected source/gambling regressions pass. Full required checks and diff review completed before advancing to M14.

## Required checks before M14

| Command                            | Result                                                                                                                           |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| npm run content:verify:rdi2-source | Exit 1, expected. M13 accepted; first pending M14. 13/44 reviewed mechanics, 0/23 verified Drinks. No normalized source or lock. |
| npm run typecheck                  | Exit 0, all five TypeScript projects and Worker bindings pass.                                                                   |
| npm run lint                       | Exit 1; ESLint passes, same four existing Prettier failures. Explicit check of all changed files passes.                         |
| npm test                           | Exit 1; 1,835 pass, one existing private-content guard failure, 1,836 total in 26 subruns including Workers runtime.             |
| npm run test:coverage              | Exit 1 from that same test failure. All 89 files pass all four per-file 90% thresholds.                                          |
| npm run build                      | Exit 0.                                                                                                                          |
| npm run test:e2e                   | Exit 0, 27 passed (24 main / 1 development / 2 production RDI1).                                                                 |

Aggregate statements 99.49%, branches 98.34%, functions 99.53%, lines 99.63%. Source validator statements/functions/lines 100%, branches 99.59%.

The existing private-content guard expects three missing ignore rules and no tracked private imports; those imports are already tracked. Four baseline formatting failures remain: RDI1 reaudit-required-corrections.json, immutable RDI1 v1 nested source-normalized.json and source-lock.json, and RDI2 README.md. These files and index/ignore policy remain unchanged. No failing test was skipped or weakened.

Git diff and added files reviewed; git diff --check passes. Semantic before/after assertions preserve M01–M12, M14–M44, all Drinks and 40 cards per character. No production engine, Worker, client, schema or API change, secrets, debug logging, complete copyrighted database copy or immutable RDI1 edit. Nothing staged or committed.

# Step 24A — M17 Drink Ignore

M17 is COMPLETE / VERIFIED, with all required checks recorded before M18 inspection. M15 remains COMPLETE / VERIFIED_FOR_PROJECT_RULESET under its scoped user override, and M16 COMPLETE / VERIFIED without an override. Full Step 24A remains INCOMPLETE; no normalized source, source lock, production RDI2 import or Step 24B is created.

Each character's quantity two was checked separately. Six Dimli/Eve/Fleck physical original records were inspected one by one and file hashes reproduced. Eve's two records are identical; both were still counted and inspected separately. Their original titles and per-record hashes are recorded in the private ledger.

The publisher's [Second Rule of Sometimes](https://slugfestgames.com/rulesfest-the-second-rule-of-sometimes/) directly links [this complete-card illustration](https://slugfestgames.com/wp-content/uploads/2015/11/2ndRuleofSometimes3.png). It was downloaded, hashed and viewed directly. Both left and right Gog This taste yucky! cards independently show Sometimes Drink Ignore after inspection, without payment or an extra restriction. The left card's red cross marks the example's Negate; its full rules remain readable. The article explicitly demonstrates the second copy responding after the first is Negated. This is complete publisher evidence, not inferred Gog wording and not an extension of M15 authority. Images stay in ignored local evidence only.

Current Ninth Edition pages 3–4 establish complete Chaser reveal before response, whole Drink plus Chasers, own applicable Drink, ordinary Negate and refreshed response opportunities. Drink Events remain excluded without explicit permission. Passing or splitting must make self affected before using this defense; team variants are not added. All seven source checks pass.

The shared engine binding uses event DRINK / AFFECTS SELF followed by IGNORE CURRENT_EFFECT. It protects self from the whole Drink, without global Negate or a cost. Two synthetic engine tests verify complete Drink/Chaser Ignore and the publisher's repeated-defense sequence. Eight source evidence/alignment tests preserve six individually inspected originals, both Gog images, quantities and shared implementation. Fourteen validator cases accept verified evidence and reject lost provenance, unauthorized overrides, wrong artifacts, other-player/Event triggers, premature Chaser timing, Negate, payment and runtime binding changes.

Nine focused suites pass **361/361** and strict test TypeScript compilation passes. Production engine, Worker and UI remain unchanged. Full command results and diff review are recorded below before the next source row is inspected.

## Required checks before M18

| Command                            | Result                                                                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| npm run content:verify:rdi2-source | Exit 1, expected: M17 accepted, first pending M18; 17/44 mechanics reviewed, 0/23 Drinks verified. Normalized source and lock absent. |
| npm run typecheck                  | Exit 0; all five projects and Worker bindings.                                                                                        |
| npm run lint                       | Exit 1; ESLint passes, same four pre-existing formatting failures. Explicit changed-file formatting passes.                           |
| npm test                           | Exit 1; 1,931 passed / one existing private-content guard failed / 1,932 total in 26 subruns including actual Workers runtime.        |
| npm run test:coverage              | Exit 1 from the same existing guard; all 89 files pass all unchanged per-file 90% metric thresholds.                                  |
| npm run build                      | Exit 0.                                                                                                                               |
| npm run test:e2e                   | Exit 0; all 27 pass (24 main / one development / two production RDI1).                                                                |

Aggregate coverage: statements 99.5%, branches 98.19%, functions 99.54%, lines 99.64%. Validator statements/functions/lines 100%, branches 97.71%.

The same existing private-content ignore/index guard and four formatting files remain; exact paths are recorded in the preceding M15 report. Immutable RDI1 content and unrelated index/ignore policy are preserved. No test removed, skipped or weakened.

Git diff and added files reviewed; git diff --check passes. Semantic snapshots preserve M01–M16 (including M15 completion/authority), M18–M44, all Drinks and all physical counts. All character decks remain 40. Publisher/original evidence remains separate from overrides. No production engine/Worker/UI/API/schema-binding changes, dead code, debug logging, secrets, tracked downloaded deck/card artwork, immutable RDI1 mutation, staging or commit. Full Step 24A remains incomplete; Step 24B is not safe to begin.

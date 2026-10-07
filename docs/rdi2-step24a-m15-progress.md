# Step 24A — M15 USER OVERRIDE

M15 is COMPLETE / VERIFIED_FOR_PROJECT_RULESET, labeled M15 USER OVERRIDE. All required checks were run before inspecting M16. Full Step 24A remains INCOMPLETE. No Step 24B compiler, normalized source, source lock or production RDI2 import is created.

The user's [M15 instruction summary](../codex-prompts/step-24a-m15-user-override.md) explicitly supplies the same template for both Gog copies. Its SHA-256, source identifier and **M15 USER OVERRIDE** provenance are recorded separately from the publisher evidence. Exact physical Gog wording remains UNAVAILABLE, officialSourceVerified false; the missing original text no longer blocks the authorized ruleset. The earlier [blocked review](rdi2-step24a-m15-blocked.md) and its private ledger checks remain historical evidence.

## Individually checked source rows

Dimli 1 / Eve 0 / Fleck 0 / Gog 2, checked independently. Dimli's one exact original helmet record and reproduced source-file/record hashes remain unchanged, reconciled with the [current Ninth Edition](https://slugfestgames.com/wp-content/uploads/2021/11/RDI2-9thEd-Web.pdf), printed page 4. The Gog quantity matrix is separate secondary evidence. The [official Adonis example](https://slugfestgames.com/wp-content/uploads/2017/08/ALKRulesForWeb.pdf), printed page 1, supports Gog's defensive response and its Negatability, but does not reproduce complete Gog text. Full source-category/trigger semantics and identical copies are the explicit project override.

All seven per-item checks now pass for the project ruleset. Source plan and concrete shared engine binding agree: CARD source, ACTION/SOMETIMES/ANYTIME, direct pending SELF.FORTITUDE with direction ANY, then IGNORE / CURRENT_EFFECT. Direct changes qualify under existing affects-attribute rules even at the 20 cap; indirect Drink modifiers and later gambling consequences do not. Drinks and Drink Events do not qualify merely because they affect Fortitude. Existing shared conversions/engine predicates are unchanged.

The shared resolver Ignores all effects of the card on the responding player; other affected players resolve normally. It never globally Negates the original source. Negating the defense restores the original source's effects on the player. No Gog/card-title branch is added to the engine. RDI2 source metadata checks canonical identity only for evidence/binding validation.

## Changes and tests

Private candidate/ledger: independently scoped override, source/field provenance, two identical Gog copies, seven reviewed checks, shared engine binding and preserved previous blocker history. The current M15 hard blocker is removed; later rows and Drinks remain unchanged.

Source validator: qualified M15 status, exact authority/provenance, unchanged Dimli evidence, identical two-copy binding and precise trigger/resolution. The source schema now retains an optional canonicalCardTitle so the validator can verify that source identity. Twenty-one source cases cover acceptance and reject altered authority, false publisher wording, lost provenance, broader source categories, indirect/opponent attributes, global Negate/Ignore, changed runtime binding, quantity and identity.

Synthetic fixtures exercise the shared engine with nine behavior cases: Action, Sometimes, Anytime, multi-target whole-card Ignore including other stats/Gold, damaging Drink rejection and proper Drink defense, Drink Event rejection, indirect modifier rejection, legal counter and capped-attribute legality. Three source-alignment cases preserve authority hash, supporting publisher example, actual shared trigger/effect binding and two identical physical-copy expansion.

Nine selected suites pass **335/335**; strict test TypeScript compilation exits 0. Existing Sometimes/Ignore/Fortitude/Drink regressions are included. No production engine, Worker, UI, schema binding or API behavior is changed. Required repository results are recorded below; M16 is the next unresolved source row.

## Required command results before M16

| Command                            | Result                                                                                                                                                   |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm run content:verify:rdi2-source | Exit 1, expected: M15 qualified override accepted; first pending M16. 15/44 mechanics reviewed, 0/23 Drinks verified; normalized source and lock absent. |
| npm run typecheck                  | Exit 0, all five projects and Worker bindings.                                                                                                           |
| npm run lint                       | Exit 1; ESLint passes, same four pre-existing formatting failures. All M15 changed files pass explicit formatting.                                       |
| npm test                           | Exit 1; 1,887 passed / one existing private-content guard failed / 1,888 total in 26 subruns, including actual Workers runtime.                          |
| npm run test:coverage              | Exit 1 from the same existing guard; all 89 files pass every unchanged per-file 90% metric threshold.                                                    |
| npm run build                      | Exit 0.                                                                                                                                                  |
| npm run test:e2e                   | Exit 0; all 27 pass (24 main / one development / two production RDI1). No browser test failure/retry in this M15 run.                                    |

Aggregate coverage: statements 99.49%, branches 98.28%, functions 99.54%, lines 99.64%. Source validator statements/functions/lines 100%, branches 98.67%.

The existing private-content guard reports three missing ignore rules and already tracked private imports. Pre-existing formatting failures remain in RDI1 reaudit-required-corrections.json, immutable RDI1 v1 nested source-normalized.json and source-lock.json, and RDI2 README.md. Their data and ignore/index policy remain unchanged. No failing test is removed, skipped or weakened.

Git diff, added files and semantic snapshots reviewed; git diff --check passes. M01–M14, M16–M44 and all Drinks unchanged, all character quantities remain 40, official evidence catalogs preserved and previous M15 blocker retained as history. No runtime engine, Worker/UI, dead code, debug logging, secrets, downloaded card database/artwork, immutable RDI1 edits, staging or commit. M15 is complete for the explicitly authorized ruleset; full Step 24A and release completeness remain incomplete.

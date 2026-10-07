# Step 24A — M16 protected Sometimes counter

M16 is COMPLETE / VERIFIED. M15 is COMPLETE / VERIFIED_FOR_PROJECT_RULESET under its independent M15 USER OVERRIDE. Step 24A remains INCOMPLETE; no Step 24B, normalized source, source lock or production RDI2 import is created.

Each physical quantity was checked separately: Dimli 1, Eve 1, Fleck 1, Gog 1. Each original Dimli/Eve/Fleck record was inspected independently and its file hash reproduced. Record hashes and original canonical titles are preserved in the private ledger. Eve's original title ends in a period; Dimli/Fleck end in an exclamation mark. The nested original data.type is Sometimes; outer legacy Foundry type base is not interpreted as card mechanics.

The complete publisher-printed Gog not think so! card is reproduced in the [official Ninth Edition](https://slugfestgames.com/wp-content/uploads/2021/11/RDI2-9thEd-Web.pdf), printed page 4. The PDF was downloaded and hashed. It establishes Sometimes Negate, plus both incoming and outgoing equivalence to the ordinary protected counter. Gog's quantity is checked separately against the matrix. No missing wording is inferred, and no M15/M12/M09 user authority is reused.

The exact source template requires a pending compatible Sometimes card. It cancels every unresolved effect of the immediate source, without canceling an earlier ancestor. It does not require the countering player to be the affected target. Incoming protection and outgoing compatibility use one declared family, rdi.negate_sometimes, with shared SAME_FAMILY_ONLY metadata. Any source-specific response restriction remains enforced. Countering this response allows its original source to proceed. The current publisher clarification page was inspected without a superseding M16 change found.

All seven per-item source checks pass. Candidate/ledger record separate original and publisher evidence, the structured source plan and the concrete shared binding. Source regression guards reject lost original/publisher evidence, fabricated overrides, altered source types, compatibility, family/protection, wrong resolution and inconsistent runtime binding. Three alignment cases preserve identities, hashes and all four quantities. Two synthetic shared-engine cases demonstrate another player's Ignore being Negated, equivalent protected counters interoperating, unrelated incoming counter rejection and deterministic reconnect/replay.

Eight focused suites pass **321/321**; strict test TypeScript compilation passed before the final fixture-alignment edit and is included again in the full required typecheck. Production engine, Worker and UI behavior remain unchanged. All required commands are recorded below, before M17 inspection.

## Required checks before M17

| Command                            | Result                                                                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| npm run content:verify:rdi2-source | Exit 1, expected: M16 accepted, first pending M17; 16/44 mechanics reviewed, 0/23 Drinks verified. Normalized source and lock absent. |
| npm run typecheck                  | Exit 0; all five projects and Worker bindings.                                                                                        |
| npm run lint                       | Exit 1; ESLint passes, same four pre-existing formatting failures. Explicit changed-file formatting passes.                           |
| npm test                           | Exit 1; 1,907 passed / one existing private-content guard failed / 1,908 total in 26 subruns including actual Workers runtime.        |
| npm run test:coverage              | Exit 1 from the same existing guard; all 89 files pass all unchanged per-file 90% metric thresholds.                                  |
| npm run build                      | Exit 0.                                                                                                                               |
| npm run test:e2e                   | Exit 0; all 27 pass (24 main / one development / two production RDI1).                                                                |

Aggregate coverage: statements 99.49%, branches 98.23%, functions 99.54%, lines 99.64%. Validator statements/functions/lines 100%, branches 98.17%.

The same existing private-content ignore/index guard and four formatting files remain; exact paths are recorded in the preceding M15 report. Immutable RDI1 content and unrelated index/ignore policy are preserved. No test removed, skipped or weakened.

Git diff and added files reviewed; git diff --check passes. Semantic snapshots preserve M01–M15 (including M15 completion/authority), M17–M44, all Drinks and all physical counts. All character decks remain 40. Publisher/original evidence remains separate from overrides. No production engine/Worker/UI/API/schema-binding changes, dead code, debug logging, secrets, tracked downloaded deck/card artwork, immutable RDI1 mutation, staging or commit. Full Step 24A remains incomplete; Step 24B is not safe to begin.

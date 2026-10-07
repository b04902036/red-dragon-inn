# Step 24A — M18 historical evidence stop

This historical stop is superseded by the user’s explicit M18-specific ownership/quantity/standard-copy override. See [the current M18 continuation](rdi2-step24a-m18-progress.md); the missing Gog physical provenance is no longer a project blocker. The original findings and commands below are retained as history.

**STOP: M18 Gog's two paid-extra-Drink cards lack complete original records or readable full card images.** Quantity and mechanic-family assignment are supported by the supplied secondary matrix. Exact Gog identity/type, own-phase timing, payment, number of Drinks, target wording and special restrictions cannot be verified individually. No M18 override was authorized. M15's override does not apply here.

M15 is COMPLETE / VERIFIED_FOR_PROJECT_RULESET under **M15 USER OVERRIDE**. M16 and M17 are COMPLETE / VERIFIED with direct publisher Gog wording, separately inspected original records and all required command results. See [M15](rdi2-step24a-m15-progress.md), [M16](rdi2-step24a-m16-progress.md) and [M17](rdi2-step24a-m17-progress.md).

For M18, each of the two Dimli and two Eve original JSON records was independently inspected and hashed. Both source-file hashes reproduce the source catalog. Each record establishes Sometimes, own Buy Drinks phase, payment of one Gold to the Inn and two additional face-down Drinks. The [publisher phase clarification](https://slugfestgames.com/order-a-drink/) confirms Buy Drinks and Order a Drink are the same phase. The [current RDI2 rules](https://slugfestgames.com/wp-content/uploads/2021/11/RDI2-9thEd-Web.pdf), printed pages 1–3, establish before/after phase-action opportunities and additional Drinks for other players, assigned together or distributed. These reconcile legacy Dimli/Eve target wording; they do not identify Gog's individual cards.

The [publisher Gog page](https://slugfestgames.com/rdi-characters/gog-the-half-ogre/) does not show M18. The available official errata was checked. Publisher examples of similarly named cards in other character decks are not Gog evidence. The direct community forum/archive fetch returned 403/internal errors in this continuation; the supplied local quantity matrix remains available. No claim is made that every possible source was exhausted.

The candidate mechanic's effects and legality remain unchanged and unverified for Gog. The private ledger records one passing quantity check and six unresolved full-row checks, plus four separate original-record hashes and the precise blocker. M19–M44 and all 23 Drink records remain untouched and pending. No production import, normalized source, source lock or Step 24B was created.

To unblock M18, provide readable complete records/card photos for Gog's two M18 copies, including type and all rules text, or explicitly authorize a separate M18 project rule override defining both copies' complete semantics. Matching another deck is not assumed.

## Required commands and review

Before inspecting M18, all seven required commands were run for M17:

| Command                            | Result                                                                                                                                                   |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm run content:verify:rdi2-source | Exit 1 as required for incomplete content: 17/44 reviewed, 0/23 Drinks, first unresolved M18; no normalized source/lock.                                 |
| npm run typecheck                  | Exit 0.                                                                                                                                                  |
| npm run lint                       | Exit 1; ESLint passes, four pre-existing formatting failures remain.                                                                                     |
| npm test                           | Exit 1; 1,931 pass / one existing private-content guard failure / 1,932 total, 26 subruns including actual Workers runtime.                              |
| npm run test:coverage              | Exit 1 from the same guard; all 89 files meet all unchanged per-file 90% thresholds. Statements 99.50%, branches 98.19%, functions 99.54%, lines 99.64%. |
| npm run build                      | Exit 0.                                                                                                                                                  |
| npm run test:e2e                   | Exit 0; 27/27 pass, including development and production RDI1.                                                                                           |

Exact baseline failure paths are recorded in the M15 report. Full Step 24A and repository release checks remain incomplete. The M18 stop metadata and audit-boundary regression are verified separately below; no engine/runtime behavior changed.

After recording the M18 stop, all seven focused source/engine suites pass **258/258**, strict test TypeScript compilation exits 0, and the source verifier exits 1 with the explicit M18 blocker, accepting the 17 previously reviewed mechanics. Final changed-file formatting and git diff --check pass. Semantic comparisons preserve M01–M17 completion/authority, M19–M44, every Drink, every physical character-card row and all prior source records. M18 rule semantics remain unchanged. No immutable RDI1, engine, Worker or UI changes, secrets, downloaded artwork, staging or commit were introduced.

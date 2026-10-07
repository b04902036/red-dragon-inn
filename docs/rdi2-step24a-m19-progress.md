# Step 24A — M19 Fleck free orders or refill exemption

M19 source review is COMPLETE / VERIFIED. All required commands were executed; existing repository failures remain, so the release gate is not clean. No project override is needed. Full Step 24A remains incomplete; no normalized source, source lock, RDI2 compiler or production import has been created.

Both physical Fleck records were separately read from a fresh download of the [original unofficial JSON](https://raw.githubusercontent.com/HaxxonHax/the-inn/main/Cards/base/fleck/fleck.json). Its SHA-256 matches the supplied uploaded crosscheck, and each physical record has a separately reproduced canonical record hash. Both are Sometimes and use the same two alternatives. This user-authorized original reference is not labeled publisher-direct card evidence. Dimli and Eve absence were separately checked in their hashed originals; Gog absence is supported by the supplied complete matrix. The remote matrix returned 403, so the ledger does not claim fresh remote inspection.

The [official phase rename](https://slugfestgames.com/order-a-drink/) equates older Buy Drinks with Order a Drink. The [current RDI2 rules](https://slugfestgames.com/wp-content/uploads/2021/11/RDI2-9thEd-Web.pdf), printed pages 2–4, establish relevant phase opportunities, current other-player face-down placement, one Gold per player to the Inn at refill, and ordinary Sometimes/Negate timing. Current listed errata were inspected separately.

The normalized source makes the printed alternatives explicit:

- During self's Order a Drink phase, order two additional face-down Drinks for other players without a card fee. They may go to the same or different recipients; ordinary ordering remains additional.
- Before self's current Drink-deck refill payment, waive only that one-Gold-to-Inn fee. Other players still pay. This does not refund paid Gold, grant Gold, waive future payments or apply to a Character-deck reshuffle.

One played copy resolves only its matching alternative. The free-order alternative does not also waive a refill caused by those orders. No M09/M12/M15/M18 authority is transferred to M19.

All seven per-item checks pass. Candidate, ledger, physical titles, source evidence and validator were updated only for M19. Twenty-nine new source-gate cases reject changed provenance, numbers, timing, targets, face-up placement, payment, global/future waivers, simultaneous alternatives and incorrect copies. Five physical-record/source tests retain the evidence classification and source alignment. Four synthetic shared-engine tests verify the supported free-order alternative, same/different recipients, zero card payment, normal ordering remaining additional, owner opportunity after ordering, reconnect/replay and legal Negate.

The engine audit records a capability gap for Step 24B. The effect DSL has no scoped refill-waiver operation or pending self-refill-payment response opportunity. Some existing Inn-draw paths deduct refill fees synchronously; the normal dealing path reshuffles without charging a fee. A future shared refill mechanism must cover both paths. This source audit implements neither that mechanism nor an artificial test-only waiver resolver. The free-order branch uses the existing generic phase opportunity and extra-order effect, omitting mandatory payment metadata as required by the runtime schema.

Before editing, four selected suites passed **297/297** and the source gate rejected M19. After correcting test-binding/schema issues exposed by the first focused run, all six selected suites pass **335/335** and strict test TypeScript compilation passes. Full required command results and final diff review are recorded below, before inspecting M20.

## Required checks before M20

| Command                            | Exact result                                                                                                                                 |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| npm run content:verify:rdi2-source | Exit 1, expected: M19 accepted, first pending M20. 19/44 mechanics reviewed, 0/23 Drink records verified; normalized source and lock absent. |
| npm run typecheck                  | Exit 0; all five projects and Worker binding generation pass.                                                                                |
| npm run lint                       | Exit 1; ESLint passes, same four existing formatting failures. Explicit changed-file formatting passes.                                      |
| npm test                           | Exit 1; 2,015 passed / one existing private-content guard failed / 2,016 total in 26 subruns including actual Workers runtime.               |
| npm run test:coverage              | Exit 1 from the same guard; all 89 files meet unchanged per-file 90% thresholds in all four metrics.                                         |
| npm run build                      | Exit 0.                                                                                                                                      |
| npm run test:e2e                   | Exit 0; all 27 pass (24 main / one development / two production RDI1).                                                                       |

Aggregate coverage: statements 99.5%, branches 98.08%, functions 99.55%, lines 99.65%. Validator statements/functions/lines 100%, branches 96.85%. No per-file threshold failures.

The same existing private-content ignore/index guard and four formatting failures remain; their exact paths are recorded in the preceding M18 report. Immutable RDI1 content and unrelated ignore/index policy are preserved. No failing test removed, skipped or weakened.

Git diff and new source/test files reviewed; git diff --check passes. Semantic comparisons preserve M01–M18, M20–M44, all Drink records and earlier sources/overrides. Every character deck remains 40. Original file and both individual-record hashes reproduce. No production engine, Worker, UI, dependency, API or binding changes, secrets, debug logging, tracked downloaded artwork, immutable RDI1 mutation, staging or commit. Full Step 24A remains incomplete; Step 24B cannot begin.

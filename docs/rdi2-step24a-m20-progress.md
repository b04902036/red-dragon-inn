# Step 24A — M20 Fleck all-player Inn toast

M20 source review is COMPLETE / VERIFIED. All required commands were executed; existing repository failures remain, so the release gate is not clean. M19 was completed and all required command results recorded before this review began. Full Step 24A remains incomplete; Step 24B is not started.

The single physical Fleck Action record was separately inspected from a fresh download of the [authorized original unofficial JSON](https://raw.githubusercontent.com/HaxxonHax/the-inn/main/Cards/base/fleck/fleck.json). Its file SHA-256 matches the supplied crosscheck, and the individual record hash reproduces. It explicitly includes the actor, draws each player's Drink from the Inn and instructs leading Drink Events to be discarded without effects until a Drink is found. Original card provenance remains SECONDARY, distinct from publisher generic rules; no project override is needed. Dimli/Eve absence were checked separately in their hashed originals, and Gog absence is supported by the supplied complete matrix. Remote matrix inspection remains unavailable (403), without a fresh remote verification claim.

The [current RDI2 rules](https://slugfestgames.com/wp-content/uploads/2021/11/RDI2-9thEd-Web.pdf), printed pages 1 and 3–5, verify Action timing, Inn refill and Chasers, standard Negate/Ignore and simultaneous Drink timing. Each active player receives a separate Drink from the Inn; this does not copy one shared Drink or start a Drinking Contest. All complete Drinks and Chasers are revealed before relevant Sometimes/Anytime responses, and consumption occurs simultaneously after responses. Current standard Chaser handling takes precedence over the legacy broad Event reminder: a Drink Event drawn as a Chaser terminates that Chaser chain; leading Events are instead skipped while finding a base Drink. Current listed errata were checked separately.

All seven source checks pass. Candidate and ledger retain the verified original Action plan, add explicit Drink semantics and record the engine audit. Fleck remains one physical copy, all four character decks remain 40, and all other mechanic/Drink reviews remain unchanged.

Twenty-four validator cases distinguish original card provenance, quantities, own Action timing, actor inclusion, separate Inn draws, Event handling, Chasers, independent responses and simultaneous settlement. Four source/physical-record tests verify quantities, record evidence and engine-audit classification. Three synthetic tests exercise only the supported shared-engine subset: distinct Inn Drinks including actor, no premature Alcohol effects, hidden remaining Inn ID, complete Chasers before responses, independent own Ignore, reconnect/replay and legal Action Negate preventing the batch.

The engine audit explicitly remains PARTIAL_SHARED_ENGINE_SUPPORT. Existing FORCE_SIMULTANEOUS_DRINK with source INN prepares separate Drinks and defers consumption, but beginBatch calls prepareDrink with its default skipEvents=false. The current effect DSL exposes no leading-Event search option. Step 24B needs a shared capability to implement M20's verified skip rule; it is not simulated in tests or implemented during Step 24A. Refill payment response/waiver remains the separate M19 capability gap.

Before editing, four selected suites passed **332/332** and the source gate rejected M20. After editing, six suites pass **363/363**. Strict TypeScript compilation passes. Full required commands and diff review are recorded below, before M21 inspection.

## Required checks before M21

| Command                            | Exact result                                                                                                                                 |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| npm run content:verify:rdi2-source | Exit 1, expected: M20 accepted, first pending M21. 20/44 mechanics reviewed, 0/23 Drink records verified; normalized source and lock absent. |
| npm run typecheck                  | Exit 0; all five projects and Worker binding generation pass.                                                                                |
| npm run lint                       | Exit 1; ESLint passes, same four existing formatting failures. Explicit changed-file formatting passes.                                      |
| npm test                           | Exit 1; 2,046 passed / one existing private-content guard failed / 2,047 total in 26 subruns including actual Workers runtime.               |
| npm run test:coverage              | Exit 1 from the same guard; all 89 files meet unchanged per-file 90% thresholds in all four metrics.                                         |
| npm run build                      | Exit 0.                                                                                                                                      |
| npm run test:e2e                   | Exit 0; all 27 pass (24 main / one development / two production RDI1).                                                                       |

Aggregate coverage: statements 99.53%, branches 98.02%, functions 99.66%, lines 99.67%. Validator statements/functions/lines 100%, branches 96.42%. No per-file threshold failures.

The same existing private-content ignore/index guard and four formatting failures remain; exact paths are in the M18 report. Immutable RDI1 content and unrelated ignore/index policy are preserved. No test removed, skipped or weakened.

Git diff and added files reviewed; git diff --check passes. Semantic comparisons preserve M01–M19, M21–M44, all Drink records and earlier sources/overrides. Every deck remains 40. Original file and physical-record hashes reproduce; original M20 legality/effect plan is unchanged. No production engine, Worker, UI, dependency, API or binding change, secrets, debug logging, tracked downloaded artwork, immutable RDI1 mutation, staging or commit. Full Step 24A remains incomplete; Step 24B cannot begin.

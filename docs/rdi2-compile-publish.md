# Step 24C — RDI2 compilation and combined local publication

The locked Step 24A project ruleset now compiles into a real ContentPack. The new immutable local edition is `content_rdi1_rdi2_mechanics_v1`. It contains Deirdre, Fiona, Gerki, Zot, Dimli, Eve, Fleck and Gog, with 40 physical Character cards each, plus separate RDI1 and RDI2 30-card Drink decks. There are 226 unique definitions and 380 physical cards in the combined edition.

The local D1 `production` channel selects this combined edition for new rooms. Both `content_rdi1_mechanics_v1` and `content_rdi1_mechanics_v2` still load and match their reviewed source. Existing rooms retain their content-version pin. This step does not deploy or publish anything remotely. Step 24D has not begun.

## Compilation and provenance

`src/content/rdi2-compiler.ts` is deterministic and accepts only the audited normalized source, verification ledger, mechanic matrix and matching source-lock hashes. All 44 mechanic families and 23 Drink records use the shared strict card, effect and trigger schemas. Unknown effects or unavailable bindings fail compilation. The compiler preserves RDI1 definitions, IDs, quantities, traits and translations when combining editions.

Stable RDI2 IDs derive from locked source keys. Physical copies use `deckCards.quantity`. M18's paid extra orders bind to the existing mandatory activation cost; M33's payment remains an ordered effect. M21 keeps its separate audited Dimli/Gog response timings. The hard-counter family uses the existing cross-edition `rdi_core_hard_no` identity and same-family restriction; M27 retains its Drink-modifier family and incoming-counter restrictions. These bindings use data, with no character/title dispatch in the generic engine.

The source ledger retains publisher evidence and explicit user overrides separately. Compiled reconstructed records use `PUBLIC_RULES_PARAPHRASE`, never `LICENSED`. English and Traditional Chinese records use `MANUAL` / `MANUAL_REVIEWED` implementation translations, with canonical locale-independent IDs. No claim of official translation or a distribution license is made. No artwork is added.

Ignored private outputs are:

- `content-private/imports/rdi2/pack.json`: the four-character RDI2 edition.
- `content-private/imports/rdi2/pack-combined.json`: the combined edition used for publication.
- `content-private/imports/rdi2/compile-report.json`: both validation reports, source hashes and provenance.

The compiler creates these artifacts exclusively. Repeating compilation accepts byte-identical artifacts; a conflicting artifact fails rather than being overwritten. Local publication validates both the private graph and the D1 round-trip, preserves RDI1, and accepts an already-published identical edition without rewriting it. A conflicting draft or published edition fails validation.

```sh
npm run content:verify:rdi2-source
npm run content:compile:rdi2
npm run content:verify:rdi2
npm run content:verify:rdi1-rdi2
npm run content:publish:rdi2
npm run content:verify:rdi1-rdi2 -- --read-d1
```

Publication is local only and requires the corrected RDI1 v2 edition to be published first. It activates the combined edition for new rooms. CI must provision the ignored locked inputs and compile the private outputs before tests; missing content must not fall back to sample cards.

## Drink setup and Bar Deck

The combined lobby exposes exactly eight playable characters and three host-controlled Drink choices: RDI1, RDI2, or the combined Bar Deck. The client submits only selected deck IDs in `START_MATCH`. The server validates the selection against the pinned edition and records it in the replay manifest. Unknown, duplicated or missing required selections cannot mutate the room.

The shared server draw path covers ordering, forced Drinks, Chasers and Events. Bar setup shuffles the selected physical Drinks, partitions 30 active cards and keeps the remainder in a hidden reserve. Initial player Drinks are then dealt from the active deck. Taking its final card queues the normal refill obligations and takes the next 30 from the reserve. When the reserve runs out during refill, discarded Drinks are shuffled into the reserve to finish the batch. Cards still in players' piles or resolution are never recycled. This implements the [publisher's RDI2 Bar Deck rule, page 6](https://slugfestgames.com/wp-content/uploads/2021/11/RDI2-9thEd-Web.pdf).

The active deck never permanently contains 60 cards. The reserve and active order stay server-only; public projections expose counts. Snapshots validate physical ownership and the 30-card active limit. Accepted commands and domain events preserve deterministic replay and reconnect. Existing single-Inn manifests retain their original draw behavior.

If every available Drink is held in play and both reserve and discard are empty, the existing finite-supply fallback returns no cards. It does not fabricate copies or repeatedly charge for an unavailable refill.

## Changed files and acceptance coverage

- Compiler/validator/tooling: `src/content/rdi2-compiler.ts`, `src/content/rdi2-pack.ts`, `scripts/rdi2-pack.ts`, `vite.rdi2-pack.config.ts`, package scripts.
- Runtime/setup: `src/engine/inn-deck.ts`, setup/turn/Drink modules, state and ownership invariants, `worker/runtime-content.ts`, `worker/durable/game-room.ts`.
- Protocol/presentation/UI: command/event/view/presentation schemas, server projections, content presentation, edition completeness, `RoomScreen.tsx`, bilingual setup labels.
- Tests: five compiler/completeness cases; eight Bar Deck cases executed in Node and workerd; six actual Workers/D1/DO publication, pinning, replay and reconnect cases; three production browser journeys, one per Drink setup. Vitest and Playwright configuration and the test runner include these suites.
- Documentation: this report, content import and protocol guides; a continuation link preserves the historical Step 24B report.

Focused negative checks cover hash mismatch, unknown bindings, modified/duplicate/no-op records, missing translations, incorrect provenance, invalid deck selections, forged active counts and duplicate reserve ownership. Runtime checks exercise dry-run import, immutable publication, both old/new editions, hidden order, actual refill payments, snapshot/replay, eviction and WebSocket reconnect. Browser checks verify eight character choices, all Drink choices, production hands, locale switching and refresh without browser errors.

## Verification — 2026-10-07

Step 24C is complete for the locked project ruleset. All required checks pass:

| Command/check                                                                  | Final result                                                                                              |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `npm run content:verify:rdi2-source`                                           | Exit 0; 44 mechanics, 23 Drink records, 160 Character cards, 30 Drinks, zero source-lock errors           |
| `npm run content:compile:rdi2`                                                 | Exit 0; byte-identical private artifacts on repeated compilation                                          |
| `npm run content:verify:rdi2`                                                  | Exit 0; 4 characters, 40/40/40/40, Drink 30, no unknown effects                                           |
| `npm run content:verify:rdi1-rdi2`                                             | Exit 0; 8 characters, every Character deck 40, both Drink decks 30                                        |
| `npm run content:publish:rdi2`                                                 | Exit 0; local immutable publication and new-room channel activation; identical publication repeats safely |
| `npm run content:verify:rdi1-rdi2 -- --read-d1`                                | Exit 0; entire D1 graph matches the compiled edition                                                      |
| `npm run content:verify:rdi1 -- --version content_rdi1_mechanics_v1 --read-d1` | Exit 0; archived source-lock hashes and immutable D1 round-trip pass                                      |
| `npm run content:verify:rdi1 -- --version content_rdi1_mechanics_v2 --read-d1` | Exit 0; current RDI1 source-lock and D1 round-trip pass                                                   |
| `npm run content:verify:zh-TW`                                                 | Exit 0; combined channel, 462/462 fields translated, zero UI/content issues                               |
| `npm run typecheck`                                                            | Exit 0                                                                                                    |
| `npm run lint`                                                                 | Exit 0                                                                                                    |
| `npm test`                                                                     | Exit 0; 2,560 passed across 30 configured runtime groups                                                  |
| `npm run test:coverage`                                                        | Exit 0; the same 2,560 tests pass and all 96 measured files meet every existing per-file 90% gate         |
| `npm run build`                                                                | Exit 0                                                                                                    |
| `npm run test:e2e`                                                             | Exit 0; 30 passed: 24 main, 1 development, 2 RDI1 production, 3 combined production                       |
| `npm run verify:build`                                                         | Exit 0                                                                                                    |
| `git diff --check` and diff review                                             | Passed; no debug logging, private content or secrets added to tracked output                              |

Aggregate coverage is 99.51% statements, 97.84% branches, 99.72% functions and 99.66% lines. The new compiler has 99.51% statement / 96.79% branch coverage, the edition validator has 100% / 100%, and the shared Inn/Bar draw path has 97.83% / 96.15%. Worker, Durable Object, D1 and WebSocket tests execute inside the actual Workers runtime.

## Scope and remaining work

Edition-scoped production completeness passes for these eight characters. The separate full-catalog release checker still exits 1 for the other 68 of 76 catalog characters. It reports zero additional content errors, unknown effect keys, no-op definitions or missing Traditional Chinese; this step does not claim full-catalog release readiness.

Team-game runtime and M21 team acceptance remain the explicitly authorized non-blocking TODO. Source semantics and override classifications are unchanged. Step 24D is the next content acceptance milestone, and requires a separate instruction.

Private artifacts, test logs and coverage reports remain ignored. Pre-existing Step 24A/24B edits and private-index removals were preserved.

Subsequent Step 24D acceptance is recorded in [full RDI2 and mixed-edition verification](rdi2-full-verification.md), with the generated [per-definition coverage matrix](rdi2-card-coverage.md). The results above remain the historical Step 24C checks.

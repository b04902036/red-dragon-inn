# Step 24A — M18 standard extra-Drink cards

M18 source review is **COMPLETE / VERIFIED_FOR_PROJECT_RULESET**. All required commands were executed; existing repository failures remain, so the full release gate is not clean. This continuation handles M18 only. M19 onward and all Drink records remain pending and unchanged; Step 24B is not started. Full Step 24A remains incomplete, with no normalized source, source lock or production RDI2 import.

The user's [M18 instruction summary](../codex-prompts/step-24a-m18-user-override.md) is independently hashed. It authorizes exactly three Gog-specific provenance facts as **M18 USER OVERRIDE / PROJECT_RULE_OVERRIDE**: Gog owns this standard card, has exactly two copies, and both copies use the identical standard mechanic. It does not reuse M09/M12/M15 authority. Complete original Gog card provenance remains unavailable and is not claimed publisher-direct.

The standard effect is independently **publisher-supported**, rather than inferred or overridden. The [publisher Daareka print-and-play PDF](https://slugfestgames.com/wp-content/uploads/2016/12/RedDragonInn6DaarekaPrintAndPlay.pdf), page 3 top middle and top right, was downloaded, hashed, rendered and visually inspected. Both complete standard cards show Sometimes, own Order a Drink phase, one Gold to the Inn and two additional Drinks. This 2016 playtest artifact is corroborated by the complete printed standard card in the [official Spyke/Flower rules](https://slugfestgames.com/wp-content/uploads/2018/07/SFRulesForWeb.pdf), page 1, parsed directly. Neither artifact is presented as Gog deck provenance. Downloaded PDF/pages and the inspection helper remain in ignored local tools; application dependencies are unchanged.

Each of Dimli's two and Eve's two original JSON records was independently rechecked, with source-file and per-record hashes reproduced. The official Buy Drinks/Order a Drink phase rename reconciles their older wording. [Current RDI2 rules](https://slugfestgames.com/wp-content/uploads/2021/11/RDI2-9thEd-Web.pdf), pages 1–3, establish relevant own-phase opportunities before or after normal ordering, and face-down additional Drinks for other players, either together or distributed. Fleck's absence and each character quantity were checked separately. Both Gog physical copies have separate override evidence entries pointing to the independently verified standard effect.

All seven per-item checks pass. The old [M18 stop](rdi2-step24a-m18-blocked.md) is retained as historical evidence, with its original review preserved in the private ledger. Its missing-Gog-provenance blocker is removed under this explicit authority, without labeling Gog ownership, quantity or identical-copy membership as publisher-direct evidence.

The structured source retains own Order a Drink phase and the ordered effects: PAY_INN SELF amount 1, then ORDER_EXTRA_DRINKS count 2 targets OTHER_PLAYERS. The synthetic shared runtime binding uses existing phase opportunity, mandatory payment metadata and generic extra-Drink ordering. No engine or character/title-specific resolver changes are needed; no RDI2 compiler is introduced.

Tests add seven per-record/provenance/source-alignment cases, 34 source-gate cases and five synthetic engine cases. They distinguish publisher effects from Gog override facts; reject reused overrides, false official provenance, changed phase/payment/count/targets and incorrect copy bindings; and verify same/different recipients, face-down hidden IDs, payment before orders, normal ordering remaining additional, own-phase/other-player rejection, Negate preventing all effects, untimed owner opportunity, reconnect and deterministic replay.

Before edits, three focused suites passed 256/256 and the source gate rejected M18. After edits, six focused suites pass **323/323**, strict test TypeScript compilation exits 0, and the source gate accepts M18 while rejecting pending content. Required full command results and final diff review are recorded below.

After recording M18 completion, both source suites pass again, **272/272**; the explicit source gate still accepts M18 and rejects pending content. Final changed-file formatting passes.

## Required checks

| Command                            | Exact result                                                                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm run content:verify:rdi2-source | Exit 1, expected: M18 accepted; first pending M19. 18/44 mechanics reviewed, 0/23 Drink records verified; normalized source and lock absent.            |
| npm run typecheck                  | Exit 0. All five TypeScript projects and Worker binding generation pass.                                                                                |
| npm run lint                       | Exit 1. ESLint passes; the same four existing Prettier failures remain. Explicit changed-file formatting check passes.                                  |
| npm test                           | Exit 1. 1,977 passed / 1 failed / 1,978 total across 26 subruns, including actual Workers runtime. Sole failure is the existing private-content guard.  |
| npm run test:coverage              | Exit 1 from the same guard. 1,977 passed / 1 failed; all 89 files meet unchanged per-file 90% thresholds for statements, branches, functions and lines. |
| npm run build                      | Exit 0.                                                                                                                                                 |
| npm run test:e2e                   | Exit 0. All 27 pass: 24 main, one development, two production RDI1.                                                                                     |

Aggregate coverage: statements **99.5%**, branches **98.12%**, functions **99.55%**, lines **99.64%**. Source validator statements/functions/lines **100%**, branches **97.15%**. No per-file threshold failures.

The sole test failure remains tests/content/private-content.test.ts: three expected private-directory ignore rules are absent and private imports are already tracked. Four existing formatting failures remain:

- content-private/imports/rdi1/reaudit-required-corrections.json
- content-private/imports/rdi1/versions/content_rdi1_mechanics_v1/content-private/imports/rdi1/source-normalized.json
- content-private/imports/rdi1/versions/content_rdi1_mechanics_v1/source-lock.json
- content-private/imports/rdi2/README.md

Immutable RDI1 content and unrelated index/ignore policy are preserved within this M18-only task. No failing test was removed, skipped or weakened.

## Final diff review and boundary

Git diff and added source/test files reviewed; git diff --check passes. Semantic snapshots confirm M01–M17, M19–M44, all Drink records, earlier sources and overrides are unchanged. Every character retains 40 physical cards. Original M18 standard semantics are unchanged; the old blocked review remains historical. Both the independent override file hash and inspected publisher PDF hash reproduce. No production engine, Worker, UI, dependency, API or binding change, dead code, debug logging, secrets, tracked publisher artwork, immutable RDI1 mutation, staging or commit was introduced.

M18's seven per-item checks and focused behavioral regressions pass. Full Step 24A remains incomplete. M19 onward is pending and was not started under this M18-only instruction. Step 24B cannot begin before the complete source lock and explicit authorization.

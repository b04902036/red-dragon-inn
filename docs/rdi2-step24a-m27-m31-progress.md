Current update: M31 is now COMPLETE under the explicit physical-identity normalization override; M32 verified; M33 is the next unsupported item. See [current report](rdi2-step24a-m31-m33-progress.md). The following report preserves the preceding checkpoint.

# Step 24A: M27 complete; M28–M30 verified; M31 blocked

The user's [M27 provenance authorization](../codex-prompts/step-24a-m27-gog-provenance-override.md) resolves only Gog's physical-copy identity. M27 is COMPLETE / VERIFIED_FOR_PROJECT_RULESET. Its gameplay rules, direct-effect predicate, protected incoming counters and standard engine binding retain their existing publisher authority and are unchanged. No Gog-specific mechanic was added.

Gog has exactly one existing SOMETIMES `negate_drink_change_card` record, now bearing the authorized canonical title. Quantity/family evidence remains secondary-matrix verified; the missing physical identity is labeled **M27 USER OVERRIDE — Gog physical-copy provenance**. The original Gog record/scan remains unavailable, and publisher-direct Gog ownership is not claimed. Dimli, Eve and Fleck each retain their one existing M27 copy. Every character deck remains 40 physical cards; total 160.

M28, M29 and M30 were inspected sequentially, with focused checks passing before the next audit:

| Item | Independently inspected records | Verified behavior                                                                                                                                                                      |
| ---- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M28  | Fleck 1                         | Action: everyone including self loses one Alcohol; each other player pays actor one Gold. Zero Alcohol does not exempt payment. Shared binding uses `CHANGE_STAT` then `COLLECT_GOLD`. |
| M29  | Eve 2                           | Action: another chosen player gains exactly two Alcohol. Both original records agree with the publisher's current +2 erratum; stale +1 is rejected.                                    |
| M30  | Dimli 1, Eve 2, Fleck 1         | Action: another chosen player loses exactly one Fortitude. Eve's separate fire-card erratum does not alter this family.                                                                |

The original reference files were hash-checked against the user-authorized crosscheck, and every applicable physical record was inspected and hashed separately. Original JSON evidence remains secondary. Current rule and errata evidence remains primary: [Ninth Edition rules](https://slugfestgames.com/wp-content/uploads/2021/11/RDI2-9thEd-Web.pdf), [The New Eve](https://slugfestgames.com/the-new-eve/). No production RDI2 pack was compiled.

## Exact stopping point

M31 `damage_two` remains UNRESOLVED_GOG_PHYSICAL_COPY_PROVENANCE. Dimli's five and Fleck's two original records were individually inspected and hashed; Eve's absence was checked. The secondary matrix assigns Gog five cards to this family. The publisher's Ninth Edition printed page 1 establishes **Why you laugh at Gog?**, Action, another-player target, lose two Fortitude. That example does not establish the physical identities, quantities by title or complete wording of all five Gog copies.

Needed: original Gog records, clear card images with copy inventory, or publisher evidence connecting all five physical M31 copies to their identities and complete standard semantics. Targeted searches and the publisher Gog character page did not supply that inventory. M27's one-copy authorization cannot be broadened to M31. No later mechanic or Drink was marked verified.

Current source review count: **30/44 qualified mechanic rows and 0/23 Drink records**. M21 remains INCOMPLETE_ENGINE_ACCEPTANCE with real team test J pending under the user's existing continuation decision. Step 24A remains incomplete; no normalized source, source lock, Step 24B or Step 25 work is created.

## Verification

Before editing: source gate reproduced 26/44 qualified rows, all four decks 40, and the M27 provenance blocker; both existing M27 suites passed **32 tests**. After the M27 update, source validation confirmed 27/44, all four decks 40, and no M27 blocker; **395 focused/checkpoint tests** passed before auditing M28. Final focused suites passed **418 tests across 11 files**, including unchanged M27 gameplay/incoming-counter tests, copy/count/provenance rejection tests, M28–M30 shared-engine behaviors and M31 fail-closed checks.

| Required command                     | Exact result                                                                                                                                                                                                                                                                |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run content:verify:rdi2-source` | Exit 1, intentionally fail closed: 30/44 mechanics, 0/23 Drinks; character decks 40/40/40/40, character total 160, Drink physical total 30. M31, later rows, Drinks and M21/J remain unresolved. Existing M21 card-summary mismatches also remain. No M27 validation error. |
| `npm run typecheck`                  | Exit 0; Worker binding generation and all five TypeScript projects pass.                                                                                                                                                                                                    |
| `npm run lint`                       | Exit 1; ESLint passes, Prettier reports the same four pre-existing formatting failures listed below.                                                                                                                                                                        |
| `npm test`                           | Exit 1; 2,204 passed, one failed, 2,205 total across 26 runtime groups. Sole failure is the existing private-content policy test. Workers/Durable Object suites execute in the real Workers runtime.                                                                        |
| `npm run test:coverage`              | Exit 1 for the same private-content test; 2,204 passed, one failed. Aggregate statements 99.54%, branches 97.99%, functions 99.67%, lines 99.68%. All 89 files meet every 90% threshold. Source validator: 100% statements/functions/lines, 96.52% branches.                |
| `npm run build`                      | Exit 0.                                                                                                                                                                                                                                                                     |
| `npm run test:e2e`                   | Exit 0; 27 passed: main Chromium 24 (47.1s), development mode one (8.9s), production RDI1 two (22.2s).                                                                                                                                                                      |

The final M28 Ignore fixture was strengthened to start its protected player at nonzero Alcohol, proving both Alcohol and Gold are actually suppressed; all three M28 engine tests passed again. No engine implementation changed in this continuation.

Pre-existing formatting failures:

- `content-private/imports/rdi1/reaudit-required-corrections.json`
- `content-private/imports/rdi1/versions/content_rdi1_mechanics_v1/content-private/imports/rdi1/source-normalized.json`
- `content-private/imports/rdi1/versions/content_rdi1_mechanics_v1/source-lock.json`
- `content-private/imports/rdi2/README.md`

`tests/content/private-content.test.ts` still fails because the repository does not ignore all required private paths and already tracks private imports. This failure predates this continuation. The source gate's M21 summary mismatches also reproduced before editing. No immutable RDI1 version or ignore policy was changed to suppress these failures. Step 24A as a whole is not declared complete.

## Files and final review

Changes cover the RDI2 source candidate and ledger, the scoped M27 validator guard, the M27 instruction record, content tests for M27–M31, synthetic shared-engine tests for M28–M30, checkpoint assertions in the existing M21/general source tests, and progress/evidence/checklist/override documentation. No runtime, UI, protocol, migration, production content version or RDI2 compiler changes were introduced.

Reviewed `git diff` and the continuation-specific source/ledger diffs; `git diff --check` passes. Independent comparison against the pre-edit snapshot confirms M01–M26 and M32–M44 data unchanged, all Drink records unchanged, every physical quantity/owner distribution unchanged, all non-Gog M27 cards unchanged, and M27 legality/effects/counter metadata/engine audit/publisher mechanic verification unchanged. Every inspected original record hash and the scoped instruction hash reproduce. Existing engine changes in the working tree belong to the preceding M27 evidence task and were left untouched. Browser checks restore their generated RDI1 artifacts; final status shows no new RDI1 content changes.

No dead code, debug logging, secrets, complete original deck downloads or new absolute local paths were introduced into repository-facing changes. Downloaded originals and execution logs remain under ignored `.tools/`. Nothing was committed. Next permitted work is resolving M31's explicit evidence gap within Step 24A; Step 24B remains unsafe to begin.

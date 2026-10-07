Current update: M27 provenance is now resolved by the user-only one-copy override, and M27 is COMPLETE. M28–M30 verified; M31 is the next unsupported item. See [current report](rdi2-step24a-m27-m31-progress.md). The following report preserves the earlier checkpoint.

# Step 24A — M27 publisher mechanic COMPLETE; Gog physical-copy provenance pending

The [user's evidence-unblock instruction](../codex-prompts/step-24a-m27-official-evidence-unblock.md) is preserved byte for byte with its SHA-256 in the source catalog. It authorizes the publisher-supported M27 rule, not a new user override. M27's **mechanic is COMPLETE and PUBLISHER_VERIFIED**. Its remaining row status is `UNRESOLVED_GOG_PHYSICAL_COPY_PROVENANCE`, with `completionStatus=MECHANIC_COMPLETE_PROVENANCE_PENDING`. The complete effect, direct-effect predicate and incoming-counter restriction are no longer unresolved.

The separate missing evidence is a direct Gog-deck card record/image or publisher deck record identifying his physical M27 copy. Gog's quantity **1** and mechanic-family assignment remain verified from the supplied secondary matrix. His physical copy has no independently inspected record, and publisher-direct Gog ownership is not claimed. This preserves the user's explicit instruction to report only a separately unresolved provenance issue. M28 onward is untouched. M21/J remains pending, the gate counts **26/44 fully qualified rows, 0/23 Drinks**, and no normalized source, source lock, RDI2 compiler/import or Step 24B is created.

## Publisher evidence and individual records

The [RDI2 Ninth Edition rules](https://slugfestgames.com/wp-content/uploads/2021/11/RDI2-9thEd-Web.pdf), printed page 5, reproduce the complete standard Sometimes counter. They establish direct Drink-changing targets and the protected incoming counter family. Printed page 4 establishes Gog's equivalent hard-counter family. The publisher's [Stop Playing With the Drinks clarification](https://slugfestgames.com/rulesfest-stop-playing-with-the-drinks/) independently establishes the direct-effect test: M27 Negates a Sometimes source, so it does not itself directly change the Drink and cannot be targeted by another M27. [RDI7 Third Edition rules](https://slugfestgames.com/wp-content/uploads/2021/11/RDI7-3rdEd-Web.pdf), printed page 7, additionally exclude merely giving Special Reserve Drinks.

All three previously inspected original Dimli/Eve/Fleck records were rehashed and reconciled with the publisher template, including each record's incoming restriction. Each deck contains one such record. Their source-file and canonical record hashes are retained separately as authorized secondary original JSON. No original Gog record is invented, no full deck text/artwork is added, and no earlier override is reused or broadened. The matrix page remained unavailable for direct retrieval; no fresh direct remote-matrix inspection is claimed.

The candidate and all four bilingual card summaries now record the incoming-only-hard-counter rule. The structured source uses a pending Sometimes source that directly changes an actual Drink, ordinary Negate, explicit same-counter rejection and generic counter-family metadata. Publisher facts and secondary physical-quantity facts remain separate in the ledger.

## Shared runtime verification

The existing generic response stack, Negate resolution, source-capability predicates and `allowedCounterFamilies` implement the binding. Both existing equivalent hard-counter family identifiers are permitted. There are no Gog/card-title checks in engine code.

Regressions first reproduced two shared fact-extraction bugs: a `MODIFY_PENDING_EFFECT` directly modifying a Drink was not classified as a Drink change; and a modifier capable of affecting Events was wrongly labeled as currently affecting an Event even when its actual target was a Drink. The small correction in `source-capabilities.ts` recognizes the first and uses the actual pending parent for the second. The response-stack/protection/resolution code itself is unchanged.

Nineteen synthetic engine tests cover required A–K: Ignore cancellation; positive/negative numeric modifications through both shared operations; passing and splitting; forced extra drinking, direct player Alcohol and ordering rejection; Event rejection; Sometimes-only typing; M27 versus M27 failing its predicate even with protection removed; both legal hard-counter families restoring the original modifier; unrelated incoming counter rejection, including a forged server command; 30-second timing, stale prompts, private IDs, reconnect and deterministic replay. The valid Negate-Drink category is separately verified through the generic source-capability matcher; that classification test does not claim a new production Drink-negation card or Special Reserve runtime.

Thirteen source tests preserve publisher classification, original record hashes, instruction hash, generic binding, pending provenance, M21/J and later entries. They reject drift in legality/effects/incoming protection/binding, relabeling as an override, secondary publisher authority and attempts to use mechanic completion to bypass the provenance gate. Together with the additional RDI1 Drink/Event control below, this replaces the previous single M27 stop test with **32 additional tests overall**.

Before editing, the five existing source/Drink/direct-effect suites passed **366/366**, and the source verifier reproduced the closed 26-row checkpoint. After correcting initial fixture API usage, the new engine suite reproduced **3 failures / 16 passes** attributable to the two real matcher bugs. Nine focused source/engine suites then passed **449/449**.

The first full run exposed another fixture issue: the RDI1 counter's existing “affect Drink Events” case actually used a Wine parent. It incorrectly treated the modifier's ability to affect Events as a current Event target. The fixture now uses an actual synthetic Event parent, retains its server rejection assertions, and adds a paired normal-Drink control. No immutable RDI1 content is changed. The expanded ten-suite focused run passes **463/463**. The earlier premature passing-total report was corrected after parsing the full log (2,166 passed / 2 failed); that run and the interrupted coverage attempt are not reported as the final results.

## Required final checks

All seven required commands finished on the corrected code/tests. The Step 24A source-lock gate remains closed regardless of successful M27 mechanic tests.

| Command                              | Exit | Final result                                                                                                                                      |
| ------------------------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run content:verify:rdi2-source` | 1    | Expected closed gate: 26/44 fully qualified rows, 0/23 Drinks; only Gog physical-copy provenance remains unresolved for M27. M21/J stays pending. |
| `npm run typecheck`                  | 0    | Worker binding generation and all five TypeScript projects pass.                                                                                  |
| `npm run lint`                       | 1    | ESLint passes; the same four existing formatting failures remain.                                                                                 |
| `npm test`                           | 1    | 2,168 passed / 1 failed / 2,169 total across 26 runtime groups. Only the existing private-content Git guard fails.                                |
| `npm run test:coverage`              | 1    | Same 2,168 passed / 1 failed. 99.54% statements, 98.01% branches, 99.67% functions, 99.68% lines; every metric in all 89 files exceeds 90%.       |
| `npm run build`                      | 0    | Production build passes.                                                                                                                          |
| `npm run test:e2e`                   | 0    | 27 passed: main Chrome 24 (47.3s), development selection 1 (8.9s), published RDI1 2 (22.2s).                                                      |

The generic source-capability matcher has **100% coverage on all four metrics**, including its two corrections. The source validator has 100% statement/line/function coverage and 96.62% branch coverage. Coverage thresholds are unchanged.

The existing Git-guard failure is `tests/content/private-content.test.ts`: required private ignore patterns are absent and private imports are already tracked. The four formatting failures remain `content-private/imports/rdi1/reaudit-required-corrections.json`, `content-private/imports/rdi1/versions/content_rdi1_mechanics_v1/content-private/imports/rdi1/source-normalized.json`, `content-private/imports/rdi1/versions/content_rdi1_mechanics_v1/source-lock.json` and `content-private/imports/rdi2/README.md`. Those failures are not waived or repaired by this scoped M27 correction. Changed implementation/data/report files pass their formatting checks; the user's instruction is intentionally byte-preserved.

## Diff review and next boundary

This continuation changes the M27 candidate/ledger and source catalog, generic source-capability matcher, source validator, M27 source/engine tests and synthetic binding, the RDI1 counter's actual Event fixture and paired Drink control, preserved instruction and evidence/progress/checklist documentation. Existing package/config changes belong to earlier work and are not modified here.

Final diff review after E2E passes: M01–M26 data/overrides, M28–M44 and every Drink match the pre-edit snapshots; physical quantities remain 40 per character and 30 Drinks; all three original M27 file/record hashes reproduce; the copied attachment's hash matches its original bytes; M21/J remains pending; no normalized source or lock exists. `git diff --check` passes. Ignored evidence/helpers remain untracked, no secrets or complete deck transcription is introduced, and immutable RDI1 has no substantive diff after its browser checks. The production engine diff contains only the two shared source-capability corrections, without character/title checks. Server-side forged-response rejection remains exercised.

Only Gog physical-copy provenance may stop M27 now. Do not reopen its mechanic wording or incoming-counter evidence. M28 and Step 24B are not safe to begin until that separately preserved issue is resolved under the user's no-guessing policy.

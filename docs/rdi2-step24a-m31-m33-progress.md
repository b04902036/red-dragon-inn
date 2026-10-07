Historical checkpoint; superseded by [M33–M40 continuation](rdi2-step24a-m33-m40-progress.md).

# Step 24A: M31 complete; M32 verified; M33 blocked

The [user's M31 attachment](../codex-prompts/step-24a-m31-gog-identity-normalization.md), preserved byte-for-byte and SHA-256 recorded, resolves only Gog's missing per-copy identity requirement. M31 is COMPLETE / VERIFIED_FOR_PROJECT_RULESET. Gog keeps one `damage_two` Action family record with quantity five, no invented printed names, and no per-copy gameplay variation. **Why you laugh at Gog?** remains the publisher-direct physical example; it is not assigned as the printed name of every copy.

Evidence stays separate: the standard another-player/two-Fortitude/normal-Action mechanic is publisher-verified; Gog quantity five remains secondary-matrix verified; the four unknown printed identities are waived by **M31 USER OVERRIDE — physical identity normalization**. Their titles remain unavailable, and publisher verification of all five printed identities is not claimed. All earlier overrides remain unchanged.

The shared engine quantity expander was tested with a synthetic definition using the verified binding. It creates five distinct instance IDs for one definition; every instance deals exactly two Fortitude to another player, with no independent Gold, Alcohol or Drink effect, and follows the ordinary response/discard/phase pipeline. Forged self-target and wrong-phase/other-owner commands reject. Normal Ignore/Negate, reconnect and deterministic replay pass. No production RDI2 pack or new engine handler was created.

M32 is independently VERIFIED. Both original Eve fire records were individually inspected and hashed, with their file hash checked against the user-authorized crosscheck. Their Action/other-player/three-Fortitude text matches [the publisher's current Eve erratum](https://slugfestgames.com/the-new-eve/). Original spelling is retained separately from the publisher's title spelling. No M31 authority is reused, and stale two-damage data is rejected. Both copy fixtures and ordinary defenses pass.

All character decks remain exactly 40, total 160; every physical quantity and mechanic distribution is unchanged. Current review count: **32/44 qualified mechanic rows, 0/23 Drink records**. M21 remains INCOMPLETE_ENGINE_ACCEPTANCE with real team test J pending under the existing user continuation decision.

## Exact stopping point

M33 `damage_three_pay_inn_one` is UNRESOLVED_MISSING_CARD_EVIDENCE. The supplied secondary matrix and fresh search-index excerpt support Gog quantity one and the abbreviated three-Fortitude/one-Gold-to-Inn family. Direct forum fetch failed; no fresh direct full-post inspection is claimed. The current publisher rules do not supply the missing card text. The [publisher Gog page](https://slugfestgames.com/rdi-characters/gog-the-half-ogre/) links an image that was downloaded and visually inspected: it is artwork only, with no printed title, type or rules. Its filename is not a card-title source.

Needed: trustworthy original text or a clear publisher/user-owned card scan establishing the physical identity, Action type, precise target, three Fortitude loss, one Gold to the Inn, whether payment is an upfront play cost or a resolving effect, effect order, Ignore/Negate/payment consequences, and any additional restrictions. In particular, candidate `asEffectNotCost: true` is not verified. The M31 identity waiver supplies no M33 semantics or provenance.

M33's candidate gameplay was not implemented or guessed. M34 onward and all Drinks remain untouched. No normalized source, source lock, Step 24B or Step 25 work was created.

## Verification

Before editing, source validation reproduced 30/44 qualified rows and the M31 blocker; nine baseline M31/Action regression tests passed. M31 then passed 400 focused/checkpoint tests before M32 began. M32 and shared Action/timing/reaction regressions passed 128 tests before M33 was inspected. Final focused checks passed **507 tests across 11 files**, including required M31 A–H, source mutation guards, M32 regressions and M33 fail-closed tests.

| Command                              | Exit | Result                                                                                                                                                                                |
| ------------------------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run content:verify:rdi2-source` | 1    | Expected fail-closed result: 32/44 qualified mechanics, 0/23 Drinks; M33 and subsequent records unverified, M21/J and existing M21 summary mismatches remain. No M31/M32 drift error. |
| `npm run typecheck`                  | 0    | Passed after correcting new test assertions to inspect actual Gold-change events instead of a nonexistent Inn balance field.                                                          |
| `npm run lint`                       | 1    | ESLint passed. Four existing Prettier failures remain, listed below.                                                                                                                  |
| `npm test`                           | 1    | 2,234 passed, one existing private-content policy failure; 2,235 tests across all 26 project runs, including real Workers runtime tests.                                              |
| `npm run test:coverage`              | 1    | Same 2,234 passed / one existing failure. Coverage thresholds passed for all 89 measured files.                                                                                       |
| `npm run build`                      | 0    | Worker and client builds passed.                                                                                                                                                      |
| `npm run test:e2e`                   | 0    | All 27 passed: main 24 (48.6s), development selection one (8.9s), production RDI1 two (21.6s).                                                                                        |

The final 507-test focused run was repeated after the assertion correction and passed. Full test and coverage runs preceded that test-only correction; no application or validator behavior changed afterward. Coverage: statements **99.54%**, branches **97.98%**, functions **99.67%**, lines **99.68%**. The RDI2 source validator reached 100% statements/functions/lines and 96.53% branches. Every measured per-file metric is at least 90%.

The existing failure in `tests/content/private-content.test.ts` reproduces the repository's private-path policy mismatch: only one of four expected paths is ignored, and private imports are already tracked. Ignore policy was not changed in this scoped audit. Existing formatting failures:

- `content-private/imports/rdi1/reaudit-required-corrections.json`
- `content-private/imports/rdi1/versions/content_rdi1_mechanics_v1/content-private/imports/rdi1/source-normalized.json`
- `content-private/imports/rdi1/versions/content_rdi1_mechanics_v1/source-lock.json`
- `content-private/imports/rdi2/README.md`

## Changes and review

Updated the RDI2 candidate and ledger for M31/M32/M33; added the scoped M31 validator guard; preserved the user attachment; added M31/M32 source and shared-engine tests plus M33 fail-closed tests; updated current checkpoint assertions and evidence/checklist/progress documents. Engine tests use clearly marked synthetic definitions and existing shared handlers. Runtime engine code, protocols, UI, migrations and production RDI2 compilation were not changed in this continuation.

Reviewed the working diff and ran `git diff --check` successfully. A separate semantic comparison against the pre-edit source/ledger snapshots passed: M01–M30, M34 onward and all Drinks unchanged; every character's physical distribution and 40-card count unchanged; M31/M32 gameplay fields unchanged; original record/file and attachment hashes reproduced; M33 unresolved; M21/J pending; no normalized source or lock. E2E's temporary RDI1 output changes were restored by its cleanup. Earlier working changes were preserved. No changes were staged or committed, and no secrets or machine-local paths were added to repository content.

Step 24A remains incomplete. Next work requires M33 primary/original evidence or an explicit, separately scoped user decision; Step 24B is not safe to begin.

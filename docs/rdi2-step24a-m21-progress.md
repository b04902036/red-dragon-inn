# Step 24A — M21 user override and pending team acceptance

Subsequent workflow decision: the user explicitly [authorized source audits from M22 onward](../codex-prompts/step-24a-source-audit-continuation.md) while leaving M21/J pending and the final source lock blocked. This revises only the earlier sequential-advance gate. M21 remains INCOMPLETE_ENGINE_ACCEPTANCE and its existing evidence/behavior requirements are unchanged. See the [later continuation report](rdi2-step24a-m22-m27-progress.md). The command results and 21-row count below describe the original M21 review checkpoint.

M21 source semantics are **VERIFIED_FOR_PROJECT_RULESET** under the independent **M21 USER OVERRIDE**. M21 is **INCOMPLETE_ENGINE_ACCEPTANCE**, not COMPLETE: required real team-game test J remains pending. When asked about the missing team runtime, the user explicitly chose **Keep Step 24A scope; leave team acceptance pending**. That preserves the test requirement and does not authorize skipping it. M22 is not advanced and Step 24B is not started.

The [full user instruction](../codex-prompts/step-24a-m21-user-override.md) is preserved byte-for-byte and its SHA-256 recorded in the source catalog/ledger. It authorizes exactly two identical Gog Sometimes copies, an actual other-player Drink reveal including Drinking Contest, after all Chasers, exactly one independent additional Drink from that revealer's own Drink Me! Pile, no self target and no extra contest entry. All reconstructed full-semantic fields are PROJECT_RULE_OVERRIDE. Exact physical Gog wording remains UNAVAILABLE and is not claimed publisher-direct. M09/M12/M15/M18 authority remains unchanged.

The [official RDI8 rules](https://slugfestgames.com/wp-content/uploads/2021/11/RDI8RulesWeb.pdf), printed pages 3-8 and 11-12, and [RDI10 rules](https://slugfestgames.com/wp-content/uploads/2026/02/RDI10RulesWeb.pdf), printed page 14, retain publisher-supported identity, chosen-player repeated-drinking/team-phase examples and generic Drink, Chaser, empty-pile, counter, contest and team-target rules. Another-player targeting excludes teammates, and only the chosen opponent repeats drinking. These rules do not reproduce Gog's complete card. The secondary reveal-description quotation supplied in the user prompt has separate SECONDARY / USER_PROVIDED_QUOTATION provenance, without a fresh direct remote matrix claim.

Dimli's single original Drink up, friend! record and previously fetched original-file/record hashes were rechecked. Original evidence and official Ninth Edition printed page 2 remain separate authority. Its original another-player Drink Phase opportunity is preserved as a distinct character template; the Gog-specific reveal/contest override is not applied to Dimli. Eve/Fleck absence and all four quantities remain unchanged. Gog has exactly two copies bound to the same M21 family and same Gog template; all four character decks remain 40.

## Changes and tests

Candidate and ledger record both character templates, qualified field-level provenance, the historical wording stop, generic engine binding and honest capability audit. The previous source-blocking reason about Gog wording is superseded; the source gate remains closed by the pending team acceptance and later unverified items. The validator rejects incorrect authority, trigger/source/amount/targets, merged Drinks, contest entries, Dimli spillover and false team-runtime/COMPLETE claims.

The source plan uses `CHARACTER_TEMPLATES`: a later compiler must select the matching character's template, preserving Dimli/Gog timing separately. The source validator checks a structured trigger in every template. This extends the audit source schema; the runtime effect DSL and production engine remain unchanged.

The Gog synthetic fixture uses the existing shared `DRINK` response event with `SOURCE_ACTOR=OTHER` and `SOURCE_TYPE=DRINK`, then `QUEUE_EXTRA_DRINK target=SOURCE_ACTOR`. The type predicate ensures an empty-pile sober-up frame is not mistaken for an actual reveal. No Gog/title branch or Drink resolver is added.

Eighteen focused engine tests verify required A-H and further accepted interactions: original consumption before extra effects, exactly one target-own-pile draw with no central substitute, self rejection including forged intent, actual reveals outside normal Drink Phase, complete original and extra Chasers, independent original Ignore/modification, independent extra Ignore/pass/split, Fortitude effects, contest actual Alcohol versus comparison, normal empty-pile SOBER/SKIP behavior, legal Sometimes Negate, rejection by modification-only counters, two copies, pass-out, 30-second guest timing, stale prompt rejection, hidden IDs and reconnect/replay. The engine keeps the original source frame until its nested queued Drinks finish, so tests check exact discarded membership/count without imposing a new discard ordering.

Thirty-two content/validator tests verify required I (two identical copies), exact instruction hash, per-field authority, preserved Dimli semantics, source/fixture alignment, original and primary evidence, structured character trigger templates and failure cases. Test J is not skipped or faked: there is no executable team-game setup, team roster, teammate-aware relation/target validation or team state in the current runtime. Four independent seats are not a team game. Publisher team rules are locked as source facts, while their executable acceptance remains pending as the user selected.

The source audit also records the separate existing Dimli capability gap: the engine only exposes the existing own Order a Drink phase opportunity, not the full other-player Drink-phase opportunity. No production engine, runtime, protocol, UI, dependency or binding change is made in this Step 24A source task.

Before edits, four baseline suites passed **357/357**. After edits, all six selected source/Drink/Chaser/Sometimes/contest regression suites pass **407/407**. Strict test TypeScript compilation passes. The first full-check attempt exposed missing generic character-trigger metadata support and a missing review card-type field, which were corrected; interrupted test/coverage runs are not counted as complete. Final required commands are recorded below after execution.

## Required checks

All required commands were completed after the metadata corrections. M21 remains incomplete because required J is pending under the user's chosen scope.

| Command                              | Exact result                                                                                                                                                |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run content:verify:rdi2-source` | Exit 1, expected: authorized M21 source semantics accepted, required team J pending; 21/44 qualified mechanics, 0/23 Drinks, normalized source/lock absent. |
| `npm run typecheck`                  | Exit 0; Worker type generation and all five TypeScript projects pass.                                                                                       |
| `npm run lint`                       | Exit 1; ESLint passes, same four existing formatting failures. Explicit changed-file formatting passes.                                                     |
| `npm test`                           | Exit 1; 2,096 passed / one existing private-content guard failed / 2,097 total across 26 subruns, including actual Workers runtime.                         |
| `npm run test:coverage`              | Exit 1 from the same existing guard; all 89 files meet unchanged per-file 90% thresholds in all four metrics.                                               |
| `npm run build`                      | Exit 0.                                                                                                                                                     |
| `npm run test:e2e`                   | Exit 0; all 27 pass (24 main / one development / two production RDI1).                                                                                      |

Aggregate coverage: statements 99.53%, branches 97.99%, functions 99.67%, lines 99.68%. Source validator statements/functions/lines 100%, branches 96.40%. No per-file threshold failures. No test removed, skipped or weakened; real team test J is documented pending and not replaced by a fake fixture.

The sole existing failing `tests/content/private-content.test.ts` guard reports missing private-directory ignore patterns and already-tracked private imports. Four existing formatting failures remain:

- `content-private/imports/rdi1/reaudit-required-corrections.json`
- `content-private/imports/rdi1/versions/content_rdi1_mechanics_v1/content-private/imports/rdi1/source-normalized.json`
- `content-private/imports/rdi1/versions/content_rdi1_mechanics_v1/source-lock.json`
- `content-private/imports/rdi2/README.md`

These baseline files, immutable RDI1 and unrelated ignore/index policy remain unchanged. Repository-wide release checks remain unclean; full Step 24A is not complete.

All changed implementation, data and report files pass the explicit formatting check. The preserved user instruction follows the existing `codex-prompts/` formatting exclusion and is verified byte-for-byte by its recorded SHA-256.

## Review and remaining gate

Changed files: the preserved M21 prompt, private source candidate/ledger, `src/content/rdi2-source.ts`, the existing source-boundary test, new M21 source/engine tests and synthetic fixture, plus evidence/override/checklist/progress/history documentation. Git diff and added files reviewed; `git diff --check` passes. Semantic comparisons reproduce all earlier completions, M22–M44, Drink records, prior overrides/sources and physical quantities. Dimli's original legality/effects are unchanged. Original-file/record, publisher PDF and exact user-instruction hashes reproduce; downloaded originals/artwork remain ignored. No production engine, Worker, UI, dependency, binding or RDI1 mutation, secrets, debug logging, staging or commit introduced.

At the original M21 checkpoint the required gate remained closed with 21/44 qualified source rows, 0/23 Drinks, no normalized source/lock and pending team acceptance J. The subsequent explicit user decision linked above permits later source audits while retaining this acceptance blocker. The original physical wording is no longer a source blocker.

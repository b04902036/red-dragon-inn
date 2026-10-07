# Step 24A — M21 Gog extra Drink evidence stop

Historical wording stop, superseded by the user's M21 override on 2026-10-06. The [current M21 report](rdi2-step24a-m21-progress.md) records resolved source semantics and pending team acceptance J under the user's selected Step 24A scope. The original findings below remain audit history, not a current request for Gog wording.

M19 and M20 individual source reviews are COMPLETE / VERIFIED, with all required command results recorded before advancing. Full Step 24A remains incomplete. M21 is **UNRESOLVED_MISSING_CARD_EVIDENCE / BLOCKED_MISSING_EVIDENCE**. No M22 review or Step 24B implementation has begun.

The single Dimli Drink up, friend! original Sometimes record was individually inspected in a fresh [authorized unofficial JSON download](https://raw.githubusercontent.com/HaxxonHax/the-inn/main/Cards/base/dimli/dimli.json). File SHA-256 reproduces the supplied crosscheck; its separate canonical-record hash is recorded in the private ledger. It specifies another player's Drink Phase and an additional Drink from that player's Drink Me! Pile. The [official RDI2 Ninth Edition](https://slugfestgames.com/wp-content/uploads/2021/11/RDI2-9thEd-Web.pdf), printed page 2, reproduces this complete template; generic Drink/Chaser, response and Drinking Contest rules are separate publisher authority. Eve/Fleck absence checked independently in hashed original decks and the complete supplied matrix. Matrix quantities remain Dimli 1 / Eve 0 / Fleck 0 / Gog 2. Original-reference provenance remains SECONDARY, not a publisher-hosted original-card claim.

The [official RDI8 rules](https://slugfestgames.com/wp-content/uploads/2021/11/RDI8RulesWeb.pdf), printed page 12, and [official RDI10 rules](https://slugfestgames.com/wp-content/uploads/2026/02/RDI10RulesWeb.pdf), printed page 14, explicitly identify Gog from RDI2 and **Gog say you drink MORE!**. Each example makes a chosen opponent drink again during the affected team's Drink Phase; the other teammates are unaffected. Both PDFs downloaded and hashed; relevant pages directly inspected. These are VERIFIED_OFFICIAL_NAMED_EXAMPLE facts. Gog quantity two and Sometimes mechanic-family assignment are VERIFIED_SECONDARY_MATRIX facts.

Neither example reproduces Gog's complete card. Its precise legal trigger, extra-Drink source, amount wording and all card-specific restrictions remain unverified, as does the complete identical-copy assignment for both physical records. The publisher character page's GogSayDrinkNow image was downloaded and visually inspected: artwork only, with no printed title/type/rules. The existing reviewer Gog2 photo contains three other cards, none is MORE. Exact-title/source searches found no complete readable Gog card or trustworthy original Gog JSON. This report does not claim that the known title or Drink-Phase example is missing.

Unblocking requires complete original Gog M21 records or a readable complete card scan sufficient to verify both physical copies and all seven checks. Alternatively, a new explicit **M21-specific user override** may define the unresolved semantics and identical-copy assignment. No such override is currently authorized; M09/M12/M15/M18 authority does not transfer. Gog exactCardText stays UNAVAILABLE, normalizedSemantics UNRESOLVED and officialSourceVerified false. Candidate M21 legality/effects remain unverified and unchanged; no effect was inferred from Dimli.

The existing source-boundary test now asserts the partial official identity alongside the unresolved semantics and absent override, and requires all later rows to remain pending. Before editing, source suites passed **322/322**; afterward the three selected source suites pass **327/327**, including both newly completed Fleck reviews. The required full verification was rerun after recording this stop; results below. The source gate still fails, with 20/44 verified mechanics, 0/23 verified Drink records and no normalized source/lock.

## Required checks

| Command                              | Exact result                                                                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `npm run content:verify:rdi2-source` | Exit 1, expected: M21 unresolved wording explicitly blocks; 20/44 mechanics verified, 0/23 Drinks; normalized source/lock absent.   |
| `npm run typecheck`                  | Exit 0; Worker binding generation and all five TypeScript projects pass.                                                            |
| `npm run lint`                       | Exit 1; ESLint passes, same four existing formatting failures. Explicit changed-file formatting passes.                             |
| `npm test`                           | Exit 1; 2,046 passed / one existing private-content guard failed / 2,047 total across 26 subruns, including actual Workers runtime. |
| `npm run test:coverage`              | Exit 1 from the same existing guard; all 89 files meet unchanged per-file 90% thresholds in all four metrics.                       |
| `npm run build`                      | Exit 0.                                                                                                                             |
| `npm run test:e2e`                   | Exit 0; all 27 pass (24 main / one development / two production RDI1).                                                              |

Aggregate coverage: statements 99.53%, branches 98.02%, functions 99.66%, lines 99.67%. Validator statements/functions/lines 100%, branches 96.42%. No per-file threshold failures. No test removed, skipped or weakened. No M21 rule implementation or additional engine capability is claimed.

The existing failing `tests/content/private-content.test.ts` guard reports missing private-directory ignore patterns and already-tracked private imports. The four existing formatting failures remain:

- `content-private/imports/rdi1/reaudit-required-corrections.json`
- `content-private/imports/rdi1/versions/content_rdi1_mechanics_v1/content-private/imports/rdi1/source-normalized.json`
- `content-private/imports/rdi1/versions/content_rdi1_mechanics_v1/source-lock.json`
- `content-private/imports/rdi2/README.md`

These baseline files, immutable RDI1 versions and unrelated ignore/index policy remain unchanged. Repository-wide release checks are not clean; this is not full Step 24A completion.

## Diff review and preserved scope

The M21 diff is limited to `content-private/imports/rdi2/source-candidate.json`, `verification-ledger.json`, the assertion in `tests/content/rdi2-source.test.ts`, `reference/rdi2/source-evidence.md`, `verification-checklist.md` and the progress/stop documentation. The M19 and M20 report/test/fixture/validator changes are described in their separately completed reports. No architecture, API or schema change is introduced by this M21 stop.

Git diff, added files and semantic/hash comparisons reviewed; `git diff --check` passes. M01–M20 completion, M22–M44, all Drink records, all physical quantities, earlier sources/overrides and original M21 rule plan are preserved. Every character deck remains 40. Original file, physical-record, publisher PDF and inspected image hashes reproduce. Full original downloads and artwork are verified ignored in the local evidence cache; no downloaded card database/artwork is added to the repository. RDI1 content, production engine, Worker, UI, dependencies and bindings are unchanged. No secrets, debug logging, staging or commit introduced. Source readiness remains closed; next mechanic is not safe to begin without resolving M21.

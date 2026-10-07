# Step 24A remaining-item audit pass — 2026-10-07

The user authorized reviewing all remaining items, skipping unsupported details and reporting all gaps together. This audit pass is finished; **Step 24A's source-lock milestone is not complete**. No unsupported row was promoted, no immutable normalized source or source lock was generated, and Step 24B/25 did not begin.

The [workflow instruction](../codex-prompts/step-24a-complete-audit-skip-unverified.md) changes when to report blockers, not the evidence standard. The existing M21/J scope decision and all narrowly scoped user overrides remain in force.

## Results

- All 44 mechanic rows and all 23 Drink records now have individual reviews.
- **42/44 mechanic source reviews qualify**, including the authorized project rulesets. M21 is source-qualified but remains INCOMPLETE_ENGINE_ACCEPTANCE because team test J is pending.
- **15/23 Drink source reviews qualify**: 14 VERIFIED and Fine Ambrosia VERIFIED_FOR_PROJECT_RULESET under the existing confirmed user override.
- Dimli, Eve, Fleck and Gog remain exactly **40 physical cards each**, total 160. The Drink Deck remains **30 physical cards**.
- M41, M44 and eight Drinks remain explicitly unresolved. Candidate numbers/traits on those records are not promoted to verified rules.

## Verified corrections

M42's two separately inspected original Eve records are **Anytime**, not Action. The candidate, physical type, matrix CSV/Markdown and ledger now agree. Both original records say to pick a player; ordinary living self/other targeting applies. M43's original Fleck Action also permits picking a player, so the unsupported other-player restriction was removed. Shared runtime bindings use COLLECT_GOLD, respectively one and two Gold. Generic fixture tests verify actual transfer and legal self targeting without moving Gold; no production RDI2 card was compiled.

M44's standard Anytime/pick-player/pay-Inn-one mechanic is publisher-verified. Three independently hashed Dimli/Eve/Fleck originals corroborate it. Only Gog-specific physical provenance remains unresolved; standard gameplay is not reopened.

Mead's built-in split now explicitly uses resolved numeric effects including prior modifiers, with ceil halves and independent subsequent responses. Two Alcohol per player is recorded only as the **unmodified example**, not as a constant when the Drink is modified. Its Event/Chaser and external-split exclusions remain explicit.

Drinking Contest and Round on the House have separate current-edition semantics. Contest initial Events count zero without being skipped; Round on the House discards leading Events and searches for a Drink. Contest comparison, extra Drinks, tie continuation, payout and elimination boundaries are recorded individually.

The validator now checks each audited Drink's effect/special-rule fields against its review and accepts only Fine Ambrosia's specifically authorized Drink project status. M21's already verified physical summaries are checked against separately reviewed character summaries, avoiding false mismatch errors caused by the combined family description. Its actual source mechanics and pending team gate remain intact.

## Drink audit inventory

Quantities were checked individually against the [RDI2 inventory](https://boardgamegeek.com/wiki/page/thing%3A33451%3Amoreinfo) and the [secondary mechanic matrix](https://forums.giantitp.com/archive/index.php/t-211309.html). These are secondary quantity/completeness evidence, not sole gameplay authority. Each ledger review separates them from the specific publisher example/image or user instruction.

| Row | Drink                             | Copies | Result                                                 |
| --- | --------------------------------- | -----: | ------------------------------------------------------ |
| D01 | Dark Ale                          |      2 | VERIFIED                                               |
| D02 | Dark Ale with a Chaser            |      1 | VERIFIED                                               |
| D03 | Dirty Dishwater                   |      1 | Unresolved complete card effects                       |
| D04 | Dragon Breath Ale                 |      1 | VERIFIED                                               |
| D05 | Drinking Contest!                 |      2 | VERIFIED                                               |
| D06 | Dwarven Firewater                 |      2 | VERIFIED                                               |
| D07 | Elven Wine                        |      2 | VERIFIED                                               |
| D08 | Elven Wine with a Chaser          |      1 | VERIFIED                                               |
| D09 | Fine Ambrosia, Nectar of the Gods |      1 | VERIFIED_FOR_PROJECT_RULESET                           |
| D10 | Holy Water                        |      1 | VERIFIED                                               |
| D11 | Light Ale                         |      2 | VERIFIED                                               |
| D12 | Light Ale with a Chaser           |      1 | VERIFIED                                               |
| D13 | Mead                              |      1 | VERIFIED                                               |
| D14 | Ogre Brew                         |      1 | Unresolved exact ordinary values and trait replacement |
| D15 | Orcish Rotgut                     |      1 | Unresolved Orc replacement/full restrictions           |
| D16 | Round on the House!               |      2 | VERIFIED                                               |
| D17 | The Challenge!                    |      1 | Unresolved complete Event/success timing               |
| D18 | Troll Swill                       |      1 | Unresolved Troll replacement                           |
| D19 | Water                             |      1 | Unresolved complete empty-effect/no-Chaser record      |
| D20 | We're Cutting You Off!            |      1 | Unresolved exact negative value/full effects           |
| D21 | Wine                              |      2 | VERIFIED                                               |
| D22 | Wine with a Chaser                |      1 | VERIFIED                                               |
| D23 | Wizard's Brew                     |      1 | Unresolved complete numeric effects                    |

## All outstanding evidence and acceptance gates

| Item                           | Exact missing evidence or acceptance                                                                                                                                                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M41 Gog**                    | Complete original/clear physical card/official card-specific evidence establishing physical identity, Action type, each-other-player one-Gold-to-self payment and any extra restrictions. Other characters' records do not establish Gog's wording.                 |
| **M44 Gog**                    | Direct Gog physical-copy identity/standard-family assignment for its one Tip the Wench copy, or a specifically authorized provenance decision. Standard mechanic and secondary quantity are already verified.                                                       |
| **D03 Dirty Dishwater**        | Complete primary/current record for candidate -1 Fortitude, zero Alcohol, Drink type and no additional rule.                                                                                                                                                        |
| **D14 Ogre Brew**              | Exact candidate ordinary +2 Alcohol/-1 Fortitude and Ogre/Half-Ogre predicate with entire +3 Alcohol/zero Fortitude replacement. Publisher Erin reduction example does not prove exact values or traits.                                                            |
| **D15 Orcish Rotgut**          | Exact Orc predicate and entire +2 Alcohol/zero Fortitude replacement, plus complete restrictions. Ordinary -2 Fortitude has publisher support.                                                                                                                      |
| **D17 The Challenge!**         | Initial Event discard/search behavior, decline behavior, exact survival/payout condition and response/elimination boundaries. Later official examples already verify optional acceptance, two complete Chaser Drinks and one Gold from each other player afterward. |
| **D18 Troll Swill**            | Exact Troll predicate and entire +2 Alcohol/zero Fortitude replacement. Ordinary +1 Alcohol/-1 Fortitude has publisher support.                                                                                                                                     |
| **D19 Water**                  | Complete primary card or equivalent official rule establishing no Fortitude/Gold/extra effects, Drink type and no Chaser. Zero Alcohol comparison alone is insufficient.                                                                                            |
| **D20 We're Cutting You Off!** | Exact candidate -1 Alcohol and no additional effect/Chaser. Current rules establish negative Alcohol and a zero contest score, but not the exact value.                                                                                                             |
| **D23 Wizard's Brew**          | Complete primary/current +2 Alcohol/+2 Fortitude, Drink type and no additional effects/Chaser.                                                                                                                                                                      |
| **M21 test J**                 | A real team-game acceptance test requires shared team runtime/teammate targeting. User elected to retain Step24A scope and leave J pending; no waiver was supplied.                                                                                                 |

For the evidence gaps, an inspected complete current card scan/record or explicit item-specific user decision would allow further review. No M09/M12/M15/M18/M27/M31/M33/M37/M40 override is reused for these rows.

## Evidence inspected

- [Current RDI2 Ninth Edition](https://slugfestgames.com/wp-content/uploads/2021/11/RDI2-9thEd-Web.pdf), including rendered printed pages 1/2/3/6 and per-item rule sections.
- [Publisher Chaser clarification](https://slugfestgames.com/rulesfest-dealing-with-chasers/), with its complete [Wine/Dragon Breath image](https://slugfestgames.com/wp-content/uploads/2015/10/3.png) and [Light/Dark Chaser chain image](https://slugfestgames.com/wp-content/uploads/2015/10/2.png) visually inspected.
- Complete [Round on the House image](https://slugfestgames.com/wp-content/uploads/2015/10/4.png) visually inspected for leading-Event discard/search and every-player copies. The illustration in the Ninth Edition PDF is cropped; it is not cited as complete printed card text.
- [Publisher Holy Water clarification](https://slugfestgames.com/rulesfest-the-first-rule-of-sometimes/) and complete [Holy Water image](https://slugfestgames.com/wp-content/uploads/2015/11/1stRuleExample1.png) visually inspected.
- [Current Natyli rules](https://slugfestgames.com/wp-content/uploads/2021/11/NatyliRulesWeb.pdf), printed page 2, for Dwarven Firewater, Elven Wine and ordinary Troll Swill.
- [Current Erin rules](https://slugfestgames.com/wp-content/uploads/2021/11/ErinRulesWeb.pdf), printed page 2, as partial Ogre Brew evidence only.
- [RDI10 rules](https://slugfestgames.com/wp-content/uploads/2026/02/RDI10RulesWeb.pdf), printed pages 12/17, as partial Challenge/Orcish Rotgut evidence; [RDI8](https://slugfestgames.com/wp-content/uploads/2021/11/RDI8RulesWeb.pdf) corroborates the Challenge example.
- [Combined rules](https://slugfestgames.com/wp-content/uploads/2019/02/Red_Dragon_Inn_Combined_Rules_as_of_RDI_7_v_1.1.pdf), printed page 33, as partial Water comparison evidence only.
- [Publisher teleconference example](https://slugfestgames.com/teleconference-rdi/), for Wine combined with Dark Ale.
- [Current RDI3 Sixth Edition](https://slugfestgames.com/wp-content/uploads/2012/08/RDI3-Rules.pdf), printed page 6, directly specifies ordinary Wine at two Alcohol Content. RDI10 printed pages 2/5 separately verify the named standard Tip the Wench target/payment facts; the cropped Ninth Edition page 2 illustration establishes its title/type.
- Six M42–M44 original physical records inspected separately; full-file hashes match the user-authorized Dimli/Eve/Fleck crosscheck. Each canonical record hash is preserved in the private ledger. Publisher Eve/ordinary payment rules were reconciled separately.

Publisher images/PDFs and full original text remain in the ignored local evidence cache. No artwork or full proprietary text database was added to public fixtures.

## Validation

| Command                                             | Exact result                                                                                                                                                                                              |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run content:verify:rdi2-source`                | Exit 1 as required: 42/44 mechanic and 15/23 Drink reviews qualify, ten evidence gaps and M21/J remain, normalized source/source lock absent. The previous M21 physical-summary mismatch errors are gone. |
| `npm run typecheck`                                 | Exit 0.                                                                                                                                                                                                   |
| `npm run lint`                                      | Exit 1: ESLint passed; Prettier reports the four existing files listed below.                                                                                                                             |
| `npm test`                                          | Exit 1: **2,376 passed / 1 failed / 2,377 total**, all 26 configured subruns executed, including actual Workers runtime suites. Sole failure is the existing private-content policy assertion.            |
| `npm run test:coverage`                             | Exit 1 for the same existing test failure; **2,376 passed / 1 failed**. All 90 covered files meet the 90% per-file gates. Aggregate: statements 99.55%, branches 97.97%, functions 99.68%, lines 99.69%.  |
| `npm run build`                                     | Exit 0.                                                                                                                                                                                                   |
| `npm run test:e2e`                                  | Exit 0: **27/27 passed** across fixture, development and production RDI1 browser configurations.                                                                                                          |
| Focused RDI2/generic/timing/elimination regressions | Exit 0: **892/892 passed**, 72 files, rerun after the final evidence-locator updates.                                                                                                                     |
| `git diff --check`                                  | Exit 0.                                                                                                                                                                                                   |

Existing formatting failures:

- `content-private/imports/rdi1/reaudit-required-corrections.json`
- `content-private/imports/rdi1/versions/content_rdi1_mechanics_v1/content-private/imports/rdi1/source-normalized.json`
- `content-private/imports/rdi1/versions/content_rdi1_mechanics_v1/source-lock.json`
- `content-private/imports/rdi2/README.md`

The existing `tests/content/private-content.test.ts` failure expects four private paths to be ignored, while current `.gitignore` ignores only `src/content/private/` among those paths. Private import files are also already tracked. This audit does not rewrite that policy, untrack supplied data or reformat immutable RDI1 content.

Forty focused tests were added for individual Drink review boundaries and field drift, the scoped Fine Ambrosia override, M42/M43 payment/type/target behavior, M44's retained provenance gap and M21 character-summary validation. Existing checkpoint tests now assert the final audit state rather than incorrectly requiring later records to remain unaudited.

The complete Git diff was inspected, including earlier outstanding engine/runtime changes. A semantic comparison against this turn's saved source/ledger checkpoint confirms M01–M41 gameplay and ledger reviews remain unchanged, apart from M21's reviewed character-summary metadata. All physical quantities are unchanged; only the listed M42/M43 corrections, M44 review and individual Drink audits were advanced. There is no RDI1 content diff and no staged change or commit. Publisher artwork/full original records remain outside public fixtures in the ignored local evidence cache.

**Step 24B is not safe to begin.** Skipping an item does not satisfy the source-lock gate or waive the required checks. The audit pass is complete with the consolidated gaps above; the release/source-lock milestone remains blocked.

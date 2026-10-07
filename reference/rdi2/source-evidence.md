# RDI2 source evidence

Current status: **Step 24A COMPLETE**, with 44/44 mechanic rows and 23/23 Drinks individually qualified, zero source blockers, and a generated/verified immutable normalized source and lock. Team mode and M21/J remain a user-authorized non-blocking TODO for all steps. See the [final source verification report](../../docs/rdi2-source-verification-report.md). Earlier checkpoints below are historical and retain their original evidence limits.

Historical update: M40 is COMPLETE / VERIFIED_FOR_PROJECT_RULESET under the scoped M40 USER OVERRIDE. Shared Anytime, cap20, final rescue and Negate acceptance tests pass; printed Gog title remains unavailable and waived, with an explicit normalized fallback. M41 stops at unavailable complete Gog payment-card evidence after independently verifying Dimli/Eve/Fleck originals. Current count 40/44 qualified mechanic reviews, 0/23 Drinks; M21/J remains pending. No source lock or Step24B. See [current report](../../docs/rdi2-step24a-m40-m41-progress.md). Prior checkpoints below are historical.

M27 is COMPLETE with the scoped Gog physical-copy provenance override, preserving all publisher gameplay evidence. M28–M30 are individually VERIFIED after original-record and current publisher checks. M31 stops on missing provenance/complete wording for all five Gog physical copies; its named publisher two-damage template and secondary quantity do not resolve that inventory. Current count: 30/44 qualified mechanic reviews, 0/23 Drinks. M21/J stays pending. No source lock or Step 24B is created. See [current report](../../docs/rdi2-step24a-m27-m31-progress.md).

Earlier checkpoint notes below are preserved as history.

Current checkpoint: the user's [explicit workflow decision](../../codex-prompts/step-24a-source-audit-continuation.md) allows M22 onward source audits while M21/J stays pending. M22–M26 are individually source VERIFIED. M27's publisher mechanic, direct-effect predicate and incoming restriction are now COMPLETE; only separate Gog physical-copy provenance remains pending. The [current M27 report](../../docs/rdi2-step24a-m27-progress.md) records publisher URLs, individual original hashes, generic tests and required checks. The [earlier continuation report](../../docs/rdi2-step24a-m22-m27-progress.md) and later sections retain historical checkpoints.

## Authority order

1. Current SlugFest official rules / official errata / official later rules.
2. User-provided card data (`HaxxonHax/the-inn`) for Dimli, Eve and Fleck, cross-checked against current official rules.
3. Complete community quantity/mechanic matrix.
4. BGG catalog data only as a catalog/quantity cross-check, never as sole rules authority.

If sources disagree, **do not guess**. Step 24A must resolve the conflict with primary/current evidence or stop.

## Official RDI2 Ninth Edition

https://slugfestgames.com/wp-content/uploads/2021/11/RDI2-9thEd-Web.pdf

Verified directly:

- 4 character decks, exactly 40 cards each: Dimli, Eve, Fleck, Gog
- 30-card Drink deck
- Sometimes/Anytime timing
- response opportunity starts with the player who played/revealed the source
- after a response resolves, the original source receives a new response cycle
- forced gambling leave offers response before leaving completes
- direct-stat definition for Fortitude/Alcohol/Gold response cards
- redirected Fortitude keeps its original source
- each redirect applies once, in play order
- Negate vs Ignore
- Drink-changing counter restrictions
- split Drinks are independent
- Mead current split behavior
- Round on the House
- Drinking Contest
- Bar Deck

## Official Eve updates

https://slugfestgames.com/the-new-eve/

Mandatory overrides over older material:

- Eve's relevant defensive illusion is the broad Fortitude/Alcohol/Gold version.
- Eve's direct Alcohol attack is +2 Alcohol.
- Eve's fire attack is 3 Fortitude loss.

## Official errata / Illusionary Coin

https://slugfestgames.com/clarifications-and-errata/

Illusionary Coin prevents the current required Gold loss. For ante semantics, the ante still counts as having been made even though no Gold transfers.

## Dimli restart gambling

https://slugfestgames.com/wp-content/uploads/2021/11/GIIRulesForWeb.pdf

Dimli's special post-win response keeps the existing round/pot, has eligible remaining players ante, and repeats the gambling game.

## The Challenge — later official examples

https://slugfestgames.com/wp-content/uploads/2021/11/RDI8RulesWeb.pdf
https://slugfestgames.com/wp-content/uploads/2026/02/RDI10RulesWeb.pdf

Later official examples explicitly show the revealing player deciding to accept The Challenge, revealing two Drinks (with Chasers), taking both, and getting Gold from each other player when successful.

## Uploaded The Inn

Used only for Dimli/Eve/Fleck. Hashes and per-mechanic counts are in `the-inn-crosscheck.json`.
Gog is not present in the uploaded source.

### Step 24A M05–M12 historical reviews

M01–M04 were individually checked on 2026-10-05 against the directly inspected RDI2 quantity table, supplied per-row crosscheck, and official Ninth Edition rules. Their private ledger entries record each check and its evidence.

M05 `cheat_control_and_eject` is now individually VERIFIED on 2026-10-05. The supplied [original Eve/Fleck records](m05-eve-fleck-control-eject-original-records.json) independently establish Cheating, control takeover, one current participant being forced out, no further Gambling/Cheating for that participant this Round, and retention of already-anted Gold. Both canonical record SHA-256 values were independently reproduced. Full source-file hashes remain supplied provenance; the absent original files were not rehashed. Per-character quantities agree with the matrix and the supplied Dimli/Eve/Fleck crosscheck.

Current Ninth Edition pages 2–3 establish gambling priority and generic response-before-forced-leave / response-before-sole-player-win timing, continuing legal Sometimes/Anytime availability after leaving, and pot retention. The [Gambling 102 explanation](https://slugfestgames.com/rulesfest-gambling-102/) links a readable Fleck control/eject example, but its generic prose uses “another player.” The user's explicit project decision resolves the target as `ANY_ACTIVE_GAMBLER`, self-target `ALLOWED`. This permission is recorded as **PROJECT_RULE_OVERRIDE**, with `officialSourceVerified: false`; it is not an official-source verification claim. The original records are unchanged, and the previous M05 blocker review is retained as history.

M06 is **VERIFIED_FOR_PROJECT_RULESET** on 2026-10-05. The user's verified facts and the Ninth Edition forced-leave example establish Gog's canonical identity, one Sometimes anti-cheat response, response opportunity before forced leave, and the immediate-win/pot semantics. The user's separate project instruction supplies exact Negate and continuing-participation requirements. Both fields remain **PROJECT_RULE_OVERRIDE**, with `officialSourceVerified: false`; exact original Gog wording is not claimed verified. The candidate, field-level ledger and validator preserve that distinction. Countering M06 leaves the original Cheating card pending. Tests use synthetic content with the existing generic engine, without implementing Step 24B or publishing RDI2.

M07 is individually **VERIFIED**: Dimli/Eve/Fleck/Gog each one Sometimes. The publisher's [shared printed card](https://slugfestgames.com/wp-content/uploads/2016/01/GII102.3.png) explicitly permits use after leaving the Round. [Gambling 102](https://slugfestgames.com/rulesfest-gambling-102/) and current rules confirm active-Round timing, prohibited ante-causing/round-ending responses, legal forced-leave responses including a two-player Round, and prohibition after final pass. The candidate's missing post-leave permission was corrected from that direct evidence.

M08 is individually **VERIFIED**: Dimli one Sometimes, other characters zero. The publisher's [Dimli printed card](https://slugfestgames.com/wp-content/uploads/2016/01/GII102.4.png) establishes retention of the pot, only remaining participants anteing 1 additional Gold, actor currently winning and continuation left. Its explicit named-card exclusion replaces the unverified broader `winnerNotAlreadyReplaced` condition. This identity reference is source metadata; no engine title checks were added. The official [Gambling? I'm In! integration rules](https://slugfestgames.com/wp-content/uploads/2021/11/GII-InsideRDI1.pdf) independently confirm remaining players ante and repeat the game. Variant-specific dice/card instructions are not imported into base RDI2. Current timing and the publisher's restart example agree; the inspected errata page provides no superseding restart restriction.

M09 is **VERIFIED_FOR_PROJECT_RULESET**. [Dimli original JSON](https://raw.githubusercontent.com/HaxxonHax/the-inn/main/Cards/base/dimli/dimli.json) and [Fleck original JSON](https://raw.githubusercontent.com/HaxxonHax/the-inn/main/Cards/base/fleck/fleck.json) were fetched; both complete-file SHA-256 hashes reproduce the uploaded crosscheck. All four named M09 records were independently inspected; their Sometimes types and broad pending self-payment/ante/Gold-taken triggers agree. Public artifacts retain identity, hashes and rules summaries, not the complete downloaded decks. The user's M09 override supplies equivalent Gog semantics only; exact Gog text remains UNAVAILABLE and not official-source-verified.

The [official RDI6 rules](https://slugfestgames.com/wp-content/uploads/2021/05/RDI6-3rdEd.pdf), printed pages 5 and 9, verify own-card payment legality and recipient preservation. The [official combined rules](https://slugfestgames.com/wp-content/uploads/2019/02/Red_Dragon_Inn_Combined_Rules_as_of_RDI_7_v_1.1.pdf), printed page 17 Merchant Ship, explicitly distinguish four independent payments from one payment. M09 replaces the whole current Gold-loss instance, including an ante or Gold taken, using Inn Gold to the original destination. Inn-to-Inn has no net transfer; payer gains no Gold. Source-specific restrictions still apply. RDI6 Minion Wages is an explicit special cost rule, not a universal one-Gold limit on M09. The [official RDI9 rules](https://slugfestgames.com/wp-content/uploads/2023/07/RDI9RulesForWeb.pdf), printed page 9, provide a supplemental generic payment-substitution example, not Gog wording.

M10 is **VERIFIED**. Both physical [Eve original JSON](https://raw.githubusercontent.com/HaxxonHax/the-inn/main/Cards/base/eve/eve.json) Illusionary Coin records were independently inspected and file hash reproduced. The [official clarifications](https://slugfestgames.com/clarifications-and-errata/) explicitly establish that the intended recipient gets no Gold, other effects continue, and a prevented ante counts even without Gold transfer. Current Ninth Edition recognizes Coin for ante fulfillment. No payment from the Inn or Gold movement to the pot is inferred; one current loss instance is prevented. No project override applies to M10.

M11 is **VERIFIED**. The single original Eve Sleight of hand... record establishes one Gold from the pot during an active Round, explicit permission after leaving, and no other Round effect. The official combined rules, printed page 14, explicitly reference this card and confirm that stealing the last Gold does not award a Prize. This card does not win/end the Round or alter control. No Prize variant is implemented.

M12 `avoid_ante_leave` is **VERIFIED_FOR_PROJECT_RULESET**: Dimli 2, Eve 0, Fleck 1, Gog 2. The three exact pure-mode Dimli/Fleck records were rechecked against their hashed original JSON files. The official Ninth Edition, printed page 3, verifies Gog's opening-ante example and generic leaving consequences: earlier Gold stays, no future participant antes, Gambling/Cheating prohibited while otherwise-legal Sometimes/Anytime remain available.

The user's independently hashed [M12 override](../../codex-prompts/step-24a-m12-user-override.md) explicitly resolves Gog's second template as ante avoidance/leave **OR** Ignore Drink, and permits later self-ante responses including I raise!. Both decisions are **M12 USER OVERRIDE**, not newly discovered publisher wording. Exact Gog text remains UNAVAILABLE and `officialSourceVerified` false. The original M12 blocker review is preserved as history; its two overridden points no longer block the project ruleset. M09 remains independent and unchanged.

The two templates bind existing Gog rows without changing counts: pure-mode M12 quantity two and dual-mode M13 quantity one. M13's overall source verification is not advanced by the M12 task. Concrete source metadata and synthetic runtime fixtures agree: active participation, actual pending SELF ante, initial/later context, current-only cancellation before payment, no refund and context-exclusive whole-Drink Ignore with Chasers. Eight focused behavior cases and the existing generic/RDI1 gambling regressions pass using the shared engine; no Gog/title checks or production compiler are introduced. M13 onward mechanic/ledger rows and all Drink records retain their prior statuses and data. No normalized source or source lock is created; remaining unverified entries still close the source gate.

## Complete quantity/effect matrix

https://forums.giantitp.com/archive/index.php/t-211309.html

This transcription gives all RDI2 mechanic rows and counts. It is useful for completeness but must never override newer official rules/errata.

## RDI2 Drink list cross-check

https://boardgamegeek.com/boardgame/33451/the-red-dragon-inn-2

The list totals 30 cards, but see the Fine Ambrosia conflict below.

## Fine Ambrosia hard conflict

The detailed legacy mechanical table places Fine Ambrosia before the `Drink Events` heading and assigns numeric Drink-like effects:

- +1 Alcohol
- +4 Fortitude
- pay 2 Gold

BGG's catalog labels the same card as `(Drink Event)`.

The original package did **not** choose between those classifications.

The user subsequently resolved the intended game behavior on 2026-10-05: Drink Event, +1 Alcohol, +4 Fortitude, and payment of 2 Gold to the Inn. The candidate and D09 ledger preserve this as `USER_RULE_OVERRIDE`, along with both original conflicting candidates. It supersedes the original request to wait for a card image for this decision, while leaving all other item-by-item verification requirements in force. It is not a claim that either secondary source was verified as the current official card.

### M13 individual continuation review

M13 is VERIFIED_FOR_PROJECT_RULESET. The three original Dimli/Eve/Fleck JSON files linked above were downloaded again and full hashes reproduce the supplied crosscheck. One exact dual-mode record in each deck was individually inspected; canonical titles and per-record hashes are recorded in the private ledger. All three state own current ante avoidance/leave, retained prior Gold, Gambling/Cheating restriction, OR Ignore Drink after inspection. Current Ninth Edition pages 3–4 and publisher clarifications supply whole-Chaser and self-affected Drink scope, timing, normal continuation and later ante exclusion after leaving. Gog uses only the already authorized M12 Template B, with exact wording UNAVAILABLE and project provenance preserved. Source validator regressions reject altered provenance and branch semantics. M14 onward and all Drinks are still pending. See [current continuation report](../../docs/rdi2-step24a-m13-progress.md).

### M15 historical stop and explicit project resolution

M15 was UNRESOLVED_MISSING_CARD_EVIDENCE. Dimli's exact original helmet record is individually checked, with reproduced file hash and canonical record hash recorded in the private ledger. Each quantity is checked: Dimli 1, Eve 0, Fleck 0, Gog 2. The [official Adonis/Lich King rules](https://slugfestgames.com/wp-content/uploads/2017/08/ALKRulesForWeb.pdf), printed page 1, demonstrate Gog's Stop poking Gog responding to an Action's Fortitude loss and being Negated. They do not reproduce the complete Gog card. The [historical stop](../../docs/rdi2-step24a-m15-blocked.md) remains preserved. On 2026-10-06 the user explicitly authorized **M15 USER OVERRIDE** for two identical copies and the exact Sometimes/direct SELF Fortitude Action/Sometimes/Anytime shared Ignore template. M15 is now VERIFIED_FOR_PROJECT_RULESET; physical wording remains UNAVAILABLE, never publisher-verified. M12/M09 provenance is not reused. See [the current M15 report](../../docs/rdi2-step24a-m15-progress.md). M16 onward and all Drinks remain pending.

### M14 direct printed-card evidence

M14 is individually VERIFIED: Dimli 0, Eve 2, Fleck 0, Gog 1. Both distinct Eve original records individually inspected and hashed; official The New Eve revised card image read visually. A complete readable Gog Shut up! printed-card photo from Couchman’s Corner (2015-04-09) was downloaded and inspected directly, with photo hash and explicit reviewer-hosted provenance. This is not a publisher-host claim or inference from Eve. Current Ninth Edition direct-stat/Ignore examples reconcile the exact categories, relation and gambling exclusion. RDI6 printed page 5 adds the generic own-card Gold payment restriction. No project override used; M12/M09 authority remains limited to their named cards. See [M14 report](../../docs/rdi2-step24a-m14-progress.md). The subsequent M15 review stops at missing Gog evidence as recorded above; M16 onward and all Drinks remain pending.

### M16 complete protected-counter source evidence

M16 is individually VERIFIED, with final required checks in [its report](../../docs/rdi2-step24a-m16-progress.md). One exact original record for each Dimli/Eve/Fleck was independently inspected and original file hashes reproduced. Gog not think so! is printed in full in the [official Ninth Edition](https://slugfestgames.com/wp-content/uploads/2021/11/RDI2-9thEd-Web.pdf), page 4; the PDF artifact is downloaded and hashed. Each character has one copy, checked separately. Incoming and outgoing equivalence use shared protected-counter family metadata; no project override and no Gog/card-title check in the engine. Later rows and Drinks remain pending until M16's required checks complete.

### M17 direct publisher images for both Gog Drink defenses

M17 is individually VERIFIED. Six physical Dimli/Eve/Fleck originals independently inspected and file hashes reproduced. The [publisher's Second Rule of Sometimes](https://slugfestgames.com/rulesfest-the-second-rule-of-sometimes/) directly links [two complete Gog card images](https://slugfestgames.com/wp-content/uploads/2015/11/2ndRuleofSometimes3.png), downloaded, hashed and viewed directly. Both show the full Sometimes Drink Ignore after inspection, no cost or extra restriction; article explicitly permits the second copy after first Negated. Current Ninth Edition supplies complete Chaser and own-Drink scope, distinct from Events. No project override or inferred Gog text. See [M17 report](../../docs/rdi2-step24a-m17-progress.md); later entries remain pending until final checks complete.

### M18 partial review and exact evidence stop

Four Dimli/Eve physical records independently inspected and hashed, original file hashes reproduced. Current official phase rename and additional-Drink rules reconcile their own-phase, one-Gold/two-extra-Drink effect and other-player distribution. Gog quantity/family remain secondary-matrix evidence; complete Gog M18 records or readable full card images have not been located in inspected sources. Exact identity/type, phase, payment/amount, targets and printed restrictions remain unresolved. No M18 user override authorized; M15 authority cannot transfer. See [M18 stop](../../docs/rdi2-step24a-m18-blocked.md). M01–M17 completion preserved; M19 onward and all Drinks unchanged.

### M18 standard mechanic and separately authorized Gog provenance

The former M18 missing-provenance stop is superseded by the independently hashed [M18 USER OVERRIDE](../../codex-prompts/step-24a-m18-user-override.md). Gog ownership, quantity two and identical standard-copy assignment use only this authority, not a publisher-direct claim. Underlying type, own-phase timing, one-Gold Inn payment and two-extra-Drink effect are independently publisher-supported: [Daareka print-and-play](https://slugfestgames.com/wp-content/uploads/2016/12/RedDragonInn6DaarekaPrintAndPlay.pdf), page 3 top middle/right, downloaded/hashed/rendered/visually inspected, corroborated by [Spyke/Flower official rules](https://slugfestgames.com/wp-content/uploads/2018/07/SFRulesForWeb.pdf), printed page 1. Current RDI2 shared ordering rules verify hidden placement/distribution to other players. Four Dimli/Eve originals individually rechecked and hashes reproduced. M18 is VERIFIED_FOR_PROJECT_RULESET; see [current report](../../docs/rdi2-step24a-m18-progress.md). Original stop review remains historical; later rows and all Drinks unchanged.

### M19 original Fleck dual-context records

Both physical Fleck records were individually inspected in a fresh download of the authorized original JSON. File SHA-256 matches the supplied crosscheck; separate per-record hashes reproduce. Exact Sometimes type and own-phase two free additional Drinks OR self refill-payment exemption are original-reference evidence, not publisher-direct card provenance. Dimli/Eve absence checked separately in their hashed originals; supplied complete matrix confirms all four character quantities, with Gog absent. Current Ninth Edition and the official phase rename reconcile legacy Buy Drinks wording, current other-player face-down distribution and one Gold per player to Inn at refill. No override. All seven M19 source checks pass; shared refill response/waiver remains an engine capability gap for Step 24B. See [M19 report](../../docs/rdi2-step24a-m19-progress.md); later entries remain pending until required checks are recorded.

### M20 original Fleck all-player Inn toast

One complete physical Fleck Action record individually inspected from a fresh original-reference download; file and record hashes reproduce. It explicitly includes self, draws each player's own Inn Drink, and discards leading Events without effects while searching for a Drink. Current Ninth Edition governs Chasers and simultaneous response/consumption timing. A Chaser Event terminates its chain under current rules; this is separate from the printed leading-Event search. No project override, contest or Round on the House copy semantics. Dimli/Eve originals and supplied matrix separately verify absence. Seven source checks pass; engine support remains explicitly partial because the existing simultaneous Inn batch cannot skip leading Events. See [M20 report](../../docs/rdi2-step24a-m20-progress.md), with required checks recorded before continuing.

### M21 partial official Gog evidence and exact stop

Dimli's single Drink up, friend! record was individually inspected in a fresh authorized original-reference download; file and record hashes reproduce. The [official Ninth Edition](https://slugfestgames.com/wp-content/uploads/2021/11/RDI2-9thEd-Web.pdf), printed page 2, reproduces its complete Sometimes/other-player Drink Phase/additional own-pile Drink template. Eve/Fleck absence were checked separately in hashed originals and the supplied complete matrix. Gog's two-copy Sometimes/family assignment is matrix-supported.

The [official RDI8 rules](https://slugfestgames.com/wp-content/uploads/2021/11/RDI8RulesWeb.pdf), printed page 12, and [official RDI10 rules](https://slugfestgames.com/wp-content/uploads/2026/02/RDI10RulesWeb.pdf), printed page 14, each name Gog from RDI2 and Gog say you drink MORE! in the Skipping or Repeating Phases example. The selected opponent drinks again during the affected team's Drink Phase; only that player is affected. Both PDFs downloaded, hashed and relevant pages inspected. This verifies identity and partial effect, not complete Gog printed wording. The publisher GogSayDrinkNow image is illustration only, inspected visually; the previously inspected reviewer photograph contains three different cards. Neither provides the missing text.

M21 is **UNRESOLVED_MISSING_CARD_EVIDENCE / BLOCKED_MISSING_EVIDENCE**. Exact Gog trigger, extra-Drink source, amount wording and all printed restrictions/identical-copy semantics remain unverified. Do not substitute Dimli semantics or reuse prior overrides. M01–M20, M22–M44, all Drink records and existing overrides are preserved. See [exact evidence stop](../../docs/rdi2-step24a-m21-blocked.md).

### M21 explicit override resolution and pending team acceptance

The historical wording stop above is superseded by the independently hashed, byte-for-byte preserved [M21 USER OVERRIDE](../../codex-prompts/step-24a-m21-user-override.md). It supplies Gog's actual other-player Drink reveal trigger (including contest), count one, target own pile, no self targeting, independent Drink and unchanged contest comparison, and exactly two identical copies. All those reconstructed full-semantic fields remain PROJECT_RULE_OVERRIDE, with exact physical wording UNAVAILABLE and officialSourceVerified false. Dimli's original phase-only template remains independently verified and unbroadened.

[Official RDI8 rules](https://slugfestgames.com/wp-content/uploads/2021/11/RDI8RulesWeb.pdf), printed pages 3-8 and 11-12, separately support generic Drink/Chaser/empty-pile/counter/contest rules, personal Drink piles and another-player targeting excluding teammates, plus the named Gog repeated-drinking example. The supplied secondary reveal wording is recorded as a user-provided quotation, not publisher-direct wording or newly accessed remote evidence. The eighteen synthetic existing-engine behavior tests and source regressions pass. Source review is VERIFIED_FOR_PROJECT_RULESET, while **INCOMPLETE_ENGINE_ACCEPTANCE** retains pending real team test J. The user chose to keep Step 24A scope and leave that acceptance pending because no team runtime/target validation exists. See [current M21 report](../../docs/rdi2-step24a-m21-progress.md). M22 onward and all Drinks remain pending; no Step 24B begins.


### Final source resolution and independent 67-row re-audit

All M01–M44 and D01–D23 were individually rechecked after the [final user instruction](../../codex-prompts/step-24a-final-source-lock-resolution.md). Fresh Dimli/Eve/Fleck downloads reproduce their original supplied hashes and 40-card quantities. Every current ledger original-record hash and cached artifact hash reproduces; check/evidence links, per-character matrix quantities, source classifications, structured legality and special-effect references were rechecked. The prior 57 qualified source rows remain unchanged. Final source qualification is 44/44 mechanics and 23/23 Drinks, with 160 character cards and 30 Drink cards.

The ten new decisions are explicit user evidence, not newly located publisher scans. Their precise classification is preserved in the private ledger and [override record](known-overrides.md). M21 still has nine passing runtime acceptance cases and pending real team test J. The latest separately preserved user decision makes team mode and test J non-blocking for every step. See [current resolution report](../../docs/rdi2-step24a-final-source-resolution.md).


## Team mode is a non-blocking TODO for all steps

On 2026-10-07 the user answered: “keep team mode a TODO, not blocking for any step”. The [preserved workflow decision](../../codex-prompts/step-24a-team-mode-nonblocking-todo.md) supersedes the earlier final-lock restriction. M21 source review is complete; real team acceptance J and team runtime remain pending, without a passing or implementation claim. Team mode does not block Step 24A or later steps. Its source rules and publisher/user classifications are unchanged, and all non-team gates remain required.


### Step 24A completed

All required checks pass. Immutable normalized source and source lock are generated and independently verified with actual SHA-256 hashes. All 44 mechanics and 23 Drinks qualify for the project ruleset. See the [final source verification report](../../docs/rdi2-source-verification-report.md); Step 24B was not started.

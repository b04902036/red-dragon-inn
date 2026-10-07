# RDI2 known current-edition overrides

These are mandatory; old data must not silently win.

Current status: Step 24A COMPLETE; all source items qualify and the immutable lock verifies. Earlier progress sections below preserve the decisions made at those times. The final resolutions and non-blocking team-mode decision supersede their historical blockers. See the [final report](../../docs/rdi2-source-verification-report.md).

## M05 current participant and self-target permission

Explicit project decision on 2026-10-05: `cheat_control_and_eject` selects `ANY_ACTIVE_GAMBLER`, and self-target is `ALLOWED` for both Eve and Fleck.

Record this as `PROJECT_RULE_OVERRIDE`, with `officialSourceVerified: false`. The supplied original wording selects one player in the current Round; the official generic Gambling 102 prose describes another player. The project permission resolves that interpretation for this app without claiming official verification of self-target legality. Keep the original evidence and the override separate. Generic forced-leave responses, post-leave restrictions and already-anted Gold retention remain grounded in the current official rules and original records.

## M06 anti-cheat response project ruleset

The user's 2026-10-05 instruction defines a pending Cheating card during an active Round, with the responder still participating. Successful resolution Negates the source and immediately wins the Round and current pot. Pending forced leave preserves participation until it resolves; a Negated M06 leaves the original source pending.

Record `negatesCheatingCardRule` and `requiresActiveParticipation` as **PROJECT_RULE_OVERRIDE**, with `officialSourceVerified: false`. The canonical Gog identity, quantity, anti-cheat classification, forced-leave response opportunity and win-round semantics are verified separately. Exact original Negate wording and participation wording remain unverified. M06 is **VERIFIED_FOR_PROJECT_RULESET**, not fully official-source-verified.

The source gate accepts individually authorized project-rule statuses only with matching scoped provenance and exact user-defined trigger/effects. Later item-specific decisions are recorded separately below. Synthetic tests exercise the existing generic engine; no Gog/card-title checks were added to engine code and no RDI2 production content was compiled.

## M09 Gog payment-substitution override

The user's [M09 unblock instruction](../../codex-prompts/step-24a-m09-unblock.md) and [payment evidence](m09-payment-substitution-evidence.json) explicitly authorize Gog's two M09 cards to use exactly the verified Dimli/Fleck family semantics, with no additional card-specific restriction. Record Gog quantity as VERIFIED, mechanic family as VERIFIED_SECONDARY_MATRIX, exact text as UNAVAILABLE and normalized semantics as PROJECT_RULE_OVERRIDE; `officialSourceVerified` remains false. M09 is VERIFIED_FOR_PROJECT_RULESET.

The original Dimli/Fleck JSON files were fetched and rehashed; all four named records independently establish impending self Gold loss, including payment, ante and Gold taken, paid with Inn Gold. Official rules establish whole current instance, preserved recipient, own-card payment legality and separate-payment boundaries. No fixed one-Gold cap or global future-payment waiver applies. Explicit source-specific nonavoidability, substitution bans, Inn-payment bans or special costs retain priority. This override is limited to M09; it does not resolve M12 or later Gog cards.

## M10 and M11 verified source semantics

Illusionary Coin prevents the current qualifying Gold loss without any Gold movement; a prevented ante counts as paid and other source effects continue. This is distinct from M09's Inn payment to the original recipient. Both original Eve physical records and explicit official clarifications establish it without a project override.

Sleight of hand... takes one Gold from the current pot, may be used after leaving an active Round and has no other effect on that Round. The official Prize clarification excludes taking a Prize, including when the last Gold is stolen. No implementation of the Prize variant is introduced.

## M12 USER OVERRIDE: Gog ante-avoidance templates

The user's [M12 instruction](../../codex-prompts/step-24a-m12-user-override.md) independently resolves two decisions: Gog's second effect template includes the Ignore Drink alternative, and Gog may respond to later required antes, including I raise!, while still participating. Both are explicitly **M12 USER OVERRIDE**, represented as `PROJECT_RULE_OVERRIDE` with `officialSourceVerified: false`. Exact original Gog card text remains UNAVAILABLE. This does not reuse or broaden M09.

Template A cancels the pending own ante before Gold is collected, then leaves. Template B selects that same ante branch or ignores the current whole Drink, including Chasers, using existing shared `CONTEXT_BRANCH` resolution. Its Drink branch does not leave gambling or charge Gold. Source-specific prohibitions on responses still apply. Only the current ante is canceled; prior pot contributions remain and other players' obligations continue. Once departed, the player is excluded from later participant antes, cannot play Gambling/Cheating, and may still play otherwise-legal Sometimes/Anytime cards. Those generic leaving consequences are publisher-supported separately.

Effect templates do not redefine physical quantities. The existing matrix retains two Gog pure-mode M12 copies and one Gog dual-mode M13 copy. M12's override records and binds both templates; the M13 overall source review remains pending, and no other character's M13 wording is inferred. The generic engine already supplies ante-response windows before deduction for initial and later antes; eight focused behavioral tests and existing gambling regressions verify it without an engine refactor.

## M07 and M08 publisher-card corrections

M07 expressly allows play after leaving the Round. Its other active-Round, ante-source and round-ending-source restrictions remain. This correction comes from the publisher's printed shared card and Gambling 102 clarification.

M08's printed exclusion names `Um… I know you think you won, but…`. The previous generic `winnerNotAlreadyReplaced` restriction was broader than verified evidence and was removed. The exact named-card reference is structured source metadata for a future content binding, not a card-title check in engine code. No prohibition on every winner-changing effect is inferred.

## Eve

Official SlugFest Eve update:

- broad defensive illusion: protects against qualifying Fortitude / Alcohol Content / Gold effects
- direct Alcohol effect: **+2 Alcohol**
- fire attack: **3 Fortitude loss**

The corrected candidate matrix already applies these changes.

## Mead

Current Ninth Edition rules:

- base Mead is **3 Alcohol**
- after normal pre-split modification opportunity, the drinker may use Mead's built-in split
- each half is computed with round-up; unmodified Mead therefore produces two 2-Alcohol Drinks
- after splitting, the two Drinks are independent and may be modified separately
- Mead cannot be split if it was obtained as a Chaser or as the result of a Drink Event
- Mead cannot be affected by another card that splits a Drink

Do not use the older shorthand that gives another player a full duplicate 3-Alcohol Mead.

## Redirected Fortitude loss

Keep the original source player/card. Only Fortitude loss redirects; unrelated effects do not. Multiple redirects apply once each, in order played.

## Fine Ambrosia

User rule decision confirmed on 2026-10-05: treat Fine Ambrosia as a Drink Event, with +1 Alcohol, +4 Fortitude, and payment of 2 Gold to the Inn. The candidate now encodes these exact effects.

The private candidate and D09 ledger record this as `USER_RULE_OVERRIDE`, separately from official verification. The conflicting legacy/catalog evidence remains preserved. D09 is now individually VERIFIED_FOR_PROJECT_RULESET: quantity checked separately, all five source checks pass, Event/Chaser/Contest behavior follows current shared rules. The classification and exact +1 Alcohol/+4 Fortitude/pay-Inn-two effects remain the existing USER_RULE_OVERRIDE, never publisher-direct card wording. Historical conflicting candidates are preserved. Other unresolved items and M21/J still prevent a source lock.

## The Challenge

The candidate below must still be verified before locking. Current/later official examples verify optional acceptance, two complete Chaser Drinks and one Gold from each other player afterward; they do not establish the complete Event-search, decline, survival or response/elimination rules. D17 remains unresolved. Proposed candidate constraints, not a complete verified rule:

- revealing player may choose whether to accept
- if accepted, reveal two complete non-event Drinks (with Chasers)
- resolve both
- if the challenger survives the complete challenge resolution, collect 1 Gold from each other applicable player

Step 24A must reconcile the exact success/payment timing with the source and record it.

## M13 review under existing M12 Template B authority

M13 is individually VERIFIED_FOR_PROJECT_RULESET: Dimli/Eve/Fleck exact original dual-mode records and quantities verified separately; Gog one copy checked against the matrix and its semantics supplied by the existing M12 USER OVERRIDE Template B. Exact Gog wording remains UNAVAILABLE and officialSourceVerified false. This uses the already explicit M12 authorization for that card, without authorizing M14 or broadening M09. Both branches retain actual pending self context, pre-resolution timing, Chasers, current-only ante cancellation, no refund and post-leave consequences.

## M15 USER OVERRIDE — Gog's two Fortitude-defense copies

The user's [2026-10-06 M15 instruction summary](../../codex-prompts/step-24a-m15-user-override.md) authorizes both Stop poking Gog copies as identical Sometimes responses. ACTION/SOMETIMES/ANYTIME must directly affect SELF.FORTITUDE under the existing shared affects-attribute rules. Shared Ignore protects self from all effects of that card; other targets resolve normally, and a legal Negate of the response leaves the original source affecting self. Drinks, Drink Events, indirect modifiers and gambling outcomes do not qualify merely by a later Fortitude consequence. No additional source categories, restriction or Gog-specific resolver is authorized.

The complete Gog template is PROJECT_RULE_OVERRIDE, labeled M15 USER OVERRIDE, officialSourceVerified false. Publisher Adonis examples support use and Negatability separately; exact physical Gog wording remains UNAVAILABLE. Dimli's original evidence is preserved independently. This authority applies only to Gog M15's two copies and cannot be reused for later unresolved cards.

## M18 USER OVERRIDE — Gog standard-copy provenance only

The user’s [M18 instruction summary](../../codex-prompts/step-24a-m18-user-override.md) independently authorizes Gog ownership, exactly two copies, and both copies using the identical standard extra-Drink card mechanic. Only those three provenance facts are PROJECT_RULE_OVERRIDE / M18 USER OVERRIDE, with no publisher-direct Gog claim. Standard Sometimes, own Order a Drink phase, one Gold paid to Inn and two additional Drinks remain VERIFIED_PUBLISHER_STANDARD_CARD; current RDI2 rules establish face-down placement on other players, either same or different recipients. The complete publisher standard cards were visually inspected in Daareka print-and-play page 3 and corroborated by the Spyke/Flower printed rules page 1. No M09/M12/M15 authority is reused, no Gog-specific effect inferred and no later row unblocked.

## M21 USER OVERRIDE — Gog reveal response only

The user's [M21 attachment](../../codex-prompts/step-24a-m21-user-override.md), preserved byte-for-byte with SHA-256 in the ledger, authorizes exactly two identical Gog Sometimes copies. Trigger: another player actually reveals a Drink, including contests and other valid reveal contexts, at the shared response point after complete Chasers. Effect: exactly one independent extra Drink from that revealer's own Drink Me! Pile; no self target, phase repeat, Inn substitute, original-Drink merge or extra contest entry. Shared empty-pile, Drink/Chaser/Ignore/pass/split/elimination and counter rules apply. Force-drinking is not itself CHANGES_DRINK_EFFECT. Original Gog wording remains UNAVAILABLE; reconstructed semantics are PROJECT_RULE_OVERRIDE, not publisher-direct text.

Publisher identity, chosen-player/team-phase examples and generic rules retain their separate authority. The supplied secondary reveal wording is recorded as a user-provided quotation, without a fresh direct remote matrix claim. Dimli's original phase-only template is preserved; M09/M12/M15/M18 are unchanged. The user initially chose **Keep Step 24A scope; leave team acceptance pending**. Required real team test J remains pending, without a waiver or M21 COMPLETE claim. The later workflow decision below permits further source audits. See [M21 report](../../docs/rdi2-step24a-m21-progress.md).

## Source-audit continuation decision — no mechanic override

On 2026-10-06 the user explicitly selected **Continue source audits; keep M21/J pending** after the assistant explained that this revises the earlier complete-before-next-item requirement. The [preserved decision](../../codex-prompts/step-24a-source-audit-continuation.md) authorizes M22 onward source reviews while retaining M21 INCOMPLETE_ENGINE_ACCEPTANCE and pending team test J. It does not supply missing later effects, waive any final source-lock gate or authorize Step 24B. M22–M26 use verified original/publisher evidence without new overrides. M27's [evidence instruction](../../codex-prompts/step-24a-m27-official-evidence-unblock.md) also creates no semantic override: its mechanic and incoming restriction are publisher-verified and COMPLETE, with only Gog physical-copy provenance separately pending. See [current M27 report](../../docs/rdi2-step24a-m27-progress.md).

## M27 USER OVERRIDE — Gog physical-copy provenance only

The [2026-10-06 authorization](../../codex-prompts/step-24a-m27-gog-provenance-override.md) supplies Gog ownership of exactly one physical copy of The Wench thinks you should stop playing with the drinks., using the existing standard Sometimes `negate_drink_change_card`. Only that provenance is PROJECT_RULE_OVERRIDE; matrix quantity/family stays secondary and all previously verified mechanics/counter restrictions remain publisher-verified. No publisher Gog scan/deck list is claimed, no variant or duplicate is added. M27 is COMPLETE after focused validation. This does not authorize any M31 Gog copy, gameplay change, team acceptance waiver or Step 24B. See [current report](../../docs/rdi2-step24a-m27-m31-progress.md).

## M31 USER OVERRIDE — physical identity normalization

The [byte-preserved user instruction](../../codex-prompts/step-24a-m31-gog-identity-normalization.md) authorizes Gog’s five physical `damage_two` copies as one quantity-five standard Action family with no per-copy gameplay variation. Exactly four unknown printed identities are waived for Step 24A; none may be invented. Why you laugh at Gog? remains the one publisher-direct physical example, not the claimed title of every copy. Standard Action, another-player target and exactly two Fortitude loss retain publisher authority; quantity five retains the existing matrix evidence. This authorization adds no cost/effect/restriction and cannot be broadened to M33 or other Gog rows. See [current report](../../docs/rdi2-step24a-m31-m33-progress.md).

## M37 USER OVERRIDE — Gog retaliation only

The [byte-preserved M37 instruction](../../codex-prompts/step-24a-m37-retaliation-user-override.md) authorizes one Gog Sometimes retaliation: after actual Fortitude loss from another player’s played card, the original source loses two. Any card Gog played to reduce or Ignore this specific loss disqualifies retaliation, including partial reduction and Negated attempts. Unrelated responses and another player’s reduction do not count as Gog playing mitigation. Exact Gog title/text remain unavailable and are not required by this authorization. Publisher named Dimli/Fleck timing/source examples, exact original Dimli/Fleck exclusion and secondary quantity evidence remain separate. No M40 healing-card semantics, passive-resource mechanics, production pack, team acceptance waiver or Step 24B are authorized.

## M40 USER OVERRIDE — Gog healing card normalization

The [M40 user instruction](../../codex-prompts/step-24a-m40-gog-healing-user-override.md), preserved byte-for-byte with SHA-256 in the source catalog, authorizes exactly one Gog ANYTIME `gain_two_fortitude` copy: SELF +2 Fortitude, no extra cost, trigger, condition or restriction. Ordinary shared timing, cap20, responses/Negate and last-chance rescue apply. Gog's printed physical title/text remain unavailable; the title requirement is explicitly waived, and the established normalized display is not physical provenance. No publisher-direct Gog wording claim. Fleck original and publisher generic rules remain separate. This override does not apply to M41 or any other family.


## Final audit-pass workflow decision

The [2026-10-07 instruction](../../codex-prompts/step-24a-complete-audit-skip-unverified.md) authorizes auditing every remaining item and collecting all unsupported details in one report. It supplies no new mechanic, physical provenance, team acceptance waiver or source-lock exception. M41/M44 and eight Drinks remain unresolved; M21/J remains pending. See the [combined report](../../docs/rdi2-step24a-final-audit-pass.md).


## Final Step 24A source resolutions — ten item-specific decisions

The [byte-preserved final user instruction](../../codex-prompts/step-24a-final-source-lock-resolution.md), SHA-256 `0e350c803247046aacb5bcdd5928583449bc59bbc38acdcbe588991fcbd4c19a`, supersedes the ten source gaps listed in the historical audit-pass report. M41 authorizes exactly one Gog Action collecting one Gold from each other applicable player; its exact printed title remains unavailable and waived, with a non-physical fallback display. M44 authorizes only Gog ownership of one standard Tip the Wench. copy; its publisher-verified Anytime/pick-a-player/pay-Inn-one mechanic is unchanged.

D03, D14, D15, D17, D18, D19, D20 and D23 each have independent USER OVERRIDE labels. D03 and D20 now use the authorized canonical titles. D14/D15/D18 replace the entire numeric effect for the explicitly named traits, preserving no ordinary Fortitude loss. D17 keeps two independent complete Chaser chains, distinct leading-Event search versus Event-as-Chaser behavior, pre-resolution Event responses, decline without penalty, shared legal rescues and post-resolution survival/payout. Water remains a normal no-effect/no-Chaser Drink; the negative Drink retains its signed value and shared Contest floor. Wizard's Brew has only +2 Alcohol/+2 Fortitude.

Existing D15/D18 ordinary numeric evidence, D17 modern publisher example/shared timing, D19 printed zero Alcohol and D20 negative-Drink/Contest evidence retain publisher authority. The user overrides do not create publisher card transcriptions or expand earlier overrides. All previously qualified source rows are unchanged. The ten-row resolution does not itself waive team acceptance. The later user decision below makes team mode and M21/J a non-blocking TODO for every step; the final normalized source and immutable lock have now been generated and verified.


## Team mode is a non-blocking TODO for all steps

On 2026-10-07 the user answered: “keep team mode a TODO, not blocking for any step”. The [preserved workflow decision](../../codex-prompts/step-24a-team-mode-nonblocking-todo.md) supersedes the earlier final-lock restriction. M21 source review is complete; real team acceptance J and team runtime remain pending, without a passing or implementation claim. Team mode does not block Step 24A or later steps. Its source rules and publisher/user classifications are unchanged, and all non-team gates remain required.

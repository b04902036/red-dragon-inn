# Step 24A stopped at M15

Historical stop, superseded on 2026-10-06 by the explicit [M15 USER OVERRIDE](rdi2-step24a-m15-progress.md). The original evidence limitations below remain true; they no longer block the authorized project ruleset.

M13 and M14 have individually completed source reviews and regression checks, recorded in [M13](rdi2-step24a-m13-progress.md) and [M14](rdi2-step24a-m14-progress.md). Full Step 24A is INCOMPLETE. M15 is UNRESOLVED_MISSING_CARD_EVIDENCE; no M16 review, normalized source, source lock or Step 24B work follows this stop.

The latest request said “step21a.” An optional clarification was presented; no answer arrived. The active RDI2 conversation and M12 continuation were used to interpret this as continuing Step 24A. The earlier RDI1 Step 21A and immutable RDI1 content were preserved.

## Evidence checked separately

M15 quantities: Dimli 1, Eve 0, Fleck 0, Gog 2. Each was checked against the complete quantity matrix; the matrix assigns Sometimes / Fortitude Ignore but does not reproduce complete Gog card wording.

Dimli's single original [JSON record](https://raw.githubusercontent.com/HaxxonHax/the-inn/main/Cards/base/dimli/dimli.json) was inspected independently: own Fortitude, Action/Sometimes/Anytime, Sometimes response. Its file SHA-256 reproduces the uploaded crosscheck; record SHA-256 is recorded in the private ledger. The [current Ninth Edition](https://slugfestgames.com/wp-content/uploads/2021/11/RDI2-9thEd-Web.pdf), printed page 4, supports Dimli's helmet example and generic direct-attribute/Ignore interpretation.

The [official Adonis/Lich King rules](https://slugfestgames.com/wp-content/uploads/2017/08/ALKRulesForWeb.pdf), printed page 1, identify Gog's Stop poking Gog: a response to Adonis's Action prevents Gog's Fortitude loss, and a subsequent legal Negate cancels Gog's response. This is a partial example. It does not reproduce Gog's complete source-category list, exact trigger, numeric conditions or additional restrictions. Those missing details are not official-source-verified.

Publisher character pages, targeted text/image searches and the official Sometimes response article were inspected. No trustworthy original Gog JSON or readable complete M15 card image was located. The inspected publisher response graphic shows Fiona, not Gog M15. The clear M14 Gog photograph is a different card. Neither can verify M15. No complete card text or image is added to tracked public documentation.

## Exact blocker and next input

Gog's two M15 copies need complete original card evidence: a trusted original JSON record or a legible card photograph/scan that establishes the full type, effect, source categories, timing and restrictions. An explicit M15 user ruleset override could define otherwise unresolved fields, with project provenance, but no such override has been authorized. Existing M06, M09 and M12 overrides cannot be reused for M15.

Only quantity is marked PASS for the complete M15 row; the six remaining per-item checks record the exact unresolved Gog portions. The candidate effect plan remains provisional. No Gog field is filled by analogy to Dimli or M14, and M15 is not counted among the 14 reviewed mechanics. M01–M14, M16–M44, character card quantities and all 23 Drink entries remain unchanged from the M15 before-review snapshots.

## Checks and scope

All seven required commands were run for M14 before inspecting M15; exact results appear in [the M14 command table](rdi2-step24a-m14-progress.md). Typecheck/build pass. Full tests: 1,854 passed and one existing private-content guard failure. Coverage: all 89 files meet all four 90% thresholds. Lint: ESLint passes, four existing formatting failures remain. Browser suite: initial existing keyboard-scroll assertion failed; an unchanged complete rerun passed all 27, with cause still undiagnosed. The source completeness gate fails as required.

After recording the M15 blocker, three source regression suites pass **189/189**, strict test TypeScript compilation exits 0, explicit formatting of every changed continuation file exits 0, and git diff --check exits 0. The source verifier exits 1 as required, explicitly rejecting M15's missing Gog wording and reporting 14/44 reviewed mechanics, 0/23 verified Drinks. Final semantic comparisons pass for unchanged M01–M14, M16–M44, character cards and all Drinks. This adds evidence/status metadata and strengthens the existing boundary assertion; engine, Worker, UI and runtime behavior are unchanged. No later mechanic or Drink is reviewed. Step 24B is unsafe to begin.

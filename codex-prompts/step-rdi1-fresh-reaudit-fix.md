# Step RDI1-REAUDIT — Apply fresh 2026-10-05 source audit corrections safely

## Context

The existing RDI1 private source has already shipped as:

```text
content_rdi1_mechanics_v1
```

The current source SHA-256 before this re-audit is:

```text
91357d8e03180e397caf760ac0fbadac9c1260a79a89eeea81751ea5619b2156
```

A fresh internet re-audit was performed without relying on previous conclusions.

Read:

```text
reference/rdi1/reaudit-2026-10-05/RDI1_REAUDIT_REPORT.md
reference/rdi1/reaudit-2026-10-05/verification-ledger.json
reference/rdi1/reaudit-2026-10-05/verification-ledger.csv
reference/rdi1/reaudit-2026-10-05/fresh-source-index.md
content-private/imports/rdi1/reaudit-required-corrections.json
content-private/imports/rdi1/source-normalized.json
```

## Critical rules

- Zero guessing.
- Do not change a mechanic merely because a different implementation is easier.
- Do not use character/card-name checks in generic engine code.
- Do not overwrite or mutate the already-published `content_rdi1_mechanics_v1`.
- Old v1 rooms/replays must remain loadable.
- Do not update the source lock until all corrections and tests are complete.
- If current engine/schema cannot express a confirmed rule, add a generic capability rather than weakening the rule.
- If a new source conflict appears, STOP and report it.

## Phase 1 — independently reproduce the audit locally

Before changing source, validate:
- existing source SHA-256 matches `91357d8e03180e397caf760ac0fbadac9c1260a79a89eeea81751ea5619b2156`
- Deirdre/Fiona/Gerki/Zot each 40
- all 40 mechanic rows match the re-audit ledger
- RDI1 Drink total = 30
- 18 unique Drink definitions
- no quantity mismatch

Do not infer correctness from totals.

## Phase 2 — apply only confirmed corrections

### A. Current rules source metadata

Update the "current official RDI1 rules" reference from Twelfth Edition to:

```text
https://slugfestgames.com/wp-content/uploads/2021/10/RDI1-15thEd.pdf
```

Preserve old sources as historical/secondary references if useful, but do not label Twelfth Edition as current.

### B. Deirdre — all_players_drink_now

Current source is wrong.

Required semantic behavior:
- every living player, including Deirdre, drinks from the CENTRAL DRINK DECK
- do not consume each player's Drink Me! pile for this effect

Inspect the existing generic forced/simultaneous Drink operations. Reuse or extend them generically.
Do not add a Deirdre/card-title branch.

Add tests proving:
- central Drink Deck is used
- personal Drink Me! piles are unchanged by this effect
- all affected players receive proper Drink resolution
- Chasers/event handling follows the correct rules for this source
- server legalPlays/timing remains correct
- replay deterministic

### C. Fiona — force_extra_drink_on_reveal

Current source says:

```text
AFTER_REVEAL_BEFORE_RESOLVE
```

Current Fifteenth Edition rule:
- no player may respond to a Drink until ALL Chasers have been revealed

Required:
- this Sometimes is not legal before the Chaser chain finishes
- it is legal at the appropriate post-Chaser pre-resolution opportunity

Encode this in structured source timing and/or a generic authoritative Drink-response invariant.
Do not rely on UI suppression.

Tests:
- base Drink with no Chaser -> legal at normal post-reveal response point
- Drink with one Chaser -> not legal before Chaser; legal after Chaser chain
- multiple Chasers -> only legal after full chain
- Drink Event revealed as Chaser -> chain ends according to current rules, then legality is re-evaluated
- highlight/30s prompt only when actually legal

### D. negate_drink_change_card

Current source is under-specified.

Required current semantics:
- source being Negated must be a SOMETIMES card
- that Sometimes card must change a Drink's effects
- this includes Ignore/Negate/pass/split/numeric Drink modification
- cannot Negate another copy of this mechanic
- cannot Negate effects that merely order Drinks
- cannot Negate effects that merely force drinking
- cannot Negate direct player-Alcohol changes
- cannot Negate effects on Drink Events
- this counter itself can only be affected by the protected `I don't think so!` family

Use structured source type/capability/counter-family metadata.

Tests must include positive and every negative category above.

### E. Drinking Contest

Correct source summary and verify handler behavior.

Current official behavior includes:
- a Drink Event revealed as a player's contest Drink has NO EFFECT and contest score 0
- Chasers are included normally
- players may modify Drinks after reveal/chaser completion
- pass/split/ignore does not change whose revealed Drink score is used
- extra Drinks taken during contest do not change contest score
- total Alcohol below 0 scores 0 for the contest, while actual Drink effects still apply
- tied highest players repeat
- official pass-out/winner Gold settlement ordering must be preserved

Do not merely edit display text. Verify engine behavior for every bullet.

### F. Round on the House completeness

Verify the current implementation handles:
- reveal a Drink with possible Chasers
- skip Drink Events while finding the source Drink
- the complete source Drink is copied
- independent copies
- no modification before copies exist
- individual copies may be modified afterward

If behavior is already correct, only improve source summary/evidence metadata and tests.

## Phase 3 — evidence tiers

The old source marked mechanics broadly as HIGH / MECHANICALLY_VERIFIED.

Replace this coarse claim with an evidence tier that reflects the ledger, for example:
- CURRENT_OFFICIAL_DIRECT
- LATER_OFFICIAL_CROSSCHECK
- FRESH_COMPLETE_MATRIX_PLUS_CURRENT_GENERIC_RULES
- LIMITED_PRIMARY_CARD_TEXT

Do not invent an "official" status for rows only supported exactly by a secondary complete matrix.

For `substitute_one_gold_from_inn`, keep exactly-one-Gold substitution unless primary evidence proves a broader behavior. Do not generalize.

## Phase 4 — full per-row validation

After edits, check EVERY one of the 40 mechanic rows again against:
`verification-ledger.json`.

Required:
- counts unchanged unless a newly found primary source explicitly proves otherwise
- 40 each / 160 total
- all Sometimes triggers server-evaluable
- all effect plans executable
- no UNKNOWN/TODO/ASSUMED/GUESSED

Check all 18 Drink definitions / 30 physical cards again.

## Phase 5 — new source lock and immutable version

Only after everything above passes:

1. back up the prior private source locally
2. create/update the committed source lock for the corrected source using the repository's normal lock procedure
3. compile a NEW immutable content version

Recommended version:

```text
content_rdi1_mechanics_v2
```

Do NOT overwrite `content_rdi1_mechanics_v1`.

Update scripts/config only as necessary so:
- v1 remains loadable for existing rooms/replays
- v2 can be explicitly verified and activated

## Phase 6 — required checks

Run, adapting version arguments to the repository's actual scripts:

```bash
npm run content:verify:rdi1-source
npm run content:compile:rdi1
npm run content:verify:rdi1
npm run content:verify:zh-TW
npm run typecheck
npm run lint
npm test
npm run test:coverage
npm run build
npm run test:e2e
```

Then publish v2 to local D1 without deleting v1 and perform a D1 round-trip verification.

## Final report

Create:

```text
docs/rdi1-fresh-reaudit-2026-10-05.md
```

Report:
- old/new source SHA-256
- old/new immutable version IDs
- every correction applied
- all 40 mechanic rows with final status
- all 18 Drink definitions with final status
- exact tests added for each confirmed correction
- command results
- proof v1 still loads
- proof v2 round-trip matches corrected source
- remaining evidence limitations, if any

Do not start RDI2 work during this step.

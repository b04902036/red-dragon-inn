# RDI1 Fresh Re-Audit — 2026-10-05

Audited source SHA-256:

```text
91357d8e03180e397caf760ac0fbadac9c1260a79a89eeea81751ea5619b2156
```

This audit intentionally re-searched the web instead of treating earlier findings as evidence.

## Executive result

### Counts

- Deirdre: **40/40**
- Fiona: **40/40**
- Gerki: **40/40**
- Zot: **40/40**
- Character physical total: **160/160**
- Character mechanic rows compared one by one: **40**
- Quantity-row mismatches: **0**
- RDI1 Drink physical cards: **30/30**
- Drink unique definitions checked: **18**
- Drink quantity mismatches: **0**

The current quantity distribution exactly matches the freshly retrieved complete public RDI1 matrix.

### Confirmed corrections required

1. `all_players_drink_now`
   - Current source incorrectly draws from each player's **Drink Me! pile**.
   - Current/later official examples identify Deirdre's effect as making each player drink from the **Drink Deck**.
   - This is gameplay-changing.

2. `force_extra_drink_on_reveal`
   - Current source uses `AFTER_REVEAL_BEFORE_RESOLVE`.
   - Current Fifteenth Edition says **no player may respond to a Drink until all Chasers have been revealed**.
   - Encode `AFTER_CHASERS_BEFORE_RESOLVE` or enforce an equivalent authoritative global gate.
   - This is timing/gameplay-changing.

3. `negate_drink_change_card`
   - Current source trigger is too broad because it does not explicitly require the source card to be **SOMETIMES**.
   - Current official wording: Negate a **Sometimes** card that changes a Drink's effects.
   - It may not Negate another copy.
   - The counter itself may only be affected by the protected `I don't think so!` family.
   - Structured legality/counter metadata must encode all of this.

4. `drinking_contest`
   - Current summary says a Drink Event revealed for the contest counts as 0 **and resolves normally**.
   - Current Fifteenth Edition says the Drink Event has **no effect** and counts as a 0-Alcohol Drink.
   - Also verify official current scoring edge cases in the handler/tests.

### Metadata corrections

5. `sourceRefs.official_rules_current`
   - Current private source labels the **Twelfth Edition** PDF as current.
   - The official RDI1 rules located in this fresh audit are **Fifteenth Edition**.
   - Update the reference and re-evaluate rule-derived verification metadata.

6. Verification confidence
   - The current source marks all mechanics as `MECHANICALLY_VERIFIED` / `HIGH`.
   - That is too coarse.
   - The complete per-character quantity matrix is a secondary public transcription.
   - Current official rules directly verify many generic/card-specific interactions, but not every individual quantity row.
   - Store evidence tier per mechanic instead of claiming identical primary-source confidence for all 40 rows.

## One remaining evidence limitation

`substitute_one_gold_from_inn`

- Fresh complete matrix confirms the RDI1 distribution row `Pay or Ante with found gold` = 2 / 2 / 2 / 1.
- Later official examples confirm that RDI1 cards can satisfy a one-Gold obligation using Gold from the Inn.
- This audit did **not** locate current primary text establishing a broader rule that a single RDI1 card may replace more than one Gold of an arbitrary multi-Gold obligation.
- The existing source replaces **exactly 1 Gold**, which is conservative and consistent with the evidence found.
- Do not generalize it beyond 1 Gold without primary card text.

## Drinks

All basic RDI1 Drink quantities and numeric values match the freshly retrieved public table and the current BGG 30-card composition.

`Round on the House` matches current official semantics. For completeness, its summary should mention that the source Drink may have Chasers; copies are created only after the complete Drink is known.

`Drinking Contest` requires the correction described above.

## Important

Do not overwrite the old published `content_rdi1_mechanics_v1` in place.

After corrections:
- create a new source lock
- compile a new immutable version (recommended: `content_rdi1_mechanics_v2`)
- keep v1 available for old room/replay compatibility
- run mixed timing/Drink regression tests before activating v2

See `verification-ledger.json` for all 40 mechanic rows and all 18 Drink definitions.

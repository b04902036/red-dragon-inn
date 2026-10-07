# Step 24A — Final Source-Lock Resolution
# M41, M44, D03, D14, D15, D17, D18, D19, D20, D23

Continue Step 24A only.

Do NOT begin Step 24B.

The full Step 24A audit has already completed with:

- 42 / 44 mechanics verified
- 15 / 23 Drinks verified

This prompt is an explicit user-authorized resolution for all remaining
Step 24A blockers listed below.

Apply these decisions narrowly.

Do not reinterpret already-verified rows.
Do not downgrade publisher-verified evidence to user overrides.
Do not claim secondary evidence or user decisions are publisher-direct evidence.

After applying these resolutions, rerun the ENTIRE Step 24A source verification,
not only these ten rows.

---

# 1. M41 — Gog payment card

Existing matrix evidence establishes:

- owner = Gog
- quantity = 1
- mechanic family = each other player pays Gog 1 Gold

The exact Gog printed card title and complete publisher-hosted physical card
remain unavailable.

The user explicitly authorizes the following normalized M41 behavior.

## M41 USER OVERRIDE

Type:

`ACTION`

Quantity:

`1`

Effect:

`Each other player pays Gog 1 Gold.`

Use the normal shared Gold-transfer/payment pipeline.

There is:

- no additional payment by Gog;
- no target selection;
- no additional Fortitude effect;
- no Alcohol Content effect;
- no conditional bonus;
- no additional restriction;
- no special incoming-counter restriction.

In a normal non-team game:

`EACH_OTHER_LIVING_PLAYER -> pay 1 Gold to Gog`

In a team game, use the normal publisher-defined meaning of:

`each other player`

Do not invent a Gog-specific team rule.

## Physical identity

The exact printed Gog card title is NOT verified.

Do not present:

`Impress the Table`

or any other normalized/fallback label as the physical printed title unless
direct evidence exists.

The exact physical title is waived as a Step 24A requirement.

Record:

`M41 USER OVERRIDE — Gog physical identity and normalized mechanic`

The standard gameplay family itself has publisher analogues showing that
"Each other player pays you 1 Gold" is an Action-style mechanic, but Gog's
specific physical card remains non-publisher-direct.

---

# 2. M44 — Gog Tip the Wench provenance

The gameplay mechanic itself is publisher-verified.

Official standard card:

`Tip the Wench.`

Type:

`ANYTIME`

Effect:

`Pick a player. They pay 1 Gold to the Inn.`

Use the publisher-defined normal meaning of:

`Pick a player`

Do not convert this to `another player`.

The shared targeting rules therefore apply normally.

## M44 USER OVERRIDE — provenance only

The user authorizes:

- Gog owns exactly 1 physical copy of `Tip the Wench.`;
- Gog's copy uses the standard publisher-verified mechanic;
- there is no Gog-specific variant.

Only Gog ownership / quantity is override evidence.

Do NOT mark the card type or mechanic as override evidence.
Those remain publisher-verified.

Do not reopen M44 gameplay verification.

---

# 3. D03 — Dirty Dishwater

The user explicitly authorizes the following RDI2 Drink record.

Title:

`Dirty Dishwater`

Quantity:

`1`

Type:

`DRINK`

Alcohol Content:

`0`

Fortitude:

`-1`

Chaser:

`false`

Effect:

`Lose 1 Fortitude.`

There are no other printed gameplay effects or special restrictions for this
normalized RDI2 record.

Do not retain a speculative physical title such as:

`Questionable Dishwater`

as though it were the printed card title.

Record the exact numeric/card-detail portion as:

`D03 USER OVERRIDE`

unless direct publisher card evidence is added.

---

# 4. D14 — Ogre Brew

The user explicitly authorizes the following RDI2 Drink record.

Title:

`Ogre Brew`

Quantity:

`1`

Type:

`DRINK`

Chaser:

`false`

## Normal character

Base effects:

- Gain 2 Alcohol Content.
- Lose 1 Fortitude.

Normalized values:

- alcohol = +2
- fortitude = -1

## Ogre / Half-Ogre replacement

If the drinking character has either trait:

- `OGRE`
- `HALF_OGRE`

replace the ENTIRE normal numeric effect with:

- Gain 3 Alcohol Content.
- Fortitude change = 0.

In other words:

Normal:
`+2 Alcohol, -1 Fortitude`

Ogre / Half-Ogre:
`+3 Alcohol, 0 Fortitude`

The word `instead` is treated as replacement, not an additional effect.

Do NOT apply:

`+3 Alcohol AND -1 Fortitude`

to an Ogre or Half-Ogre.

No other race/trait receives this replacement.

There are no additional D14-specific restrictions.

Record the exact base values and trait replacement as:

`D14 USER OVERRIDE`

---

# 5. D15 — Orcish Rotgut

The user explicitly authorizes the following RDI2 Drink record.

Title:

`Orcish Rotgut`

Quantity:

`1`

Type:

`DRINK`

Chaser:

`false`

## Normal character

Base effects:

- Alcohol Content change = 0.
- Lose 2 Fortitude.

Normalized:

`0 Alcohol, -2 Fortitude`

## Orc replacement

If the drinking character has trait:

`ORC`

replace the ENTIRE base numeric effect with:

`+2 Alcohol Content, 0 Fortitude`

Therefore an Orc does NOT lose the normal 2 Fortitude.

Do NOT implement:

`+2 Alcohol AND -2 Fortitude`

for an Orc.

No other trait receives this replacement unless independently verified by
another rule.

There are no additional D15-specific restrictions.

Record this exact mechanic as:

`D15 USER OVERRIDE`

---

# 6. D17 — The Challenge!

Title:

`The Challenge!`

Quantity:

`1`

Type:

`DRINK_EVENT`

Current publisher rules and examples already support the following:

- the revealer may choose whether to accept the Challenge;
- accepting results in two Drinks;
- those Drinks may include Chasers;
- the challenger takes both Drinks;
- a successful challenger receives 1 Gold from each other player;
- normal Drink / Chaser response rules apply;
- no player may respond to a Drink until its complete Chaser chain is known.

Keep those facts publisher-supported where appropriate.

The following legacy-card details are explicitly resolved by the user.

## D17 USER OVERRIDE

### Choice

When The Challenge begins resolving, the revealing player chooses:

`ACCEPT`

or:

`DECLINE`

If they decline:

- reveal no Challenge Drinks;
- drink no Challenge Drinks;
- receive no payout;
- the Event ends.

There is no penalty for declining unless another independently verified effect
says otherwise.

### Accepting

If accepted, the challenger must take exactly:

`2 separate Drinks`

from the Red Dragon Inn Drink Deck.

These are not Ordered Drinks and do not come from a Drink Me! Pile.

### Searching past Drink Events

For each of the two required base Drinks:

1. reveal from the RDI Drink Deck;
2. if the revealed card is a Drink Event, discard that Event without resolving
   it;
3. continue revealing until a non-Event Drink is found;
4. that non-Event Drink becomes one of the two Challenge Drinks.

Repeat until exactly two base non-Event Drinks have been obtained.

This Event-search behavior is part of The Challenge.

### Chasers

After a non-Event base Drink is found, build its Chaser chain using the normal
shared Chaser rules.

A Drink Event revealed AS A CHASER:

- has no effect;
- is discarded;
- ends that Chaser chain according to the normal Chaser rules.

Do NOT treat a Drink Event revealed as a Chaser as another base-Drink search.

### Drink independence

The two Challenge Drinks are two separate Drinks.

Do not merge their numeric effects into one giant Drink.

Each Drink has its own:

- Chaser chain;
- Drink-response legality;
- Ignore / modification handling;
- resulting effects.

### Response timing

The Challenge Drink Event itself receives the normal Event response opportunity
when revealed.

If the Event is successfully Negated or Ignored before it begins resolving,
apply the normal Event rules and do not proceed into the Challenge for that
affected player.

Once The Challenge has begun resolving, do not allow a player to retroactively
Ignore the Event merely to remove a later part of its effect.

For each resulting Challenge Drink:

- first reveal its complete Chaser chain;
- then allow normal legal responses to that Drink;
- then resolve that Drink.

Do not allow a response to an incomplete Chaser chain.

Do not invent a special Challenge-only Drink-response card family.

### Survival checkpoint

After both Challenge Drinks and their legal response chains have completely
resolved, determine whether the challenger survived the Challenge.

Use the normal game rules, including any legal rescue responses that may save
the challenger from passing out.

If the challenger remains in the game after the Challenge's two Drinks are
fully resolved:

`Challenge succeeded`

If the challenger is eliminated as a result of the Challenge:

`Challenge failed`

### Payout

On success:

`Each other applicable player pays the challenger 1 Gold.`

Use the normal shared Gold-payment pipeline.

On failure:

`No Challenge payout.`

The challenger does not pay themselves.

Do not pay the reward before the two Drinks have resolved.

Do not award the payout merely for accepting.

Record the exact legacy search / decline / survival checkpoint details that
were not publisher-direct as:

`D17 USER OVERRIDE`

Keep the publisher-supported modern Challenge example and generic Event /
Drink / Chaser timing evidence separately classified.

---

# 7. D18 — Troll Swill

The user explicitly authorizes:

Title:

`Troll Swill`

Quantity:

`1`

Type:

`DRINK`

Chaser:

`false`

## Normal character

Effects:

`+1 Alcohol Content`
`-1 Fortitude`

## Troll replacement

If the drinking character has trait:

`TROLL`

replace the ENTIRE normal numeric effect with:

`+2 Alcohol Content`
`0 Fortitude`

Therefore a Troll does not take the normal Fortitude loss.

Do NOT implement:

`+2 Alcohol AND -1 Fortitude`

for a Troll.

No additional D18-specific restriction exists.

Record as:

`D18 USER OVERRIDE`

---

# 8. D19 — Water

The user explicitly authorizes:

Title:

`Water`

Quantity:

`1`

Type:

`DRINK`

Alcohol Content:

`0`

Fortitude:

`0`

Chaser:

`false`

Special effects:

`none`

Water has no printed numeric effect and no additional gameplay effect.

It is still a normal Drink Card for rules that refer to a Drink.

Do not treat it as:

- a Drink Event;
- a Chaser;
- an automatic Ignore;
- a sober-up action;
- a card that reduces Alcohol Content.

It simply resolves with no intrinsic effect.

In a Drinking Contest its printed Alcohol Content is 0.

Record the complete no-effect/no-Chaser confirmation as:

`D19 USER OVERRIDE`

---

# 9. D20 — We're Cutting You Off!

Title:

`We're Cutting You Off!`

Quantity:

`1`

Type:

`DRINK`

Chaser:

`false`

The user explicitly authorizes the exact numeric effect:

`Alcohol Content -1`

Fortitude change:

`0`

No other printed effect.

Therefore:

`Lose 1 Alcohol Content.`

Use the normal global minimum Alcohol Content rule.

The player's Alcohol Content cannot fall below 0.

However, the Drink itself has a negative Alcohol value for rules that inspect
the Drink's Alcohol Content.

Publisher rules already explicitly recognize that this Drink can have total
Alcohol Content below zero and state that such a Drink counts as 0 for Drinking
Contest comparison while still affecting the player's Alcohol Content normally.

Keep that generic negative-Drink / Drinking-Contest behavior classified as
publisher-supported.

Record only the exact `-1` value and complete no-extra-effect record as:

`D20 USER OVERRIDE`

Do not retain a normalized placeholder title such as:

`Cut Off for the Night`

as though it were the printed title.

---

# 10. D23 — Wizard's Brew

The user explicitly authorizes:

Title:

`Wizard's Brew`

Quantity:

`1`

Type:

`DRINK`

Chaser:

`false`

Effects:

`Gain 2 Alcohol Content.`
`Gain 2 Fortitude.`

Normalized:

- alcohol = +2
- fortitude = +2

There is:

- no race/trait replacement;
- no payment;
- no card draw;
- no target;
- no conditional clause;
- no additional restriction.

Apply normal global stat minimum/maximum rules.

Record the exact numeric values and no-extra-restriction confirmation as:

`D23 USER OVERRIDE`

---

# 11. Evidence discipline

For every one of these rows, preserve the evidence classification.

Never convert a user override or community matrix into:

`PUBLISHER_VERIFIED`

unless a genuine publisher-direct source supports that exact fact.

Use categories equivalent to:

- publisher-direct;
- publisher generic/shared rule;
- matrix/secondary support;
- explicit user override.

Examples:

M44 mechanic:
`publisher-direct`

M44 Gog quantity/provenance:
`M44 USER OVERRIDE`

D20 generic negative Drink behavior:
`publisher-direct`

D20 exact -1:
`D20 USER OVERRIDE`

D17 modern accept / two-Drink / payout example:
`publisher-direct`

D17 legacy Event-search / decline details where direct original text is missing:
`D17 USER OVERRIDE`

---

# 12. Remove speculative physical titles

Review all ten resolved rows for placeholder or normalized titles that may have
been accidentally treated as printed physical titles.

Specifically:

- M41 exact Gog printed title remains unknown.
- D03 printed title is `Dirty Dishwater`.
- D20 printed title is `We're Cutting You Off!`.
- M44 printed title is `Tip the Wench.`

Do not invent physical titles simply to satisfy the schema.

If the schema requires a display name for M41, use the repository's explicit
normalized/fallback naming convention and mark it as non-physical.

---

# 13. Final Step 24A verification

After applying all resolutions above:

1. Re-run every Step 24A verification item from M01 through M44.
2. Re-run every Drink verification item from D01 through D23.
3. Do not trust only the previously-passed ledger rows.
4. Recompute all physical quantities.
5. Verify each RDI2 Character Deck still totals exactly 40 physical cards.
6. Verify the RDI2 Drink Deck totals exactly 30 physical cards.
7. Verify all mechanic references resolve.
8. Verify all Drink special-mechanic references resolve.
9. Verify there are no unknown mechanics.
10. Verify there are no unresolved Step 24A blockers.
11. Verify evidence classifications and override labels are preserved.
12. Review the complete git diff.

Expected final audit:

`44 / 44 mechanics qualify`

`23 / 23 Drinks qualify`

If and only if all Step 24A validation passes:

- produce/finalize the normalized RDI2 source;
- produce/finalize the Step 24A source lock using the repository's existing
  lock workflow;
- run the required source-lock verification again after lock generation.

Do not manually invent hashes.
Do not bypass a failing verifier.
Do not weaken validation merely to obtain 44/44 or 23/23.

If a NEW contradiction is discovered that is not explicitly resolved by this
prompt, stop and report only that new contradiction.

Do NOT stop again for the ten issues explicitly resolved above.

---

# 14. Final report

When finished, report:

- mechanics verified: expected 44/44;
- Drinks verified: expected 23/23;
- character physical counts;
- Drink physical count;
- source-normalized status;
- source-lock status;
- all newly recorded USER OVERRIDES;
- all verification/test commands and results;
- changed files;
- `git status --short`;
- whether Step 24A is now fully complete.

If all gates pass:

`Mark Step 24A COMPLETE.`

Stop there.

Do NOT begin Step 24B in the same task.
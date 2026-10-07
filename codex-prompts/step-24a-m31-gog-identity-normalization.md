# Step 24A — M31 Gog Five Two-Damage Cards Resolution

Continue Step 24A from M31 only.

Do not begin Step 24B.

M31 concerns Gog's five physical cards in the `damage_two` mechanic family.

Do not guess or invent printed card titles.

---

# 1. Publisher-Verified M31 Mechanic

SlugFest's official RDI2 9th Edition rules directly show a Gog card:

`Why you laugh at Gog?`

Type:

`Action`

Printed effect:

`Pick another player. They lose 2 Fortitude.`

Therefore the following M31 mechanic is publisher-verified:

- Type = Action.
- Target = another player.
- Effect = target loses exactly 2 Fortitude.
- It uses normal Action-card timing.
- It has no additional payment, secondary effect, special trigger, or printed restriction shown on the verified card.

Use this as the verified standard M31 mechanic.

Do not reinterpret `another player` as self-targetable.

---

# 2. Quantity

Existing M31 matrix verification establishes:

`Gog damage_two quantity = 5`

Preserve quantity 5.

Do not reduce the quantity merely because only one publisher-visible printed
card identity has been located.

---

# 3. Remaining Physical-Identity Gap

Publisher evidence currently gives a direct printed identity for one M31 card:

`Why you laugh at Gog?`

Complete publisher-visible identities for the remaining four physical Gog
cards have not been located.

Do NOT:

- invent four Gog-flavored titles;
- copy titles from another character;
- assume all five physical cards literally have the printed title
  `Why you laugh at Gog?`;
- claim a Gog deck scan was found when none was found.

---

# 4. M31 USER OVERRIDE — Normalized Physical Family

For Step 24A source-lock purposes, the user authorizes Gog's five physical
two-damage cards to be normalized as one physical mechanic family:

- owner: Gog
- mechanic: `damage_two`
- quantity: 5
- type: Action
- target: another player
- effect: target loses 2 Fortitude

All five physical M31 cards use this same gameplay mechanic.

There is no per-copy gameplay variation for M31 in this project's normalized
content.

The exact printed title of each of the four publisher-unidentified copies is
NOT required for Step 24A completion.

This override resolves the missing per-copy physical identity requirement
without fabricating card names.

---

# 5. Printed Title Handling

Preserve the one publisher-direct title:

`Why you laugh at Gog?`

as verified evidence for the mechanic.

Do not manufacture printed titles for the other four copies.

If the normalized schema stores the mechanic family as a single record with
`quantity: 5`, use that representation.

Preferred result:

- one normalized `damage_two` Gog record;
- quantity = 5;
- standard mechanic data;
- evidence records `Why you laugh at Gog?` as the publisher-verified physical
  example.

Do not create five fake card records just to satisfy quantity.

If the schema requires individual physical-copy records, use stable internal
copy IDs rather than fabricated printed titles.

For example, internal identity may distinguish copy instances, but those IDs
must NOT be presented as physical printed card names.

---

# 6. Gameplay Definition

Every M31 physical copy resolves as:

1. Gog plays the card as his normal Action.
2. Gog chooses another player.
3. That player loses exactly 2 Fortitude.
4. Normal response timing occurs.
5. Resolve/discard using the shared Action-card pipeline.

Do not add:

- Gold payment;
- Alcohol Content change;
- damage to all players;
- damage to Gog;
- conditional bonus damage;
- repeat damage;
- Drink interaction;
- special incoming-counter restriction;
- Sometimes timing.

Those belong to other mechanics/cards unless separately verified.

---

# 7. Do Not Merge Other Gog Damage Cards Into M31

M31 must remain distinct from Gog's other offensive Action mechanics.

In particular, do not classify a card as M31 merely because it causes
Fortitude loss.

A Gog card with:

- a different numeric Fortitude loss;
- an additional Gold cost;
- an all-opponents target;
- another additional effect;

belongs to its own mechanic row.

M31 is specifically:

`another player loses exactly 2 Fortitude`

with no additional M31-specific effect.

---

# 8. Required Tests

## Test A — Quantity

Assert Gog's normalized M31 family has:

`quantity = 5`

## Test B — Type

Assert M31 is:

`ACTION`

and not Sometimes, Anytime, Gambling, or Cheating.

## Test C — Target

Assert another player is a legal target.

Assert Gog himself is not a legal target.

## Test D — Damage

Resolve M31 against a valid target.

Assert:

`Fortitude loss = exactly 2`

## Test E — No Extra Cost

Assert resolving M31 does not independently:

- pay Gold;
- gain Alcohol Content;
- order a Drink;
- force another Drink;
- create another Fortitude effect.

## Test F — Action Timing

Assert M31 uses the normal Action-card timing and shared Action pipeline.

Do not add a special M31 timing window.

## Test G — Five Physical Copies, One Mechanic

Where the content system expands quantities into physical cards, verify all
five M31 instances resolve through the same `damage_two` mechanic.

Do not require five different mechanic definitions.

## Test H — Deck Count

After M31 normalization, verify Gog's total Character Deck physical count
remains exactly:

`40`

Do not compensate for an M31 count error by modifying unrelated Gog cards.

---

# 9. Evidence Ledger

Record the evidence distinction accurately.

## Publisher-Verified

Record:

- physical Gog card identity:
  `Why you laugh at Gog?`
- type:
  `Action`
- effect:
  `Pick another player. They lose 2 Fortitude.`
- normal Action timing.

## Matrix-Verified

Record:

- Gog M31 mechanic-family quantity = 5.

## M31 USER OVERRIDE

Record:

`M31 USER OVERRIDE — physical identity normalization`

Meaning:

- all five Gog M31 physical cards belong to the same `damage_two` gameplay
  mechanic family;
- there is no per-copy gameplay variation in the normalized implementation;
- exact printed identities of the four publisher-unidentified physical copies
  are waived as a Step 24A requirement;
- no unknown printed titles may be invented.

Do not label the four unknown physical titles as publisher-verified.

---

# 10. Completion Gate

M31 is complete when:

- publisher-direct `Why you laugh at Gog?` evidence is recorded;
- Gog M31 quantity remains 5;
- all five normalize to the same `damage_two` mechanic;
- type = Action;
- target = another player;
- effect = exactly 2 Fortitude loss;
- no invented titles exist;
- no unverified additional effects or restrictions exist;
- focused M31 tests pass;
- Gog physical deck total remains 40;
- relevant Action / targeting / Fortitude regressions pass;
- evidence ledger clearly separates publisher evidence, matrix evidence, and
  the M31 physical-identity normalization override.

After all checks pass:

`Mark M31 COMPLETE.`

Continue Step 24A to M32.

Do not stop M31 again solely because publisher-hosted printed identities for
the remaining four physical copies are unavailable.
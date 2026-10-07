# Step 24A — M40 Gog Healing Card Override

Continue Step 24A from M40 only.

Do not begin Step 24B.

M40 concerns Gog's self-healing card.

The complete publisher-visible physical Gog card text has not been located.

This prompt is an explicit M40-specific user override resolving the remaining
identity / wording ambiguity.

Do not reuse or broaden earlier overrides.

---

# 1. Authoritative M40 Rule

For this project, Gog has exactly:

`1`

physical card in the following mechanic family:

`gain_two_fortitude`

Type:

`ANYTIME`

Effect:

`Gain 2 Fortitude.`

Target:

`SELF`

There is no additional Gog-specific trigger, payment, target choice, condition,
once-per-turn restriction, or other special restriction.

This is the authoritative normalized M40 behavior.

---

# 2. Timing

M40 is a normal Anytime Card.

Apply the publisher-defined Anytime rules.

It may be played at any legal Anytime opportunity, including:

- during Gog's own turn;
- during another player's turn;
- before or after a phase's normal special action where normal timing permits;
- during an already-open response sequence where Anytime cards are legal;
- during Gambling where the normal engine permits Anytime cards;
- during the phase-end Anytime opportunity;
- during Gog's final rescue opportunity before elimination.

Do not require a special trigger.

Do not model M40 as a Sometimes Card.

---

# 3. Self Only

M40 affects only Gog.

Resolution:

`Gog gains 2 Fortitude.`

Do not allow Gog to:

- choose another player;
- heal all players;
- split the healing;
- transfer the healing;
- convert the healing into another stat.

There is no target selection.

---

# 4. Fortitude Cap

Use the normal publisher-defined Fortitude limits.

Fortitude may not exceed:

`20`

Examples:

Gog at 16:

`16 -> 18`

Gog at 18:

`18 -> 20`

Gog at 19:

`19 -> 20`

Gog at 20:

`20 -> 20`

The card is still considered to affect Gog's Fortitude even if the actual
numeric gain is partially or completely capped by the maximum.

Use the shared stat-change pipeline.

Do not implement M40-specific clamping.

---

# 5. Last-Chance Rescue

M40 is legal during the normal final Sometimes / Anytime rescue opportunity
before Gog is eliminated for passing out.

Example:

Gog's state after pending cards finish resolving:

`Alcohol Content = 18`
`Fortitude = 17`

Gog would pass out.

Before elimination becomes final, Gog may play M40.

M40 resolves:

`Fortitude 17 -> 19`

Now:

`Alcohol Content 18 < Fortitude 19`

Gog survives.

This behavior follows the normal publisher last-chance rule.

Do not eliminate Gog before giving him the existing legal Anytime rescue
opportunity.

---

# 6. Insufficient Healing

If M40 does not heal enough to save Gog, normal elimination continues.

Example:

`Alcohol = 20`
`Fortitude = 15`

M40 resolves:

`Fortitude 15 -> 17`

Gog still satisfies the passing-out condition.

After all applicable final responses finish:

`Gog is eliminated normally.`

Playing M40 does not itself guarantee survival.

---

# 7. No Additional Cost

M40 has no M40-specific:

- Gold payment;
- Drink payment;
- discard cost;
- ante;
- Alcohol increase;
- Fortitude sacrifice.

Do not invent a cost because the exact printed Gog card title/text is absent.

The only normalized effect is:

`SELF +2 Fortitude`

---

# 8. No Special Restrictions

For this project's M40 normalization, explicitly assume there are no additional
printed restrictions beyond ordinary Anytime rules.

In particular, do NOT add requirements such as:

- only on Gog's turn;
- only after losing Fortitude;
- only when below a certain Fortitude;
- only once per turn;
- only during a response window;
- cannot be used while Gambling;
- cannot be used as a final rescue;
- cannot be used at 20 Fortitude.

If another global rule independently restricts card play at a particular game
state, apply that global rule normally.

Do not create an M40-specific restriction.

---

# 9. Negation / Responses

M40 is still a Character Card and participates in the normal response system.

If another card is legally capable of Negating an Anytime Card, it may respond
to M40 according to that card's verified rules.

If M40 is successfully Negated:

`Gog gains 0 Fortitude.`

Do not grant the healing before response resolution.

Normal sequence:

1. Gog plays M40.
2. Other players receive normal legal response opportunities.
3. If M40 survives responses, it resolves.
4. Gog gains up to 2 Fortitude.
5. Re-evaluate elimination state if applicable.

---

# 10. Structured Mechanic

Reuse the existing shared mechanic if one already exists:

`gain_two_fortitude`

Conceptually:

- type: `ANYTIME`
- target: `SELF`
- effect op: `CHANGE_STAT`
- stat: `FORTITUDE`
- delta: `+2`
- quantity for Gog: `1`

Do not create a Gog-specific healing engine primitive.

Do not duplicate an existing generic `gain_two_fortitude` mechanic merely to
represent Gog's physical copy.

---

# 11. Physical Title

The exact publisher-verified printed title of Gog's M40 physical card remains
unresolved.

Do not invent a Gog-flavored title.

If the current candidate contains a speculative display title, do not present
that title as publisher-verified.

Preferred normalization:

- owner = Gog
- mechanic = `gain_two_fortitude`
- quantity = 1
- type = Anytime
- rules = `Gain 2 Fortitude.`

If the schema requires a display label and no verified physical title exists,
use the repository's established normalized/fallback-display convention.

Do not fabricate physical provenance.

---

# 12. Required Tests

## Test A — Quantity

Assert Gog has exactly:

`1`

M40 physical card.

---

## Test B — Type

Assert M40 is:

`ANYTIME`

and not Action, Sometimes, Gambling, or Cheating.

---

## Test C — Normal Healing

Gog begins at 15 Fortitude.

Resolve M40.

Assert:

`Fortitude = 17`

---

## Test D — Self Only

Assert M40 has no other-player target selection.

Assert only Gog's Fortitude changes.

---

## Test E — Cap at 20

Gog begins at 19 Fortitude.

Resolve M40.

Assert:

`Fortitude = 20`

not 21.

---

## Test F — Already at Maximum

Gog begins at 20 Fortitude.

Resolve M40.

Assert:

- Fortitude remains 20;
- card resolves normally;
- no alternate benefit is generated.

---

## Test G — Other Player's Turn

During another player's turn, at a legal normal Anytime opportunity:

Assert M40 is playable.

---

## Test H — Phase-End Anytime

At the existing phase-end Anytime opportunity:

Assert M40 is legal.

Do not require a Sometimes trigger.

---

## Test I — Last-Chance Rescue

Create a state where Gog would pass out after pending effects resolve.

Give Gog M40.

Assert:

- elimination pauses for the normal final response opportunity;
- Gog may play M40;
- +2 Fortitude is applied;
- if Alcohol Content becomes lower than Fortitude, Gog remains in the game.

This test is mandatory.

---

## Test J — Healing Insufficient to Save

Create a passing-out state where +2 is insufficient.

Resolve M40.

Assert:

- healing occurs;
- Gog is still eliminated after normal final response processing.

---

## Test K — Negated Healing

Gog plays M40.

A legally applicable Negate response successfully Negates it.

Assert:

`Fortitude gain = 0`

Do not heal before the response stack finishes.

---

# 13. Evidence Classification

Keep the evidence ledger separated accurately.

## Publisher-Supported Generic Rules

Publisher RDI2 rules establish:

- Anytime Cards may be played at any time, including interrupting another action;
- relevant Anytime Cards may be played in any phase;
- players receive a final Sometimes / Anytime opportunity before elimination;
- Fortitude cannot exceed 20;
- effects resolve as completely as possible within stat limits.

These generic rules remain publisher-supported.

## Secondary / Matrix Support

Existing independent secondary evidence supports:

- Gog has a self-healing card;
- quantity = 1;
- effect family = `Gain 2 Fortitude`;
- the Gog healing card is an Anytime Card.

Do not mislabel those Gog-specific facts as publisher-direct card-text evidence.

## M40 USER OVERRIDE

Record:

`M40 USER OVERRIDE — Gog healing card normalization`

The override confirms:

- owner = Gog;
- quantity = 1;
- type = Anytime;
- target = self;
- effect = gain exactly 2 Fortitude before normal cap handling;
- no additional Gog-specific trigger, payment, cost, condition, or restriction;
- ordinary Anytime, response, stat-cap, and last-chance rules apply;
- exact printed physical-card title is waived as a Step 24A requirement.

---

# 14. Completion Gate

M40 is complete when:

- Gog quantity = 1;
- type = Anytime;
- effect = self +2 Fortitude;
- shared Fortitude cap is respected;
- normal Anytime timing works;
- final rescue timing works;
- normal Negate timing works;
- no fabricated additional restrictions exist;
- no fabricated physical title is presented as verified;
- focused M40 tests pass;
- relevant Anytime / stat-cap / elimination / response regressions pass;
- Gog's total physical Character Deck count remains correct;
- evidence ledger distinguishes generic publisher rules from the M40 user
  override.

After all checks pass:

`Mark M40 COMPLETE.`

Continue Step 24A to M41.

Do not stop M40 again solely because the original publisher-hosted Gog card
photo or exact printed title is unavailable.
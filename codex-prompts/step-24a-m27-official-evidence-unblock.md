# Step 24A — M27 Official Evidence Unblock

Continue Step 24A from M27 only.

Do not begin Step 24B.

M27 does NOT require a new user override for its mechanic.

SlugFest publisher evidence now resolves the previously missing complete
mechanic and incoming-counter restriction for:

`The Wench thinks you should stop playing with the drinks.`

Use publisher evidence for this mechanic.

Do not classify the mechanic below as a user override.

---

# 1. Card Type

Type:

`SOMETIMES`

This is a response card.

---

# 2. Core Effect

M27 Negates a Sometimes Card that directly changes the effects of a Drink.

Conceptually:

- source being responded to must be a `SOMETIMES` card;
- that source must directly modify the effects of a Drink;
- M27 Negates that Sometimes Card.

Use the normal shared Negate pipeline.

Do not Ignore the Drink itself.

Do not globally cancel unrelated effects.

---

# 3. Valid Target Categories

Publisher rules explicitly establish that the following count as changing
the effects of a Drink and are therefore valid M27 targets when performed by
a Sometimes Card:

- Negating a Drink;
- Ignoring a Drink;
- passing a Drink to another player;
- splitting a Drink;
- increasing a Drink's Alcohol Content;
- decreasing a Drink's Alcohol Content;
- otherwise directly altering one or more effects of a Drink.

The important test is:

`Does the target Sometimes Card directly change the Drink when that card resolves?`

If yes, M27 may target it, subject to the other restrictions below.

---

# 4. Invalid Target Categories

M27 must NOT be used merely because a card is related to drinking.

Publisher rules explicitly exclude cards whose effect is only to:

- order or buy Drinks;
- give Special Reserve Drinks;
- force a player to drink;
- directly increase a player's Alcohol Content;
- affect a Drink Event Card.

These effects do not qualify as directly changing the effects of a Drink Card.

Do not use downstream consequences to decide legality.

Example principle:

If a card causes a player to drink another Drink, it is not thereby modifying
the currently revealed Drink.

---

# 5. Direct-Effect Rule

Use the normal RDI direct-effect rule.

A card affects or changes another object only if it directly impacts that
object when the card resolves.

Do not classify indirect consequences as direct modification.

Examples:

- increasing a Drink's Alcohol Content directly modifies the Drink;
- passing the Drink directly modifies who receives that Drink;
- Ignoring that Drink directly changes how the Drink resolves;
- forcing someone to drink another Drink does NOT modify the current Drink;
- directly increasing a player's Alcohol Content does NOT modify a Drink.

Reuse the existing shared direct-effect matcher if one exists.

Do not hardcode a list only for Gog if the engine already models these facts.

---

# 6. Incoming-Counter Restriction

M27 has a publisher-verified protected incoming-response restriction.

The card itself may only be affected by:

`I don't think so!`

or the project's mechanically equivalent card family representing that
publisher-defined counter.

This restriction applies to responses targeting M27 itself.

Conceptually:

M27 is played
→ another response attempts to affect M27
→ allow it only if it belongs to the `I don't think so!` protected counter family
→ reject all other incoming cards that attempt to affect M27.

Do not treat this as a normal unrestricted Sometimes card once it is on the
response stack.

---

# 7. M27 Cannot Negate Another M27

A second copy of:

`The Wench thinks you should stop playing with the drinks.`

cannot be used to Negate the first copy.

There are two independent reasons:

1. the first M27 is protected by its incoming-counter restriction;
2. more fundamentally, the first M27 does not itself directly change a Drink.

The first M27 is Negating a Sometimes Card.

Therefore the first M27 is not a legal target for the second M27's
"changes the effects of a Drink" requirement.

Model the target-legality rule correctly rather than depending only on the
protected-counter special case.

---

# 8. Interaction Example

Example:

1. Player reveals Wine.
2. Another player uses a Sometimes Card to increase Wine's Alcohol Content.
3. Gog plays M27.
4. M27 is a legal response because the target Sometimes Card directly modifies
   Wine.
5. M27 Negates that modifier.
6. Another M27 cannot legally Negate Gog's M27.
7. A legal `I don't think so!`-family counter may affect Gog's M27.

If Gog's M27 is successfully Negated by `I don't think so!`, the original
Drink-modifying Sometimes Card remains able to resolve normally unless another
response changes the result.

Use normal response-stack resolution.

---

# 9. Drink Event Restriction

M27 does not target a Sometimes Card merely because that card affects a
Drink Event.

Drink Cards and Drink Event Cards are distinct for this rule.

If the source only affects a Drink Event Card:

`M27 = illegal response`

Do not generalize "Drink" to include Drink Events here.

---

# 10. Structured Mechanic

Represent the mechanic approximately as:

- type: `SOMETIMES`
- response kind: `NEGATE`
- target source type: `SOMETIMES`
- target requirement: `DIRECTLY_CHANGES_DRINK_EFFECTS`
- effect: `NEGATE_CURRENT_SOURCE`
- incoming protection: `ONLY_IDONTTHINKSO_FAMILY`

The exact internal schema may differ.

Prefer existing generic reaction predicates and protected-counter families.

Do not implement the rule with title-string checks if a mechanic-family or
capability system already exists.

---

# 11. Required Tests

Add or preserve focused M27 tests.

## Test A — Negate Ignore Drink

A Sometimes Card attempts to Ignore a Drink.

Assert:

- M27 is legal;
- M27 Negates that Sometimes Card.

## Test B — Negate Drink modifier

A Sometimes Card directly increases or decreases a Drink effect.

Assert M27 is legal.

## Test C — Passing Drink

A Sometimes Card passes the Drink to another player.

Assert M27 is legal.

## Test D — Splitting Drink

A Sometimes Card splits the Drink.

Assert M27 is legal.

## Test E — Force another Drink

A Sometimes Card forces a player to drink another Drink without directly
changing the current Drink.

Assert:

`M27 is illegal`

## Test F — Direct Alcohol Content change

A Sometimes Card directly changes a player's Alcohol Content without modifying
a Drink Card.

Assert:

`M27 is illegal`

## Test G — Order Drinks

A Sometimes Card causes Drinks to be ordered.

Assert:

`M27 is illegal`

## Test H — Drink Event

A Sometimes Card changes a Drink Event but does not directly modify a Drink Card.

Assert:

`M27 is illegal`

## Test I — M27 against M27

Player A plays M27.

Player B attempts to answer with another M27.

Assert:

`illegal`

Verify legality fails because the target M27 is not directly modifying a Drink.

Also verify the protected incoming-response rule.

## Test J — I don't think so against M27

Player A plays M27.

Player B plays a legal `I don't think so!`-family counter against it.

Assert:

- response is legal;
- M27 is Negated;
- normal nested response resolution continues.

## Test K — Other counter against M27

Attempt to affect M27 using another counter that is not part of the
`I don't think so!` family.

Assert:

`illegal`

This test is mandatory because it covers the previously missing
incoming-counter restriction.

---

# 12. Evidence Classification

Record M27 mechanic evidence as publisher-verified.

Primary publisher evidence now establishes:

- M27 is a Sometimes Card;
- it Negates a Sometimes Card that directly changes a Drink's effects;
- Ignore / Negate / split / pass / Drink-effect alteration qualify;
- ordering Drinks does not qualify;
- forcing someone to drink does not qualify;
- directly changing a player's Alcohol Content does not qualify;
- affecting a Drink Event does not qualify;
- M27 cannot Negate another M27;
- M27 itself may only be affected by the `I don't think so!` counter family.

Do not create `M27 USER OVERRIDE` for these facts.

If Gog-specific quantity or physical-copy provenance is independently still
unverified, report ONLY that remaining provenance issue.

Do not report the M27 mechanic or incoming-counter restriction as unresolved.

---

# 13. Completion Gate

M27 mechanic verification is complete when:

- target predicate is implemented correctly;
- valid Drink modifiers can be Negated;
- invalid drink-related but non-modifying cards are rejected;
- Drink Event effects are rejected;
- M27 cannot target another M27;
- only `I don't think so!`-family counters can affect M27 itself;
- nested response resolution is correct;
- focused M27 tests pass;
- relevant Sometimes / Negate / Drink regression tests pass;
- evidence ledger classifies these rules as publisher-verified.

After those checks:

`Mark M27 mechanic COMPLETE.`

Continue Step 24A unless there is a separate unresolved Gog-specific
quantity/provenance issue.

Do not stop M27 again for missing mechanic wording or incoming-counter
restriction; both are now covered by publisher evidence.
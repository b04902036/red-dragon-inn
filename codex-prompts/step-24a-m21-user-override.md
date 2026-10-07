# Step 24A — M21 Gog "Gog say you drink MORE!" User Override

Continue Step 24A / M21 only.

Do not begin Step 24B.

This prompt is an explicit M21-specific user override for the remaining card-text ambiguity.

Do not reuse or broaden M09, M12, M15, or M18 overrides.

---

# M21

Mechanic:

`force_extra_drink_during_other_drink_phase`

Gog card:

`Gog say you drink MORE!`

Quantity:

`2 copies`

Type:

`SOMETIMES`

Both Gog copies use the same mechanic.

---

# 1. Publisher-Verified Facts

SlugFest publisher rules explicitly identify:

`Gog say you drink MORE!`

and demonstrate Gog using it to make one chosen player:

`drink again`

during that player's team's Drink Phase.

The publisher example also establishes that only that chosen player drinks again; their teammates do not.

The publisher rules also establish the normal Drink procedure and normal Drink / Chaser / Ignore handling.

Keep these facts classified as publisher-supported.

---

# 2. M21 USER OVERRIDE

The user explicitly resolves the remaining card-text ambiguity as follows.

Treat both Gog copies as having this gameplay meaning:

"As another player reveals a Drink, they must drink one additional Drink from the top of their own Drink Me! Pile."

This override establishes the trigger, source, amount, and restrictions below.

Do not stop M21 again because a publisher-hosted image of the complete Gog card text is unavailable.

Do not falsely label the reconstructed full wording as publisher-direct text.

Record it as:

`M21 USER OVERRIDE`

---

# 3. Trigger

M21 triggers when:

`another player reveals a Drink`

The trigger is based on a player revealing a Drink, not merely entering a Drink Phase.

Therefore M21 may trigger from any otherwise-valid Drink reveal, including:

- normal Drink Phase;
- Drinking Contest.

Do not restrict M21 only to the normal Drink Phase.

Apply the shared Drink timing rules.

If the revealed Drink has Chasers, first complete the normal Chaser-reveal process before opening responses at the point where the engine normally allows players to respond to that Drink.

Do not introduce an illegal response window between the original Drink and its unresolved Chasers.

---

# 4. Target

The affected player must be:

`ANOTHER_PLAYER`

Gog cannot target himself.

Use the normal shared meaning of `another player`.

In team variants, follow the project's publisher-backed targeting rules for `another player`, including teammate restrictions.

Do not create a Gog-specific targeting exception.

---

# 5. Effect

When M21 resolves successfully:

`target player must drink exactly 1 additional Drink`

The additional Drink comes from:

`the top of the TARGET player's own Drink Me! Pile`

It does not come from:

- the central Drink Deck;
- Gog's Drink Me! Pile;
- another player's Drink Me! Pile.

Use the normal shared Drink-resolution pipeline.

Conceptually the mechanic is:

`FORCE_DRINK_FROM_OWN_DRINK_ME_PILE`

Target:

`CHOSEN_OTHER_PLAYER`

Count:

`1`

---

# 6. Empty Drink Me! Pile

Do not invent a special Gog rule for an empty pile.

If the target is required to drink from their Drink Me! Pile but that pile has no Drink available, use the normal shared rules for being required to drink with an empty Drink Me! Pile.

Do not draw a replacement Drink from the central Drink Deck merely because M21 was played.

---

# 7. Additional Drink Resolution

The forced additional Drink is a normal independent Drink.

It must support all normal applicable mechanics, including:

- Chasers;
- Drink effects;
- Ignore Drink;
- legal Drink modification;
- passing or splitting where otherwise legal;
- passing out;
- applicable shared response windows.

Do not combine the original Drink and the M21-forced Drink into one Drink.

The original Drink resolves as its own Drink.

The forced additional Drink resolves as another Drink.

---

# 8. Drinking Contest

M21 is legal when another player reveals a Drink during a Drinking Contest.

Example sequence:

1. A player reveals their Drinking Contest Drink.
2. M21 becomes legally triggerable.
3. Gog plays `Gog say you drink MORE!`.
4. The target drinks 1 additional Drink from their own Drink Me! Pile.

The M21-forced extra Drink does not change which Drink the target revealed for purposes of determining the Drinking Contest winner.

Its Alcohol Content does not get added to the Drinking Contest comparison.

However:

- the extra Drink's normal gameplay effects still resolve;
- its Alcohol Content still changes the player's actual Alcohol Content normally;
- Fortitude changes still occur normally;
- passing out still occurs normally;
- Chasers and normal Drink interactions still apply.

Do not treat the extra Drink as a second Drinking Contest entry.

---

# 9. Amount

M21 forces exactly:

`1 additional Drink`

per resolved copy.

Do not interpret `drink MORE` as:

- two additional Drinks;
- repeated drinking until the pile is empty;
- repeating the whole Drink Phase;
- drawing a Drink from the central Drink Deck.

One resolved M21 means:

`+1 Drink`

---

# 10. Multiple Copies / Multiple Responses

Gog has exactly 2 physical copies of M21.

Both copies use the same mechanic definition.

Do not create separate mechanic IDs for the two physical copies.

If the normal Sometimes / response-stack rules legally allow both copies to be played during the same relevant sequence, use the normal shared response rules.

Do not create an artificial once-per-phase restriction unless another verified rule requires one.

---

# 11. Interaction With Drink-Modification Counters

Do not classify M21 as merely modifying the numeric or textual effects of the currently revealed Drink.

M21 causes another Drink to occur.

Use the existing shared rules regarding cards that force a player to drink.

Do not make M21 automatically count as "changing the effects of a Drink" if the existing rules distinguish forcing another Drink from modifying the current Drink.

Preserve existing shared counter-family behavior.

---

# 12. Structured Mechanic

Represent M21 approximately as:

- id: `force_extra_drink_during_other_drink_phase`
- type: `SOMETIMES`
- trigger event: `DRINK_REVEALED`
- trigger actor: `OTHER_PLAYER`
- target: `OTHER_PLAYER`
- effect op: `FORCE_EXTRA_DRINK_FROM_TARGET_DRINK_ME`
- count: `1`

The exact internal schema may differ.

Reuse existing engine primitives where possible.

Do not implement a Gog-only Drink subsystem.

---

# 13. Required Tests

## Test A — Normal Drink Phase

Another player reveals their normal Drink.

Gog plays M21.

Assert:

- the original Drink resolves normally;
- the target then drinks exactly 1 additional Drink;
- the additional Drink comes from the target's Drink Me! Pile.

## Test B — Correct Drink Source

Assert that M21 does not consume a card from the central Drink Deck.

Assert that the additional Drink comes from the target player's own Drink Me! Pile.

## Test C — Self-Target Rejection

Gog reveals a Drink.

Assert that Gog cannot use M21 to force himself to drink another Drink.

## Test D — Other-Player Trigger

Another player reveals a Drink.

Assert that M21 is legally triggerable.

## Test E — Chaser Timing

The target reveals a Drink with a Chaser.

Assert:

1. all required Chasers are revealed first;
2. normal Drink response timing is respected;
3. M21 does not interrupt an unfinished Chaser chain.

## Test F — Independent Extra Drink

The original Drink is modified or Ignored.

M21 still creates its own independent extra Drink if M21 itself resolves.

Do not merge the original Drink and the M21 extra Drink.

## Test G — Drinking Contest

Another player reveals their Drinking Contest Drink.

Gog plays M21.

Assert:

- target drinks exactly 1 extra Drink from their own Drink Me! Pile;
- extra Drink effects resolve normally;
- extra Drink Alcohol Content changes the player's actual Alcohol Content normally;
- extra Drink does not affect the Drinking Contest comparison.

## Test H — Empty Drink Me! Pile

The target has no card available in their Drink Me! Pile when M21 requires the extra Drink.

Assert that the engine uses the normal shared empty-pile rule.

Do not draw a substitute Drink directly from the central Drink Deck unless the normal shared rule explicitly requires that.

## Test I — Quantity

Assert Gog has exactly:

`2`

physical copies of M21.

Both copies must reference the same mechanic.

## Test J — Team Variant

In a team game, Gog targets one legal opposing player.

Assert:

- only that chosen player drinks again;
- their teammates do not also drink.

---

# 14. Evidence Ledger

Record the evidence accurately.

## Publisher-Supported

Record as publisher-supported:

- card identity: `Gog say you drink MORE!`;
- Gog can make one chosen player drink again;
- demonstrated use during another player's team Drink Phase;
- only the chosen player drinks again, not their teammates;
- normal generic Drink / Chaser / Drink Me! rules;
- relevant generic team targeting rules.

## Secondary Supporting Evidence

Record separately that secondary deck-matrix evidence describes the mechanic as:

"As another player reveals a Drink, they must drink another Drink from their Drink Me! Pile."

Do not label that transcription as publisher-direct Gog card text.

## M21 USER OVERRIDE

Explicitly mark the following as user-authorized where complete publisher-direct Gog card wording is unavailable:

- trigger = another player reveals a Drink;
- trigger also applies during Drinking Contest;
- source = target's own Drink Me! Pile;
- amount = exactly 1 additional Drink;
- target = another player, not Gog;
- the extra Drink is an independent Drink;
- during a Drinking Contest, the extra Drink resolves normally but does not count toward determining the contest winner;
- Gog has exactly 2 identical copies using this mechanic.

---

# 15. Completion Gate

M21 is complete only when:

- Gog has exactly 2 copies;
- both copies use the shared M21 mechanic;
- normal Drink reveal trigger works;
- Drinking Contest trigger works;
- Gog cannot target himself;
- exactly 1 additional Drink is forced;
- the Drink comes from the target's own Drink Me! Pile;
- the extra Drink resolves independently;
- Chaser timing is correct;
- Drinking Contest scoring is unaffected by the extra Drink;
- team targeting behaves correctly;
- focused M21 tests pass;
- relevant Drink / Chaser / Sometimes / Drinking Contest regression tests pass;
- the evidence ledger correctly distinguishes publisher evidence, secondary evidence, and M21 USER OVERRIDE.

After all checks pass:

`Mark M21 COMPLETE.`

Then continue Step 24A to M22.

Do not stop M21 again solely because the full publisher-hosted physical card text is unavailable.
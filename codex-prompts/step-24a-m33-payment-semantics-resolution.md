# Step 24A — M33 Gog Payment Semantics Resolution

Continue Step 24A from M33 only.

Do not begin Step 24B.

M33 no longer requires guessing.

The original physical Gog card has now been identified and its payment semantics can be resolved using the physical card text plus publisher rules.

Do not create an M33 user override unless a separate unresolved provenance issue appears later.

---

# 1. Physical Card Identity

Gog's M33 card is:

`Sorry, Gog not see you sitting there...`

Type:

`Action`

Physical card text:

`Pick another player. They lose 3 Fortitude.`

`Pay 1 Gold to the Inn.`

Flavor text beneath the payment:

`(... to fix the chair)`

Quantity:

`1`

Mechanic:

`damage_three_pay_inn_one`

---

# 2. Critical Ruling — The 1 Gold Is NOT a Play Cost

Treat:

`Pay 1 Gold to the Inn.`

as an effect of the card that happens when the Action resolves.

It is NOT an upfront cost required to legally play M33.

Do not implement:

`must have 1 Gold before M33 can be played`

unless some independent general game-state rule prevents the player from acting.

Do not deduct the Gold when the card is initially played.

Correct sequence:

1. Gog plays M33 as his Action.
2. Gog chooses another player.
3. Normal response opportunity opens.
4. If M33 is not Negated, the card resolves.
5. Resolve the Fortitude-loss effect.
6. Resolve Gog's 1-Gold payment to the Inn through the normal payment pipeline.

---

# 3. Why This Is a Resolving Effect

Publisher rules explicitly distinguish true play costs.

Cards with an actual play cost use wording equivalent to:

`This card costs [resource] to play.`

For an actual play cost, publisher rules explicitly say that if the player cannot pay the cost, they may not play the card.

M33 contains no such cost wording.

Instead, its printed instructions contain:

`Pay 1 Gold to the Inn.`

as a separate instruction in the effect text.

Publisher rules also explicitly discuss:

`a Gold payment on a card that you played yourself`

and allow shared effects that reduce such payments or pay them with Gold from the Inn.

Therefore M33's Gold payment must use the normal resolving-payment system, not the card-play-cost system.

---

# 4. Negate Interaction

If M33 is Negated before resolution:

- target loses 0 Fortitude;
- Gog pays 0 Gold;
- none of M33's effects happen.

This follows the normal publisher Negate rule:

a Negated card does not resolve and none of its effects occur.

Do NOT charge Gog 1 Gold before the response window.

Incorrect:

`play M33 -> immediately pay 1 -> opponent Negates`

Correct:

`play M33 -> responses -> Negated -> no damage and no payment`

---

# 5. Ignore Interaction

If the targeted player Ignores M33:

- the target does not lose the 3 Fortitude;
- M33 still resolves normally;
- Gog must still resolve the 1-Gold payment.

This follows the normal Ignore rule:

an Ignored card resolves normally but has no effect on the player who Ignored it.

Gog's own payment is not an effect on the target, so the target Ignoring M33 does not remove Gog's payment.

Expected result:

`target Ignores M33 -> target loses 0 -> Gog pays 1 to Inn`

---

# 6. Gog Cannot Ignore His Own Payment

If Gog has a card that generally allows him to Ignore a card affecting his Gold, do not allow that effect to Ignore this self-generated M33 payment.

Publisher rules explicitly prohibit using an Ignore-Gold defense to avoid a Gold payment on a card that the player played themselves.

However, normal legal mechanics that:

- reduce a payment;
- substitute payment;
- pay with Gold from the Inn;

remain usable if their own rules permit them.

Reuse the shared payment pipeline.

Do not special-case M33 against M09 or other payment mechanics.

---

# 7. Resolution Order

Preserve the printed effect order.

M33 resolves as:

1. chosen other player loses 3 Fortitude;
2. Gog pays 1 Gold to the Inn.

These are sequential effects of one Action Card.

Do not model the Gold as a prerequisite for the Fortitude attack.

Do not cancel the Fortitude effect merely because the later Gold payment is reduced or cannot fully occur.

Use normal RDI partial-resolution rules.

---

# 8. Insufficient Gold

Do not add an M33-specific requirement that Gog have at least 1 Gold before playing the card.

If the resolving payment cannot be fully paid, use the normal shared RDI rules for Gold minimums, partial effect resolution and player elimination.

Gold may never go below 0.

Do not make the payment negative.

Do not undo the already-resolved Fortitude loss solely because Gog cannot fully satisfy the later payment.

Any elimination caused by reaching 0 Gold must use the normal shared elimination/final-response process.

---

# 9. Target

M33 targets:

`another player`

Therefore:

- Gog cannot target himself;
- exactly one legal other player is chosen;
- standard targeting rules apply.

Do not broaden this to all other players.

---

# 10. Structured Mechanic

Represent M33 approximately as:

- mechanicId: `damage_three_pay_inn_one`
- type: `ACTION`
- target: `OTHER_PLAYER`
- effect 1: target loses 3 Fortitude
- effect 2: self pays 1 Gold to Inn
- paymentClassification: `RESOLVING_EFFECT`
- quantity for Gog: `1`

Use the repository's existing schema rather than inventing fields if equivalent primitives already exist.

The important invariant is:

`PAY_INN(1)` happens during resolution and is not an upfront play cost.

---

# 11. Required Tests

## Test A — Basic Resolution

Gog plays M33 against another player.

No responses occur.

Assert:

- target loses exactly 3 Fortitude;
- Gog pays exactly 1 Gold to the Inn.

---

## Test B — Payment Is Not Upfront

Play M33.

Before the card resolves, inspect game state.

Assert:

- Gog has not yet lost the 1 Gold;
- normal response timing is available.

Then resolve the card and assert the payment occurs.

---

## Test C — Negated M33

Gog plays M33.

A legal counter Negates it.

Assert:

- target loses 0 Fortitude;
- Gog pays 0 Gold.

This test is mandatory because it proves the Gold is not a play cost.

---

## Test D — Target Ignores M33

Gog plays M33.

The target legally Ignores it.

Assert:

- target loses 0 Fortitude;
- Gog still pays 1 Gold to the Inn.

This test is mandatory.

---

## Test E — Payment Reduction / Substitution

Where an existing legal shared effect reduces or substitutes Gog's payment:

Assert M33 uses the normal payment pipeline.

Do not bypass existing payment reactions.

Do not implement new M09 rules here.

---

## Test F — Cannot Ignore Own Payment

Give Gog an otherwise generic defense that Ignores a card affecting his Gold.

Assert that Gog cannot use that defense merely to Ignore the payment generated by his own M33.

Preserve any separately legal payment-reduction or Inn-payment effects.

---

## Test G — Self Target

Attempt to target Gog himself.

Assert:

`illegal`

---

## Test H — Quantity

Assert Gog has exactly:

`1`

M33 physical card.

---

# 12. Evidence Classification

Record evidence accurately.

## Direct physical-card evidence

Record:

- title: `Sorry, Gog not see you sitting there...`
- type: Action
- target: another player
- damage: 3 Fortitude
- payment: `Pay 1 Gold to the Inn.`
- quantity/mechanic-family evidence as already established by the matrix.

The located physical-card image is direct card-text evidence, although it is not currently hosted on a SlugFest publisher page.

Do not mislabel the third-party host itself as a publisher source.

## Publisher rules evidence

Use publisher rules to establish the semantics:

- actual play costs are explicitly identified as costs to play;
- a player unable to pay a true play cost may not play that card;
- Gold payments on cards a player played themselves are resolving payments;
- such self-generated payments cannot be avoided with an Ignore-Gold card;
- payment reducers / Inn-payment substitutions may still apply where legal;
- Negated cards do not resolve and none of their effects happen;
- Ignored cards still resolve normally but do not affect the player who Ignored them;
- effects resolve as completely as possible within normal attribute limits.

---

# 13. Remove the Incorrect Candidate Ambiguity

If the current candidate or ledger says:

`You then pay 1 Gold to the Inn as part of the effect.`

that interpretation is correct.

Keep the semantic meaning, but replace any speculative display title such as:

`Reckless Smash`

with the actual identified physical title:

`Sorry, Gog not see you sitting there...`

Do not retain `Reckless Smash` as though it were the printed Gog card title unless it is explicitly an internal normalized mechanic label.

If used internally, clearly distinguish it from the physical printed title.

---

# 14. Completion Gate

M33 is complete when:

- the physical title is corrected;
- type = Action;
- target = another player;
- Fortitude loss = 3;
- Gog payment = 1 Gold to Inn;
- payment occurs during card resolution;
- payment is not a play cost;
- Negate results in no payment;
- target Ignore still leaves Gog's payment intact;
- own-payment Ignore restriction works;
- normal payment substitutions/reductions remain available where legal;
- quantity = 1;
- focused M33 tests pass;
- relevant Action / Ignore / Negate / Gold-payment regressions pass;
- evidence ledger distinguishes physical-card evidence from publisher rules evidence.

After all checks pass:

`Mark M33 COMPLETE.`

Continue Step 24A to M34.

Do not stop M33 again over whether the 1 Gold is a play cost versus a resolving effect. That distinction is now resolved.
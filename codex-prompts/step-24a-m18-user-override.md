# Step 24A — M18 Gog standard extra-Drink cards user override

User instruction summary supplied directly on 2026-10-06; this is not a byte-for-byte transcription or a publisher source. Scope: M18 only. Do not start M19 or Step 24B, or reuse/broaden M09, M12 or M15 authority.

The user explicitly assigns Gog the Half-Ogre exactly two identical standard copies of Wench, bring some drinks for my friends! (`order_two_extra_drinks_paid`). Record Gog ownership, quantity two, and both physical copies using that standard mechanic as **M18 USER OVERRIDE / PROJECT_RULE_OVERRIDE**, not publisher-direct Gog provenance.

The underlying standard card mechanic remains publisher-supported: Sometimes; own Order a Drink phase; pay one Gold to the Inn; order two additional Drinks. Current official RDI2 rules supply face-down placement on other players' Drink Me! Piles. Both may go to the same other player or be distributed among different other players. Do not invent a Gog-specific effect or label the standard effect as inferred/overridden.

```text
id: order_two_extra_drinks_paid
type: SOMETIMES
legality:
  phase: ORDER_DRINK
  actor: SELF
effects:
  - op: PAY_INN
    target: SELF
    amount: 1
  - op: ORDER_EXTRA_DRINKS
    count: 2
    targets: OTHER_PLAYERS
```

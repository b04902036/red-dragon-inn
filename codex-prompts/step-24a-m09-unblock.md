# Step 24A — M09 payment-substitution unblock

Continue Step 24A from M09.

Read:

```text
reference/rdi2/m09-payment-substitution-evidence.json
content-private/imports/rdi2/source-candidate.json
content-private/imports/rdi2/verification-ledger.json
reference/rdi2/source-evidence.md
codex-prompts/step-24a-rdi2-source-lock.md
```

## 1. Fetch the exact Dimli and Fleck source records

Use these public source files:

```text
https://raw.githubusercontent.com/HaxxonHax/the-inn/main/Cards/base/dimli/dimli.json
https://raw.githubusercontent.com/HaxxonHax/the-inn/main/Cards/base/fleck/fleck.json
```

Locate exactly these records:

Dimli:
```text
Dwarves always have money.
Lemme check the money belt...
```

Fleck:
```text
Appreciative listeners! How nice!
I got this from playing in the Town Square.
```

Do not rely only on the paraphrase in the evidence JSON.
Read the original JSON records and record their exact source facts in the M09 ledger evidence.

These four records establish the same mechanic family.

## 2. Verified M09 trigger

Normalize the mechanic as:

```text
type = SOMETIMES

trigger:
  systemEvent = GOLD_LOSS_REQUIRED
  actor = SELF
```

The trigger covers a current Gold loss caused by:

```text
PAY_TO_INN
PAY_TO_PLAYER
ANTE_TO_POT
GOLD_TAKEN_BY_OTHER_PLAYER
```

This is a response to the current Gold-loss/payment context before the transfer resolves.

Do not reduce the trigger to only `PAYMENT_REQUIRED` or only `ANTE_REQUIRED`.

## 3. Amount

The normalized M09 effect substitutes the **entire current Gold-loss/payment instance**.

Do not hard-code:

```text
amount = 1
```

unless the current payment context itself is one Gold.

Examples:

```text
current payment = 1 Gold
=> Inn supplies 1

current single payment = 2 Gold
=> Inn supplies 2

four separately-defined 1-Gold payments
=> one M09 play substitutes only the current one of those four payment contexts
```

This distinction is supported by official later rules that explicitly treat special multi-payment effects as separate payment instances.

## 4. Recipient / destination

The destination never changes.

Use the generic equivalent of:

```text
SUBSTITUTE_CURRENT_GOLD_LOSS_FROM_INN
```

with:

```text
source = INN
destination = ORIGINAL_DESTINATION
payer stash loss = 0
```

Required cases:

### Payment to another player

```text
A would pay B N Gold
M09 resolves
=> A loses 0 from Stash
=> B receives N Gold from Inn
```

### Ante

```text
A must ante N
M09 resolves
=> A loses 0 from Stash
=> N Gold from Inn enters the pot
=> A counts as having satisfied that ante
```

### Gold taken by another player

```text
B would take N Gold from A
M09 resolves
=> A loses 0
=> B receives N from Inn
```

### Payment to Inn

```text
A must pay Inn N
M09 resolves
=> A loses 0 from Stash
=> destination remains Inn
```

In an abstract ledger this produces no net Inn transfer; do not create free Gold for A.

## 5. Timing

M09 is legal only while a concrete current Gold-loss/payment obligation is pending.

It is not a free Anytime source of Inn Gold.

After M09 resolves:
- current payment/Gold loss continues as satisfied using Inn Gold
- old response prompt/window is invalidated/re-evaluated normally
- other pending effects continue normally

Use the project's existing 30-second response timing rules.

## 6. Payment caused by your own card

Do NOT apply the special Ignore-Gold restriction to M09.

Official rules explicitly distinguish:
- Ignore-a-card-that-affects-your-Gold may be restricted for a payment caused by your own card
- cards that reduce payment or pay with Gold from the Inn may still be used

So M09 remains legal for a qualifying payment even when that payment was caused by a card the same player played.

## 7. Exclusions

M09 does not override a source that explicitly says its Gold loss/payment:
- cannot be avoided,
- cannot be substituted,
- cannot be paid with Gold from the Inn,
- or is otherwise unmitigable.

Do not invent exclusions that are not in source/rules.

Each separately-defined payment/loss is a separate response context.
One M09 play does not prepay or replace future independent Gold-loss contexts.

## 8. Gog evidence and project rule

Fresh complete RDI2 matrix verifies:

```text
Pay or Ante with found gold
Dimli = 2
Eve   = 0
Fleck = 2
Gog   = 2
```

No trustworthy original Gog card JSON/current card scan has been located.

Therefore record:

```text
gog.quantity = VERIFIED
gog.mechanicFamily = VERIFIED_SECONDARY_MATRIX
gog.exactCardText = UNAVAILABLE
```

Apply this explicit project rule override:

```text
Gog's two M09 cards use the same normalized M09 semantics as
the verified Dimli/Fleck payment-substitution family, with no
additional card-specific restrictions.
```

Record:

```text
gogSemanticRule = PROJECT_RULE_OVERRIDE
```

Do NOT claim Gog's exact wording or absence of extra printed restrictions is official-source-verified.

## 9. M09 ledger result

M09 may be marked:

```text
VERIFIED_FOR_PROJECT_RULESET
```

with sub-status:

```text
Dimli quantity                VERIFIED
Dimli exact source records     VERIFIED_ORIGINAL_JSON
Dimli semantics                VERIFIED

Fleck quantity                 VERIFIED
Fleck exact source records      VERIFIED_ORIGINAL_JSON
Fleck semantics                 VERIFIED

Gog quantity                    VERIFIED
Gog family assignment           VERIFIED_SECONDARY_MATRIX
Gog exact card text             UNAVAILABLE
Gog normalized semantics        PROJECT_RULE_OVERRIDE

trigger                         VERIFIED
amount/current-loss scope       VERIFIED_GENERIC_RULES
recipient preservation          VERIFIED_GENERIC_RULES
ante behavior                   VERIFIED
theft/take behavior             VERIFIED_FROM_DIMLI_FLECK_SOURCE
own-card payment legality       VERIFIED_OFFICIAL_RULES
separate-payment scope          VERIFIED_OFFICIAL_RULES
```

## 10. Required tests/source fixtures

Step 24A is source verification, not Step 24B implementation, but source fixtures must cover:

- 1-Gold payment to Inn
- multi-Gold single payment
- payment to another player
- ante
- another player taking Gold
- payment caused by your own card
- separate payment contexts
- explicit non-substitutable payment exclusion
- no pending Gold loss -> illegal
- recipient/destination preserved
- Gog evidence marked PROJECT_RULE_OVERRIDE, not official

Then continue Step 24A with M10.

Do not begin Step 24B.
Do not bulk-mark later entries VERIFIED.
Stop at the next item whose evidence is insufficient.

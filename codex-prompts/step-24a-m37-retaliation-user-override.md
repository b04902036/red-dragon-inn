# Step 24A — M37 Gog Retaliation Rule Override

Continue Step 24A from M37 only.

Do not begin Step 24B.

M37 concerns Gog's standard hit-back / retaliation card.

The exact publisher-visible Gog card text remains unavailable.

The current candidate is too permissive and must be corrected.

Do not use the current rule:

`actual Fortitude loss >= 1 => retaliation is legal`

by itself.

This prompt is an explicit M37-specific user override resolving the remaining
Gog card-text ambiguity.

---

# 1. M37 Mechanic

Treat Gog as having exactly one standard retaliation card with this gameplay
behavior:

- Type: `SOMETIMES`
- Trigger: immediately after Gog loses Fortitude from a card played by another
  player;
- Effect: the player who caused that Fortitude loss loses 2 Fortitude;
- Restriction: Gog may not play this retaliation card if Gog played any card
  to reduce or Ignore that specific Fortitude loss.

This is the authoritative M37 rule for this project.

Do not require Gog's exact printed title for Step 24A completion.

---

# 2. Critical Restriction

The current candidate restriction:

`cannot retaliate only if actual loss became 0`

is incorrect for M37.

Replace it.

M37 eligibility depends on whether Gog used a mitigation card against the
specific incoming Fortitude-loss event.

If Gog played any card whose purpose was to:

- reduce that Fortitude loss; or
- Ignore that Fortitude loss,

then Gog may NOT play M37 afterward.

This is true even if Gog still actually lost Fortitude.

Example:

Incoming loss = 4

Gog plays:

`Reduce Fortitude loss by 2`

Final loss = 2

Result:

`M37 is NOT legal`

Do not allow retaliation merely because `actualLoss = 2`.

---

# 3. Ignore Restriction

If Gog plays an Ignore card against the incoming Fortitude loss, Gog loses
M37 eligibility for that damage event.

This restriction is based on Gog having played the Ignore card, not merely on
whether the final Fortitude loss reached zero.

Therefore the engine must not implement M37 legality as only:

`actualLoss > 0`

---

# 4. Mitigation Card Was Negated

For this M37 override, use the literal historical-style restriction:

`if Gog played a card to reduce or Ignore that Fortitude loss`

Therefore:

1. another player creates a Fortitude-loss effect against Gog;
2. Gog plays a reduction or Ignore card;
3. another player Negates Gog's mitigation card;
4. original damage resolves and Gog actually loses Fortitude.

Result:

`M37 is still NOT legal`

Gog already played a card to reduce or Ignore that specific Fortitude loss.

Do not restore M37 eligibility merely because the mitigation card was Negated.

This means M37 requires response-history tracking, not only final numeric
damage.

---

# 5. No Mitigation

Example:

Another player makes Gog lose 3 Fortitude.

Gog plays no reduction or Ignore card.

Gog actually loses 3 Fortitude.

Result:

`M37 is legal`

When M37 resolves:

`original source player loses 2 Fortitude`

---

# 6. Redirection

Use the publisher-established RDI redirection rule.

If another player's card originally causes Gog's Fortitude loss, but that
damage reaches Gog through a redirection sequence, the game still treats the
Fortitude loss as coming from the original source.

Example:

Player A plays a card causing Fortitude loss.

The damage is redirected through another player and ultimately reaches Gog.

If Gog is otherwise eligible to retaliate:

`M37 targets Player A`

Do not retaliate against the intermediate redirecting player merely because
they redirected the damage.

Use the existing shared `originalSourcePlayer` / damage provenance system.

---

# 7. Valid Source Requirement

M37 requires:

`Fortitude loss from a card played by another player`

Therefore all of these must be true:

- Gog actually loses Fortitude;
- the loss came from a card;
- that card was played by another player;
- an original source player can be identified;
- Gog did not play a reduction or Ignore card against that specific loss.

Do not trigger M37 from every generic Fortitude-loss event.

---

# 8. Invalid Sources

M37 is not legal merely because Gog loses Fortitude from:

- Gog's own card;
- a Drink by itself;
- a Drink Event by itself;
- another Event with no qualifying player-played card source;
- a static/token effect with no qualifying player-played card source;
- a rule-system effect with no source player;
- any effect where Gog did not actually lose Fortitude.

Unless another separately verified rule explicitly converts such an effect
into a qualifying player-card source, M37 must remain illegal.

---

# 9. Exact Timing

M37 occurs only after the Fortitude loss resolves.

Correct order:

1. incoming card is played;
2. normal response window occurs;
3. reduction / Ignore / Negate / redirect responses resolve;
4. incoming card resolves;
5. determine Gog's actual Fortitude loss;
6. record whether Gog played a reduction or Ignore card for this loss;
7. if M37 eligibility remains valid, create the post-loss Sometimes
   opportunity;
8. Gog may play M37;
9. if M37 resolves, original source player loses 2 Fortitude.

Do not offer M37 before the incoming Fortitude loss resolves.

---

# 10. Required Reaction Context

Do not determine M37 legality from only:

`actualLoss`

The post-loss context must retain enough provenance to know at least:

- affected player;
- original source card;
- original source player;
- actual Fortitude lost;
- whether affected player played a Fortitude-loss reduction card against this
  event;
- whether affected player played an Ignore card against this event.

Conceptually:

`FORTITUDE_LOSS_RESOLVED`

with fields equivalent to:

- `affected = Gog`
- `sourcePlayer = OTHER`
- `sourceCard != null`
- `actualLoss >= 1`
- `selfPlayedReductionForThisLoss = false`
- `selfPlayedIgnoreForThisLoss = false`

The exact schema may differ.

Prefer extending the shared reaction/event provenance model rather than adding
a Gog-specific boolean hack.

---

# 11. Important Difference From Current Candidate

Current candidate behavior:

`actualLossMin: 1`

allows this:

Incoming 3
-> reduce by 1
-> actual loss 2
-> retaliate

That behavior is NOT allowed under M37.

Correct behavior:

Incoming 3
-> Gog plays reduction card
-> actual loss 2
-> M37 illegal

The restriction is about mitigation-card usage, not only final damage amount.

---

# 12. Non-Card Reduction

Do not automatically treat every numeric reduction from every possible source
as disqualifying unless it represents Gog playing a card to reduce that
specific loss.

The M37 override specifically tracks:

`Gog played a card to reduce or Ignore the Fortitude loss`

If a passive/static effect modifies incoming damage without Gog playing a
card, preserve the distinction unless an existing publisher rule explicitly
says that passive reduction counts for this card family.

Do not broaden the override beyond its wording.

If this exact passive/static interaction remains genuinely unresolved and is
required by current content, report that narrow case separately rather than
guessing.

---

# 13. Required Tests

## Test A — Clean Hit Back

Another player causes Gog to lose 2 Fortitude.

Gog uses no mitigation.

Assert:

- Gog loses 2;
- M37 becomes legal;
- M37 makes the original source player lose 2 Fortitude.

---

## Test B — Partial Reduction

Incoming loss = 4.

Gog plays a card reducing the loss by 2.

Gog actually loses 2.

Assert:

`M37 is illegal`

This is mandatory.

---

## Test C — Reduction to Zero

Incoming loss = 2.

Gog plays a card reducing loss by 2.

Assert:

- Gog loses 0;
- M37 is illegal.

---

## Test D — Ignore

Gog plays an Ignore card against the incoming Fortitude-loss card.

Assert:

`M37 is illegal`

---

## Test E — Ignore Is Negated

Incoming damage targets Gog.

Gog plays an Ignore card.

Opponent Negates the Ignore.

Incoming card then resolves and Gog actually loses Fortitude.

Assert:

`M37 is still illegal`

because Gog played an Ignore card against that loss.

This test is mandatory.

---

## Test F — Reduction Card Is Negated

Incoming damage targets Gog.

Gog plays a reduction card.

That reduction card is Negated.

Gog then loses the full Fortitude amount.

Assert:

`M37 is still illegal`

because Gog played a reduction card against that loss.

---

## Test G — Unrelated Response

Gog plays a response during the sequence that neither reduces nor Ignores the
incoming Fortitude loss.

If the incoming card later makes Gog lose Fortitude:

Assert that the unrelated response alone does not disqualify M37.

---

## Test H — Redirection

Player A creates the Fortitude-loss effect.

The damage is redirected and ultimately causes Gog to lose Fortitude.

Gog uses no reduction or Ignore.

Assert:

- M37 is legal;
- retaliation targets Player A as the original source.

---

## Test I — Self-Caused Damage

Gog's own card causes Gog to lose Fortitude.

Assert:

`M37 is illegal`

---

## Test J — Non-Player Source

A Drink or Event causes Gog to lose Fortitude without a qualifying
player-played card source.

Assert:

`M37 is illegal`

---

# 14. Evidence Classification

Record the evidence ledger accurately.

## Publisher-supported family behavior

Publisher rules support the standard hit-back pattern:

- play immediately after losing Fortitude from a card played by another
  player;
- retaliate against that source player;
- retaliation causes 2 Fortitude loss for the standard family;
- reduction can prohibit use of the hit-back card;
- redirected Fortitude loss retains its original source.

RDI2 publisher examples specifically establish the same post-loss timing and
source attribution for Dimli and Fleck hit-back cards.

## Matrix-supported

Existing deck matrix establishes Gog has:

- quantity = 1
- mechanic family = standard `another player makes you lose Fortitude ->
  they lose 2 Fortitude` retaliation.

## M37 USER OVERRIDE

Record the remaining Gog-specific wording resolution as:

`M37 USER OVERRIDE`

The override is:

Gog may not play his retaliation card if he played any card to reduce or
Ignore that specific Fortitude loss.

This remains true even if the mitigation card was later Negated and Gog still
lost Fortitude.

Do not claim Gog's complete physical printed text was located.

---

# 15. Update Existing Candidate

The existing candidate summary currently says approximately:

`You cannot use this if the loss was fully ignored/reduced to 0.`

Replace that rule.

Use instead:

`Immediately after another player causes you to lose Fortitude, that original
source player loses 2 Fortitude. You may not play this card if you played a
card to reduce or Ignore that Fortitude loss.`

This is the authoritative normalized M37 behavior for this project.

---

# 16. Completion Gate

M37 is complete when:

- quantity remains 1;
- standard hit-back amount is 2 Fortitude;
- trigger occurs after actual Fortitude loss;
- source must be another player's card;
- original source attribution survives redirection;
- partial reduction disqualifies M37;
- full reduction disqualifies M37;
- Ignore disqualifies M37;
- a Negated reduction/Ignore attempt still disqualifies M37;
- unrelated responses do not disqualify it;
- focused tests pass;
- relevant Sometimes / reduction / Ignore / Negate / redirection regressions
  pass;
- evidence ledger clearly labels the Gog-specific restriction as M37 USER
  OVERRIDE.

After all checks pass:

`Mark M37 COMPLETE.`

Continue Step 24A to M38.

Do not stop M37 again solely because Gog's complete original physical-card
wording is unavailable.
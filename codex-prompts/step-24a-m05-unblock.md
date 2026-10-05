# Step 24A M05 unblock — Eve/Fleck control-and-eject

Read:

```text
reference/rdi2/m05-eve-fleck-control-eject-original-records.json
content-private/imports/rdi2/verification-ledger.json
content-private/imports/rdi2/source-candidate.json
reference/rdi2/source-evidence.md
codex-prompts/step-24a-rdi2-source-lock.md
```

Continue ONLY Step 24A from the M05 blocker.

## Source provenance

The M05 JSON file contains verbatim records extracted from the user's uploaded
`HaxxonHax/the-inn` repository for:

- Eve the Illusionist
- Fleck the Bard

Both records are the Cheating card:

```text
What's that up your sleeve?
```

The records include source-file SHA-256 and canonical record SHA-256.

Do not rewrite or "improve" the original record while verifying it.

## What the original records establish

Both Eve and Fleck records explicitly establish:

1. card type = `Cheating`
2. take control of the current Round of Gambling
3. pick **one player in the current Round of Gambling**
4. force that chosen player to leave the Round
5. that player may not play any more Gambling or Cheating cards during this Round
6. Gold already anted stays in the pot

The two cards have the same mechanical text.

## Current official generic forced-leave rules

Use current official RDI gambling rules to add the generic timing behavior:

- when a player is being forced out, every player, including the player being
  forced out, receives the normal response opportunity before the leave completes
- if the forced leave would leave only one player, that response opportunity
  occurs before the Round ends and the remaining player wins
- after leaving, the player cannot play Gambling/Cheating for the remainder of
  the Round but can still play otherwise-legal Sometimes/Anytime cards
- already-anted Gold remains in the pot

These are generic gambling rules. Do not encode them by Eve/Fleck/card name.

## Critical target warning

The uploaded original text says:

```text
Pick one player in the current Round of Gambling
```

It does NOT say:

```text
another player
```

Therefore:

- do not silently normalize the target to `OTHER_ACTIVE_GAMBLER`
- do not assume self-targeting is legal either
- search primary/current official evidence for the target restriction
- if primary evidence explicitly says "another player", encode that
- if primary evidence explicitly allows self, encode that
- if no primary evidence resolves it, keep only this target sub-point unresolved
  and report it rather than guessing

A matching implementation pattern on a different card is not enough to resolve
this target wording.

## Required M05 ledger update

For M05 record, separately verify:

- Eve quantity
- Fleck quantity
- type = Cheating
- control takeover
- target eligibility
- forced-leave timing
- post-leave Gambling/Cheating restriction
- ante remains in pot
- final-player response-before-win behavior

Do not mark M05 fully VERIFIED until each sub-item is supported.

If only self-vs-other targeting remains unresolved, report exactly that one
sub-item instead of claiming the whole mechanic lacks source text.

## Continue Step 24A

After M05 is resolved as far as evidence permits, continue M06, M07, ... in
order according to the existing Step 24A prompt.

Do not start Step 24B.
Do not bulk-mark later ledger entries VERIFIED.
Do not guess any missing RDI2 effect.

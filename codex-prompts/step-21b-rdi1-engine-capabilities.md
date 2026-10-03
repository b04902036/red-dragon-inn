# Step 21B — Implement all generic engine capabilities required by RDI1

## Prerequisite
Step 21A is green and `docs/rdi1-engine-gap.md` exists.

## Goal
Extend the engine generically until every capability declared by the normalized RDI1 source can execute.

Do not import/publish the RDI1 decks yet.

## Architecture rules

- No card-title checks.
- No Deirdre/Fiona/Gerki/Zot branches in generic timing code.
- New behavior must be represented by validated DSL ops, validated mechanic metadata, or registered generic server handlers.
- `legalPlays` and command validation must share the same legality implementation.
- Server remains authoritative.
- Timers remain server-authoritative and replayable.

## Required engine work

Implement every NEEDS_GENERIC_ENGINE_FEATURE from Step 21A, including when applicable:

### Gambling
- `ANTE_ALL_ACTIVE(amount)`
- forced leave of a chosen active gambler
- response opportunity before forced leave completes
- system event before payout (`GAMBLING_WIN_BEFORE_PAYOUT`)
- replace winner before payout
- end round and send pot to Inn
- take Gold from pot without changing control
- payment/ante substitution using Inn Gold
- cancel current ante + leave
- generic gambling response checkpoints
- Anytime cards must remain playable during gambling whenever rules allow
- current `Winning Hand` restriction remains intact

### Timed Sometimes outside ordinary card-response frames
Add authoritative 30-second response prompts for:
- `ANTE_REQUIRED`
- `PAYMENT_REQUIRED`
- `GAMBLING_CHECKPOINT`
- `GAMBLING_WIN_BEFORE_PAYOUT`
- `FORTITUDE_LOSS_RESOLVED`
- `ORDER_DRINK` phase opportunities

Only a player with a legal Sometimes card gets a prompt.
Playing a card invalidates the old prompt, re-evaluates legality, and creates a fresh deadline as required by Step 19.

### Phase-scoped Sometimes
`order_two_extra_drinks` must be legal during the active player's Order Drink phase, both before and after the normal Order-a-Drink action while that phase remains open.

Do not classify it as Anytime just to fit the old engine.

### Damage provenance
When Fortitude loss is redirected:
- preserve the original source player/card
- the final affected player receives the loss
- post-loss retaliation targets the original source player
- full Ignore/reduction to zero prevents hit-back legality

### Drink operations
Add generic support for:
- order N additional Drinks
- force one player to drink now
- queue a second separate Drink when another player reveals one
- pass current Drink to another player
- split a Drink into two independent Drinks; combine Chasers first and halve each numeric effect with ceil rounding
- replace Alcohol gain with equal Fortitude gain
- Drink capability facts (`CHANGES_DRINK_EFFECT`, etc.)
- negate a Drink-changing card using capability metadata, not titles
- protected counter family for the RDI core Sometimes counter
- simultaneous Drink reveal/resolve
- Drinking Contest
- Round-on-the-House independent copies
- trait-based Drink replacement effects (`ORC`, `TROLL`) in a generic trait system

### Anytime
Confirm that normal Anytime cards can be played:
- during any normal phase
- in response windows
- during gambling at legal timing points
- during phase-end grace

## Trigger/schema changes

Extend `ReactionContext` and response trigger schemas with only generic structured facts needed by the source.

Examples:
```text
SYSTEM_EVENT
PAYMENT_CONTEXT
ANTE_CONTEXT
DRINK_CAPABILITY
ACTUAL_STAT_LOSS
ORIGINAL_SOURCE_PLAYER
GAMBLING_SETTLEMENT
PHASE_OPPORTUNITY
COUNTER_FAMILY
```

Keep bounded runtime validation.

## Tests — mandatory

For every new generic capability:
- happy path
- illegal timing
- stale prompt
- timeout
- nested response reset
- reconnect serialization
- deterministic replay
- hidden-information projection

Mandatory scenario tests:
1. anti-cheat negates a cheating ejection before it completes and wins
2. substitute exactly one ante/payment Gold with Inn Gold
3. cannot reclaim Gold already in pot
4. pot-to-Inn card obeys all current restrictions
5. Gerki-style post-win replacement occurs before payout
6. phase-scoped extra Drinks works before and after normal ordering
7. Anytime works during gambling
8. hit-back only after actual Fortitude loss > 0
9. redirected damage hit-back targets original source
10. pass/split/modify/ignore Drink response windows reset correctly
11. protected Sometimes counter can only be countered by its own family
12. Drinking Contest tie repeats correctly
13. Round-on-the-House copies cannot be modified before copy but can afterward
14. all new Sometimes opportunities use 30s prompts
15. playing any response produces a new prompt/deadline where the triggering opportunity remains

Run all standard checks.

Stop before Step 21C.

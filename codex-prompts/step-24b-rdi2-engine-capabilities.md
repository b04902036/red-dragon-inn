# Step 24B — RDI2 engine gap audit and generic mechanics implementation

## Prerequisite

Step 24A is fully green:
- `content:verify:rdi2-source` exits 0
- unresolved source conflicts = 0
- source lock hash is valid

If not, stop.

## Goal

Compare the source-locked RDI2 mechanics with the existing RDI1 engine and implement only the missing **generic** capabilities.

Do not import/publish RDI2 yet.

## First: produce a gap report

Create:

```text
docs/rdi2-engine-gap.md
```

For every capability used by RDI2 classify:

```text
ALREADY_SUPPORTED
SUPPORTED_WITH_SCHEMA_EXTENSION
NEEDS_GENERIC_ENGINE_FEATURE
```

Do not rewrite working RDI1 mechanics.

## Likely RDI2-specific/high-risk capabilities to audit

Do not assume these are missing; inspect first.

### Dimli
- post-win restart of an existing gambling round
- keep pot
- remaining participants re-ante
- Dimli becomes current controller
- continue from player to his left
- correct restrictions when Dimli already left / winner already replaced

### Eve
- Illusionary Gold loss prevention
- ante counts satisfied with no Gold transfer
- replace an already-revealed Drink's base effects with fixed +4 Alcohol
- future non-Drink modifiers still affect that replaced Drink
- Share Pain:
  - split pending Fortitude loss with original source
  - ceil rounding
  - prevent Eve from stacking her own further mitigation after choosing it
- redirect Fortitude:
  - target cannot be original attacker
  - preserve original source
  - only Fortitude loss redirects
  - 2-player fallback behavior

### Fleck
- free two extra Drinks during own Order Drink phase
- alternate mode: waive own Drink-deck refill payment
- all players simultaneously take Drinks from the Inn deck
- skip Drink Events while finding those forced Drinks
- sequenced multi-effect songs

### Gog
- heavy damage variants
- damage plus pay-Inn effect (payment is an effect, not an activation cost)
- all-opponents damage
- anti-cheat immediate win
- extra Drink during another player's Drink phase
- Half-Ogre trait for Ogre Brew

### RDI2 Drink deck
- Mead built-in split
- Round on the House independent copies
- Drinking Contest current semantics
- The Challenge
- trait replacement:
  - Troll
  - Orc
  - Ogre/Half-Ogre
- RDI1/RDI2 Bar Deck support if not already present

## Timing requirement — do not change the user's rule

The project's chosen timing behavior is:

```text
legal Sometimes OR legal Anytime in event/system opportunity
=> 30-second response window

legal Sometimes present
=> Sometimes voice may play

Anytime-only
=> 30-second window, NO Sometimes voice

core phase about to end
=> separate 15-second Anytime grace
```

Any card play:
- invalidates old prompt/deadline
- resolves
- recomputes legal plays
- creates a fresh 30-second response opportunity when applicable

All new RDI2 mechanics must integrate with this exact rule.

## Architecture

- no character-name checks in generic engine
- no card-title checks
- validated DSL/op or generic registered handler
- `legalPlays` and command validation share the same legality source
- server-authoritative deadlines
- reconnect/replay deterministic
- no hidden legal-card leakage

## Tests

For each newly implemented generic mechanic:
- positive path
- illegal timing
- illegal target
- stale prompt
- timeout
- nested response reset
- reconnect
- replay
- hidden information

Mandatory integration cases:
1. Dimli restart before payout
2. Eve Illusionary Coin on ordinary payment
3. Eve Illusionary Coin on ante; ante counts as satisfied
4. Eve fixed-4-Alcohol Drink replacement then later modifier
5. Share Pain odd and even Fortitude loss
6. Share Pain self-mitigation lock
7. redirect preserves Gog as original source
8. redirect 2-player fallback
9. Fleck free extra Drinks
10. Fleck refill-payment waiver
11. all-player Inn-deck Drink reveal skipping events
12. Gog heavy hit with payment side effect
13. Half-Ogre Ogre Brew replacement
14. Mead pre-split modification
15. Mead post-split independent modification
16. Mead cannot split as Chaser/event result
17. The Challenge accept and decline
18. Round on the House
19. Drinking Contest
20. all response windows follow 30s/voice rule

Run all standard checks and stop before Step 24C.

# Step 06 — Drinks, Chasers, Drink Events, elimination, win condition

## Goal

Complete the core non-character-specific game loop.

## Drink system

Implement:
- Drink Me! pile
- ordering a face-down drink to another player
- revealing own top Drink card
- empty Drink Me! behavior through configurable rule
- Alcohol effect
- Fortitude effect if supported by drink definitions
- compound/modifier hooks

## Chasers

Implement a generic chained-drink resolver:
- reveal the next card from the same source required by the rules/content definition
- combine applicable drink effects into one logical drink resolution
- prevent infinite loops through sensible validation/safety limits
- retain deterministic event order

## Drink Events

Implement Drink Event as a separate resolution type:
- event instruction/effect resolves through engine
- ordinary drink modifiers must not accidentally modify an event unless explicitly permitted by effect metadata
- if an event is encountered in a context where rules say it should be discarded rather than executed, model that context explicitly

## Elimination

Implement:
- pass-out condition: Alcohol Content >= Fortitude
- out-of-Gold condition
- correct delayed/timing-aware elimination checks
- Gold redistribution for pass-out according to configured core rule
- simultaneous elimination handling
- skipped seats on future turns
- last surviving player wins
- tie state when applicable

The distribution algorithm must be deterministic and thoroughly tested.

## Stat bounds

Enforce configured bounds:
- Fortitude
- Alcohol
- Gold nonnegative

Do not let client input directly set stats.

## Tests — mandatory

At minimum:
1. order drink moves hidden card correctly
2. opponent sees count, not identity
3. taking drink reveals/resolves top item
4. Alcohol increases correctly
5. empty Drink Me! pile fallback behavior
6. one Chaser
7. multiple chained Chasers
8. Drink Event normal resolution
9. Drink Event in Chaser-discard context if configured
10. modifiers cannot incorrectly alter Drink Event
11. pass-out at equality
12. no pass-out just below threshold
13. out-of-Gold timing
14. Gold redistribution odd/even amounts
15. remainder handling
16. simultaneous pass-out
17. simultaneous zero-Gold case
18. eliminated players skipped
19. final winner
20. tie
21. no stat below/above configured bounds
22. card conservation through drink chains
23. deterministic replay of a drink chain leading to elimination

After this step, a complete sample-content match should be possible in engine-only tests.

Add an engine integration test that plays a full scripted game from setup to winner.

Run all standard verification.

Stop after this step.

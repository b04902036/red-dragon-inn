# Step 03 — Deterministic core turn engine

## Goal

Implement the first real game engine as a deterministic TypeScript domain library.

Do not connect it to WebSockets yet.

## Rules covered in this step

Implement:
- match setup
- seat order
- active player
- initial stat configuration via rules config
- initial hand draw
- Drink Me! initial setup
- discard/draw phase
- action phase
- order-a-drink phase
- drink phase shell
- elimination-check phase shell
- next-turn transition
- deck exhaustion + reshuffle helpers
- deterministic shuffle

Keep values/config data-driven where sensible.

## Server-authoritative command handling

Introduce a central boundary such as:

```ts
applyCommand(state, command, context) -> {
  state,
  events
}
```

or equivalent.

Requirements:
- validate lifecycle
- validate active player
- validate phase
- validate card ownership/location
- validate targets when applicable
- reject stale `expectedStateVersion`
- enforce command idempotency contract or prepare a deterministic dedupe mechanism
- increment state version only for accepted state-changing commands

## RNG

All shuffle/random behavior must use one injected deterministic RNG abstraction.

Requirements:
- no `Math.random()` in game-rule code
- seed stored with match
- same seed + same command sequence => same results

## Events

Do not silently mutate important state.
Produce meaningful events for:
- draws/discards
- phase changes
- ordered drinks
- turn changes
- reshuffles
- stat changes if introduced

## Invariants

At runtime/test boundaries assert important invariants:
- each card instance is in exactly one location
- no duplicate card instance IDs
- Gold >= 0
- Fortitude/Alcohol remain within configured bounds if the rules config defines bounds
- exactly one active player while match is actively playing
- no hidden-card identities in public projection

## Tests — mandatory

Write extensive engine tests.

At minimum:
1. deterministic setup from a known seed
2. same seed gives same deck order
3. different seed can give different order
4. initial hand correct
5. active player can discard then redraw to configured hand size
6. illegal discard from another player's hand rejected
7. action command rejected outside action phase
8. order drink only during correct phase
9. cannot order from hidden/future deck data supplied by client
10. phase order is correct
11. turn advances to next non-eliminated seat
12. deck exhaustion reshuffles discard correctly
13. no card instance exists in two zones
14. stale state version rejected
15. duplicate command ID does not double-apply
16. rejected command does not mutate state/version
17. deterministic event sequence for same seed + commands
18. public/private projections remain safe after several turns

Add property/invariant tests if practical for card conservation and deterministic replay.

## Coverage

Meaningful core engine rules introduced in this step should meet the project's >=90% target.

Run all standard verification.

Stop after this step.

# Step 18 — Correct Sometimes/Anytime legality and response ordering

## Goal

Make the timing engine rules-correct and data-driven before adding real RDI 1/2 cards.

Do NOT add timers yet. Step 19 owns deadlines.

## Current files to inspect

At minimum:

```text
src/engine/timing.ts
src/engine/resolution-state.ts
src/engine/model.ts
src/content/cards.ts
src/content/effects.ts
src/protocol/projections.ts
src/protocol/views.ts
src/client/game-actions.ts
tests/engine/timing.test.ts
tests/fixtures/timing-match.ts
```

Read `reference/current-reaction-review.md`.

## Official timing behavior to implement

For a played card, revealed Drink, or Event:

1. Determine the source event.
2. Determine which `Sometimes` cards are relevant based on their actual trigger predicates.
3. `Anytime` cards remain playable where the rules permit.
4. Response order begins with the player who played/revealed the source, then proceeds in seat order.
5. Players with no legal response cards may be auto-skipped by the digital implementation.
6. When someone plays a response:
   - that response becomes a child resolution
   - other players may respond to the child
   - child resolves first
7. After the child resolves:
   - re-evaluate the original source against current state
   - discard the old pass consensus
   - restart response opportunities for the original source in the original timing order
8. Only when nobody has a legal response / all eligible players pass may the source resolve.

Do not reuse stale legality computed before a nested response.

## Reaction trigger model

Add a runtime-validated, data-driven predicate model for `Sometimes`.

Do not put card-name-specific if/else checks in `timing.ts`.

Use a structure conceptually like:

```ts
responseTrigger: {
  event: ...,
  conditions: [...]
}
```

The exact schema may differ.

It must be expressive enough for every RDI 1 and RDI 2 Sometimes card supplied later.

Expected trigger families include at least:

- any card/effect about to affect self
- Fortitude loss affecting self
- Alcohol gain / Drink affecting self
- Gold loss/payment affecting self
- another player's card affecting self
- Drink revealed
- Drink modifier opportunity
- Gambling/Cheating interaction
- Gambling round state/control
- card/effect being negatable
- Sometimes card being played
- applicable source category/type
- actor/target relationship:
  - SELF
  - OTHER
  - ANY
- phase/lifecycle restrictions
- source affects one target vs multiple targets
- pending operation/effect matching

Do not overfit to sample fixture card names.

## Event context

Create a deterministic `ReactionContext` (or equivalent) derived from authoritative state and current resolution frame.

It should expose structured facts, not presentation strings.

Examples:

```text
source kind
source card type
source actor
targets
affected players
pending effect categories
pending stat deltas
drink/event context
gambling context
parent/child relation
phase
```

## Legal response evaluation

Create a server-side function such as:

```ts
legalResponsesForPlayer(state, playerId, reactionContext)
```

Return exact card instance IDs plus legal command/target requirements.

The engine must use this same evaluator when validating `PLAY_RESPONSE`.

Do not let UI legality and server legality diverge.

## Response order

Replace the current response ordering helper.

Required behavior:

```text
source player
→ next living seat
→ ...
→ source player cycle complete
```

When a child response finishes, re-evaluate the parent and restart at the parent's timing origin.

Persist the parent's timing-origin player ID explicitly if needed.

## Sometimes vs Anytime

- `Sometimes` must pass trigger predicates.
- `Anytime` does not need a Sometimes trigger, but still must obey current resolution/gambling rules.
- During an event response opportunity, a player may use a legal Anytime card.
- The response window must not expose which private cards make a player eligible.

## Auto-skip

If a player's private hand has no legal response:
- skip them without waiting for a client PASS
- continue to the next eligible player

If no one has any legal response:
- the source resolves immediately.

Public state may show who currently has response priority, but must never reveal:
- how many response cards they hold
- which response cards they hold
- why another player had no legal response

## Tests — mandatory

Rewrite any existing tests that encode the old incorrect order.

At minimum test:

1. source actor gets first response opportunity
2. next living seat follows source actor
3. eliminated players skipped
4. player with zero legal response cards auto-skipped
5. legal Sometimes trigger is accepted
6. same Sometimes card outside its trigger is rejected
7. unrelated Sometimes card is rejected even though a response window exists
8. Anytime may be used during a response opportunity
9. Ignore only when source affects the actor as allowed
10. Negate only against a valid negatable source
11. response to response creates child frame
12. child frame gets its own freshly evaluated responses
13. after child resolves, parent passes reset
14. parent response order restarts from parent's timing origin
15. a card played by a response can change which parent responses are now legal
16. newly legal response becomes available after re-evaluation
17. previously legal but now invalid response is no longer accepted
18. no legal responders => source resolves without fake pass commands
19. public projection leaks no hand legality
20. server validation and private legal-response calculation agree
21. deterministic replay remains identical
22. reconnect serialization in nested-response state remains valid

Keep at least one depth-4 response-stack test.

## Documentation

Update:

```text
docs/timing-engine.md
docs/protocol.md
```

Explain:
- timing origin
- trigger evaluation
- auto-skip
- re-evaluation after a child response

## Verification

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run test:coverage
npm run build
npm run test:e2e
```

Stop after Step 18.

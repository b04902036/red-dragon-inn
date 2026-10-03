# Step 04 — Resolution stack, response windows, effect DSL

## Goal

Implement the timing engine needed for Sometimes/Anytime/Ignore/Negate-style interactions.

This is a critical engine step. Do not simplify it into one giant phase enum.

## Resolution model

Introduce a stack/frame system.

A resolution frame should be able to represent:
- source card/effect
- actor
- targets
- pending effect operations
- response timing/window
- cancellation state
- per-target ignore state
- required choices
- continuation after child frame resolves

Design for nested responses.

## Response window

A response window must track:
- eligible players
- whose response opportunity is active
- passes
- responses already submitted if relevant
- response timing type
- what source/effect is being responded to

Do not leak hidden hands when calculating eligibility.

## Effect DSL

Implement a minimal extensible DSL for common operations.

Start with operations such as:
- change_fortitude
- change_alcohol
- transfer_gold
- pay_inn
- draw_cards
- discard_cards
- ignore_source_for_self
- negate_source
- open_choice
- start_gambling placeholder
- modify_pending_effect

Use runtime validation.

Effects that cannot be safely represented should use:
- `effect_key`
- validated params
- server-side handler registry

No executable code from D1.

## Resolution semantics

Define clear semantics for:
- source card enters resolution
- response window opens
- pass sequence
- a response itself may open another response window
- child frame resolves first
- Ignore affects appropriate target/effect
- Negate cancels appropriate source/effect
- original source resolves only after responses complete

Document exact engine semantics even if future RDI-specific edge cases may add rules later.

## Tests — mandatory

Test deeply nested behavior.

At minimum:
1. simple action with no responses resolves
2. one Sometimes response
3. nested response to response
4. multiple players pass in correct order
5. all-pass closes response window
6. Ignore prevents effect for the intended target without incorrectly canceling unrelated targets
7. Negate cancels intended source/effect
8. canceled frame does not apply operations
9. a response card is removed from correct hand/zone
10. illegal response timing rejected
11. ineligible player cannot respond
12. player cannot pass twice to corrupt window state
13. response stack unwinds in correct order
14. nested effects produce deterministic event order
15. rejected nested command leaves stack unchanged
16. public projection exposes window/priority but not hand contents
17. disconnect/reconnect-safe state is serializable in the middle of a response window

Add at least one 3-level nested response test.

Document the timing model in `docs/timing-engine.md`.

Run all standard verification.

Stop after this step.

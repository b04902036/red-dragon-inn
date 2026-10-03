# Timing engine through step 18

`timing.ts` implements source frames and response windows independently of the turn phases. These are generic sample-content semantics, not a complete catalog of character-specific timing rules. [Gambling](gambling-engine.md) suspends a source with child control frames; [Drinks/Events](drinks-elimination.md) now use compound root sources with ELIMINATION_CHECK continuations.

## Frames and priority

Step 19 adds [persisted server deadlines and phase-end grace](timed-prompts.md). Phase completion now opens legal Anytime opportunities before transitioning; pending elimination waits through that grace. Every response priority receives a production 30-second deadline; each phase-end priority receives 15 seconds. Durable Object alarms and recorded system actions own expiry.

1. An owned Action enters `RESOLUTION`, leaving its owner's hand. Its effects are copied from the validated server definition; the client supplies only a card reference and any required target. If nobody has a legal response, the source resolves immediately without fabricated player passes.
2. A frame records source, actor, chosen targets, pending operations/cursor, stage (`RESPONSES`, `OPERATIONS`, `CHOICE`), cancellation, ignored players, parent ID, saved window, chosen option, and continuation. An Action continues to `ORDER_DRINK`; a response or Anytime source resumes its parent or suspended turn.
3. The frame's persisted actor is its timing origin. Initial priority starts with that actor, then proceeds clockwise through living seats. The server auto-skips players without a legal response. Window kind describes the source's timing: `SOMETIMES` for Actions/generic responses, the response kind for Ignore/Negate, or `ANYTIME`.
4. Only the priority holder may `PASS_RESPONSE` or `PLAY_RESPONSE`, naming the active window. Passing advances clockwise. A second pass in the same consensus round is rejected. Once everyone passes, the window closes and operations execute in definition order.
5. A response leaves its owner's hand and pushes a child with its own freshly evaluated window. The parent's window stays on its frame and its passes reset. No parent operation executes while a child is pending.
6. Children resolve and discard first. A completed child re-evaluates its parent using current state and pending effects, creates a fresh window identity, and restarts at the parent's original timing origin. Previously passed players regain response opportunities; newly legal cards become available and invalid cards disappear. A canceled parent closes immediately and skips its operations. Character sources move to their owner's discard exactly once; Drink/Event compound sources move all held cards to Inn discard exactly once.

`reactionContext` derives structured facts from authoritative state and the pending effect cursor: source kind/type/actor, affected players, pending operations/stat deltas, negatable status, phase/lifecycle and parent identity. `responseTrigger` contains an event and bounded alternatives (OR); each alternative contains conditions (AND). Conditions cover actor/target relationships, stat gains/losses/payments, source types, pending operations, target counts, phase/lifecycle, nested responses, current player stats and live gambling state. Predicates never use display names or card-specific branches.

`legalResponsesForPlayer` combines trigger predicates with the same effect and target validation used by `PLAY_RESPONSE`. Anytime does not require a Sometimes trigger but must pass effect/context validation. Legacy pinned Ignore/Negate definitions without trigger metadata use their structural predicates; an unspecified ordinary Sometimes is never universally legal. Ignore requires the actor to be affected by the immediate parent and not already ignored. Negate requires a noncanceled negatable character-card source. New definitions can explicitly disable negation. Action, Gambling, Cheating, Drink and Special cards cannot be submitted as responses.

Only the authenticated priority player's private view receives exact `legalResponses`, including card instance IDs and legal targets. The public window/event eligibility field is the living-seat roster, not the hidden eligible-hand calculation. Neither public projections nor event history expose legal-card counts, IDs or auto-skip reasons. `PLAY_CARD` handles ordinary Actions, an active player's Gambling initiation, or a living player's Anytime card between commands, including out of turn. Normal turn commands suspend while any frame/window or gambling sub-state exists.

A gambling control source is a child of the suspended initiating frame in OPERATIONS, which has no saved response window. Its completion returns to the gambling round, rather than reopening the initiating window. Its own response children follow the ordinary rules above. Gambling priority advances when control executes and remains valid through private choices; gambling commands still wait until the control frame completes.

## Ignore, Negate, and pending operations

- `IGNORE { scope: CURRENT_EFFECT }` ignores the immediate parent source's entire pending effect batch for the responder. The legacy scope name refers to this source effect, not just one operation index. Other targets remain affected. The exclusion lasts only for that frame. For Gold transfers, ignoring the payer also prevents the transfer, preserving Gold conservation.
- `NEGATE { scope: TOP_STACK }` cancels the immediate parent frame, never a distant ancestor. A canceled frame still discards its source and runs its continuation, but emits no resolved operations. Negating an Ignore prevents the Ignore from applying; negating that Negate allows the Ignore to resolve.
- `MODIFY_PENDING_EFFECT { effectIndex, delta, allowDrinkEvents? }` adjusts a not-yet-executed `CHANGE_STAT` on the immediate parent. The engine validates index, operation type, and safe arithmetic before accepting the source. A Drink Event requires explicit `allowDrinkEvents: true` on the definition's effect.
- `MODIFY_DRINK { alcoholDelta, fortitudeDelta, allowDrinkEvents? }` adjusts both compound Drink stat hooks. The immediate parent must be a Drink, or an explicitly permitted Event with both SELF stat hooks.

For example, Shove → Ignore → Negate unwinds as Negate, canceled Ignore, Shove. The target's Fortitude stays 20 while responses are pending, then becomes 18. With Ignore alone it remains 20.

## Validated effect DSL

All operations use strict Zod schemas; unknown fields, executable strings/functions, unknown keys, invalid targets, and unsafe numeric parameters fail validation. The existing sample content and published D1 seed remain unchanged.

| Operation               | Generic behavior                                                                                                                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CHANGE_STAT`           | Change Fortitude, Alcohol, or Gold on SELF, CHOSEN_PLAYER, EACH_OTHER_PLAYER, or ALL_PLAYERS. Clamp to configured bounds and safe integers; Gold cannot become negative. Events contain actual delta/value. |
| `TRANSFER_GOLD`         | Pay from actor to targets in seat order, capped by available Gold and recipient bounds. No transfer to self or Gold creation.                                                                               |
| `PAY_INN`               | Remove Gold up to the player's available amount, respecting the effective nonnegative lower bound.                                                                                                          |
| `DRAW_CARDS`            | Draw through the shared injectable RNG/deck helper, capped at configured hand size. Reshuffle discard on exhaustion, excluding held sources; report shortages.                                              |
| `DISCARD_CARDS`         | Open one owner's private choice of exactly `min(count, hand size)` cards. Empty hands skip the choice.                                                                                                      |
| `IGNORE`, `NEGATE`      | Apply the immediate-parent semantics above.                                                                                                                                                                 |
| `OPEN_CHOICE`           | Ask one owner to select another living target for subsequent CHOSEN_PLAYER operations.                                                                                                                      |
| `OPEN_OPTION`           | Record a validated option selection on the frame and in the event log. Option-dependent mechanics can extend the dispatcher/handlers later; this operation applies no implicit stat change.                 |
| `START_GAMBLING`        | Start a configured round, charge accepted antes, and suspend the initiating source until settlement. Only an active player's root ACTION source may start.                                                  |
| `TAKE_GAMBLING_CONTROL` | Transfer control through an accepted control source; reset pass consensus and apply allowedNextCategories restrictions.                                                                                     |
| `WIN_GAMBLING`          | Request immediate settlement as the control source's final operation, after responses/choices finish.                                                                                                       |
| `LEAVE_GAMBLING`        | Remove SELF from control participation, preserving the ante and response eligibility.                                                                                                                       |
| `MODIFY_PENDING_EFFECT` | Adjust the immediate parent's pending stat operation.                                                                                                                                                       |
| `MODIFY_DRINK`          | Adjust the immediate compound Drink's pending Alcohol/Fortitude; Events require explicit metadata and stat hooks.                                                                                           |
| `CUSTOM`                | Select a trusted handler via `effect_key` with independently validated parameters. The closed server registry implements `sample.adjust-resource`, saturating resource values at safe integer boundaries.   |

Each choice operation has at most one owner; use separate operations for multiple owners. Choices suspend their frame with a new window ID and no response priority. `CHOOSE_TARGET`, `CHOOSE_OPTION`, or `CHOOSE_CARDS` must come from the designated owner, match the choice kind, and contain only offered selections with the exact permitted count. Choices cannot be interrupted. After selection, execution resumes at the next operation and may open another choice. Remaining effect context is revalidated when targets change. Only the chooser receives option/card identities; public state exposes only the chooser's ID.

A CHOSEN_PLAYER operation before a target choice requires an upfront other-player target. If a target choice occurs first, no upfront target is accepted. Target choices happen after responses close and do not implicitly create a second reaction window. Specialized timing can extend this rule later.

The handler registry is TypeScript code on the server. D1 stores validated JSON only. Resources retain their visibility; internal resource/choice events must pass through projections before any future transport delivery.

## Events, serialization, and limits

Opening/closing windows, priority changes, passes, submissions, source start/completion, Ignore/Negate, choices, effect modifications, and stat/resource/card changes emit ordered domain events with accepted command causation. Rejected commands preserve the original state, stack, windows, RNG, receipts, and empty event list. Exact retries never submit another response.

Frames, saved parent windows, choices, RNG, and receipts consist entirely of JSON data. After a JSON/D1 snapshot load, the active window is reattached to its top frame before mutation. Invariants validate the stack chain, cursor/stage, full living-player eligibility, valid priority/pass membership, private choice references, and agreement between top-frame and active windows. JSON round trips mid-response and mid-choice resume with identical outcomes/events. The Workers integration suite persists a three-level stack through actual D1 and verifies deterministic continuation and event ordering.

The stack is bounded at 32 frames, with at most 256 submitted responses per window. No timers, default passes, network delivery, sockets, or live reconnect endpoints are introduced. Future room adapters must authenticate actors, persist accepted state/events atomically, project only public/owner views, and handle their own timeouts/transport limits.

## Visual verification

Run `npm run demo:engine`, then open `.tools/engine-demo/trace.html`. The **Three-level response chain** table shows depth 1 → 2 → 3, priority moving to Sample player 4 for the Negate, and Fortitude remaining 20 until the source resolves. After the fourth leaf pass, depth returns to 1 because Ignore was canceled. The final row shows depth 0, priority None, Fortitude 18, and ORDER_DRINK. The comparison text confirms Ignore alone leaves Fortitude 20. Expand **Inspect public timing view** to see priority and revealed source references without hidden hands or pending operation parameters.

The existing twelve-turn report and blocked-action check remain below. `npm run test:e2e` regenerates the report and verifies the displayed priority, unwind order, stats, phases, and projection privacy in Chromium. The normal app provides a live multiplayer table; see [the game UI guide](game-ui.md). Nested resolution, serialized history and replay are included in [the final release gate](mvp-status.md).

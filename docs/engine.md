# Core turn engine through step 12

The deterministic domain library is in `src/engine/`. It imports no React, Node, or Cloudflare runtime APIs. The Worker/room adapter supplies pinned content and authenticated player identity to this library. The sample loop connects to hibernatable WebSockets and the React table through validated projections. See [the gambling guide](gambling-engine.md) for suspended rounds and [the Drink/elimination guide](drinks-elimination.md) for compound sources, safe checks, redistribution, and victory.

## Preparing and starting a match

`createMatch(input)` validates a server-owned version-one content pack, room/match/host identities, two to four unique players/seats, a uint32 seed, optional rules, and an optional starting state version. It returns a `SETUP` state. Seats are sorted numerically; sparse seat sets are allowed. Each selected character must have exactly one character deck. There must be exactly one shared Inn deck, enough copies for the configured initial hands/Drinks, and no more than 256 copies per core deck.

Definitions remain separate from physical instances. `deckCards.quantity` creates distinct instance IDs, even for repeated/shared definitions. Instantiation order uses ASCII ID ordering instead of locale-dependent collation. IDs use a stable match namespace plus an ordinal; correlation IDs provide no authorization or secrecy. The state pins `contentVersionId` and contains the definitions, rules, RNG state, original instance count, and command receipts. All of these fields are internal.

The default rules are Fortitude 20, Alcohol 0, Gold 10, hand size 7, and one initial face-down Drink per player. Fortitude/Alcohol bounds default to 0–100; Gold always must be nonnegative. Each stat can have explicit bounds, or `null` to omit a bound. Setup rejects invalid bounds and initial values outside them. Character resources initialize from content metadata. Character-specific side-deck instantiation/mechanics remain later work; existing side-deck state is included in conservation checks.

Only the host can send `START_MATCH` during `SETUP`. This shuffles character decks and the Inn through the injected RNG, draws initial hands, deals initial Drinks in seat order, and starts `DISCARD_DRAW` for the lowest seat. Configured stats are initialized with events. The entire accepted command advances the state version once, regardless of event count.

## Command boundary

```ts
const result = applyCommand(state, untrustedPayload, {
  actorId: authenticatedPlayerId,
  // Optional trusted deterministic RNG service; defaults to MULBERRY32_V1.
});
```

The boundary asserts state invariants, strictly parses the payload, validates room/player identity, checks command receipts, and rejects stale expected versions. The actor comes from server context; payloads cannot provide actor identity, stats, hands, future deck order, RNG, or phase state. Normal rejections return `{ status: 'REJECTED', code, state, events: [] }` with the original state object unchanged.

Accepted work runs on a detached transaction draft. On success it returns `{ status: 'ACCEPTED', state, events, acceptedVersion }`. The input and every nested input collection remain untouched. Corrupt server state or a broken RNG provider throws instead of committing partial work. Overflow is rejected rather than rounding/wrapping version or turn counters.

Receipts bind a command ID to its actor, canonical parsed payload, and accepted version. An exact retry returns `DUPLICATE` and its original accepted version, even after later commands; it returns the current state and no new events. Reusing the ID with another actor or payload is rejected. Rejected IDs are not consumed. Receipts remain for the match lifetime and serialize with state. The room carries lobby versions into match setup and persists receipts/history for dedupe, replay and reconnect.

## Turn sequence

| Phase               | Accepted intent and resulting behavior                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `DISCARD_DRAW`      | `DISCARD { cardIds }`: choose zero or more owned hand cards, then draw to configured hand size and enter `ACTION`              |
| `ACTION`            | `SKIP_ACTION`: enter `ORDER_DRINK`; `PLAY_CARD`: validate an owned Action or Gambling source and its optional target           |
| `ORDER_DRINK`       | `ORDER_DRINK { targetPlayerId }`: deal the server-selected top Inn card face-down to another living player, then enter `DRINK` |
| `DRINK`             | `TAKE_DRINK` (or legacy `ADVANCE_PHASE`): reveal/queue the compound Drink; after responses/effects, enter `ELIMINATION_CHECK`  |
| `ELIMINATION_CHECK` | `ADVANCE_PHASE`: enter `NEXT_TURN`                                                                                             |
| `NEXT_TURN`         | `ADVANCE_PHASE`: increment turn number and select the next non-eliminated seat, wrapping around, then enter `DISCARD_DRAW`     |

All turn intents require the living active actor, correct lifecycle, correct phase, command ID, and expected state version. A `CHOSEN_PLAYER` operation before a target choice requires one other living target; other Actions reject a supplied target. Every Action leaves the hand and opens a revealed source frame and response window. After responses and effects resolve, its card enters discard and the turn advances to ordering. Turn commands cannot skip pending frames, windows, choices, or gambling. See [the timing engine](timing-engine.md) for priority, nested responses, Ignore/Negate, the effect DSL, choices, serialization, and continuations.

Drinks now consume actual physical cards, execute effects through the response stack, and check elimination at the completed source boundary. Ordering places a face-down card on top of the target pile. An empty Inn emits `DRINK_ORDER_SKIPPED` and enters DRINK; an empty personal pile follows the configured SOBER/SKIP fallback. `ADVANCE_PHASE` cannot skip pending resolution or draw/action/order validation. The elimination phase advances only after safe checks have run; an eliminated active player hands off immediately, and a winner/tie finishes the match.

## RNG, piles, and events

`rng.ts` specifies the portable `MULBERRY32_V1` stream: seed/state are uint32, and each draw increments a safe integer counter. Fisher–Yates shuffling consumes one draw per swap. The same initial seed, content/config/roster, RNG implementation, and commands produce the same state and events. There is no ambient randomness, clock, network, or platform state. Snapshotted RNG state resumes the same stream. Injected sources must preserve the seed and advance the draw counter exactly once, with output in `[0, 1)`.

`drawFromPiles` draws top-first, exhausting existing deck cards before reshuffling only discard. Drawn/held cards cannot enter that reshuffle. It returns ordered draw/reshuffle segments so emitted events preserve operation order. If there are fewer available cards than requested, drawing stops and emits `DRAW_SHORTFALL`; no copies are created. Both character and Inn helpers update instance locations with every transfer.

Events share the accepted command's resulting version and command ID, with contiguous zero-based indexes and deterministic event IDs. Setup/config/stats, initial shuffles/deals, draws/discards, exhaustion reshuffles, ordered/skipped Drinks, phase changes, turn changes, and action handoffs all have explicit events. Internal shuffle/draw/Drink events contain hidden identities; they are never client messages. Future replay/reducer/persistence integration must preserve this distinction.

`assertCoreInvariants` checks unique player identities/seats, one living active player while playing, numeric stats/bounds, nonnegative Gold, hand size, valid definition/instance references, matching ownership/location, one zone per instance, conserved registry count, and valid receipt causation. It runs before and after commands. Public/private projections remain the only supported client serialization boundary.

## Visual verification

From the repository root:

```sh
npm run demo:engine
```

Open `.tools/engine-demo/trace.html` in a browser. This generated development report shows twelve turns; it is separate from the app and contains safe public projections. It needs no server or Cloudflare login. The report uses hand size **3** to make exhaustion easy to observe; the default engine configuration still uses **7**.

Check these visible results:

1. The green line says replay passed and card conservation is `34 / 34`.
2. Version 1 has `DISCARD_DRAW`, Sample player 1, hand counts `3 / 3 / 3 / 3`, Drink piles `1 / 1 / 1 / 1`, and two Inn cards.
3. The next six rows show `ACTION → ORDER_DRINK → DRINK → ELIMINATION_CHECK → NEXT_TURN → DISCARD_DRAW`, ending with Sample player 2. Versions include the additional response commands needed to resolve Drinks.
4. Ordering reduces the Inn count and increases only the target's hidden pile. Resolving a Drink reveals/consumes that player's top chain, emits DRINK_REVEALED/DRINK_DISCARDED, and lets Inn exhaustion reshuffle actual discard.
5. Later rows redraw from shuffled character discard and include `DECK_SHUFFLED`. Hand size remains three and conservation remains 34.
6. Expand **Inspect public view**. It contains counts/public stats, with no hand identities, hidden Drink identities, future deck order, RNG, or command receipts.
7. At **Action response window**, Sample Friendly Shove keeps phase ACTION and target Fortitude 20 while players have priority. Skipping is rejected with RESOLUTION_PENDING. The **Three-level response chain** above shows Ignore being negated, leaf-first unwind, and the final Fortitude 18 / ORDER_DRINK outcome. With Ignore alone the target stays at 20.

The report also contains the new compound Drink/elimination scenario and a complete sample match; see [their visual checklist](drinks-elimination.md#visual-verification). Rebuild it after engine changes. `npm run test:e2e` regenerates it and verifies displayed results in Chromium alongside the shell. `npm run dev` continues to open the health screen; the game UI is scheduled for step 08.

## Automated verification

Run all standard commands and `npm run test:coverage`. Tests cover golden RNG output, deterministic setup/replay, config, command rejection/dedupe, phase/seat order, exhaustion, card conservation across many seeds/turns, corrupt-state failures, and projection privacy. A Workers-runtime integration test executes the pure engine and round-trips its events through actual D1. Executable engine files have per-file 90% coverage gates; type-only declarations and the development report are outside engine coverage.

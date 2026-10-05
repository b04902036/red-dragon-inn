# Drinks and elimination through step 06

`drinks.ts` creates a compound source on the existing response stack; `stats.ts` applies bounded changes; `elimination.ts` evaluates final stats at safe command boundaries. All three are pure TypeScript with no React or Cloudflare dependencies. Commands never supply stats, pile order, drawn identities, modifiers, or payouts.

## Ordering and taking a Drink

`ORDER_DRINK { targetPlayerId }` places the server-selected top Inn card face-down on **top** of another living player's Drink Me pile. Public and owner views show only pile counts. `TAKE_DRINK` during DRINK reveals the active player's own top card and queues its effects. For compatibility, `ADVANCE_PHASE` in DRINK performs the same resolution; it cannot skip responses or effects. Neither intent accepts a card identity or authoritative result.

Every Drink opens a response window before effects apply, including an empty-pile fallback. The frame holds all revealed physical cards in RESOLUTION until it completes. It then discards them exactly once to the Inn discard and continues to ELIMINATION_CHECK. Held sources never enter an Inn reshuffle. Only explicitly revealed sources appear in public `sourceCards`; hands, remaining Drink piles, and future deck order remain hidden. Internal reveal/shuffle events must never be broadcast directly.

The ordering and empty-pile defaults follow the [published core rules](https://slugfestgames.com/wp-content/uploads/2024/11/RetailRulesAIN.pdf). The repository contains original sample definitions only.

## Rules and compound effects

The server validates these defaults in `rulesConfigSchema`:

```json
{
  "drinks": {
    "emptyPile": "SOBER",
    "soberAmount": 1,
    "chaserSource": "SAME_SOURCE",
    "chaserEvent": "DISCARD_STOP",
    "maxChainCards": 32
  },
  "elimination": {
    "passOutGold": "SPLIT_WITH_INN",
    "innShareRounding": "UP"
  }
}
```

SOBER subtracts the configured 1–1000 Alcohol, respecting bounds; SKIP applies zero base changes. Neither creates a physical card. An empty Chaser source stops the chain without applying another empty-pile fallback.

A Chaser reveals another card from its current source. Optional Drink `chaserSource` overrides the rule with SAME_SOURCE or INN; switching to INN keeps subsequent SAME_SOURCE pulls at the Inn. The complete chain reveals before players respond, following [SlugFest's Chaser clarification](https://slugfestgames.com/rulesfest-dealing-with-chasers/). Base Alcohol and Fortitude values aggregate into two SELF stat operations, followed by additional Drink DSL operations in reveal order. Ignore suppresses the whole source for its player; Negate cancels the immediate source. A Negated Ignore restores the Drink normally.

Chaser work is capped at the validated `maxChainCards` (1–32). Reaching it emits DRINK_CHAIN_STOPPED/LIMIT and preserves the next unrevealed card. A frame has at most 32 effect operations; oversized compound effects reject atomically. Inn exhaustion reshuffles only actual discard through the injectable deterministic RNG.

## Drink Events and modifiers

A top-level Drink Event has kind DRINK_EVENT and executes its validated definition effects through the normal stack, including private target/option/card choices. It has no implicit Alcohol/Fortitude operations. A definition requiring CHOSEN_PLAYER must open a target choice; TAKE_DRINK does not accept a target.

A Drink Event encountered as a Chaser emits DRINK_EVENT_DISCARDED with explicit CHASER context and never executes its instructions. DISCARD_STOP ends the chain, the default core behavior; DISCARD_CONTINUE is an explicit configurable variant that reveals another card. The encountered event stays held with the compound source until disposal, keeping it out of reshuffles.

`MODIFY_DRINK { alcoholDelta, fortitudeDelta }` changes the compound source's pending SELF Alcohol/Fortitude operations. `MODIFY_PENDING_EFFECT` addresses an individual pending stat operation. Both reject Drink Event parents unless their server-defined metadata explicitly sets `allowDrinkEvents: true`. A permitted MODIFY_DRINK still requires both stat hooks on the Event. Invalid context, missing hooks, or unsafe integer arithmetic rejects before consuming the response card. These are generic hooks, not a copyrighted card catalog.

## Elimination and Gold

Step 21B adds independently interruptible forced, passed, split, simultaneous and copied Drinks, delayed extra reveals, immutable contest scores/tie continuations, and generic trait replacements. See [the capability and persistence inventory](rdi1-engine-capabilities.md). Elimination still waits for the safe boundary described below.

Alcohol >= Fortitude means passed out; Gold zero means broke. Stat operations mark a pending check, but that marker is not a verdict. The engine checks final stats only when no stack, response/choice, or gambling round remains. A nested temporary pass-out can be healed by the parent source; a player who spends their last Gold on an ante can survive by winning the pot. No player is removed midway through a source's effects or gambling settlement.

At a safe boundary, victims and survivors are frozen simultaneously in seat order. No victim receives another victim's payout. Passed-out victims take precedence when both conditions hold. SPLIT_WITH_INN/UP sends half the spendable Gold, rounded up, to the Inn; the other half splits evenly among survivors. Remainders and amounts exceeding recipient Gold bounds also go to the Inn. With Gold 10 and three survivors, the Inn receives 7 and each survivor receives 1. With Gold 7, the Inn receives 4 and each survivor receives 1. The core split follows the [combined rules](https://slugfestgames.com/wp-content/uploads/2019/02/Red_Dragon_Inn_Combined_Rules_as_of_RDI_7_v_1.1.pdf).

DOWN rounds the Inn's initial half down; ALL_TO_INN pays no survivors. An explicit positive Gold floor is retained by a victim; only Gold above that floor is redistributed. GOLD_REDISTRIBUTED records the exact debit, Inn share, and actual recipient credits, including zero amounts. Gold cannot become negative; Fortitude/Alcohol honor configured bounds, or safe integer limits when bounds are null. New matches default to Fortitude/Alcohol 0–20, while existing rooms and replays keep their saved bounds. A capped stat effect emits its actual delta and does not cancel other operations, such as charging Gold for healing.

An eliminated active seat immediately hands off clockwise to a living player at DISCARD_DRAW. Later turns skip eliminated seats. One survivor finishes the match with that winner; zero survivors finishes with an empty winner list (tie). FINISHED clears phase/active player and permits no new gameplay commands. Exact accepted-command retries retain their normal duplicate semantics.

## Verification and persistence

`tests/engine/drinks.test.ts`, `elimination.test.ts`, and `drink-state.test.ts` exercise all 23 prompt requirements, rejection atomicity, bounds/configuration, conservation, nested timing, and corrupted snapshots. `full-match.test.ts` uses `scripts/sample-game.ts` to play original sample content from SETUP to one winner for three seeds, then replays every command with identical events/state. The runner uses server-configured initial Fortitude 4 to shorten the game, without editing authoritative state during play.

The Workers-runtime Drink test saves a pending compound source and its event batch into actual D1, restores the JSON snapshot, finishes elimination identically, and verifies appended history. No schema migration or published sample/seed change is needed. Live rooms, WebSockets, reconnect endpoints, and gameplay controls remain later steps. The original sample Toast has an empty instruction batch; executable Event examples belong to marked test fixtures.

## Visual verification

Run `npm run demo:engine`, then open `.tools/engine-demo/trace.html`. In PowerShell, use `Start-Process .tools/engine-demo/trace.html`.

1. **Drink chain and elimination** has green replay/snapshot and physical-card checks (34 cards).
2. Tea → Tea → Fizz appears as one compound source. During reveal and the first three passes, Alcohol/Fortitude remain 18/20 and player 1 remains Playing.
3. The final pass shows 22/22, Eliminated, Gold `0 / 11 / 11 / 11`, DISCARD_DRAW, and Sample player 2 active.
4. Expand **Inspect public Drink view** on a pending row: three revealed source references are visible; hidden hand identities, Drink contents, deck order, and RNG are absent.
5. **Complete sample match** starts PLAYING, includes a settled gambling round and resolved Drinks, then ends FINISHED with one survivor. Its green named winner matches the one non-eliminated player in the final public view.

`npm run test:e2e` regenerates the report and verifies these outcomes in Chromium. The regular app at the Vite URL still displays backend health; this step adds no gameplay UI.

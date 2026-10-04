# Gambling engine through step 05

This page preserves the original step-05 model. For the current pending-ante stage, system checkpoints, pre-payout winner replacement, pot operations and Anytime support, see [Step 21B generic capabilities](rdi1-engine-capabilities.md).

`src/engine/gambling.ts` suspends the normal turn while a round is active. `null` means inactive; `ROUND` and `SETTLING` are internal stages. State records initiator, participants/exclusions, controller/source, priority, accepted contributions/pot, current passes, departures, and the initiating resolution/turn continuation. It is JSON data, independent of React, Workers, and connections.

## Starting and antes

An active player's Gambling card starts a round through `PLAY_CARD` during ACTION. An Action can instead contain `START_GAMBLING`. Both open the ordinary response window first; Negate can cancel the source before any ante. Starting from a reaction, another round, or another phase is rejected. A Gambling category implicitly supplies START at initiation and TAKE_CONTROL during a round; its definition should not duplicate those operations.

Rules are explicit server configuration:

```json
{
  "anteAmount": 1,
  "insufficientGold": "EXCLUDE",
  "initiatorControls": true,
  "allowLeave": true
}
```

These are defaults in `rules.gambling`. EXCLUDE omits living players who cannot afford the full ante above the configured nonnegative Gold floor. PAY_AVAILABLE accepts their positive available amount instead. Zero available Gold always excludes a player. An excluded initiator cannot start. This configurable policy is sample-engine behavior, not an implementation of every published ante modifier.

The engine plans all contributions before changing Gold, then charges them in seat order and creates the pot. The initiator controls by default; disabling that option assigns the next clockwise participant, wrapping if necessary. Priority begins clockwise after the controller, skipping excluded/departed players. A sole participant gets their ante returned immediately. Responses can change Gold after source acceptance; eligibility and payout capacity are checked again before charging anyone. A now-invalid start emits GAMBLING_START_CANCELED and resumes the source without an ante.

## Control, passes, and leaving

Only gambling priority may submit GAMBLING_PLAY, GAMBLING_PASS, or GAMBLING_LEAVE, with command ID and expected version. A play must reference an owned Gambling/Cheating card. Its server-defined effects first take control, then execute the definition's remaining operations. A response window precedes execution, allowing ordinary Sometimes/Anytime/Ignore/Negate interactions under the existing timing rules. Until it closes, the previous controller and pot remain unchanged. A negated control source consumes/discards its card and advances priority without transferring control.

Passing records consensus for the current controller; it does not remove participation. A successful control change clears previous passes, so a player who passed can play when priority returns. When every other remaining participant has passed, the controller wins. This distinction follows [SlugFest's gambling clarification](https://slugfestgames.com/rulesfest-gambling-101/).

Leaving records a permanent departure for that round and preserves the contribution already in the pot. Departed players cannot play control cards. They remain living players and can still respond in other players' source windows. LEAVE_GAMBLING with SELF provides the validated effect hook, including reactions by the controller; a departing controller hands control clockwise and resets pass consensus. A departing actor's pending control source is canceled. If nested responses leave the last participant as the owner of a previously accepted leave effect, that effect emits GAMBLING_LEAVE_SKIPPED rather than removing the final possible winner.

Both command priority and reaction priority are explicit and distinct. Gambling commands suspend during responses and private choices. Choice operations after control changes serialize safely and cannot cause an early payout.

## Generic restrictions and immediate wins

Gambling/Cheating definitions may include:

```json
{
  "gambling": {
    "allowedNextCategories": ["CHEATING"],
    "immediateWin": false
  }
}
```

Without metadata both categories are allowed and immediateWin is false. A category restriction controls the next successful control play without checking a card name. TAKE_GAMBLING_CONTROL with allowedNextCategories provides the equivalent DSL hook; WIN_GAMBLING ends the round through the current control source after responses/choices resolve. A definition's immediateWin appends that hook. WIN_GAMBLING must be the source's final operation. The engine rejects invalid context before moving the card. These generic hooks are fixture mechanics; no copyrighted card catalog is bundled.

## Gold, settlement, and resumption

`gold.ts` centralizes all post-setup Gold changes, transfers, payments, antes, and payout. Gold is always a safe integer within effective bounds and cannot become negative. Events report actual changes. Going from positive Gold to zero emits ELIMINATION_CHECK_REQUESTED and marks `control.eliminationCheckPending`. No player is eliminated during ante, reactions, or payout. Step 06 evaluates final stats after gambling and its initiating source finish; the pending marker is not a verdict. The pot can save a player who spent their last Gold on the ante. See [elimination](drinks-elimination.md#elimination-and-gold).

Before starting, every possible winner must have capacity for the whole pot after their ante. While participating, even after passing, a player's maximum Gold reserves room for that pot. Gold effects/transfers honor this ceiling. The pot is cleared before crediting the winner, releasing the reserve and paying the full amount exactly once. Configurations that cannot accommodate payout reject the start with GOLD_CAPACITY rather than losing Gold through clamping.

The initiating source stays on the resolution stack, with its operation cursor immediately after START_GAMBLING. Normal phase and active player remain unchanged. Control sources are child frames; after the round settles, remaining initiating operations execute and its original continuation resumes ORDER_DRINK. Exact command retries emit no new antes/payout; stale versions reject without mutation.

## Persistence, privacy, and verification

Public state shows pot, initiator/controller/source, both priorities, contributions, participation, passes/departures, and category restrictions. It omits the internal continuation, hands, deck order, face-down Drinks, RNG, and operation parameters. The owner's private hand stays separate. Domain events remain internal and must not be broadcast directly.

Unit tests cover all 18 required behaviors, corruption rejection, Gold conservation, pending choices, complete deterministic replay across seeds, and snapshot resumption. A Workers-runtime test saves a mid-round control window and escrow into real D1, restores it, completes the round with identical events, and verifies one payout in the append log. Live sockets and reconnect endpoints remain later work.

Run `npm run demo:engine` and open `.tools/engine-demo/trace.html`. In **Gambling round**:

1. The green check reports deterministic replay/snapshot resume and Gold + pot = 40 after every accepted command.
2. Four antes produce pot 4 and Gold `9 / 9 / 9 / 9`, with player 1 controlling and player 2 holding gambling priority.
3. Player 2's Gambling leaves control unchanged while responses are pending, then transfers it to player 2. Player 3's Cheating does the same and transfers it to player 3.
4. Players 4, 1, and 2 pass clockwise. The last row shows pot 0, Gold `9 / 9 / 13 / 9`, no controller/priority, and ORDER_DRINK for the original active player.
5. Expand **Inspect public gambling view** to see antes/membership without hidden state or the internal suspended continuation.

`npm run test:e2e` regenerates this report and checks those displayed results in Chromium. The normal app remains the health shell; no live gameplay UI is introduced in this step.

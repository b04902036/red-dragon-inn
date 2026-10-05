# RDI2 source evidence

## Authority order

1. Current SlugFest official rules / official errata / official later rules.
2. User-provided card data (`HaxxonHax/the-inn`) for Dimli, Eve and Fleck, cross-checked against current official rules.
3. Complete community quantity/mechanic matrix.
4. BGG catalog data only as a catalog/quantity cross-check, never as sole rules authority.

If sources disagree, **do not guess**. Step 24A must resolve the conflict with primary/current evidence or stop.

## Official RDI2 Ninth Edition

https://slugfestgames.com/wp-content/uploads/2021/11/RDI2-9thEd-Web.pdf

Verified directly:

- 4 character decks, exactly 40 cards each: Dimli, Eve, Fleck, Gog
- 30-card Drink deck
- Sometimes/Anytime timing
- response opportunity starts with the player who played/revealed the source
- after a response resolves, the original source receives a new response cycle
- forced gambling leave offers response before leaving completes
- direct-stat definition for Fortitude/Alcohol/Gold response cards
- redirected Fortitude keeps its original source
- each redirect applies once, in play order
- Negate vs Ignore
- Drink-changing counter restrictions
- split Drinks are independent
- Mead current split behavior
- Round on the House
- Drinking Contest
- Bar Deck

## Official Eve updates

https://slugfestgames.com/the-new-eve/

Mandatory overrides over older material:

- Eve's relevant defensive illusion is the broad Fortitude/Alcohol/Gold version.
- Eve's direct Alcohol attack is +2 Alcohol.
- Eve's fire attack is 3 Fortitude loss.

## Official errata / Illusionary Coin

https://slugfestgames.com/clarifications-and-errata/

Illusionary Coin prevents the current required Gold loss. For ante semantics, the ante still counts as having been made even though no Gold transfers.

## Dimli restart gambling

https://slugfestgames.com/wp-content/uploads/2021/11/GIIRulesForWeb.pdf

Dimli's special post-win response keeps the existing round/pot, has eligible remaining players ante, and repeats the gambling game.

## The Challenge — later official examples

https://slugfestgames.com/wp-content/uploads/2021/11/RDI8RulesWeb.pdf
https://slugfestgames.com/wp-content/uploads/2026/02/RDI10RulesWeb.pdf

Later official examples explicitly show the revealing player deciding to accept The Challenge, revealing two Drinks (with Chasers), taking both, and getting Gold from each other player when successful.

## Uploaded The Inn

Used only for Dimli/Eve/Fleck. Hashes and per-mechanic counts are in `the-inn-crosscheck.json`.
Gog is not present in the uploaded source.

### Step 24A audit stop: M05

M01–M04 were individually checked on 2026-10-05 against the directly inspected RDI2 quantity table, supplied per-row crosscheck, and official Ninth Edition rules. Their private ledger entries record each check and its evidence.

For M05 `cheat_control_and_eject`, the supplied crosscheck contains counts, types, and source hashes, but no original Eve/Fleck card text. The official [Gambling 102 explanation](https://slugfestgames.com/rulesfest-gambling-102/) describes the generic control/eject family and explicitly mentions variants; it does not establish each Eve/Fleck card's exact target and complete effect. The Ninth Edition confirms the forced-leave response opportunity but also does not supply those two card texts.

Verification stops at M05 until the original user-provided Eve/Fleck JSON or readable card images are available. M06 onward and the remaining Drink checks have not been marked verified. No normalized source or source lock has been created.

## Complete quantity/effect matrix

https://forums.giantitp.com/archive/index.php/t-211309.html

This transcription gives all RDI2 mechanic rows and counts. It is useful for completeness but must never override newer official rules/errata.

## RDI2 Drink list cross-check

https://boardgamegeek.com/boardgame/33451/the-red-dragon-inn-2

The list totals 30 cards, but see the Fine Ambrosia conflict below.

## Fine Ambrosia hard conflict

The detailed legacy mechanical table places Fine Ambrosia before the `Drink Events` heading and assigns numeric Drink-like effects:

- +1 Alcohol
- +4 Fortitude
- pay 2 Gold

BGG's catalog labels the same card as `(Drink Event)`.

The original package did **not** choose between those classifications.

The user subsequently resolved the intended game behavior on 2026-10-05: Drink Event, +1 Alcohol, +4 Fortitude, and payment of 2 Gold to the Inn. The candidate and D09 ledger preserve this as `USER_RULE_OVERRIDE`, along with both original conflicting candidates. It supersedes the original request to wait for a card image for this decision, while leaving all other item-by-item verification requirements in force. It is not a claim that either secondary source was verified as the current official card.

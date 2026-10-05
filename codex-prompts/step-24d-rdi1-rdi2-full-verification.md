# Step 24D — Verify every RDI2 card mechanic and mixed RDI1/RDI2 gameplay

## Goal

Prove the RDI2 content is not merely importable, but actually playable with correct legality, timing, effects, highlighting, audio, reconnect and replay.

## Per-definition coverage matrix

Generate:

```text
docs/rdi2-card-coverage.md
```

One row per unique compiled RDI2 definition:
- character/deck
- physical quantity
- type
- mechanic
- legal timing
- structured trigger
- effect implementation
- en-US
- zh-TW
- positive legality test
- negative legality test
- effect-resolution test

No row may say TODO/UNKNOWN/UNSUPPORTED.

## Every Sometimes card

For EVERY unique Sometimes definition:
- positive `legalPlays` test
- negative `legalPlays` test
- illegal command rejected server-side
- legal card highlighted
- 30-second response opportunity
- Sometimes voice iff at least one legal Sometimes exists
- stale prompt rejected
- card play causes full re-evaluation and fresh timer when appropriate

Do not sample only representative cards.

## Anytime timing matrix

Explicitly test:
- Sometimes only => 30s + voice
- Anytime only => 30s + no voice
- both => 30s + voice
- neither => no response wait
- phase end => independent 15s Anytime grace

## Character-specific mandatory scenarios

### Dimli
- restart gambling before payout
- existing pot remains
- only still-participating players continue
- new ante
- correct controller/order
- cannot use after leaving
- cannot use after incompatible winner replacement
- Drink pass/split/alcohol-to-Fortitude

### Eve
- both broad Ignore copies use current errata
- +2 Alcohol attack
- 3 Fortitude fire attack
- Illusionary Coin normal payment
- Illusionary Coin theft
- Illusionary Coin ante with ante counted
- fixed 4-Alcohol Drink replacement
- later non-Drink modifier still works
- Share Pain odd/even
- Share Pain mitigation lock
- redirect 3+ players
- redirect 2-player fallback
- original source preserved

### Fleck
- four Cheating-control cards
- free extra Drinks
- refill-payment waiver
- all-player Inn-deck toast
- split Drink
- rowdy song ordering of effects
- sad song at Alcohol 0 still performs Gold transfer
- take 2 Gold

### Gog
- complete 40-card count
- anti-cheat win
- broad direct-stat Ignore
- Fortitude-only Ignores
- 2-damage family
- 3 damage + Inn payment
- 4 damage
- all-opponents damage
- post-loss retaliation
- extra Drink in another player's Drink phase
- Half-Ogre Ogre Brew replacement

## Drink deck — every unique definition

Test every RDI2 Drink/Event:
- all basic numeric Drinks
- all Chasers
- Water
- Cutting Off
- Holy Water
- Wizard's Brew
- Troll/Orc/Ogre trait replacements
- Fine Ambrosia exactly as source-locked
- Mead current built-in split
- Mead Chaser/event-result restriction
- Round on the House
- Drinking Contest
- The Challenge accept/decline

## Mixed RDI1/RDI2 E2E

Use multiple browser contexts.

Required:
1. combined production content
2. all 8 characters visible
3. choose mixed RDI1/RDI2 characters
4. select combined Bar Deck
5. Action highlighting
6. Sometimes 30s + voice
7. Anytime-only 30s + no voice
8. 15s phase-end grace
9. nested response resets prompt
10. Gambling + Cheating cross-set
11. Dimli restart gambling
12. Eve redirect from an RDI1 attacker
13. Fortitude retaliation targets original source
14. RDI2 Drink modifier
15. Mead
16. Drinking Contest
17. The Challenge
18. reconnect during response
19. one client en-US, one zh-TW
20. elimination/winner
21. persistent result
22. deterministic replay equality

Use injected short deadlines only in tests.

## Verification

Run all normal checks plus:

```bash
npm run content:verify:rdi2-source
npm run content:verify:rdi2
npm run content:verify:rdi1-rdi2
npm run content:verify:zh-TW
```

Stop before Step 25.

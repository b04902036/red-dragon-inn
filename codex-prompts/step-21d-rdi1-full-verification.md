# Step 21D — Per-card legality, timer, highlight and gameplay verification for all RDI1 content

## Goal
Prove that all 160 character-card copies and the complete 30-card Drink deck are formally playable with the Step-18/19/20 systems.

## Mechanical coverage matrix
Generate:
```text
docs/rdi1-card-coverage.md
```

One row per unique compiled card definition:
- character/deck
- quantity
- type
- mechanic id
- legal timing
- response trigger
- effect handler/DSL
- en-US
- zh-TW
- positive legality test
- negative legality test
- effect-resolution test

No row may say TODO/unsupported.

## Sometimes legality
For EVERY Sometimes definition:
- positive `legalPlays` test
- negative `legalPlays` test
- server rejects the card in the negative context
- if legal and local priority holder, card is highlighted
- 30-second prompt exists
- English response MP3 plays once for new prompt
- response/pass/timeout resets correctly
- playing a response re-evaluates and resets prompt as required

Do not test only one representative Sometimes card.

## Anytime
For EVERY Anytime mechanic:
- legal in ordinary legal checkpoints
- legal during response handling when applicable
- legal during gambling
- legal during 15-second phase-end grace
- highlighted whenever `legalPlays` contains it
- stale prompt/version rejected

## Gambling
Run scenarios with all RDI1 gambling mechanic families:
- start/control
- raise
- Strong Hand restriction
- cheating control
- cheating + forced leave
- anti-cheat immediate win
- pot to Inn
- post-win winner replacement
- payment/ante substitution
- pot theft
- voluntary ante avoidance + leave
- multi-use leave/Drink cards

## Drinks
Cover every unique RDI1 Drink definition and Event:
- all numeric Drinks
- Chasers
- Water/no effect
- sober-down Drink
- Wizard tonic
- Orc/Troll replacement branch using synthetic trait fixtures
- Drinking Contest
- tie loop
- ignored/passed/split Drink still uses correct contest score
- Round for the House independent copies

## Four-character E2E
Use four browser contexts:
- Deirdre
- Fiona
- Gerki
- Zot

Required:
1. production content, no fixture mode
2. each receives the correct 40-card deck
3. hidden hands remain private
4. playable highlights use server legalPlays
5. real RDI1 Sometimes prompt
6. response voice and 30s timer
7. nested response with protected counter family
8. Anytime phase-end 15s
9. gambling including cheating
10. Drink modifier + counter
11. Drink pass/split
12. forced extra Drink
13. post-damage retaliation
14. reconnect during a timed response
15. one browser zh-TW, one en-US
16. game can proceed to elimination/winner
17. deterministic replay reaches identical final state

Use shortened injected test deadlines, not production constants.

Run every standard command plus:
```bash
npm run content:verify:rdi1
```

Stop before Step 22.

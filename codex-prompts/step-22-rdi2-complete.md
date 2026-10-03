# Step 22 — Complete The Red Dragon Inn 2 implementation

## Goal

Add the complete playable content of The Red Dragon Inn 2:

Characters:
- Gog the Half-Ogre
- Fleck the Bard
- Eve the Illusionist
- Dimli the Dwarf

Verified product structure:
- four unique 40-card character decks
- one 30-card Drink deck

After this step the application supports all eight RDI1 + RDI2 characters.

## Private source requirement

Use:

```text
content-private/imports/rdi2/
```

Same rules as Step 21:
- owned/licensed data only
- do not scrape complete proprietary card text
- do not invent effects
- stop with blocker report if required source data is missing

## Production content

Add RDI2 to the published production content version or create a new immutable version, e.g.:

```text
rdi1_rdi2_v1
```

Existing RDI1 rooms pinned to an older version must remain replayable.

## Character decks

Each RDI2 character deck:
- exact physical total 40
- all card types correct
- all Sometimes triggers encoded
- all Anytime behavior encoded
- all Gambling/Cheating mechanics encoded
- zero no-op official cards

Create character-specific handlers only where generic DSL/handlers cannot express the behavior.

## RDI2 Drink deck / additional drink rules

Implement the complete private-source RDI2 30-card Drink deck.

RDI2 rules introduce/clarify mechanics that must be supported where present, including:
- Drink Events
- multi-player/simultaneous Drink handling
- Drinking Contest-style resolution
- Round-on-the-House-style independent copies
- Chaser interactions
- modifiers applied to individual copied Drinks at the correct time
- repeated reveal behavior where a contest ties
- Drink Event behavior in comparison contexts

Implement based on official rules, not card-name hacks.

## Combined RDI1 + RDI2 drink mode

Do NOT simply make a permanent 60-card active Drink deck.

The official Bar Deck Variant is designed for using more than 30 Drink cards:
- combine desired Drink cards into a Bar Deck
- use 30 as the active Drink Deck
- when it runs out and normal refill cost occurs, take the next 30 from the Bar Deck
- when the Bar Deck is exhausted, rebuild appropriately from discarded Drinks

Implement selectable game setup:

```text
RDI1 Drink deck only
RDI2 Drink deck only
RDI1 + RDI2 Bar Deck
```

Default for an RDI1+RDI2 mixed-character lobby may be `RDI1 + RDI2 Bar Deck`, but make it explicit in lobby/setup.

## Localization

Add complete en-US/zh-TW presentation for imported RDI2 content.

Preserve English canonical names:
- Gog the Half-Ogre
- Fleck the Bard
- Eve the Illusionist
- Dimli the Dwarf

If verified zh-TW names are unavailable for a field:
- use English fallback or a status-marked translation
- never mislabel an unverified translation as official

## Completeness

RDI1+RDI2 production target:

```text
characters: 8/8
character physical cards: 320/320
RDI1 Drink physical cards: 30/30
RDI2 Drink physical cards: 30/30
unknown effects: 0
unsupported mechanics: 0
required zh-TW missing: 0
```

## Tests — mandatory

### Per-character suites

Dedicated tests for:
- Gog
- Fleck
- Eve
- Dimli

Every distinct card mechanic needs behavioral coverage.

### Content

1. each RDI2 character totals 40 physical cards
2. RDI2 Drink deck totals 30
3. every Sometimes card has trigger predicates
4. zero unknown effects
5. zero no-op official cards
6. zero sample prefixes
7. all private/legal-play projections correct

### RDI2 drink mechanics

8. simultaneous Drink resolution
9. independent copy semantics
10. players cannot modify the source before copy if rules forbid it
11. copied Drinks may be modified independently afterward
12. contest highest Alcohol comparison
13. tie causes correct repeated reveal behavior
14. ignored Drink still contributes comparison value where rules specify
15. Drink Events count/resolve correctly in comparison context
16. Chasers work inside multi-player Drink flows
17. nested Sometimes responses during these flows reset 30s prompts correctly

### Bar Deck

18. RDI1-only mode creates 30-card deck
19. RDI2-only mode creates 30-card deck
20. combined Bar Deck has 60 physical source cards
21. active Drink Deck starts at 30
22. exhaustion charges/refills correctly
23. second group of 30 is used before recycle
24. discard recycle behavior correct after Bar Deck exhaustion
25. deterministic seeded order/replay

### Cross-set

26. RDI1 character vs RDI2 character response interaction
27. Gerki/Fleck gambling interaction
28. Eve response against RDI1 effects
29. Dimli/Gog Drink/Fortitude interaction
30. mixed-set nested response stack
31. timed response and phase-end windows remain correct
32. highlight derives from server legal plays

## E2E

At least:
- lobby shows all eight characters
- mix RDI1/RDI2 characters in one match
- select combined Bar Deck
- trigger an RDI2 response
- trigger a multi-player Drink mechanic
- timer/voice/highlight behavior
- complete gambling round
- reconnect
- switch one client zh-TW and another en-US

Run all standard checks and production/localization completeness.

Stop after Step 22.

# Step 21 — Complete The Red Dragon Inn 1 implementation

## Goal

Implement the complete playable content of The Red Dragon Inn 1:

Characters:
- Deirdre the Priestess
- Fiona the Volatile
- Gerki the Sneak
- Zot the Wizard and Pooky

Product structure verified publicly:
- four unique 40-card character decks
- one 30-card Drink deck

The product is not complete until every physical card quantity and every gameplay effect is supported.

## Private source requirement

Use only user-owned/licensed complete card data under:

```text
content-private/imports/rdi1/
```

Accepted inputs may be:
- user-prepared CSV/JSON
- user's own scans/photos processed locally
- another explicitly authorized source

Do not scrape a public website for complete proprietary card text.
Do not invent missing effects.

If the required private data is absent:
- implement any remaining generic engine capability discovered from official rules
- emit a precise content-blocker report
- STOP rather than filling fake cards

## Content version

Create a real production content version such as:

```text
rdi1_v1
```

Do not use sample IDs/prefixes.

Canonical IDs should be stable, e.g. product/character/card slugs, not random names.

## Character decks

For each of the four characters:
- exact physical deck count = 40
- duplicate cards represented through quantity, not duplicated definitions
- all Action / Sometimes / Anytime / Gambling / Cheating cards classified correctly
- all targets and trigger predicates represented
- all card effects executable
- all response conditions represented through Step 18 trigger model
- no unsupported/no-op official card allowed

## Drink deck

Implement the complete 30-card RDI 1 Drink deck from the private source:
- ordinary Drinks
- Alcohol
- Fortitude changes
- Chasers
- Drink Events if present
- modifiers/edge behavior required by the supplied cards

Do not reproduce unnecessary raw proprietary text in test snapshots.

## Mechanics audit

For every RDI1 card, classify implementation into:

```text
PURE_DSL
GENERIC_HANDLER
CHARACTER_HANDLER
TIMING_RULE
GAMBLING_RULE
DRINK_RULE
```

Prefer generic reusable mechanics.

Do not create one handler per card unless genuinely unavoidable.

## Gambling

RDI1 relies heavily on Gambling/Cheating interactions.

Verify all RDI1 gambling cards against:
- round start
- ante
- control
- Gambling vs Cheating categories
- Winning-Hand-like restriction
- force-leave where applicable
- pot effects
- Sometimes/Anytime during gambling
- round end timing

## Localization

Every production-visible RDI1 record must have:
- canonical English identity
- zh-TW display translation
- translation source/status

Use existing glossary:
- 耐力值
- 酒精值
- 金幣
- 賭博
- 作弊
- 續杯
- 酒卡事件

Do not claim an unofficial character/card-name translation is official unless source metadata says so.

## Production completeness command

Extend:

```bash
npm run content:verify:production
```

For RDI1 subset report:

```text
RDI1 characters: 4/4
character physical cards: 160/160
drink physical cards: 30/30
unknown effects: 0
unsupported mechanics: 0
missing zh-TW required translations: 0
```

Unique definition count may be lower than physical card count because duplicates use quantity.

## Tests — mandatory

### Per character

Create a dedicated test suite for:
- Deirdre
- Fiona
- Gerki
- Zot

Every distinct mechanical card behavior must have at least one behavioral test.

Repeated copies do not require duplicate identical tests.

### Required categories

1. every card definition parses
2. every deck physical quantity totals 40
3. RDI1 Drink deck physical quantity totals 30
4. every Sometimes card has a nonempty validated trigger
5. every official card has executable effect/handler
6. zero unknown `effect_key`
7. zero unsupported `special_rule_key`
8. all targets validate correctly
9. all relevant response cards appear in server legal plays
10. illegal timing rejects the same cards
11. all Gambling/Cheating interactions behave correctly
12. Drink/Chaser/Event behaviors required by the pack work
13. deterministic replay works with every character
14. en-US presentation loads all characters/cards
15. zh-TW presentation loads all required translations
16. no sample prefix appears in RDI1 production records
17. private card text/content is not included in logs/public hidden state

### Scenario tests

Create scenario fixtures covering:
- Deirdre defensive response
- Fiona direct attack flow
- Gerki gambling/cheating flow
- Zot mixed reaction/gambling flow
- nested Sometimes from two RDI1 characters
- Anytime at phase end
- Sometimes timeout
- Anytime timeout
- elimination saved by a last-chance response

## E2E

At least:
- four players choose the four RDI1 characters
- complete several turns
- trigger a real RDI1 Sometimes response
- voice/timer appears for correct player
- legal card highlights
- gambling round with real RDI1 cards
- real Drink resolution
- reconnect mid-response

## Verification

Run all standard checks plus:

```bash
npm run content:verify:production
npm run content:verify:zh-TW
```

Do not begin Step 22 until the RDI1 subset is fully green.

Stop after Step 21.

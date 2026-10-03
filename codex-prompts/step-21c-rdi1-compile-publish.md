# Step 21C — Compile and publish the complete RDI1 mechanics-equivalent content pack

## Prerequisite
Step 21B is green.

## Goal
Compile `content-private/imports/rdi1/source-normalized.json` into the repository's actual version-one ContentPack and make the four RDI1 characters selectable/playable in production-content mode.

## Output files

Generate:
```text
content-private/imports/rdi1/pack.json
content-private/imports/rdi1/compile-report.json
```

Do not put private content under `public/`.

## Provenance

Do not falsely label this data USER_OWNED or LICENSED.

Add an explicit provenance value such as:
```text
PUBLIC_RULES_PARAPHRASE
```

Meaning:
- mechanics are reconstructed from public rule/reference material
- display titles and summaries are original/paraphrased
- no original art or full proprietary card text is bundled
- this status is NOT a distribution license

Update schema/importer/completeness logic accordingly.

Public deployment documentation must still warn that RDI branding/assets may require permission. Do not weaken that notice.

## Pack requirements

Product:
- RDI1 core

Characters:
- Deirdre
- Fiona
- Gerki
- Zot & Pooky

Each:
- primary character deck physical total 40

Drink deck:
- physical total 30

Use one card definition per unique implementation-facing card record and `deckCards.quantity` for repeats.

Every card definition must have:
- stable `carddef_...` ID
- correct type
- paraphrased `rulesText`
- machine-readable effects
- structured response trigger for Sometimes
- `negatable` metadata where applicable
- gambling metadata where applicable
- en-US + zh-TW translation records

## Character traits
Add generic character trait metadata needed by Drink rules.
RDI1 characters should have their actual relevant traits; none should accidentally trigger Orc/Troll Drink replacements.

## Content selection
The production lobby must expose these four characters from the published RDI1 content version.
No sample character should appear unless explicit fixture mode is used.

## Completeness
Add:
```bash
npm run content:verify:rdi1
```

Required zero-error output:
```text
characters: 4/4
Deirdre: 40/40
Fiona: 40/40
Gerki: 40/40
Zot: 40/40
character physical cards: 160/160
Drink deck: 30/30
unknown mechanics: 0
unknown effects: 0
Sometimes without structured legality: 0
missing en-US: 0
missing zh-TW: 0
sample production records: 0
```

## Tests
- compiler deterministic output
- all IDs unique
- all deck quantities
- all translations
- all trigger/effect schemas
- import dry run
- import + publish into local D1
- room pins RDI1 version
- lobby returns exactly four RDI1 characters in production RDI1 test environment
- no sample fallback

Run:
```bash
npm run content:verify:rdi1-source
npm run content:verify:rdi1
npm run content:import -- --input content-private/imports/rdi1/pack.json --dry-run
npm run typecheck
npm run lint
npm test
npm run test:coverage
npm run build
npm run test:e2e
```

Stop before Step 21D.

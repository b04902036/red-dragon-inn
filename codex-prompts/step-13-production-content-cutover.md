# Step 13 — Production content cutover and full-catalog readiness

## Goal

Remove fictional sample content from the normal runtime path and convert the completed MVP into a production-content-capable application.

The current repository still hardcodes sample content in production paths. Fix the architecture, not merely the labels.

## Current repository facts to address

Inspect these exact areas before editing:

- `worker/index.ts`
  - currently imports `samplePresentation`
  - currently exposes `/api/content/sample`
- `worker/durable/game-room.ts`
  - currently imports `sampleContentPack`
  - assigns characters from the sample pack
  - starts matches with the sample pack
- `src/client/use-room.ts`
  - currently fetches `/api/content/sample`
- `src/client/App.tsx`
  - contains "Original sample cards"
- `src/client/RoomScreen.tsx`
  - contains "Start sample match" and sample copy
- `src/client/GameTable.tsx`
  - contains "Sample table", "Sample adventurer", and sample-name stripping
- `src/content/cards.ts`
  - currently has sample/private source assumptions
- `src/content/pack.ts`
  - contains sample-specific rule-module schema assumptions
- `content/samples/pack.json`
  - must remain usable as a test fixture
- `seeds/0001_sample.sql`
  - must remain a development/test seed, not production default

Do not solve this by global search/replace of the string `Sample`.

## Production content source

Create a production content loader/repository path that loads a **published immutable content version** from D1/imported content.

A room must pin a `contentVersionId` before the match begins.

Recommended approach:
- add a `content_channels` table or equivalent mapping:
  - `production -> <published content version>`
- room creation resolves the current `production` content version once
- store that ID in the room record
- character selection and match start load/validate against that pinned version
- an already-created room must not silently switch content versions after a later import

Explicit fixture mode may use sample content in tests/dev, but production mode must fail clearly when no production content version is configured.

## Presentation endpoint

Replace `/api/content/sample`.

Preferred shape:

```text
GET /api/rooms/:roomId/presentation?locale=en-US
GET /api/rooms/:roomId/presentation?locale=zh-TW
```

or an equally safe room-pinned equivalent.

Presentation must reflect the room's pinned content version.

Presentation contains only public card/character definition data; hidden physical instances remain in private/public game projections as before.

## Generalize content schemas

Remove sample-only schema assumptions.

Content source/provenance should support values such as:
- TEST_FIXTURE
- USER_OWNED
- LICENSED
- OFFICIAL_CATALOG_REFERENCE

Do not equate provenance with permission to redistribute card text.

Generalize rule modules away from a literal `SAMPLE_CORE` kind.

## Full released character catalog

Use `reference/rdi_characters_76.csv` as the public catalog coverage target.

As of the supplied reference, the current released catalog target is 76 characters through RDI 10/Baelfire.

Implement a production catalog metadata layer that can contain:
- product
- character ID
- canonical English name
- product association
- expected primary deck count when known
- expected side-deck/component notes when known
- translation status

Catalog metadata is not the same thing as full playable content.

All 76 character records may be imported/cataloged without pretending their cards are implemented.

## Complete card-data rule

The user wants all cards, but do not fabricate or scrape complete proprietary card text.

Use the existing private content import pipeline.

Add a production completeness manifest/checker that reports, at minimum:

```text
expected characters
present characters
missing characters
characters with no primary deck
characters with unsupported special_rule_key
unique cards
physical card count by quantity
cards with no executable effect representation
cards with unknown effect_key
decks with invalid/zero quantity
missing required side decks
missing Traditional Chinese translation
missing source/provenance
```

If private/licensed full card data is present under `content-private/imports/`, import it and make it the production content version.

If it is absent, implement everything else in this step but **fail the production completeness command with a precise missing-content report**. Do not claim the official card set is complete.

Add a command such as:

```bash
npm run content:verify:production
```

It should exit non-zero for incomplete production content.

## Character mechanics

For every imported character:
- reject unknown `special_rule_key`
- reject unknown `effect_key`
- never silently degrade an official card to no-op
- unsupported mechanics must be listed in the compatibility report

## Production/dev mode

Define explicit behavior.

Example:
- automated tests: fixture/sample pack
- local demo: optional fixture mode
- production deploy: published production content only

A production Worker build must not accidentally default to the sample pack because D1 is empty.

## UI copy cleanup

In production UI:
- title remains `Red Dragon Inn` or localized title
- remove sample/demo disclaimers
- button becomes `Start match`
- do not strip `"Sample "` from character names in rendering
- no fallback string should say `Sample adventurer`

Test fixture names may remain sample-prefixed in tests.

## Tests — mandatory

Add/adjust tests for all of the following:

1. production Worker code does not import `sampleContentPack`
2. production Durable Object code does not import `sampleContentPack`
3. room pins a published content version
4. later production-channel update does not change an existing room
5. new room uses the newly published production version
6. invalid/unpublished content version cannot become production
7. character selection uses the room-pinned catalog
8. match start loads the room-pinned pack
9. presentation endpoint uses the room-pinned version
10. presentation does not expose hidden physical-card state
11. production mode with missing content fails explicitly, not via sample fallback
12. fixture/dev mode still works for automated tests
13. no production-facing sample copy remains
14. imported duplicate card definitions still use `deck_cards.quantity`
15. unknown effect keys fail completeness
16. unknown special-rule keys fail completeness
17. missing character decks fail completeness
18. missing side decks/components required by manifest fail completeness
19. all 76 catalog characters are represented in catalog metadata
20. current tests that depend on sample fixtures remain deterministic

Update Playwright selectors that currently search for `Start sample match` or sample-only visible copy.

## Documentation

Create/update:
- `docs/production-content.md`
- `docs/content-format.md`
- `docs/database.md`
- README production-content setup

Document exactly where the user must place owned/licensed complete card data:

```text
content-private/imports/
```

and how to run:
- import
- publish
- production completeness verification

## Verification

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm run content:verify:production
```

If the final command fails only because the repository does not contain user-owned/licensed official card data, report the missing-content result clearly. That is not permission to invent content.

Do not begin Step 14.

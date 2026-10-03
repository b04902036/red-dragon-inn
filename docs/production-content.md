# Production content through step 13

The default Worker environment is production. It reads a published immutable edition from D1; it does not import the sample pack or presentation. An empty database, missing production channel, unpublished version, invalid pack or fixture-only card provenance fails room creation with HTTP 503. There is no sample fallback. `npm run deploy` runs the completeness gate before building or publishing.

## Published edition and room pinning

`content_channels` maps `production` to a published `content_versions.id`. Foreign keys, publication triggers and playable-card provenance guards protect the mapping. `D1ContentRepository.setProductionVersion` validates the published graph before updating it. A channel update changes only future rooms.

Every new room saves `contentVersionId` in its authoritative Durable Object record before selecting a character. Join, character selection, public presentation and match setup load that exact edition. A match manifest retains the entire validated setup and pinned edition for deterministic replay. Public projection, owner-only hands and server-authenticated intents retain their existing boundaries.

`GET /api/rooms/:roomId/presentation?locale=en-US` returns only public definition names/text/types and presentation hints. It has no deck quantities, physical instances, hands, pending effect params or RNG. `zh-TW` requires complete reviewed translations in production; missing or unreviewed required text returns HTTP 503. Explicit fixture mode permits canonical English fallback. Unsupported locales return HTTP 400. `/api/content/sample` is removed. See [localization](localization.md) and the [combined upgrade audit](production-upgrade-status.md).

Rooms created by the earlier sample-only build lack a pin and are incompatible with the new record validator. Recreate those development rooms; no existing production rooms were deployed or migrated. This change does not delete local room/history data.

## Explicit fixture mode

For local demonstration:

```sh
npm run db:migrate
npm run db:seed
npm run dev:fixture
```

`dev:fixture` explicitly selects Wrangler's `fixture` environment and its published fixture version. Fixtures still come from D1, not direct imports into Worker code. Automated Workers tests explicitly configure fixture mode; a separate production-mode Workers project exercises production failures and edition changes. Playwright explicitly selects fixture mode for its browser journeys. Fixture names and IDs remain unchanged. Normal `npm run dev`, `npm run build` and deployment use production mode.

The sample seed is for development/tests only and never sets a production channel. Public UI uses `Start match`, preserves canonical names, and has no sample-specific disclaimer or fallback. Fixture cards retain their sample names when explicitly selected.

## Owned/licensed input and activation

Put complete user-owned/licensed JSON packs in ignored **`content-private/imports/`**, outside static assets. The canonical format is documented in [content format](content-format.md). No importer scrapes or downloads proprietary cards. Provenance does not grant redistribution rights; publish only content you are permitted to serve.

Run these local commands, substituting your actual filename and version ID:

```sh
npm run db:migrate
npm run content:import -- --input content-private/imports/owned-pack.json --dry-run
npm run content:import -- --input content-private/imports/owned-pack.json --write --publish
npm run content:verify:production -- --input content-private/imports/owned-pack.json
npm run content:verify:production -- --activate content_owned_v1
npm run content:verify:production
npm run dev
```

The importer writes a new edition atomically, optionally publishing it in that transaction. Activation requires an already-published edition and a passing completeness report, then updates only the local production channel. No arguments verifies the currently configured local channel. `--input` verifies a file without writing D1. Invalid/incomplete content exits 1; complete content exits 0. Unknown custom effect and character rule keys are reported and rejected before executing or persisting them.

These tools use local D1 only. They do not provision, populate or activate remote D1. Remote deployment requires account/database setup, the same validated licensed edition in that remote database, and a matching remote production-channel mapping before the live smoke check. A successful local verification alone does not populate remote storage. See [deployment](security-deployment.md).

## Public catalog versus playable content

`content/catalog/characters.json` represents all **76** records supplied in `reference/rdi_characters_76.csv`, including product association, canonical English name, expected primary-deck quantity, component notes, source URL and translation status. These are reference records, not implemented card decks. Seventy-five supplied records expect 40 primary cards; Baron von Vlazlo expects 30. Catalog IDs are stable identifiers derived from names; imported playable character IDs remain independent and completeness matches canonical English names/product associations.

The checker reports expected/present/missing characters, missing or wrong-count primary decks, unknown special rules/effects, unique definitions and physical quantities by deck, zero/invalid quantities, missing required side decks/components, missing Traditional Chinese presentation, invalid provenance and structural validation errors. Empty effects on Action/Anytime/Sometimes/Special/Drink Event cards are rejected as missing executable representation. Drink/Gambling/Cheating categories have implemented intrinsic behavior; they may additionally use the DSL.

Packs may declare per-character `requirements` for primary count, side-deck IDs/counts and resource components. Required component notes cannot be treated as implemented by importing catalog metadata. Current character side-deck instantiation is unsupported and fails completeness; declared components must correspond to actual registered resource mechanics. New catalog-specific mechanics require server handlers, param schemas, behavioral tests and replay coverage. Rule-module kind/name/summary metadata alone never registers a mechanic.

## Current content status and visual verification

There is no complete owned/licensed official pack in this workspace. The existing ignored `original-verification.json` is an original import-test fixture, not official catalog data, and is not activated as production. The completeness command therefore must fail with 76 missing catalog characters, zero present official characters/cards, and a clear configuration/input report. This is a production release blocker, not permission to fabricate cards.

To verify the cutover visually, run normal `npm run dev` and try creating a room: without an activated production edition, the landing page explains that published game content must be configured. Then use `npm run dev:fixture`, create/join in two tabs, and choose characters. The start button says `Start match`; canonical fixture names remain visible. Read a card, complete a turn and refresh. The room-pinned presentation endpoint in DevTools includes `contentVersionId` and no hidden instance/state fields. Follow [the table checklist](game-ui.md) for the complete interaction sequence.

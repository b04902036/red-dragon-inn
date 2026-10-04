# Versioned content packs

`content/samples/pack.json` contains original fictional fixtures, validated and exported by `src/content/sample.ts`. It is deliberately small: four sample characters, action/reaction/Anytime/gambling/cheating definitions, two Drinks, one Drink Event, and one character-specific resource card. No copyrighted deck or artwork is included, and these fixtures do not claim to reproduce a complete playable product.

## Pack shape

`src/content/pack.ts` defines the strict version-one schema:

```text
schemaVersion: 1
version: { id: content_…, name, createdAt: ISO UTC timestamp }
products: [{ id: product_…, slug, name, releaseYear: number | null }]
characters: [{ id: character_…, productId, slug, name, villain,
  complexity: 1..5 | null, specialRuleKey: registered key | null,
  rules: { resources: { [key]: { initialValue, visibility } }, sideDeckKeys } }]
decks: [{ id: deck_…, characterId: character_… | null,
  type: "CHARACTER" | "INN_DRINK" | "SPECIAL", slug, name }]
cards: [CardDefinition]
deckCards: [{ deckId, cardId: carddef_…, quantity: 1..64 }]
ruleModules: [{ id: rule_…, ruleKey, summary,
  rules: { kind: uppercase metadata kind (e.g. "CORE_RULES"), notes } }]
assets: [{ id: asset_…, ownerType, ownerId, type, objectKey, licenseStatus }]
requirements?: [{ characterId, primaryDeckCount,
  sideDecks: [{ deckId, quantity }], components: [{ key, label, mechanicKey }] }]
translations?: [{ entityType, entityId, field, locale, text,
  sourceKind, sourceRef, status }]
```

IDs have separate namespaces and validated suffixes. Slugs are lowercase letters/digits separated by hyphens. IDs and relevant slugs are unique within the pack; rule keys and deck/card pairs are also unique. Every product, character, deck, card, and asset reference must resolve inside that version. Character-specific cards cannot appear in another character's deck. Inn decks have no character owner and contain only Drink or Drink Event definitions; character/special decks require an owner and contain other categories.

One definition represents repeated copies. For example, the association `deck_sample_0` → `carddef_sample_shove` has quantity two, while only one definition is stored. Character decks can share generic definitions. The engine creates separate physical instances and deterministically shuffles/deals them.

## Definitions and effects

Step 21B adds validated generic mechanics metadata, traits, targets, DSL operations, and reaction facts. See the complete [schema and capability inventory](rdi1-engine-capabilities.md#schemas-and-persistence). Existing D1 definition/rules JSON stores these extensions; no SQL migration or published fixture change is required.

`src/content/cards.ts` is the authoritative card-definition schema. Common fields are `id`, `name`, `rulesText`, `source`, and `effects`, with an optional character reference. Provenance supports `TEST_FIXTURE`, `USER_OWNED`, `LICENSED`, `PUBLIC_RULES_PARAPHRASE` and `OFFICIAL_CATALOG_REFERENCE`; legacy `SAMPLE`/`PRIVATE` remain readable for fixtures and historical editions. Production playable cards require `USER_OWNED`, `LICENSED`, or `PUBLIC_RULES_PARAPHRASE`; provenance does not confer redistribution permission. The paraphrase value describes mechanics reconstructed from public rules with original/paraphrased display text, without original artwork or full proprietary card text. It is not a distribution license. Categories are `ACTION`, `SOMETIMES`, `ANYTIME`, `GAMBLING`, `CHEATING`, `DRINK`, `DRINK_EVENT`, and `SPECIAL`. Sometimes definitions have a response kind; Drinks have alcohol/fortitude/chaser metadata; Special definitions require a character and may identify a side-deck key.

Effects use the data-only DSL in `src/content/effects.ts`. Through step 06, the engine executes stat changes, Gold transfers/payments, draws/discards, Ignore/Negate, choices, pending-effect/compound Drink modifications, and gambling start/control/win/leave hooks. Optional Drink `chaserSource` selects SAME_SOURCE or INN. MODIFY_DRINK and MODIFY_PENDING_EFFECT require explicit `allowDrinkEvents: true` to modify an Event. Events have a distinct source kind and use the same validated DSL; Chaser-discard context never executes Event instructions. See [the Drink guide](drinks-elimination.md) for rules and limits. The published sample pack and D1 seed are unchanged.

The allowlisted custom keys `core.adjust-resource` and its legacy fixture alias `sample.adjust-resource` have a trusted server handler with independently validated resource/delta params. Character rule keys `core.resources` and legacy `sample.resources` initialize declared resources. Unknown special/effect keys fail import and completeness. Rule-module kinds are descriptive metadata and never execute code or register a handler. See [the timing model](timing-engine.md) for exact operations and restrictions. Supporting another rule or effect requires explicit server code and a param schema; imports cannot add executable JavaScript.

The repository derives card slugs from their definition-ID suffix, replacing underscores with hyphens. Keep these derived slugs unique. SQL stores the entire definition JSON plus searchable fields and DSL. For a custom effect, `effect_key`/`effect_params_json` mirror the first custom entry; the full ordered effect list remains in `effect_dsl_json` and `definition_json`.

The static seed `seeds/0001_sample.sql` mirrors the JSON fixture. Runtime integration tests compare every definition and deck quantity, so edits must update both. Published fixtures are immutable; changed content belongs in a new version and seed instead of rewriting an edition used by matches.

Gambling and Cheating definitions optionally include strict `gambling` metadata: `allowedNextCategories` is a nonempty, unique array drawn from GAMBLING/CHEATING, and `immediateWin` is boolean. Both fields are required when the metadata object is provided. Without it both categories can take control and no immediate win is requested. These constraints describe behavior independently of names; `TAKE_GAMBLING_CONTROL`, `WIN_GAMBLING`, and `LEAVE_GAMBLING` provide validated DSL hooks. See [the gambling guide](gambling-engine.md) for source timing, automatic start/control operations, and configuration. The published sample JSON and SQL remain unchanged.

## Assets and private content

Step 21C adds optional `gambling.canStart`: false restricts the card to gambling priority and is enforced by shared server legality. Omission preserves historical start behavior. Explicit START_GAMBLING/TAKE_GAMBLING_CONTROL instructions are consumed once alongside intrinsic category behavior. Drink `alcoholContent` now accepts signed integers from -1000 to 1000 so negative Drinks preserve their actual delta; the player-stat clamp remains unchanged. Character traits and Drink trait replacements retain the generic Step 21B schemas. See [RDI1 compilation and publication](rdi1-compile-publish.md).

Asset owners are `PRODUCT`, `CHARACTER`, `DECK`, `CARD`, or `RULE_MODULE`; types are `ARTWORK`, `ICON`, or `RULES_TEXT`. Every asset needs `ORIGINAL`, `USER_OWNED`, or `LICENSED` status. `objectKey` is a relative storage key, never a filesystem path, URL, or inline executable content. Actual asset upload/storage is future work; the sample pack includes no assets.

Place user-owned/licensed data in ignored `content-private/imports/` (also ignored: `private-content/`, `content/private/` and `src/content/private/`). Keep private files outside public Vite assets and imports into the browser bundle. Do not commit private card text, licensed art, credentials, or local file paths. Automated tests verify these paths are ignored and contain no tracked files.

The local JSON importer validates a complete version-one pack, resolves only registered custom effects, and writes a new draft through the same transactional statements as `ContentRepository.saveDraft`. Optional publishing occurs in that transaction. Match setup pins the imported pack and version. See [the import guide](content-import.md) for dry runs, compatibility reports, adapters, visual checks and current UI/asset limits.

Production requirements and translation records are stored together in immutable version-scoped `content_metadata`. Required side decks must belong to the specified character and use SPECIAL type. Component keys identify actual declared resources, and mechanics must be registered. Translation entity references and version/entity/field/locale tuples are validated; duplicate/conflicting translations fail import. English canonical names/rules remain in definitions. See [production setup and completeness](production-content.md).
Translations are edition-scoped records for `PRODUCT`, `CHARACTER`, `CARD`, `RULE_MODULE`, `MECHANIC` and `CHOICE_OPTION`. Each includes locale, source kind/reference and review status. Choice IDs use `cardDefinitionId/optionId`; mechanic IDs are registered character resource keys. Translation imports create a new edition and preserve canonical English definitions. See [localization](localization.md).

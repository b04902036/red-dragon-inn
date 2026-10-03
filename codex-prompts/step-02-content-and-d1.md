# Step 02 — Content model, D1 schema, migrations, repositories

## Goal

Create the persistent content/data layer without embedding the full copyrighted game.

The app must work with sample/test content.

## D1 schema

Create migrations for at least:

### Content

```text
content_versions
products
characters
decks
cards
deck_cards
rule_modules
assets
```

Suggested fields:

### content_versions
- id
- name
- created_at
- published_at nullable

### products
- id
- content_version_id
- slug
- name
- release_year nullable

### characters
- id
- content_version_id
- product_id
- slug
- name
- villain boolean
- complexity nullable
- special_rule_key nullable
- rules_json

### decks
- id
- content_version_id
- character_id nullable
- deck_type
- slug
- name

### cards
- id
- content_version_id
- slug
- name
- card_type
- effect_key nullable
- effect_params_json nullable
- effect_dsl_json nullable
- rules_summary nullable

### deck_cards
- deck_id
- card_id
- quantity
- PRIMARY KEY(deck_id, card_id)

### rule_modules
- id
- content_version_id
- rule_key
- summary
- rules_json

### assets
- id
- owner_type
- owner_id
- asset_type
- object_key
- license_status

Use foreign keys and uniqueness constraints intentionally.

## Runtime/history tables

Create initial migration contracts for:

```text
matches
match_players
match_events
match_snapshots
```

These may not be fully used yet but should have sensible keys/indexes.

Important:
- event sequence must be unique per match
- snapshots need sequence/version
- matches should record content version and RNG seed

## Repository layer

Do not query D1 directly from React or game-engine modules.

Create server repository interfaces:
- ContentRepository
- MatchRepository
- EventRepository

Implement D1-backed versions in `worker/repositories`.

## Sample content

Add a small, clearly fictional/sample content pack sufficient for tests:
- 2–4 sample characters
- sample action cards
- sample reaction cards
- sample gambling cards
- sample drinks
- one Drink Event
- sample duplicated card quantity through `deck_cards.quantity`

Do not copy a real complete RDI deck.

## Content versioning

Match creation must be able to lock onto a specific content version so later content updates cannot alter an in-progress match.

## Tests — mandatory

Use the Cloudflare Workers test runtime with D1 migrations.

Test:
1. Migrations apply from empty DB.
2. Migrations can be reapplied through the normal migration workflow without corrupting schema.
3. Foreign keys prevent invalid references where expected.
4. Unique constraints work.
5. `deck_cards.quantity` represents duplicates without duplicating definitions.
6. Content repository loads a full character/deck/card graph.
7. A match references a fixed content version.
8. Event sequence uniqueness is enforced.
9. JSON columns round-trip correctly.
10. Sample content can seed an empty local DB.
11. No private-content directory is committed.

## Documentation

Add:
- `docs/database.md`
- `docs/content-format.md`

Document how licensed/user-owned content will later be imported.

Run all standard verification.

Stop after this step.

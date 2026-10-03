# Step 10 — Private/user-owned content import pipeline

## Goal

Allow the engine to consume real card/character content supplied by the user without making copyrighted content a required part of the public repository.

Do not scrape the web for full decks.

## Directory convention

Create:

```text
content/
  samples/
content-private/
  README.example.md
  imports/
```

`content-private/` must be ignored by Git except for an optional `.gitkeep` or non-content instructions if desired.

CI must use only `content/samples`.

## Import formats

Support at least CSV and/or JSON import matching the repository content model.

Recommended card fields:

```text
card_id
character_id
product_id
deck_id
deck_type
card_name
card_type
quantity
effect_key
effect_params_json
effect_dsl_json
rules_summary
source_ref
```

Do not require raw copyrighted rules text if a structured effect representation is available.

## Importer requirements

- schema validation
- duplicate detection
- referential-integrity validation
- quantity validation
- card-type validation
- effect DSL validation
- unknown effect key report
- dry-run mode
- human-readable error report
- import transaction: invalid pack must not partially write
- content version creation/pinning

## Raw-source adapter

Design a clean adapter interface so later the user can supply:
- their own manually prepared CSV
- exported JSON from material they own
- locally available data they have permission to use

Do not hardcode Foundry/TTS scraping into the core importer.
Optional adapters belong under a separate import-tools folder and should never download third-party copyrighted assets on their own.

## Character special mechanics

Add an extension registry:

```text
effects/
  basic/
  characters/
```

A content pack may reference `effect_key`; the server resolves only keys registered in source code.

Unknown keys must fail import validation or be explicitly marked unsupported.

## Compatibility report

Importer should output:
- characters imported
- decks imported
- unique cards
- total physical card count from quantities
- unsupported effects
- missing assets
- validation warnings/errors

## Tests — mandatory

Create test fixture packs.

Test:
1. valid JSON import
2. valid CSV import if supported
3. invalid foreign reference rejected
4. duplicate ID rejected
5. bad quantity rejected
6. malformed effect JSON rejected
7. unknown effect key reported/rejected
8. partial transaction rollback
9. dry run writes nothing
10. content version created correctly
11. same card definition + quantity imports correctly
12. private content path ignored by Git
13. CI/sample build does not depend on private content
14. compatibility report counts are correct

If the user later supplies real owned content, add separate local-only verification without committing it.

Run standard verification.

Stop after this step.

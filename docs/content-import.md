# Local JSON content import through step 12

The importer accepts a complete version-one JSON pack matching [the content format](content-format.md). Use structured effects and an empty `rulesText` if raw rules text is unavailable. CSV is not supported in this step. Original fixtures live in `content/samples/`; user-owned or licensed inputs belong in ignored `content-private/imports/`. The optional instructions file is the only private-directory file included in the repository. No importer downloads card data or assets.

## Validate and review

Step 21C adds a deterministic private RDI1 compiler and truthful `PUBLIC_RULES_PARAPHRASE` provenance. See [RDI1 compilation/publication](rdi1-compile-publish.md) for source verification, local activation and production visual checks. CI running the RDI1 suites must provision the ignored inputs; it cannot substitute samples or skip missing-source validation.

Step 24C adds the locked RDI2 compiler and a new combined RDI1 + RDI2 edition without rewriting RDI1. See [RDI2 compilation/publication](rdi2-compile-publish.md) for the private outputs, local publication commands, source verification and three Drink setup choices.

Step 24D adds [per-definition gameplay verification](rdi2-full-verification.md). Generate its public matrix with `npm run content:coverage:rdi2`, or check that it matches the locked private inputs with `npm run content:coverage:rdi2 -- --check`. The matrix includes all compiled definitions and links to their actual legality and resolution tests.

```sh
npm run content:import -- --input content/samples/pack.json --dry-run
npm run content:import -- --input content-private/imports/my-pack.json --dry-run
```

Dry run is the default and opens no database. The compatibility report lists version ID, character/deck/definition counts, physical copy count, unsupported effect keys, missing asset keys and readable field errors/warnings. The sample reports **4 / 6 / 10 / 37**. Missing artwork is a warning; invalid references, duplicate IDs/slugs, invalid quantities/types/DSL or unregistered custom effects reject the complete pack. Asset availability can be supplied to the programmatic validator; the CLI does not upload or verify artwork and reports declared keys as unavailable.

## Write a reviewed version

Prepare local D1 with `npm run db:migrate`. Give your pack a new `content_…` version ID; an existing version is rejected rather than overwritten.

```sh
npm run content:import -- --input content-private/imports/my-pack.json --write
```

This creates a draft version and graph in one atomic transaction. Add `--publish` to publish inside that same transaction after validation. Published definitions are immutable. For review, leave the version as a draft; drafts are unavailable through play-loading repositories. A failed statement rolls back all prior statements, including version creation. The CLI always uses local D1 and cannot target a remote account.

Imported packs can be supplied to the pure engine's `createMatch` setup, which pins the version, rules, quantities and definitions for that match. Runtime rooms now resolve the published production channel at creation and use its pinned catalog for lobby selection and match start. Explicit fixture mode uses a published D1 fixture edition. Production activation requires completeness; artwork uploading remains later product work. See [production setup](production-content.md).

## Adapters and trusted mechanics

`ContentSourceAdapter` has a format name and `decode(source): unknown`. JSON is the included adapter. Later manual CSV or owned-export adapters can live in `import-tools/`, returning the same graph for shared strict validation. Adapters must not download third-party copyrighted assets. `importContent` defaults to dry run and writes only after complete validation.

Common effects execute through the existing basic DSL operations. Character handlers live in `src/engine/effects/characters/` and register in `effects/registry.ts`. The shared `registeredEffectKeySchema` is the allowlist; its types require a handler for every key. Adding a mechanic requires a strict parameter schema, server code and behavioral tests. An input cannot register executable JavaScript or enable an unknown key.

## Visual verification

Run the sample dry run above and confirm `valid: true`, counts **4 / 6 / 10 / 37**, zero unsupported effects and zero errors. Make a local original copy under `content-private/imports/`, change its version ID and repeat. Try quantity zero or an unknown CUSTOM key: the command should exit unsuccessfully and identify the field/key.

After a valid local write, inspect its draft with:

```sh
npx wrangler d1 execute DB --local --command "SELECT id,name,published_at FROM content_versions;"
```

Your new row should exist, with null `published_at` unless you used `--publish`. Import the same version again: it must fail, and row/card counts must remain unchanged. Use `npm run dev:fixture` for the sample app. Normal production development uses its activated D1 edition. Tests now validate both original public fixtures and the provisioned private RDI1 pack, then run typecheck, lint, tests, coverage, build and browser checks.

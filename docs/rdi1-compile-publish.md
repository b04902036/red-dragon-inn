# Step 21C RDI1 compilation and local publication

The locked Step 21A normalized source compiles to a version-one ContentPack under ignored `content-private/imports/rdi1/pack.json`. The companion `compile-report.json` records source SHA-256, completeness, provenance and the absence of a distribution license/artwork. Neither file belongs under `public/` or in Git. The locked Step-20 audit remains unchanged.

The edition is `content_rdi1_mechanics_v1`: four characters, 92 unique character records and 18 unique Drink records; quantities produce 160 character cards and 30 Drinks. Every public name/rules field has an en-US and reviewed manual zh-TW translation. Original source display text remains paraphrased. Canonical character/product identities retain catalog associations; manual Chinese names visibly retain their canonical English name through the existing presentation layer.

`PUBLIC_RULES_PARAPHRASE` truthfully identifies mechanics reconstructed from public rules/reference material, with original/paraphrased display titles and summaries. It does **not** claim USER_OWNED or LICENSED status and is **not** a distribution license. No original artwork or full proprietary card text is bundled. Public RDI branding, character identities and assets may require permission; obtain applicable permission before public deployment. The existing asset-license restrictions and full-catalog release gate remain in force.

## Compiler and generic schema changes

The compiler is pure and deterministic. Stable IDs derive from normalized card keys, repeated physical cards use `deckCards.quantity`, and every effect/trigger passes the shared strict schema. It converts normalized collection plans to COLLECT_GOLD, builds AND/OR response predicates, maps mandatory payment to `mandatoryGoldCost`, and records the normalized hard-counter family/policy. Mechanics IDs identify compilation plans only; runtime code never branches on titles or character identity.

Optional `gambling.canStart=false` prevents round-only cards from starting a round. Explicit start/control operations execute once; old editions still use intrinsic category behavior. Signed Drink Alcohol permits -1000 through 1000, including the source's -1 Drink. Numeric player bounds remain unchanged. Migration 0008 extends both SQL channel guards to accept paraphrase provenance while retaining publication and sample rejection guards. Artwork license status is unchanged.

Generic traits are ELF for Deirdre, HUMAN for Fiona and Zot, and HALFLING for Gerki. None match ORC/TROLL Drink replacement rules. These traits were checked against the publisher's [Deirdre](https://slugfestgames.com/rdi-characters/deirdre-the-priestess/), [Fiona](https://slugfestgames.com/rdi-characters/fiona-the-volatile/), [Gerki](https://slugfestgames.com/rdi-characters/gerki-the-sneak/), and [Zot](https://slugfestgames.com/rdi-characters/zot-the-wizard/) profiles. Pooky does not turn Zot into an Orc or Troll.

## Local workflow

```sh
npm run content:verify:rdi1-source
npm run content:compile:rdi1
npm run content:verify:rdi1
npm run content:import -- --input content-private/imports/rdi1/pack.json --dry-run
npm run db:migrate
npm run content:import -- --input content-private/imports/rdi1/pack.json --write --publish
npm run content:verify:rdi1 -- --activate content_rdi1_mechanics_v1
npm run dev
```

The import command writes/publishes one new immutable edition atomically; repeating it rejects an existing edition. `content:publish:rdi1` provides a repeatable local setup command: validate the locked source/pack, publish when absent, verify an already-published edition, then activate it. It never overwrites published content. A preexisting conflicting draft or edition fails clearly. All database commands target local D1; no remote publication/deployment occurs.

`content:verify:rdi1` reports the requested 4/4, 40/40 for each character, 160/160 and 30/30 totals and zero unknown mechanics/effects, unstructured Sometimes, missing translations or sample records. It also compares the entire graph against the locked source compilation, rejecting missing/substituted/extra mechanics, changed quantities/traits/translations and asset additions. It validates the four RDI1 catalog records, without claiming the other 72 catalog characters are implemented. `content:verify:production` continues to assess all 76 characters and is not a passing release gate for this four-character edition.

Tests require the private normalized source and generated pack to be provisioned before execution; missing input fails rather than silently skipping tests or falling back to samples. The production Workers project receives the private pack as a test-only binding. Production Worker/client builds never import it. `npm run test:e2e` runs the existing fixture suite, then a separate production-mode RDI1 preview journey, sequentially.

## Visual verification

Run normal `npm run dev` with no `CLOUDFLARE_ENV`, open the printed address, and create a **new** room. Older rooms retain their original content pin. The character selector should contain exactly Deirdre, Fiona, Gerki and Zot/Pooky, with no sample characters. Open the invite in a separate browser context, choose another character and start. Each player sees seven paraphrased cards and only counts for the opponent's hand.

Complete Discard and draw, then pass the existing 15-second Anytime opportunity or let its deadline expire. Play a server-highlighted legal card or skip the Action. Switch Language to 繁體中文 and check names/rules; reload the guest and confirm the same seat, hand and game state. DevTools presentation requests should identify `content_rdi1_mechanics_v1` and contain definition data only. The automated production browser journey checks selection, bilingual presentation, match start, discard/grace progression and refresh.

## Changed files and tests

Step 21C changes:

- Content: `src/content/cards.ts`, `src/content/production.ts`, `src/content/rdi1-compiler.ts`, `src/content/rdi1-pack.ts`.
- Server: `src/engine/card-play-legality.ts`, `worker/runtime-content.ts`, `worker/repositories/content.ts`, `migrations/0008_paraphrase_provenance.sql`.
- Tooling: `scripts/rdi1-pack.ts`, `vite.rdi1-pack.config.ts`, `package.json`, `scripts/fixture-preview.mjs`, `vitest.config.ts`, `playwright.config.ts`, `playwright.rdi1.config.ts`.
- Tests: `tests/content/rdi1-compiler.test.ts`, `tests/content/cards.test.ts`, `tests/engine/rdi1-compiled-legality.test.ts`, `tests/worker/rdi1-content.test.ts`, `tests/worker/bindings.d.ts`, `tests/worker/localization.test.ts`, `tests/e2e/rdi1-content.spec.ts`. The translation migration scenario explicitly selects its pre-0007 baseline so later migrations cannot invalidate its setup.
- Documentation: `docs/content-format.md`, `docs/content-import.md`, `docs/production-content.md`, `docs/security-deployment.md`, `docs/rdi1-compile-publish.md`.
- Generated, ignored: `content-private/imports/rdi1/pack.json`, `content-private/imports/rdi1/compile-report.json`.

New tests: 15 compiler/completeness cases, three pure-engine regressions, three actual Workers/D1 publication/lobby/guard cases, and one production browser journey. Existing signed-Drink schema rejection now checks the actual lower bound. Uncommitted Step 21B timing-fix changes remain preserved; their inventory is in [the capability document](rdi1-engine-capabilities.md#changed-file-inventory).

Formal per-card verification is Step 21D. Step 21C stops before that step; compilation/schema completeness is not a claim of completing the Step 21D release audit.

## Final verification

All Step 21C acceptance criteria passed on 2026-10-04. The Step 21B timing fix remains green. It is safe to begin Step 21D when authorized; that step has not been started. No remote content publication or deployment occurred.

| Command                                                                                      | Result                                                                                                               |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `npm run content:compile:rdi1`                                                               | PASS; generated both ignored output files                                                                            |
| `npm run content:verify:rdi1-source`                                                         | PASS, exit 0; locked source verified, zero errors                                                                    |
| `npm run content:verify:rdi1`                                                                | PASS, exit 0; 4/4 characters, all four decks 40/40, 160/160 character cards, 30/30 Drinks; all six gap counters zero |
| `npm run content:import -- --input content-private/imports/rdi1/pack.json --dry-run`         | PASS, exit 0; 110 definitions, 190 physical cards, zero errors                                                       |
| `npm run db:migrate`                                                                         | PASS, exit 0; local migration 0008 applied                                                                           |
| `npm run content:import -- --input content-private/imports/rdi1/pack.json --write --publish` | PASS, exit 0; local immutable edition published                                                                      |
| `npm run content:verify:rdi1 -- --activate content_rdi1_mechanics_v1`                        | PASS, exit 0; local production channel activated                                                                     |
| `npm run typecheck`                                                                          | PASS, exit 0                                                                                                         |
| `npm run lint`                                                                               | PASS, exit 0                                                                                                         |
| `npm run test` (`npm test`)                                                                  | PASS, exit 0; **1,144 tests, 77 files**                                                                              |
| `npm run test:coverage`                                                                      | PASS, exit 0; **1,144 tests, 77 files**; all per-file 90% thresholds met                                             |
| `npm run build`                                                                              | PASS, exit 0                                                                                                         |
| `npm run test:e2e`                                                                           | PASS, exit 0; **23 fixture tests + 1 production RDI1 test**                                                          |

Coverage: **99.39% statements, 98.12% branches, 99.73% functions, 99.58% lines**. The new compiler and RDI1 completeness verifier each have 100% coverage across all four measures. Workers/D1/protocol tests execute in the actual Workers runtime through `@cloudflare/vitest-plugin`.

Diff review and whitespace checks passed. The source lock and Step-20 audit have no diff, both generated private files are ignored/untracked, the production dependency/build checks expose no private imports, and no debug logging, secrets or machine-specific paths were added. The existing 22-file Step 21B fix and the 27-file Step 21C change are both preserved in the working tree.

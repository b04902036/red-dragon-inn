# RDI1 normalized-source verification

Step 21A locks the supplied mechanics and compares them to the Step 20 engine. It does not compile a ContentPack, publish to D1, enable production decks, or implement new gameplay.

The revised sequence is 21A source validation, 21B generic engine capabilities, 21C compilation/publication, 21D full per-card verification, then Step 22 RDI1 release audit. RDI2 is outside this sequence.

## Inputs and lock

Keep `content-private/imports/rdi1/source-normalized.json` private and ignored by Git. The verifier also reads the four reference documents under `reference/rdi1/` and `sometimes-legality-fixtures.json`. `source-lock.json` records their SHA-256 hashes against the Step 20 baseline. It contains no private card text.

Run with Node 24.15 or newer:

```bash
npm run content:verify:rdi1-source
```

Successful verification exits zero and regenerates [rdi1-engine-gap.md](rdi1-engine-gap.md). The current source contains 40 cards per character, 160 character cards, 30 Drinks, 40 mechanics and 23 Sometimes mechanics. Counts are recomputed from physical quantities rather than trusted from declared totals. Character and Drink records, bilingual text, references, explicit legality, bounded data-only effect plans, capability declarations and both card matrices are validated. Unknown operations/requirements, duplicate keys and UNKNOWN/TODO/NO_OP placeholders fail verification.

A missing or changed input, malformed JSON/CSV, or changed lock fails verification and leaves the prior report intact. Ordinary verification never rewrites the source or updates the lock. For an intentionally revised and reviewed source/reference set, explicitly record the new lock and then verify again:

```bash
npm run content:verify:rdi1-source -- --lock
npm run content:verify:rdi1-source
```

The report classifies every required capability and gives a positive/negative context pair for every Sometimes mechanic. These pairs specify the source contract; they do not claim that missing Step 21B features already work. Current-engine command/projection probes exercise supported behavior and expose unsafe naive translations, including Gold flow, self-targeting, mandatory costs and counter exclusions. No placeholder fallback is compiled.

## Verification and review

CI unit tests use original repository-safe source fixtures; the private source is required only for the explicit local source-verification command. The audit tests also check the public matrix's complete Sometimes list and all required capability IDs. Source validation confirms the supplied files' consistency; it does not independently certify their external evidence or change the production provenance/license policy.

Run all Step 21A gates:

```bash
npm run typecheck
npm run lint
npm test
npm run test:coverage
npm run build
npm run test:e2e
npm run content:verify:rdi1-source
```

For visual verification, inspect the command's JSON: `valid` must be `true`, `stage` must be `SOURCE_VALIDATION_ONLY`, character totals must each be 40, the character total must be 160, the Drink total must be 30 and `errors` must be empty. Open the generated Markdown preview and review the 35 capability rows, additional engine gaps and all 23 Sometimes rows with positive/negative expected `legalPlays`. This step adds tooling and documents, so it introduces no new browser screen. Existing game flows are covered by the unchanged browser E2E suite.

Step 21B is safe to begin after these checks pass. Full RDI1 gameplay and production content readiness still require Steps 21B–21D and the Step 22 release audit.

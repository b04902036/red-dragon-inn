# Step 21A — Lock the RDI1 normalized source and produce an engine-gap report

## Inputs

The repository is already complete through Step 20.

Read:
```text
content-private/imports/rdi1/source-normalized.json
reference/rdi1/rdi1-card-matrix.md
reference/rdi1/rdi1-mechanics-matrix.csv
reference/rdi1/source-evidence.md
reference/rdi1/required-engine-capabilities.json
docs/timing-engine.md
docs/timed-prompts.md
docs/content-format.md
```

## Goal

Treat `source-normalized.json` as the RDI1 mechanics source to implement, but validate it against the current repository before writing gameplay code.

Do NOT replace it with original card text from the web.
Do NOT invent or silently simplify mechanics.

## Required validation

Build a script:

```bash
npm run content:verify:rdi1-source
```

It must prove:
- Deirdre physical count = 40
- Fiona physical count = 40
- Gerki physical count = 40
- Zot physical count = 40
- character physical total = 160
- Drink physical total = 30
- every referenced mechanic exists
- every mechanic has en-US and zh-TW display text
- every Sometimes mechanic has an explicit legality model
- every mechanic has an effect plan
- no UNKNOWN/TODO/NO_OP entry exists
- duplicate mechanic/card keys are rejected

## Compare to Step-20 engine

Generate:

```text
docs/rdi1-engine-gap.md
```

For every required capability, classify:
- ALREADY_SUPPORTED
- SUPPORTED_WITH_SCHEMA_EXTENSION
- NEEDS_GENERIC_ENGINE_FEATURE

Do not implement character-name-specific rules.

Pay particular attention to:
- Anytime during gambling
- phase-scoped Sometimes during Order Drink
- generic gambling checkpoints
- ante/payment response context
- post-gambling settlement response
- post-Fortitude-loss response
- source-origin preservation through redirected damage
- gambling pot manipulation
- force-leave response timing
- extra Drink ordering
- forced Drinks
- multiple/queued Drinks
- pass/split Drink
- replace Drink Alcohol with Fortitude
- current Drink mutation
- Drink-change counter capability facts
- protected counter families
- simultaneous drinking
- Drinking Contest
- Round-on-the-House independent copies
- character race/trait conditions for Drinks

## Response legality audit

For every Sometimes mechanic, write at least one positive and one negative test fixture describing:
- exact event/context
- exact player relation
- why it is legal/illegal
- expected `legalPlays`

This step must expose any current Step-20 legality bug before new content is imported.

## Tests

Add tests for the source validator itself:
- wrong deck total
- missing mechanic
- missing translation
- Sometimes without trigger
- duplicate key
- unknown engine requirement

Run:
```bash
npm run typecheck
npm run lint
npm test
npm run test:coverage
npm run build
npm run test:e2e
npm run content:verify:rdi1-source
```

Stop. Do not implement Step 21B.

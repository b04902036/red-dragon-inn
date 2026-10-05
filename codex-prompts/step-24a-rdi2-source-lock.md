# Step 24A — RDI2 item-by-item source verification and source lock

## Critical rule

The user explicitly requires **zero guessing**.

Do not assume a row is correct because:
- totals add to 40,
- another character has the same mechanic,
- RDI1 implemented something similar,
- a community page says so,
- the candidate JSON says so.

Every character mechanic row and every Drink record must be verified **individually**.

If evidence is insufficient or conflicting, STOP and report the exact unresolved item. Never fill a gap by inference.

## Inputs

Read:

```text
content-private/imports/rdi2/source-candidate.json
content-private/imports/rdi2/verification-ledger.json
reference/rdi2/rdi2-card-matrix.md
reference/rdi2/rdi2-mechanics-matrix.csv
reference/rdi2/source-evidence.md
reference/rdi2/known-overrides.md
reference/rdi2/the-inn-crosscheck.json
reference/rdi2/verification-checklist.md
reference/rdi2/required-engine-capabilities.json
```

Also inspect the current repository, which has completed the RDI1 Step 22 release audit.

## Goal

Produce a source-locked RDI2 mechanics package for:

- Dimli the Dwarf — 40
- Eve the Illusionist — 40
- Fleck the Bard — 40
- Gog the Half-Ogre — 40
- RDI2 Drink Deck — 30

No implementation yet.

## Authority order

1. Current official SlugFest RDI2 rules / official errata / official later rules.
2. User-provided `the-inn` cross-check for Dimli/Eve/Fleck, reconciled with #1.
3. Complete community mechanic/quantity matrix for completeness.
4. BGG only as secondary catalog evidence.

Newer official errata always beats older data.

## Required one-by-one workflow

For EACH `Mxx` mechanic ledger entry:

1. Verify the physical quantity for each character.
2. Verify card type:
   - Action
   - Sometimes
   - Anytime
   - Gambling
   - Cheating
3. Verify every numeric value.
4. Verify target restrictions.
5. Verify precise legal timing.
6. For Sometimes:
   - exact trigger context
   - affected-player relation
   - source category/type
   - exclusions
7. Verify special restrictions and current errata.
8. Record evidence identifiers/URLs in the ledger.
9. Set `status=VERIFIED` only after all checks pass.

For EACH `Dxx` Drink ledger entry:

1. Verify quantity.
2. Verify **Drink vs Drink Event** classification.
3. Verify Alcohol/Fortitude/Gold/card effects.
4. Verify Chaser behavior.
5. Verify trait replacement.
6. Verify current-edition special behavior.
7. Record evidence and set VERIFIED only when complete.

Do not bulk-edit statuses.

## Mandatory current-edition checks

### Eve

Apply current official Eve updates:
- broad defensive illusion is Fortitude / Alcohol / Gold
- direct Alcohol attack is +2
- fire attack is 3 Fortitude loss

Reject stale source values.

### Illusionary Coin

Confirm and encode:
- prevents the current qualifying Gold loss
- no Gold moves
- if it prevents an ante, that ante still counts as having been made

### Mead

Use current Ninth Edition semantics:
- 3 Alcohol
- built-in optional split
- round halves up
- two halves independent
- cannot split when Mead is a Chaser or the result of a Drink Event
- another split-card cannot split Mead

### Redirect

Preserve original source. Redirect only Fortitude loss. Multiple redirects apply once each in order.

### Fine Ambrosia — HARD BLOCKER

The provided sources conflict:
- detailed legacy mechanical table: normal Drink, +1 Alcohol, +4 Fortitude, pay 2 Gold
- BGG catalog: labels it Drink Event

Do not choose based on intuition, list order, or majority vote.

Before locking the source, obtain **primary/current evidence**, such as:
- a clear current-edition card image from an authoritative source, or
- a user-provided scan/photo of the current card, or
- another direct official source that explicitly identifies its type and effect.

If primary evidence cannot be obtained:
- leave ledger item unresolved
- DO NOT create a source lock
- STOP and ask the user for the card image/evidence

### The Challenge

Cross-check the legacy mechanical description with later official examples.
Lock the exact:
- optional accept/decline behavior
- two-Drink reveal procedure
- Drink Event skipping behavior while finding the Drinks
- Chaser handling
- survival timing
- Gold payout timing

## Gog

The uploaded `the-inn` repo contains no Gog deck.

Therefore every Gog row requires explicit cross-check. At minimum use:
- complete 40-card mechanic matrix
- official RDI2 Ninth Edition examples for shared rules/card families
- official Gog page / official examples for Gog-specific mechanics

Do not infer an unverified Gog effect from another character merely because the matrix row is similar.

## Outputs

Only after **all entries** are verified:

```text
content-private/imports/rdi2/source-normalized.json
content-private/imports/rdi2/source-lock.json
docs/rdi2-source-verification-report.md
```

`source-lock.json` must include:
- SHA-256 of `source-normalized.json`
- date
- source/version identifiers
- exactly 44 verified mechanic rows
- 160 character physical cards
- 30 Drink physical cards
- unresolved count = 0

Add:

```bash
npm run content:verify:rdi2-source
```

Verifier must fail if:
- a ledger item is not VERIFIED
- unresolved conflicts > 0
- any deck != 40
- character total != 160
- Drink total != 30
- unknown/TODO/ASSUMED/GUESSED marker exists
- Sometimes lacks structured trigger
- en-US or zh-TW presentation is missing
- source hash differs from lock

## Tests

Add validator regression tests for:
- wrong quantity
- wrong card type
- stale Eve value
- missing trigger
- unresolved source conflict
- unverified ledger item
- duplicate mechanic ID
- missing translation
- source lock hash mismatch
- fake total that still adds to 40 but has wrong row distribution

## Verification

Run:

```bash
npm run content:verify:rdi2-source
npm run typecheck
npm run lint
npm test
npm run test:coverage
npm run build
npm run test:e2e
```

If Fine Ambrosia or any other item remains unresolved, the first command MUST fail and this step MUST stop.

Do not begin Step 24B until every source item is VERIFIED.

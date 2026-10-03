# Step 22 — RDI1 formal-play release audit

## Goal
Audit the RDI1-only milestone. No RDI2 work.

## Hard release gates

Must all be true:
- 4/4 RDI1 characters
- 160/160 character physical cards
- 30/30 Drink cards
- all character decks exactly 40
- unknown effect = 0
- unknown mechanic = 0
- unsupported card = 0
- Sometimes missing trigger = 0
- missing required en-US = 0
- missing required zh-TW = 0
- sample content in production RDI1 path = 0

## Timing audit
Verify:
- source actor/revealer begins response order
- only actually legal Sometimes get prompt/highlight
- all legal Sometimes get 30 seconds
- no legal Sometimes => no fake wait
- card play re-evaluates trigger legality
- fresh prompt gets fresh 30 seconds
- all core phase ends preserve 15-second Anytime grace
- Anytime works in gambling
- post-resolution hit-back timing is sequential, not a response to the pending damage
- elimination waits for legal last-chance windows

## Static audits
Search production code/content for:
- `sampleContentPack`
- `/api/content/sample`
- card-title checks in engine legality
- `if (name === ...)`
- no-op fallback
- unvalidated custom effects
- client-authoritative timers
- client-authoritative legal plays
- original third-party card art
- large copied original card-text blocks

## Test commands
```bash
npm run content:verify:rdi1-source
npm run content:verify:rdi1
npm run content:verify:zh-TW
npm run typecheck
npm run lint
npm test
npm run test:coverage
npm run build
npm run test:e2e
```

## Status document
Create:
```text
docs/rdi1-release-status.md
```

Include:
- card/deck counts
- unique definitions
- mechanic families
- timing coverage
- audio coverage
- highlight coverage
- bilingual coverage
- test results
- known non-RDI1 limitations
- distribution/IP note

Do not mark RDI1 formally playable unless every hard gate passes.

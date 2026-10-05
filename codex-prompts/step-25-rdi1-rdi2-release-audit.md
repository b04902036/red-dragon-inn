# Step 25 — RDI1 + RDI2 release audit

## Goal

Release-gate the eight-character milestone. Do not add RDI3+.

## Hard content gates

RDI1:
- Deirdre 40
- Fiona 40
- Gerki 40
- Zot 40
- Drink 30

RDI2:
- Dimli 40
- Eve 40
- Fleck 40
- Gog 40
- Drink 30

Combined:
- playable characters = 8/8
- character physical cards = 320/320
- Drink cards = 60/60 source total
- source conflicts = 0
- unknown mechanics = 0
- unknown effects = 0
- unsupported cards = 0
- Sometimes without structured trigger = 0
- missing en-US = 0
- missing zh-TW = 0
- sample production records = 0

## Source-integrity audit

Re-run source-lock verification.

Specifically re-check:
- Eve official errata
- Illusionary Coin
- Dimli restart
- Mead Ninth Edition
- redirect provenance
- Fine Ambrosia source-lock evidence
- The Challenge source-lock evidence

The audit must not simply trust the Step 24A report; it must re-validate lock hashes and hard counts.

## Timing release gates

Must preserve user's chosen behavior:
- Sometimes only => 30s + voice
- Anytime only => 30s + no Sometimes voice
- both => 30s + voice
- neither => immediate continuation
- each core phase end => 15s Anytime grace
- card play => old prompt invalid + fresh legality/timer

## Static audit

Search for:
- character/card-name checks in generic engine
- client-authoritative legality
- client-authoritative timers
- no-op fallbacks
- unknown handlers
- sample fallback in production
- stale Eve values
- old Mead behavior
- unresolved verification marker
- `.skip` / `.only`

## Full commands

```bash
npm run content:verify:rdi1
npm run content:verify:rdi2-source
npm run content:verify:rdi2
npm run content:verify:rdi1-rdi2
npm run content:verify:zh-TW
npm run typecheck
npm run lint
npm test
npm run test:coverage
npm run build
npm run test:e2e
```

## Final report

Create:

```text
docs/rdi1-rdi2-release-status.md
```

Include:
- source-lock hashes
- every source-conflict resolution with evidence
- character/deck counts
- unique definitions
- unsupported = 0
- timing/audio/highlight coverage
- localization coverage
- test counts/results
- coverage results
- replay/reconnect/security results
- remaining non-RDI1/RDI2 limitations

Do not declare release-ready if any source item is unresolved or any command fails.

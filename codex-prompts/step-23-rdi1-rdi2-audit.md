# Step 23 — RDI 1 + RDI 2 production audit

## Goal

Release-gate the first real content milestone.

Do not add RDI3+.

## Required production scope

Characters:
1. Deirdre
2. Fiona
3. Gerki
4. Zot
5. Gog
6. Fleck
7. Eve
8. Dimli

Required physical counts:
- 8 x 40 = 320 character cards
- RDI1 Drink deck = 30
- RDI2 Drink deck = 30

All effects must be supported.

## Timing audit

Verify against official timing behavior:

- source actor/revealer begins Sometimes response order
- only relevant Sometimes are legal
- Anytime remains usable at legal times
- nested responses resolve child-first
- after a response resolves, original source is re-evaluated
- pass consensus resets
- timers reset after card play
- 30-second response prompt
- 15-second phase-end Anytime prompt
- auto-pass on expiry
- last-chance elimination timing

No client-only legality.

## Highlight audit

For every state transition:
- private legal plays update
- legal cards highlight
- illegal cards do not
- target lists are server-authorized
- no hidden-hand/legal-play leakage

## Audio audit

Use the supplied voice WAVs if present:

```text
public/audio/voice/en-US/sometimes-response.mp3
```

Verify:
- one play per new eligible Sometimes prompt
- no replay on rerender/reconnect same prompt
- replay after a genuinely new prompt
- existing turn chime remains independent

## Content audit

Run a generated matrix:

```text
character
card definition
quantity
type
trigger status
effect implementation
target implementation
en-US status
zh-TW status
tests covering mechanic
```

Fail if any official RDI1/RDI2 card is:
- missing
- quantity-mismatched
- triggerless when Sometimes
- unsupported
- no-op
- using unknown effect key
- lacking required translation

## Full E2E scenario

Automate a long multi-browser match scenario that includes:

1. mixed RDI1/RDI2 lobby
2. combined Bar Deck
3. discard/draw
4. Action
5. Sometimes trigger
6. 30s window / shortened test clock
7. nested response
8. response resets timer
9. phase-end Anytime
10. 15s window
11. Anytime play resets timer
12. legal highlight updates
13. gambling
14. cheating/restriction interaction
15. Drink
16. Chaser
17. multi-player Drink/Event behavior
18. player enters losing condition
19. last-chance response
20. elimination or save
21. reconnect during timed prompt
22. zh-TW and en-US clients together
23. match finish
24. persistence
25. deterministic replay equality

## Static audit

Search production runtime for:
- sample card IDs/prefixes
- client-only real-card legality
- card-name-specific timing hacks
- `Date.now()` in deterministic engine modules
- browser-only authoritative timers
- stale `/api/content/sample`
- direct hidden legal-card exposure
- unknown effect fallbacks
- `.skip` / `.only`

## Required commands

```bash
npm run typecheck
npm run lint
npm test
npm run test:coverage
npm run build
npm run test:e2e
npm run content:verify:production
npm run content:verify:zh-TW
```

Add a dedicated command if helpful:

```bash
npm run content:verify:rdi1-rdi2
```

It must exit zero only when all eight decks and both Drink decks are complete.

## Final report

Create:

```text
docs/rdi1-rdi2-status.md
```

Include:
- 8/8 character status
- 320/320 character physical card count
- 30/30 + 30/30 Drink status
- unique definition count
- Sometimes trigger coverage
- unsupported mechanics = 0
- en-US completeness
- zh-TW completeness
- timer tests
- audio tests
- highlight tests
- coverage
- E2E results
- deploy readiness

Do not declare release-ready while any required official card is missing or unsupported.

Stop after Step 23.

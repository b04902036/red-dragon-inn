# Step 12 — Full MVP audit and release gate

## Goal

Audit the whole implementation instead of adding new features.

Do not add DLC/complex character mechanics in this step unless required to fix an MVP defect.

## Required user journey

Using only repository-safe sample content, prove:

1. Player A creates a room.
2. Player B joins through room code/invite link.
3. Both select sample characters.
4. Match starts.
5. Initial hands/stats/drinks are correct.
6. Opponents cannot inspect each other's hidden cards.
7. Player takes a normal turn.
8. A card opens a response window.
9. Another player responds or passes.
10. Nested resolution completes correctly.
11. A gambling round starts and completes.
12. Drinks resolve, including at least one Chaser.
13. A Drink Event resolves.
14. One client reloads/disconnects and reconnects.
15. Match proceeds.
16. A player is eliminated.
17. Winner is declared.
18. Match result is persisted.
19. Replay reaches the same final authoritative state.

## Audit categories

### Architecture
- React has no authoritative rule logic.
- Durable Object owns room state.
- D1 is persistent content/history store.
- Engine is independent/testable.
- No Redis/VPS/public IP dependency.

### Rules engine
- deterministic
- phase-safe
- response stack
- gambling
- drinks
- elimination
- hidden info

### Data/content
- content version pinned
- sample content usable
- private import pipeline works
- no copyrighted private pack committed

### Realtime
- hibernation-compatible Durable Object WebSockets
- stale version handling
- duplicate command handling
- reconnect/resync

### UX
- desktop
- mobile viewport
- response UX
- gambling UX
- reconnect UX
- accessible essential controls

### Security
- seat authorization
- schema validation
- no client authority
- no hidden data leakage

## Tests — mandatory

Run the complete suite:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Also run any dedicated:
- migration tests
- replay tests
- integration tests
- security tests

If coverage tooling exists, generate a report and inspect uncovered core-rule branches.
Add missing behavioral tests where important branches are uncovered.

## Manual code review

Inspect:
- TODO/FIXME
- `any`
- `Math.random`
- direct D1 calls from wrong layers
- client-side mutations pretending to be authoritative
- raw WebSocket messages without schema validation
- leaked hidden state
- secrets
- copyrighted private content
- debug routes
- dead code
- ignored failing tests
- `.skip` / `.only`

Any intentional remaining TODO must be documented as post-MVP.

## Final documents

Update:
- README
- architecture
- protocol
- database
- timing engine
- deployment
- content import

Create `docs/mvp-status.md` with:
- implemented scope
- known limitations
- test commands/results
- supported sample mechanics
- next recommended development order for real character content

## Completion rule

Do not say the MVP is complete if any required test fails or any critical hidden-information/server-authority issue remains.

End with a concise release-readiness report and stop.

# Step 20 — Server-authoritative legal plays and playable-card highlighting

## Goal

Make it immediately obvious which cards the local player can legally play.

Do not derive real-card legality from client heuristics.

## Current issue

`src/client/game-actions.ts` currently infers playable cards from:
- card type
- response window presence
- some Ignore targeting logic
- gambling categories

This is insufficient for RDI 1/2 Sometimes triggers.

## Private legal-play projection

Add a private server-computed legal-play structure.

Example:

```ts
legalPlays: [
  {
    cardId,
    commandType,
    requiresTarget,
    legalTargetPlayerIds?,
    promptId?,
    reasonKey?
  }
]
```

Exact shape may differ.

Requirements:
- private only
- computed from the SAME legality functions used by command validation
- never expose another player's legal cards
- updated after every accepted command, timeout, nested resolution, phase transition, and reconnect

Do not trust a legal-play list sent back by the client.

## Highlight behavior

In the hand:
- every currently playable card receives a strong, unmistakable highlight
- non-playable cards remain normal
- selected-discard styling must remain visually distinct from playable styling
- if a card is both selectable-for-discard and playable as an Anytime, represent both states without ambiguity
- do not rely on color alone
- include a visible icon/badge/text cue such as localized `可出牌 / Playable`
- support reduced motion

Recommended semantic markers:

```text
data-playable="true"
aria-description / localized accessible text
```

Do not make highlighting itself authoritative.

## Card controls

Only show/enable a Play/Respond/Gambling button when the corresponding `legalPlay` exists.

Targets:
- if one legal target, allow direct play if UX prefers
- if multiple legal targets, open target selection containing only server-authorized targets

Do not show every living opponent and wait for the server to reject invalid targets.

## Timed prompts

During a 30s Sometimes prompt:
- highlight only cards legal for the current prompt
- display remaining time
- Pass button remains obvious

During 15s phase-end Anytime:
- highlight legal Anytime cards
- display remaining time
- Pass button remains obvious

When timer/prompt resets:
- stale highlight disappears immediately
- newly legal cards highlight

## Hover/preview interaction

Keep Step 16 behavior:
- hover/focus previews card
- whole-card discard toggle works in discard-selection mode
- embedded Play/Respond buttons do not toggle selection

Highlighting must not break those interactions.

## Tests — mandatory

1. normal Action card highlighted only for active player in ACTION phase
2. another player's Action card not highlighted
3. legal Anytime highlighted outside a response where allowed
4. legal Sometimes highlighted only when trigger matches
5. unrelated Sometimes not highlighted
6. legal response changes after nested card resolution
7. stale legal card unhighlights after prompt reset
8. newly legal card highlights after re-evaluation
9. gambling legal categories highlight correctly
10. Winning-Hand-like category restriction reflects server legality
11. target-restricted card exposes only valid targets
12. private legal plays never appear in public view
13. player B never receives player A legal-card IDs
14. reconnect restores the same current legal highlights
15. expired prompt removes old legal plays
16. playable badge localized en-US
17. playable badge localized zh-TW
18. discard selected styling remains distinguishable
19. keyboard user can discover and activate a playable card
20. action button cannot bypass server validation

### E2E

21. active Action card visibly marked playable
22. advance phase => highlight updates
23. create Sometimes trigger => correct card becomes playable
24. pass/timeout => highlight disappears
25. play nested response => legality/highlight recomputed
26. phase-end Anytime holder sees highlight, non-holder does not
27. no hidden legality leakage between browser contexts

## Refactor

Retire or reduce `cardAction(...)` to presentation-only behavior.
It must not be the source of truth for legality.

Document in `docs/game-ui.md` and `docs/protocol.md`.

Stop after Step 20.

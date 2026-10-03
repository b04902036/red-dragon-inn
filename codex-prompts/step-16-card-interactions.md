# Step 16 — Card selection by whole-card click and automatic hover details

## Goal

Replace the current awkward card-selection and card-detail interactions while preserving play buttons, keyboard accessibility, mobile behavior, and engine semantics.

## Current implementation to replace

In `src/client/GameTable.tsx`:
- discard selection currently uses a checkbox inside each `.hand-card`
- card detail currently requires a `Read <card>` button
- `inspect` opens a blocking `Modal`

The user's required behavior:

1. In a card-selection mode, clicking/tapping **anywhere on the card body** toggles selected/unselected.
2. On desktop, moving the mouse over a card automatically shows card details.

Do not change gameplay rules.

## Selection interaction

When discard/card choice selection is active:
- the whole eligible card is a toggle target
- clicking once selects
- clicking again deselects
- selected styling remains obvious
- preserve min/max selection limits
- ineligible cards must not become selected
- disabled/busy state must block toggling

Use appropriate semantics:
- `role="checkbox"` + `aria-checked`, or a real input visually integrated with the whole card
- card must be keyboard focusable
- Space should toggle selection
- Enter behavior should be intentional and documented

### Event bubbling

Embedded controls such as:
- Play
- Respond
- Gambling control
- other future card action buttons

must NOT accidentally toggle discard selection.

Use explicit event handling/propagation boundaries.

Do not place an interactive `<button>` inside another `<button>`.

## ChoicePicker consistency

`ChoicePicker` currently uses checkbox labels.

For card-choice prompts:
- if options correspond to cards and enough metadata exists, use the same whole-card selection interaction
- for non-card target/option choices, keep accessible list/button controls
- preserve max-selection enforcement

Do not invent card data that the protocol does not provide. Extend the private choice presentation only if needed and safe.

## Hover/focus card detail

Remove the need for the `Read <card>` button on desktop.

Do NOT open a modal directly on pointer enter; that can move the pointer off the card and flicker.

Implement a non-blocking preview surface such as:
- fixed/anchored side panel
- floating popover positioned away from the pointer
- expanded preview region above the hand

Behavior:
- `pointerenter`/mouse hover shows the card
- `pointerleave` clears after a very short optional grace period only if needed
- keyboard focus also shows details
- moving directly from one card to another updates preview
- no click required on desktop
- preview includes:
  - localized card name
  - localized card type
  - localized rules/presentation text
  - optional canonical English name in debug/help mode, not mandatory

## Touch/mobile behavior

Touch devices have no hover.

Keep an accessible inspection path that does not conflict with selection:
- long-press, or
- focus/details control exposed only for touch/small viewport, or
- a non-blocking "details" affordance

Do not require hover on mobile.

If tapping a card is currently needed to toggle selection, do not overload the same single tap to both select and open a modal.

## Visual behavior

- selected card should visibly lift/highlight/checkmark
- hover preview should not obscure the active card row unnecessarily
- selection styling and hover styling must be distinguishable
- support reduced motion
- do not rely on color alone

## Refactor recommendation

Extract reusable components/hooks instead of making `GameTable.tsx` larger:

```text
src/client/cards/
  HandCard.tsx
  CardPreview.tsx
  useCardSelection.ts
```

Exact names may differ.

## Tests — mandatory

Component tests:
1. clicking card body selects it in discard mode
2. clicking same card body deselects
3. clicking card title/text also toggles
4. selection is blocked while busy
5. max-selection limit is enforced
6. ineligible card does not toggle
7. Play button click does not toggle selection
8. Respond button click does not toggle selection
9. keyboard Space toggles
10. `aria-checked` matches visual state
11. hover shows card preview
12. pointer leave hides/updates preview correctly
13. keyboard focus shows preview
14. preview changes when hovering a second card
15. old `Read <card>` button is absent on desktop UI
16. localized details render in zh-TW
17. mobile/touch inspection path works
18. reduced-motion mode does not rely on animation

Playwright:
19. discard two cards by clicking card surfaces, then submit
20. deselect one by clicking it again
21. hover a card and assert detail text appears without clicking Read
22. move hover between two cards and assert preview changes
23. press Play on a playable card and verify no accidental discard-selection toggle
24. keyboard-only select/deselect
25. mobile viewport can inspect and select without hover
26. no console errors during these interactions

Update existing E2E tests that currently use:
- `Read Sample Friendly Shove`
- checkbox selectors like `Discard Sample ...`

Do not weaken those tests; replace them with user-level interactions.

Run all standard checks.

Do not begin Step 17.

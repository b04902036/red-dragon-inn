# Step 08 — Playable responsive game-table UI

## Goal

Build the actual browser game screen against the realtime protocol.

The UI must be useful on desktop and mobile/tablet.

## Screens

### Landing
- create room
- join room by code/link

### Lobby
- room code
- copy invite link
- connected players
- seat state
- character/sample-character selection
- host/start control if applicable

### Game table — desktop

Recommended layout:
- center:
  - Inn Drink deck
  - Drink discard
  - gambling pot
  - currently resolving card/effect
- other players:
  - around top/left/right
  - character
  - Fortitude
  - Alcohol
  - Gold
  - hand count
  - Drink Me! count
  - public special resource
- current player:
  - hand fixed at bottom
  - own stats
  - own special resources
- right rail:
  - phase
  - active player
  - contextual buttons
  - compact event log
- overlays:
  - target picker
  - choice picker
  - response window
  - gambling interaction
  - reconnect/resync status

### Mobile

- opponent carousel
- swipeable/scrollable hand row
- fixed contextual action area
- compact stack/response display
- no critical action available only through hover

## Card interaction

Prefer click/tap-first interactions.
Drag-and-drop may be optional enhancement, never required for mobile.

The client must derive available UI actions from server-authorized/validated view hints or local presentation rules, but server remains final authority.

## Realtime UX

Show:
- reconnecting
- synced
- stale/resync
- waiting for another player's response
- command rejected reason if safe/user-actionable

Avoid optimistic mutation of hidden or critical game state unless explicitly reconciled.

## Accessibility

At minimum:
- keyboard reachable controls
- visible focus
- semantic buttons
- readable stat labels
- card text dialog/expanded view
- no color-only indication for Fortitude/Alcohol/phase
- reasonable mobile touch targets

## Assets

Use placeholder/original generic art.
Do not add copyrighted RDI art automatically.

## Tests — mandatory

### Component/logic tests
Test:
1. own hand rendered from private projection
2. opponent hand only as count/back representation
3. phase indicator
4. active player indicator
5. legal command button generation
6. response window UI
7. gambling UI
8. reconnect status
9. eliminated player state

### Playwright E2E
At minimum:
1. create room
2. second browser context joins by invite URL/code
3. lobby shows both
4. start sample match
5. each player sees only own hand
6. one player discards/draws
7. play action and respond/pass
8. order/take a drink
9. enter and finish a gambling round
10. refresh one player and reconnect
11. responsive mobile viewport can perform a turn
12. no browser console errors in happy path

Use two or more browser contexts for multiplayer scenarios.

Run standard verification.

Stop after this step.

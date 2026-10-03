# Step 15 — Tavern background music and turn-attention chime

## Goal

Add polished audio without compromising browser compatibility, reconnect correctness, accessibility, or tests.

Read `reference/audio-assets.md` first.

## Selected asset direction

Preferred background:
- `Medieval: The Old Tower Inn`
- RandomMind
- OpenGameArt
- CC0
- use the provided loop version if available

Preferred turn sound:
- `wind chimes - single 01.wav`
- Anthousai
- Freesound
- CC0
- single clear wind-chime tube hit

If those exact files are not present locally, do not silently download a different-license substitute.
Implement the asset paths and document the manual placement/download step.

Target paths:

```text
public/audio/bgm/the-old-tower-inn.*
public/audio/sfx/turn-chime.*
public/audio/LICENSES.md
```

Do not hotlink audio at runtime.

## Audio service

Create a dedicated client audio layer, for example:

```text
src/client/audio/
  AudioProvider.tsx
  audio-engine.ts
  use-attention-chime.ts
  settings.ts
```

Do not scatter `new Audio()` calls throughout UI components.

Requirements:
- BGM loop
- separate BGM volume
- separate SFX volume
- music mute
- SFX mute
- master enable/disable if useful
- settings persisted in localStorage
- sensible defaults
- pause/cleanup when app unmounts

## Browser autoplay policy

Browsers may block audio until a user gesture.

Implement:
- audio starts/unlocks only after an intentional user gesture
- creating/joining a room or pressing an explicit sound button may unlock audio
- failure to autoplay must not break gameplay
- show a small non-blocking "Enable sound" control if audio remains locked
- never spam playback retries

## When the chime plays

The requirement is to alert a player when it becomes **their opportunity to act**.

Do not simply play whenever React renders or whenever `view.version` changes.

Derive or add a stable authoritative `attentionKey` / `actionPromptId`.

It must distinguish:
- active player's actionable turn/phase
- response priority
- mandatory choice ownership
- gambling priority

A client should play the chime exactly once when:
- attention target becomes the local player for a new actionable prompt,
- audio is unlocked,
- SFX is enabled.

Do NOT replay merely because:
- private state arrived after public state
- a component rerendered
- the same snapshot was resent
- reconnect restored the same pending prompt
- a stale command caused resync
- locale changed

If the local player receives a genuinely new consecutive prompt while still being the attention target, the new `attentionKey` must permit a new chime.

## BGM behavior

- background music starts only after audio unlock
- loops seamlessly if using a loop asset
- does not restart on normal React rerender or WebSocket resync
- may continue across landing/lobby/game or begin on room entry; choose one and document it
- pause or reduce behavior when document is hidden only if implemented consistently
- no overlapping duplicate BGM elements

## UI

Add compact settings:
- music toggle
- music volume
- SFX toggle
- SFX volume

Do not dominate the game table.

Accessible labels must work in en-US and zh-TW.

## Licensing

Create `public/audio/LICENSES.md` containing:
- asset title
- author
- source page
- license
- local filename
- whether attribution is required
- retrieval date

Even for CC0, keep provenance.

## Tests — mandatory

Unit/component tests:
1. audio settings default correctly
2. settings persist
3. BGM and SFX volume are independent
4. mute prevents playback
5. autoplay rejection does not crash
6. unlock occurs only after user gesture
7. BGM starts once after unlock
8. BGM does not duplicate on rerender
9. new local actionable prompt plays one chime
10. remote player's prompt does not play local chime
11. same attentionKey never double-plays
12. new attentionKey for same player plays again
13. reconnect to the same pending attentionKey does not replay
14. response priority triggers local chime
15. mandatory choice triggers local chime
16. gambling priority triggers local chime
17. locale change does not retrigger audio
18. audio control labels are localized

Playwright:
19. user gesture unlocks audio path
20. simulated/mocked audio play is invoked when a second player causes the host's new action prompt
21. refresh/reconnect does not cause duplicate turn sound
22. game remains fully usable with audio disabled

Do not depend on actually hearing sound in CI. Mock/spy the playback boundary.

Run all standard checks.

Do not begin Step 16.

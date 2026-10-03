# Reaction voice lines

Use the existing user-supplied English MP3. This voice is shared by both UI locales; do not generate another voice or convert it to WAV.

## English

Filename:

```text
public/audio/voice/en-US/sometimes-response.mp3
```

Exact spoken line:

> Hold it! You can respond. Play a card or pass.

Recommended delivery:

- medieval tavern keeper / innkeeper
- clear rather than dramatic
- about 2–3 seconds
- one-shot, no music underneath

## Traditional Chinese UI

The `zh-TW` UI uses the same English MP3 under `public/audio/voice/en-US/`. No `zh-TW` voice directory or localized voice file is required. Changing the UI language must not replay the same prompt.

## Playback rule

This voice is NOT a generic turn sound.

Play it only when:

- the local player receives a new response prompt, AND
- at least one legally playable `Sometimes` card exists for that player.

Do not play it when:

- only an Anytime card is legal
- another player is responding
- React rerenders
- the same prompt is resent
- reconnect restores the same prompt ID

If a card is played and the original event becomes respondable again, the engine creates a new prompt ID; the voice may then play again if a legal Sometimes card exists.

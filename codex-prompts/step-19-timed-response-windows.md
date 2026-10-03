# Step 19 — 30-second Sometimes prompts and 15-second Anytime phase-end windows

## Goal

Add server-authoritative timing.

Requirements from the user:

- When a player has a legally-triggered Sometimes opportunity:
  - play the reaction voice locally
  - give that player 30 seconds to play a legal response or pass
  - timeout means automatic pass
- Before every core turn phase ends:
  - provide an Anytime opportunity
  - each player who actually has a legal Anytime card gets up to 15 seconds
  - timeout means automatic pass
- Whenever anyone plays a card during one of these windows:
  - resolve/re-evaluate
  - discard the old pass consensus
  - create a fresh prompt
  - restart the appropriate timer

Read `reference/reaction-audio.md`.

## Server authority

Do NOT implement game deadlines only with browser `setTimeout`.

The Durable Object owns deadlines.

Use Durable Object alarms or an equally reliable server mechanism.

Store enough state to survive:
- hibernation
- restart
- reconnect

Every timed prompt needs a unique immutable identity such as:

```text
promptId
kind
window/source ID
priorityPlayerId
openedAt
deadlineAt
```

The browser countdown is derived from `deadlineAt`.

## 30-second response prompt

When Step 18 determines that a player has one or more legal responses:

```text
RESPONSE_DECISION
deadline = now + 30 seconds
```

Behavior:
- `PASS_RESPONSE` before deadline => pass
- legal `PLAY_RESPONSE` before deadline => play
- deadline => server performs automatic pass
- command arriving after deadline must not beat an already-fired authoritative timeout
- use monotonic prompt identity/version checks to avoid stale timers affecting a new prompt

If a player has no legal response, auto-skip without starting 30 seconds.

### Voice

Private view should tell the local client whether the current prompt includes at least one legal Sometimes card.

Example private presentation field:

```text
responsePrompt:
  promptId
  deadlineAt
  hasLegalSometimes
```

When a NEW `promptId` targets the local player and `hasLegalSometimes == true`:
- play `/audio/voice/en-US/sometimes-response.mp3` once
- use this existing English MP3 for both `en-US` and `zh-TW` UI locales
- no Traditional Chinese voice asset or WAV conversion is required

Do not play the voice when only Anytime is legal.

Existing turn chime may remain separate.

## 15-second Anytime phase-end window

All four core phases need an explicit end grace:

```text
DISCARD_DRAW
ACTION
ORDER_DRINK
DRINK
```

Important official behavior:
- Discard/Draw's special action must complete before the end grace.
- Action card fully resolves before its phase-end grace.
- Ordering a Drink completes before its phase-end grace.
- Drink and all Chasers/events/responses fully resolve before the Drink phase-end grace.

The phase must not transition instantly anymore.

Introduce an explicit internal phase completion state / phase-end window.

### Eligibility

For phase-end Anytime:
- determine private legal Anytime cards per player
- players with none are auto-skipped
- eligible players receive priority in turn order beginning with the active player
- each eligible player gets 15 seconds to play an Anytime or pass
- do not leak who holds Anytime cards beyond the currently visible priority behavior

If nobody has a legal Anytime card, phase transition may happen immediately.

### Reset rule

If ANY card is played:
- resolve that card and all nested Sometimes/Anytime responses
- recompute legal responses
- once resolution is clear, rebuild the original phase-end Anytime opportunity
- restart at the phase-end timing origin
- issue new prompt IDs and fresh 15-second deadlines

This explicitly satisfies the user's "someone played a card -> re-check and reset timer" requirement.

## Elimination interaction

This is critical.

If a player reaches an apparent losing condition:
- finish pending resolutions first
- allow relevant Sometimes opportunities
- allow the guaranteed phase-end Anytime opportunity where applicable
- only then finalize elimination

Do not eliminate a player before their legal last-chance reactions can occur.

## Commands

Avoid overloading old commands ambiguously.

Add explicit commands/events if needed, e.g.:

```text
PASS_RESPONSE
PASS_ANYTIME
PHASE_ACTION_COMPLETE
TIMED_PROMPT_OPENED
TIMED_PROMPT_EXPIRED
PHASE_END_WINDOW_OPENED
PHASE_END_WINDOW_CLOSED
```

Automatic timeout actions are server/system actions, not forged player commands.

Replay/event logs must record timeout outcomes deterministically.

## Clock/testability

Inject a clock abstraction.

Do not scatter `Date.now()` through engine logic.

Tests must use fake time / controlled Durable Object alarms.

Replay semantics should record accepted timeout events rather than depend on the wall clock during replay.

## Tests — mandatory

### Engine/runtime

1. legal Sometimes prompt gets 30s deadline
2. no legal Sometimes => no unnecessary 30s wait
3. manual pass closes/advances prompt
4. legal response before timeout accepted
5. timeout auto-passes
6. stale timeout cannot pass a newer prompt
7. response at old prompt ID rejected after reset
8. child response resets parent evaluation
9. fresh parent prompt gets fresh 30s
10. all four core phases have phase-end Anytime handling
11. no Anytime holders => immediate phase transition
12. eligible Anytime holder gets 15s
13. phase-end pass advances correctly
14. phase-end timeout advances correctly
15. Anytime play restarts phase-end evaluation and 15s
16. nested Sometimes during an Anytime resets correctly
17. elimination waits until final legal reaction/grace windows complete
18. hibernation/reload preserves deadlineAt and prompt ID
19. reconnect does not extend an existing deadline
20. expired prompt reconnects as already passed/resolved
21. system timeout event is replayable/deterministic

### Audio/client

22. new local 30s prompt with legal Sometimes plays voice once
23. same prompt rerender does not replay
24. reconnect same prompt does not replay
25. new prompt after someone plays a card plays voice again
26. only-Anytime response opportunity does not play Sometimes voice
27. remote player's prompt does not play local voice
28. en-US uses the existing English MP3 path
29. zh-TW uses the same English MP3 path; locale changes do not replay a prompt
30. missing voice file does not break gameplay

### E2E

Use shortened configurable deadlines in E2E only.

31. Sometimes timer visibly counts down
32. timeout auto-passes and game continues
33. Anytime phase-end timer visibly counts down
34. playing a card resets visible countdown
35. two browser contexts remain synchronized through timeout

## Config

Production defaults:

```text
Sometimes decision: 30_000 ms
Phase-end Anytime: 15_000 ms
```

Tests may override through injected config.

Do not expose a client-side option to extend these timers.

## Verification

Run all normal checks plus timer/DO tests.

Stop after Step 19.

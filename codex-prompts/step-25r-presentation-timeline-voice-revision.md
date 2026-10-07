# Step 25R — Full Game Presentation, Timeline, Animation and ElevenLabs Voice Revision

Read `AGENTS.md` first.

This repository has completed RDI1/RDI2 implementation and Step 25 release audit is currently only partially complete.

PAUSE the existing Step 25 release audit.

Do NOT declare the repository release-ready yet.

Implement this revision first, then restart the full Step 25 release audit from the beginning.

Do not add RDI3+ content.

Do not modify verified RDI1/RDI2 gameplay rules or source-lock decisions unless a test proves an actual pre-existing gameplay bug.

This revision is presentation / protocol / UI / audio work.

---

# Primary Goals

Implement all of the following:

1. Full public game log containing every meaningful public action and causal effect.
2. Clear persistent player HUD for Fortitude, Alcohol, Gold, hand size and Drink Me! pile size.
3. Sequential presentation/animation showing exactly how each action evolves into the next.
4. Visible response chains such as:
   - A plays card
   - B Negates A
   - C Negates B
   - C resolves
   - B is canceled
   - A resolves
5. Drink chains and Drink Contest progression must be understandable step-by-step.
6. Every CHARACTER CARD played from a player's hand must speak its printed/canonical card title using that character's ElevenLabs voice.
7. Runtime gameplay must never call ElevenLabs.
8. Voice assets must be generated offline and bundled locally.
9. Reconnect/resync must rebuild the full log without replaying old animations or voices.
10. Animation must never prevent a player from responding to an active server timer.

---

# Existing Architecture — Preserve These Rules

The repository currently has:

- append-only `DomainEvent`s;
- deterministic replay sequence;
- `eventIndex`;
- `stateVersion`;
- server-authoritative rules;
- public/private projections;
- `PUBLIC_STATE`;
- `PRIVATE_STATE`;
- hidden-information protection;
- resolution stack;
- response windows;
- persisted D1 replay history;
- existing `AudioEngine`;
- music;
- attention chime;
- existing Sometimes response voice.

Important:

`src/protocol/presentation.ts`

already means STATIC CONTENT PRESENTATION:

- card names;
- character names;
- localized presentation;
- rules text.

Do NOT repurpose that type for game-history events.

Create a separate concept such as:

`PublicNarrationEvent`

or:

`PublicTimelineEvent`

Use consistent naming throughout the project.

---

# Critical Security Rule

Do NOT send raw `DomainEvent`s to clients.

Keep the existing architectural rule:

There is no raw DOMAIN_EVENT WebSocket message.

Internal events may contain:

- hidden card instance IDs;
- deck order;
- hidden hand identities;
- face-down Drink pile information;
- private card choices.

Those must remain server-only.

Create a server-side PUBLIC EVENT PROJECTOR which converts internal domain events into privacy-safe public narration events.

Add security tests proving hidden data never leaks.

---

# STEP 25R-01 — Public Narration Timeline

Implement a typed public event stream.

Suggested new file:

`src/protocol/public-narration.ts`

Do not use generic free-form log strings as the wire protocol.

Use a Zod discriminated union.

Each event should have stable ordering information such as:

- matchId;
- sequence;
- stateVersion;
- eventIndex;
- event type.

Use the persisted replay sequence as the primary global ordering mechanism where practical.

The public event IDs/order must be deterministic.

---

## Required Public Event Families

At minimum represent the following public concepts.

### Match / turn

- match started;
- turn started;
- phase changed;
- match finished;
- player eliminated.

### Hidden character-card draw

Publicly reveal ONLY:

- player;
- number of cards drawn.

Do NOT expose card identities.

Example public meaning:

`Alice drew 3 character cards.`

Never expose the internal `cardIds`.

### Character card play

Expose:

- player;
- cardDefinitionId;
- resolution identity;
- target player IDs where public;
- parent/source relationship where relevant.

The card definition is public once played.

Example:

`Alice played Tip the Wench targeting Bob.`

### Responses

Represent causal relationships explicitly.

Examples:

- RESPONSE_TO
- NEGATES
- IGNORES
- MODIFIES
- REDIRECTS

Do not force the client to infer these relationships from final state.

Example:

A plays Card A.

B plays Card B responding to A.

C plays Card C responding to B.

The public timeline must contain enough structured information for the UI to render:

A
↑ negated by
B
↑ negated by
C

### Resolution

Expose meaningful resolution transitions:

- resolution started where useful;
- resolution completed;
- source ignored;
- source negated;
- pending public effect modified.

Do not log internal engine noise that has no player-visible meaning.

### Drink ordering/dealing

For a face-down Drink being ordered:

Expose:

- who ordered;
- target player;
- count where applicable.

Do NOT expose the hidden Drink identity before it is revealed.

### Drink reveal

Once a Drink becomes public, expose:

- drinking/revealing player;
- cardDefinitionId;
- causal resolution/context;
- whether it is base Drink or Chaser when that is publicly knowable.

The timeline must allow:

`Drink Contest caused Bob to reveal Wine.`

followed by:

`Wine has a Chaser.`

followed by the revealed Chaser.

### Stats

Expose every actual public change:

- Fortitude;
- Alcohol Content;
- Gold;
- public special resource where appropriate.

Include:

- player;
- delta;
- resulting value;
- causal resolution where possible.

The client should be able to show:

`Bob Fortitude 18 → 16 (-2)`

and associate it with the card/effect that caused it.

### Gambling

Represent meaningful:

- gambling started;
- ante;
- control changed;
- player passed;
- player left;
- raise;
- winner;
- payout.

### Drinking Contest

This is mandatory.

The public timeline must contain enough information to reconstruct:

1. The Challenge/Drinking Contest begins.
2. Each player reveals a Drink.
3. Complete Chaser chain is shown.
4. Relevant Drink effects resolve.
5. Fortitude/Alcohol changes are shown.
6. Contest score for each participant is shown.
7. Highest score is computed.
8. If tied, identify the tied players.
9. State clearly that another contest round begins.
10. Show their new reveals.
11. Continue until one winner.
12. Show Gold payout.

Do not compress the contest into one final message.

---

# Public Projector

Create a pure/testable projector such as:

`projectPublicNarration(...)`

It may maintain projection context while processing a replay batch so that it can correlate:

- resolution IDs;
- parent resolutions;
- Drink card IDs internally;
- revealed Drink -> resolution;
- response relationships.

Internal card instance IDs may be used INSIDE the projector for correlation.

They must NOT appear in its public output unless they are already an explicitly approved public identifier.

Prefer exposing:

`cardDefinitionId`

instead of physical `cardInstanceId`.

---

# Hidden Information Tests

Mandatory tests must prove public narration never exposes:

- shuffled deck order;
- hidden hand card identities;
- other players' hand IDs;
- unrevealed Drink identities;
- Drink Me! pile contents;
- private selection card IDs;
- RNG seed;
- private pending choices.

Add a recursive security test that serializes public narration and verifies forbidden internal identifiers do not appear.

Do not rely only on TypeScript types for this test.

---

# STEP 25R-02 — WebSocket Delivery and Full History

Add a public narration server message.

Example concept:

`PUBLIC_TIMELINE`

Do NOT call it `DOMAIN_EVENT`.

A timeline batch should contain:

- match ID;
- first/last sequence;
- public narration events;
- delivery mode.

Delivery mode must distinguish:

`LIVE`

from:

`HISTORY`

or an equivalent design.

This distinction is critical.

---

# Live Events

After an accepted authoritative command is persisted successfully:

1. Domain events remain authoritative/persisted as today.
2. Project the new domain-event batch to privacy-safe narration.
3. Broadcast the public narration batch.
4. Broadcast authoritative state snapshots as required.

Maintain deterministic ordering.

Do not allow narration failures to mutate game state.

---

# Reconnect / Refresh

A reconnecting player must recover the FULL PUBLIC GAME LOG.

Do not only retain the most recent 10 entries.

Use persisted replay/event history.

The server already persists replay sequence and DomainEvents to D1.

Reuse that history.

Do not create a second independent authoritative event store.

The WebSocket/session layer should keep track of the last public timeline sequence delivered to that connection where practical.

On reconnect/resync:

- backfill missing public narration;
- mark it as HISTORY;
- deduplicate by sequence;
- then continue with LIVE events.

The client must never duplicate a log entry after:

- reconnect;
- VERSION_CONFLICT resync;
- duplicate accepted command;
- WebSocket reconnection;
- React rerender.

---

# Critical Backfill Rule

HISTORY events:

- DO populate the full log;
- DO reconstruct causal history;
- DO NOT trigger card voice;
- DO NOT replay animations;
- DO NOT replay attention sounds.

Otherwise refreshing the page would replay the entire match.

Add explicit regression tests.

---

# STEP 25R-03 — Replace Snapshot-Diff Log

The current client derives log entries by comparing old and new `PUBLIC_STATE`
and truncates the result with logic equivalent to:

`slice(-10)`

Remove that behavior.

The full event log must be driven by `PublicNarrationEvent`.

Keep `PUBLIC_STATE` authoritative for current state.

Do NOT make the narration stream authoritative for gameplay state.

---

# Full Log UX

The right-side log must keep the entire public match history.

Requirements:

- scrollable;
- no hard 10-line truncation;
- chronological;
- reconnect-safe;
- localized;
- readable causal indentation;
- player names visible;
- card names visible;
- Drink names visible once public;
- stat changes visible;
- contest rounds visible;
- response chain visible.

Group or visually indent related events.

Example:

Turn 4 — Alice

  Alice played Card A on Bob
    Bob played Card B — Negate Card A
      Carol played Card C — Negate Card B
      Card C resolved
    Card B was Negated
  Card A resolved
  Bob Fortitude 18 → 16

For Drink Contest:

Drinking Contest begins

  Round 1
    Alice reveals Wine — score 2
    Bob reveals Dark Ale — score 1
    Carol reveals Wine — score 2

  Alice and Carol tie at 2

  Tie-break Round 2
    Alice reveals ...
    Carol reveals ...

  Carol wins

  Alice pays Carol 1 Gold
  Bob pays Carol 1 Gold

The exact wording should use localization messages, not server-created English strings.

---

# Log Scrolling

When the user is already near the bottom:

- new LIVE events auto-scroll.

When the user has manually scrolled upward:

- do NOT forcibly jump to the bottom;
- show a small "new events" indicator/action.

HISTORY backfill must not cause a disruptive scroll animation.

---

# STEP 25R-04 — Player HUD Redesign

The data already exists in `PublicPlayerView`.

Do not add duplicate authoritative state.

Each player panel must prominently and persistently display:

- Fortitude;
- Alcohol Content;
- Gold;
- hand card count;
- Drink Me! pile count.

These must be visually much clearer than the current small text.

Fortitude and Alcohol are the most important pair.

They should be readable at a glance.

Show the knockout relationship visually without changing rules:

`Alcohol >= Fortitude`

should be easy for a player to understand.

Do not hide the actual numeric values behind icons.

---

# Stat Change Animation

When a LIVE public narration stat event occurs:

Show a small transient delta animation near that player's HUD.

Examples:

`-2 Fortitude`

`+3 Alcohol`

`-1 Gold`

Then animate the displayed numeric value to the authoritative current value.

This visual animation is presentation only.

Never locally compute authoritative final stats.

After animation, the HUD must match `PUBLIC_STATE`.

HISTORY backfill must not replay HUD delta animations.

---

# STEP 25R-05 — Presentation Director / Sequential Animation

Create a client presentation queue, for example:

`PresentationDirector`

or equivalent.

It consumes LIVE `PublicNarrationEvent`s.

It does NOT control gameplay.

It must never delay:

- command submission;
- legal-play display;
- response controls;
- target selection;
- server countdown.

---

# Interaction Must Remain Immediate

This is mandatory.

The authoritative server response timer may already be running while an animation is playing.

If the local player has a legal response:

- show response UI immediately;
- show countdown immediately;
- accept clicks immediately.

Do NOT wait for animation completion.

Animation is an overlay/presentation queue only.

Add a regression E2E test proving a response can be submitted while presentation animation is active.

---

# Animation Controls

Provide:

- Skip current presentation;
- Fast-forward;
- reduced-motion support.

Respect:

`prefers-reduced-motion`.

Reduced-motion mode must preserve:

- card relationship;
- causal text;
- current action clarity;

while reducing movement.

Do not remove information in reduced-motion mode.

---

# Required Animation Events

Implement clear sequential animation for:

### Character card play

1. source player's hand/player area;
2. card moves to central presentation zone;
3. card title visible;
4. source player highlighted;
5. target player highlighted;
6. card voice begins.

### Response card

Response card appears above/on the card it responds to.

Draw a clear connector/label:

- Negates;
- Ignores;
- Modifies;
- Redirects;
- Responds to.

### Nested response

Support at least 3 levels clearly.

Example:

Card A
← Card B Negates A
← Card C Negates B

Do not flatten this to a generic stack list.

### Resolution

Resolve from the top of the response chain.

Canceled cards should visibly:

- dim;
- cross/fade;
- show "Negated" or equivalent.

Then continue downward.

### Drink

Show:

1. Drink source/context;
2. card flip/reveal;
3. Chaser reveal if any;
4. combined public chain;
5. response chain;
6. individual stat changes.

### Character-card draw

Since card identity is hidden:

animate card backs only.

Show count.

Never reveal hidden faces.

### Face-down Drink deal/order

Animate Drink card backs.

Never show Drink identity before reveal.

---

# Causality Requirement

A player watching the center of the screen should be able to answer:

- What card was just played?
- Who played it?
- Who was targeted?
- Did someone respond?
- What card responded to what?
- Was something Negated/Ignored?
- What resolved?
- Why did this player's stat change?
- What caused the next Drink to appear?

If these answers require reading only the final state, the implementation is not complete.

---

# STEP 25R-06 — ElevenLabs Offline Voice Tooling

The user has chosen ElevenLabs.

The API key exists locally.

Never put it in:

- React;
- client bundle;
- Worker;
- WebSocket payload;
- committed JSON;
- generated HTML.

Read only:

`process.env.ELEVENLABS_API_KEY`

from offline Node scripts.

Use:

`.env.local`

The repository already ignores `.env.*`.

Add or maintain a safe:

`.env.example`

containing only:

`ELEVENLABS_API_KEY=`

Never print the actual key.

---

# No Runtime ElevenLabs

The game MUST NOT call ElevenLabs while a match is running.

Do not create:

`/api/tts`

Do not proxy ElevenLabs through Cloudflare.

Do not expose the API key.

All final voice audio must exist under local bundled assets such as:

`public/audio/cards/<characterId>/<cardDefinitionId>.mp3`

Runtime playback reads only these files.

---

# Current ElevenLabs API

Use the CURRENT Voice Design API.

Do NOT use deprecated:

`/v1/text-to-voice/create-previews`

Use:

`POST /v1/text-to-voice/design`

for audition previews.

Use:

`POST /v1/text-to-voice`

to promote a selected `generated_voice_id` into a reusable voice.

Use:

`POST /v1/text-to-speech/{voice_id}`

for final card-title speech generation.

Use header:

`xi-api-key`

Use:

`mp3_44100_128`

unless a clearly documented project reason requires another format.

Voice Design model should be configurable.

Default:

`eleven_ttv_v3`

TTS model should be configurable.

Default:

`eleven_v4`

Do not silently mix TTS models.

If the configured model is unavailable for the user's ElevenLabs account:

- fail clearly;
- explain which configuration must change;
- do not silently regenerate some files with another model.

---

# API Error Handling

Handle:

- HTTP errors;
- rate limits;
- 409 Voice Design generation-in-progress response;
- malformed response;
- missing API key;
- empty preview list;
- partial generation failure.

Use bounded retry/backoff where appropriate.

Do not infinite-retry.

Do not regenerate successful output because one later card failed.

---

# STEP 25R-07 — Character Voice Profiles

There are 8 selectable characters for this milestone.

Create committed voice-design profiles for:

## Deirdre

Adult female priestess.

Characteristics:

- warm;
- composed;
- reassuring;
- educated;
- medium to medium-low voice;
- calm fantasy-tavern presence;
- confident rather than timid.

## Fiona

Adult female warrior.

Characteristics:

- bold;
- energetic;
- confident;
- strong;
- playful aggression;
- crisp delivery;
- lively tavern personality.

## Gerki

Adult male rogue.

Characteristics:

- sly;
- quick;
- mischievous;
- dry humor;
- lightly raspy;
- clever;
- not cartoonishly evil.

## Zot

Older adult male wizard.

Characteristics:

- eccentric;
- theatrical;
- scholarly;
- expressive;
- slightly unpredictable;
- clear fantasy wizard identity.

Do NOT create a separate Pooky voice in this step.

Current default voice ownership follows the selectable character.

Design the system so a future card-level voice-role override can be added
without rewriting the audio engine.

## Dimli

Adult male dwarf.

Characteristics:

- low;
- rough;
- gravelly;
- jovial;
- sturdy;
- loud enough for a tavern;
- compact energetic delivery.

## Eve

Adult female illusionist.

Characteristics:

- mysterious;
- elegant;
- soft;
- airy;
- confident;
- controlled;
- slightly magical or uncanny without becoming difficult to understand.

## Fleck

Adult male bard.

Characteristics:

- charismatic;
- theatrical;
- rhythmic;
- playful;
- expressive;
- clear projection;
- performer-like voice.

## Gog

Adult male Half-Ogre.

Characteristics:

- extremely deep;
- large/booming;
- slow;
- resonant;
- goofy;
- warm;
- lovable;
- simple earnest delivery;
- NOT an evil-monster voice.

---

# STEP 25R-08 — Voice Audition Generator

Create an offline script.

Suggested:

`scripts/elevenlabs-voice-audition.mjs`

Package script:

`npm run voice:audition`

Use Node's existing `fetch`.

Do not add an ElevenLabs runtime dependency unless clearly necessary.

Do not add `dotenv` solely for this.

The script may be invoked with Node's:

`--env-file=.env.local`

or equivalent existing Node functionality.

---

# Audition Output

Generate at least 3 usable audition candidates for each of the 8 characters.

Store temporary audition output under an already-ignored development location,
for example:

`.tools/voice-auditions/`

Suggested structure:

`.tools/voice-auditions/deirdre/A.mp3`
`.tools/voice-auditions/deirdre/B.mp3`
`.tools/voice-auditions/deirdre/C.mp3`

and so on.

Generate a manifest containing:

- characterId;
- candidate label;
- generated_voice_id;
- voice description;
- model;
- seed if used;
- filename.

Do NOT store API key.

---

# Audition Text

Voice Design preview text must be long enough for the ElevenLabs API.

Use approximately 120–300 characters of original/non-card-rule tavern dialogue
appropriate to each character.

Do NOT send complete proprietary card rule text to ElevenLabs.

The audition is for voice quality.

It does not need to contain actual game card text.

Try to include:

- a short exclamation;
- a normal sentence;
- an excited sentence;

so the user can judge range.

---

# Determinism / Candidate Generation

Aim for 3 clearly labeled candidates:

A
B
C

Use controlled/different seeds when helpful.

If one Voice Design request already returns multiple valid previews, use those.

If not, make additional bounded requests to obtain 3 candidates.

Handle the current API's 409 conflict response with bounded retry/backoff.

Do not assume an API response always contains exactly 3 previews.

---

# AUDITION STOP GATE

After implementing Steps 25R-01 through 25R-08:

Run all required tests.

Review and fix the implementation.

Then run:

`npm run voice:audition`

if `ELEVENLABS_API_KEY` is available.

Produce the audition files and manifest.

STOP HERE.

Do NOT automatically choose voices for the user.

Report:

- path to each character's A/B/C audition files;
- generated voice IDs;
- voice descriptions;
- commands run;
- tests;
- git diff summary.

Ask the user to select:

- Deirdre A/B/C
- Fiona A/B/C
- Gerki A/B/C
- Zot A/B/C
- Dimli A/B/C
- Eve A/B/C
- Fleck A/B/C
- Gog A/B/C

The same final ElevenLabs voice may later be assigned to multiple characters if
the user explicitly chooses that.

Do not proceed to bulk final audio generation without the user's selections.

---

# STEP 25R-09 — Selected Voice Creation

THIS STEP RUNS ONLY AFTER USER SELECTIONS ARE PROVIDED.

Take the selected `generated_voice_id` values.

Promote selected previews using:

`POST /v1/text-to-voice`

Store reusable returned `voice_id`s in the project's voice-generation config.

Voice IDs are not API secrets.

Never store the API key.

Allow multiple character IDs to reference the same voice ID.

---

# STEP 25R-10 — Card Voice Manifest

Generate audio ONLY for character cards that are actually played from hand.

Do NOT generate this feature for:

- Drink cards merely because they are revealed;
- Drink Event cards merely because they are revealed;
- system effects.

Determine card ownership from production content:

`deck -> characterId`
plus:
`deckCards`

Do not infer ownership from card names.

---

# Spoken Text

The spoken audio is the PRINTED/CANONICAL CARD TITLE.

Use:

`canonicalName`

from the English canonical content when available.

Do NOT speak:

- `rulesText`;
- effect summary;
- localized zh-TW translation;
- mechanic ID.

Example:

Speak:

`Tip the Wench.`

Do not speak:

`Pick a player. They pay 1 Gold to the Inn.`

---

# Asset Path

Use a deterministic path.

Recommended:

`public/audio/cards/<characterId>/<cardDefinitionId>.mp3`

A shared card definition belonging to two different characters must be allowed
to have two different audio files because the characters may have different
voices.

---

# Incremental Generation

Create a committed/generated manifest containing enough information to decide
whether an asset is stale.

Hash inputs equivalent to:

- characterId;
- cardDefinitionId;
- spokenText;
- voiceId;
- modelId;
- outputFormat;
- relevant voice-generation settings.

If unchanged and file exists:

`SKIP`

If changed:

`REGENERATE`

If new:

`GENERATE`

Do not spend ElevenLabs quota regenerating identical assets.

---

# Partial Failure

Generation must be resumable.

If 100 files succeed and file 101 fails:

- preserve the successful files;
- record/report the failure;
- next run resumes only missing/stale assets.

Do not delete valid completed assets.

---

# Voice Verification Script

Add:

`npm run voice:verify`

This command MUST NOT call ElevenLabs.

It must verify locally:

- every production RDI1/RDI2 character-card association has an expected voice asset;
- every manifest entry has a file;
- no zero-byte MP3 exists;
- no unexpected duplicate path;
- spokenText is a title, not rules text;
- all 8 characters have a voice mapping;
- Drink-only definitions are not incorrectly required;
- stale hashes are reported.

This should be safe to run in CI and Step 25 release audit.

---

# STEP 25R-11 — Runtime Card Voice Playback

Extend the existing `AudioEngine`.

Do not create a second independent browser audio architecture.

Card voice trigger:

`LIVE CARD_PLAYED public narration event`

Use:

- actor/player ID;
- actor character ID from authoritative public state;
- cardDefinitionId.

Resolve local audio path.

Queue the corresponding MP3.

---

# Important Voice Deduplication

Use the public timeline sequence/event identity as the dedupe key.

The same LIVE event must speak once.

It must NOT replay because of:

- rerender;
- PUBLIC_STATE update;
- PRIVATE_STATE update;
- reconnect;
- HISTORY backfill;
- locale change.

Persist bounded seen-event keys similarly to the existing attention-audio design.

---

# Voice Queue

Voices must not overlap each other.

Implement a serialized voice queue.

If:

A plays Card A
then B immediately responds with Card B
then C responds with Card C

play titles in event order:

A title
then B title
then C title

Do not play all three simultaneously.

Gameplay controls remain immediately interactive while audio queues.

---

# Existing Sometimes Voice

Preserve the current Sometimes-response attention behavior unless intentionally
integrating it into the same voice queue.

If integrating:

- do not play two voices on top of one another;
- attention chime may still be immediate;
- response controls must remain immediate;
- card-title voice must not consume response timer input availability.

Add explicit tests for the interaction.

---

# Audio Settings

Separate voice settings from SFX.

Extend settings with:

- voiceMuted;
- voiceVolume.

Preserve backward compatibility with existing stored audio preferences.

Existing users with old `rdi:audio` storage must receive safe defaults.

Do not break:

- music mute;
- SFX mute;
- autoplay unlock;
- attention chime.

---

# Music Ducking

While a card voice or response voice is actively playing:

temporarily reduce BGM gain.

Use a configurable reasonable factor.

Example:

35–50% of current music level.

After all voice playback finishes:

smoothly restore the user's configured music volume.

Do not permanently overwrite the user's volume setting.

Do not duck when voice audio is muted.

---

# Missing Voice Asset

A missing voice MP3 must never block gameplay.

Behavior:

- log a development warning where appropriate;
- skip the voice;
- continue presentation/gameplay.

`voice:verify` should prevent this in release builds.

---

# STEP 25R-12 — Animation/Voice Relationship

Card voice and visual card presentation should correspond to the same public
timeline event.

Preferred sequence:

1. card presentation appears;
2. actor/target are visible;
3. title begins speaking;
4. response chain continues.

Do not wait for speech completion before enabling gameplay actions.

For presentation pacing, it is acceptable to wait for a short visual beat before
the next noninteractive animation.

However:

if the local player receives an active response prompt, the response UI takes
priority over animation pacing.

---

# STEP 25R-13 — Required Scenario Tests

Create deterministic tests/fixtures for the following.

## Scenario A — Ordinary Action

Alice plays a 2-Fortitude damage card on Bob.

Expected visible sequence:

- Alice played card;
- target Bob;
- card title voice;
- card resolves;
- Bob Fortitude old → new;
- HUD delta;
- full log contains all events.

## Scenario B — Negate Chain

A plays Card A.

B plays Card B to Negate A.

C plays Card C to Negate B.

Verify:

- hierarchy is correct;
- C links to B;
- B links to A;
- C resolves;
- B is Negated;
- A resolves;
- animations preserve this order;
- log preserves this causal relationship;
- three card-title voice events queue in correct order.

## Scenario C — Ignore

A plays an effect on B.

B Ignores it.

Verify:

- relationship clearly says Ignore;
- B's ignored part does not change B's stats;
- other valid portions of the source still resolve when rules require.

Presentation must reflect engine result rather than inventing semantics.

## Scenario D — Drink + Chaser

Reveal a Drink with a Chaser.

Verify:

- base Drink reveal;
- Chaser relation;
- complete chain;
- response timing;
- stat changes;
- causal log.

## Scenario E — Drinking Contest Tie

At least 3 players.

Round 1 produces a tie.

Verify:

- all reveals;
- Chaser where applicable;
- scores;
- exact tied players;
- tie-break round;
- new reveals;
- final winner;
- payout;
- intermediate Fortitude/Alcohol/Gold changes.

This scenario is mandatory.

## Scenario F — Hidden Draw

Another player draws character cards.

Verify client sees only:

`draw count`

No card definition or instance identities.

## Scenario G — Face-down Drink order

Verify the target Drink pile count changes / card-back animation occurs.

Verify Drink identity remains hidden until reveal.

## Scenario H — Reconnect

Generate substantial history.

Reconnect.

Verify:

- complete full log reconstructed;
- no duplicate log lines;
- no historical animations;
- no historical card voices;
- current live event animates/speaks exactly once.

## Scenario I — Active response during animation

Make an animation active.

Open a 30-second response prompt for the local player.

Verify:

- controls appear immediately;
- countdown reflects authoritative deadline;
- player can respond before presentation queue finishes;
- server accepts response.

This is mandatory.

## Scenario J — Four-player HUD

Verify all four player panels clearly show:

- Fortitude;
- Alcohol;
- Gold;
- hand count;
- Drink pile count;

without overlap at supported desktop viewport.

Add responsive coverage for narrower viewport where applicable.

---

# STEP 25R-14 — Accessibility

Animations must not be the only source of information.

Every event also exists in accessible textual form in the log.

Provide:

- sensible ARIA labels;
- keyboard-accessible skip/fast-forward controls;
- `prefers-reduced-motion`;
- visible focus;
- no information conveyed by color alone.

Stat changes should include signs/text, not only red/green.

---

# STEP 25R-15 — Documentation

Update:

`docs/protocol.md`

Document public narration protocol and hidden-information policy.

Update:

`docs/audio.md`

Document:

- card-title voices;
- ElevenLabs generation workflow;
- local-only runtime assets;
- voice settings;
- music ducking;
- autoplay behavior.

Add a voice-generation document such as:

`docs/voice-generation.md`

Include exact commands:

- configure API key;
- audition;
- select/create voices;
- generate assets;
- verify assets.

Update audio provenance.

For AI-generated assets record at minimum:

- ElevenLabs;
- generation date;
- API/model ID;
- character voice role;
- spoken title;
- output format;
- generation manifest/hash.

Do not claim ElevenLabs is the copyright owner of user-generated content.

Do not store the API key in provenance files.

---

# STEP 25R-16 — Do Not Corrupt Step 25

This revision invalidates any Step 25 release-audit conclusions produced before
the revision.

Preserve useful existing Step 25 work, but do not trust old pass results.

After FINAL voice selection/generation and all revision work is complete:

update:

`codex-prompts/step-25-rdi1-rdi2-release-audit.md`

to include at minimum:

`npm run voice:verify`

and explicit release gates for:

- public narration hidden-info tests;
- full-log reconnect;
- response-chain animation;
- Drink Contest presentation;
- HUD;
- voice coverage;
- voice reconnect dedupe;
- no runtime ElevenLabs request.

Then rerun Step 25 FROM THE BEGINNING.

---

# Mandatory Code Review After EACH Implementation Stage

After each stage:

1. inspect `git diff`;
2. inspect new protocol schemas;
3. inspect hidden-information exposure;
4. inspect reconnect behavior;
5. inspect timer behavior;
6. inspect audio deduplication;
7. inspect animation queue ownership;
8. inspect accessibility;
9. inspect dead code;
10. run targeted tests.

Do not merely report bugs found during review.

FIX THEM before proceeding.

Only leave an issue unresolved when it genuinely requires the user's voice
selection or another external decision.

---

# Mandatory Final Self-Review

Before saying this revision is complete, perform a fresh review as if reviewing
another developer's pull request.

Specifically search for these mistakes:

## Security

- raw DomainEvent exposed;
- `cardInstanceId` leaked from hidden hand;
- deck shuffle IDs leaked;
- private choice IDs leaked;
- Drink pile identities leaked;
- API key referenced by client code;
- ElevenLabs endpoint present in runtime bundle.

## Timeline

- ordering by stateVersion only instead of replay sequence;
- duplicate reconnect log entries;
- missing causal relation;
- log limited to last N events;
- HISTORY causing live presentation.

## Animation

- presentation blocks input;
- timer begins only after animation;
- CSS state pretending to be authoritative state;
- hidden cards rendered face-up;
- response hierarchy flattened incorrectly.

## Audio

- title uses `rulesText`;
- zh-TW translated title used instead of canonical printed title;
- duplicate voice on reconnect;
- overlapping voices;
- voice assets generated at runtime;
- API key committed;
- old ElevenLabs deprecated endpoint;
- music volume permanently modified by ducking.

## Content

- changing verified card mechanics merely for presentation;
- inventing new RDI2 effects;
- modifying Step 24 source locks;
- altering card counts.

## Tests

- test only checks render;
- no nested response test;
- no Drink Contest tie test;
- no reconnect test;
- no hidden-info test;
- no active-timer-during-animation test;
- no voice coverage validator.

Fix every identified issue.

Then repeat the relevant test suite.

---

# Required Commands Before Audition Stop Gate

Before stopping for user voice selection run:

`npm run typecheck`

`npm run lint`

`npm test`

`npm run build`

`npm run test:e2e`

plus all newly added targeted validators/tests.

If the API key is available:

`npm run voice:audition`

Do not run bulk card voice generation yet.

---

# Required Commands After Final Voice Selection

After selected voices are created and final card audio is generated:

run:

`npm run voice:verify`

and all normal revision checks.

Then restart and complete the original Step 25 required commands:

`npm run content:verify:rdi1`

`npm run content:verify:rdi2-source`

`npm run content:verify:rdi2`

`npm run content:verify:rdi1-rdi2`

`npm run content:verify:zh-TW`

`npm run typecheck`

`npm run lint`

`npm test`

`npm run test:coverage`

`npm run build`

`npm run test:e2e`

Do not weaken a verifier to obtain a pass.

---

# Deliverables Before Voice Selection

At the first stop gate provide:

1. implementation summary;
2. changed files;
3. public narration architecture;
4. security/privacy test results;
5. full-log behavior;
6. HUD changes;
7. animation behavior;
8. timer-safety test result;
9. ElevenLabs audition tooling;
10. paths for all A/B/C audition MP3 files;
11. audition manifest;
12. exact commands/results;
13. `git diff --stat`;
14. `git status --short`;
15. self-review findings and fixes.

Then STOP for user voice selection.

Do NOT begin final voice generation automatically.

---

# Final Deliverables After Voice Selection

After the user supplies selections and implementation resumes, provide:

1. selected voice mapping;
2. ElevenLabs reusable voice IDs;
3. number of final generated card voice files per character;
4. total generated files;
5. skipped/cache hits;
6. `voice:verify` result;
7. runtime playback tests;
8. reconnect dedupe tests;
9. animation tests;
10. hidden-information tests;
11. full Step 25 audit results;
12. updated `docs/rdi1-rdi2-release-status.md`;
13. changed files;
14. `git diff --stat`;
15. `git status --short`;
16. final self-review findings and fixes.

Only after every release gate passes may Step 25 be marked complete.

Do not begin any RDI3+ work.
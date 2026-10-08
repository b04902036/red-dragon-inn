# Step 26 — Physical Printed-Title Voice Generation & Runtime Integration

You are working in the current repository state. Do not restart the voice system from scratch.

## Goal

Finish the production card-title voice pipeline so that every physical character-card copy can use its correct printed English title for TTS, including cases where multiple physical cards share one gameplay `cardDefinitionId` but have different printed titles.

Then generate and integrate the currently configured voices for:

- Gog the Half-Ogre
- Dimli the Dwarf
- Fleck the Bard

Do not invent or select voice IDs for the other five characters. Prepare their mappings so they can be generated later by only adding Voice IDs.

## Current repository facts

Existing voice infrastructure already exists and should be extended, not replaced:

- `scripts/card-voice-assets.mjs`
- `scripts/card-voices.mjs`
- `scripts/voice-decode.mjs`
- `scripts/voice-runtime-security.mjs`
- `src/client/audio/AudioProvider.tsx`
- `src/client/audio/card-voice-catalog.ts`
- `src/client/audio/use-card-voices.ts`
- `src/client/audio/voice-queue.ts`
- `public/audio/cards/manifest.json`
- `docs/voice-generation.md`

Existing npm commands:

- `npm run voice:test`
- `npm run voice:plan`
- `npm run voice:generate`
- `npm run voice:verify:partial`
- `npm run voice:verify`
- `npm run voice:security`

Current configured ElevenLabs voices in `content/presentation/character-voices.json`:

- Gog: `LSaaFXnHBKjbbNrMtOsH`
- Dimli: `iDHk3E7ojf3zi6XPDM2o`
- Fleck: `kJ1WJLsLiz0CnWmEPesT`

All three use:

- model: `eleven_flash_v2_5`
- output: `mp3_44100_128`

The following must remain disabled until the user supplies a Voice ID:

- Deirdre
- Fiona
- Gerki
- Zot
- Eve

Never use Voice Design. Never invent a Voice ID.

## Canonical printed-title inputs

These files are now the authoritative card-title inputs. Do not research the titles again and do not substitute normalized pack names.

RDI1:

- `content-private/imports/rdi1/rdi1-deirdre-printed-titles.json`
- `content-private/imports/rdi1/rdi1-fiona-printed-titles.json`
- `content-private/imports/rdi1/rdi1-gerki-printed-titles.json`
- `content-private/imports/rdi1/rdi1-zot-printed-titles.json`

RDI2:

- `content-private/imports/rdi2/rdi2-dimli-printed-titles.json`
- `content-private/imports/rdi2/rdi2-eve-printed-titles.json`
- `content-private/imports/rdi2/rdi2-fleck-printed-titles.json`
- `content-private/imports/rdi2/rdi2-gog-printed-titles.json`

Each file must validate as:

- `physicalCardCount === 40`
- sum of row `quantity` === 40
- every row has `canonicalCardTitles.length === quantity`

Across all eight characters this is exactly 320 physical title assignments.

Respect the Gog project overrides already present in its printed-title JSON. Do not replace them.

## Critical architecture problem to fix

The current voice pipeline assumes:

`characterId + cardDefinitionId -> one spokenText`

That is insufficient.

A single gameplay definition may represent several physical printed cards with different titles.

Examples include:

- Dimli `damage_two`
- Fleck `cheat_take_control`
- Eve `cheat_take_control`
- RDI1 Deirdre / Fiona / Gerki / Zot rows with multiple printed titles

The engine already creates individual `CardInstanceId`s, but each instance currently stores only its gameplay `definitionId`.

Therefore do NOT arbitrarily choose one title for a definition.

Implement a physical presentation/title variant layer.

## Required design

### 1. Build a versioned title-variant input

Replace or upgrade the current one-title-per-definition private mapping.

Preferred shape:

```json
{
  "schemaVersion": 2,
  "entries": [
    {
      "characterId": "character_rdi_dimli_the_dwarf",
      "cardDefinitionId": "carddef_rdi2_dimli_damage_two",
      "variants": [
        {
          "variantId": "v1",
          "spokenText": "That's it! No more short jokes!",
          "quantity": 1
        },
        {
          "variantId": "v2",
          "spokenText": "Are you saying I'm grumpy?",
          "quantity": 2
        },
        {
          "variantId": "v3",
          "spokenText": "Let's try some Dwarven wrist wrestling!",
          "quantity": 2
        }
      ]
    }
  ]
}
```

Exact field names may differ if there is a cleaner existing convention, but the invariants are mandatory:

- one entry per character + gameplay definition
- one or more title variants
- exact `spokenText` copied byte-for-byte from `canonicalCardTitles`
- variant quantities sum to that deck-definition quantity
- stable deterministic `variantId`
- duplicate physical copies with the same title share the same variant/audio asset
- different printed titles under the same definition remain distinct
- no fallback to pack `name`, rules text, localized text or mechanic labels

Add a deterministic build/import script rather than maintaining hundreds of mappings manually.

The importer must read all eight printed-title JSON files and the locked combined pack, validate ownership, definition existence, quantities, and exact 40-card coverage.

If a `cardKey` cannot be mapped uniquely to a production definition, fail loudly before any TTS request.

### 2. Assign presentation variants to physical CardInstances

New matches must preserve which physical printed-title variant each copy represents.

The engine currently instantiates each `deckCards` quantity into separate `CardInstanceId`s before shuffle.

At that point, deterministically assign each physical instance a presentation/title variant based on the variant quantities for that definition.

Requirements:

- mechanics still use `definitionId` only
- presentation identity must not change card effects or legality
- shuffling moves the already-assigned physical instances; it must not reroll title variants
- discard / reshuffle preserves the same variant
- reconnect preserves the same variant
- replay/persistence preserves the same variant
- deterministic seeded games remain deterministic
- no title choice occurs when the card is played

Prefer a small optional field on `CardInstance`, e.g. `presentationVariantId`, so old serialized fixtures/replays can still parse.

For old states without the field:

- if that definition has exactly one title variant, it may safely resolve to that variant
- if it has multiple title variants, do not guess; voice playback should skip that legacy card rather than choose a wrong title

### 3. Expose only the safe variant identity on CARD_PLAYED narration

The existing public live narration has `cardDefinitionId`.

Add the presentation variant identifier needed for client voice lookup when a character card is actually revealed/played.

Do not expose hidden hand/deck composition before play.

The live public event should carry enough information to resolve:

`characterId + cardDefinitionId + presentationVariantId`

Do not send API keys or private evidence text.

Preserve existing behavior:

- only LIVE `CARD_PLAYED` can speak
- HISTORY is silent
- reconnect/rerender does not replay old speech
- response UI/countdowns remain usable during audio
- missing voice assets never block gameplay

### 4. Upgrade voice asset generation and manifest

Upgrade the current manifest/generator from definition-only assets to variant assets.

Recommended path:

```text
public/audio/cards/<characterId>/<cardDefinitionId>/<variantId>.mp3
```

The public manifest entry must include at minimum:

- characterId
- cardDefinitionId
- variantId
- exact spokenText
- voiceId
- modelId
- outputFormat
- voiceSettings
- contentHash
- audio sha256
- assetPath
- generatedAt
- source/author/license fields already required by the project

Because the existing `public/audio/cards/manifest.json` is currently empty, a clean schema upgrade is acceptable. Still keep schema versioning explicit.

Cache behavior must remain:

- unchanged valid clip => zero API request
- corrupted/missing/stale clip => regenerate only that clip
- save every successful clip/manifest update atomically
- a later failure must preserve earlier successful clips
- rerunning resumes safely
- Chromium decoding validation is still mandatory
- no model fallback

### 5. TTS request requirements

Use ElevenLabs Text-to-Speech only.

For each asset:

- `text` = exact `spokenText`
- model = configured `eleven_flash_v2_5`
- output = `mp3_44100_128`
- preserve the current explicit voice settings unless there is a proven bug
- do not prepend character name
- do not read rules text
- do not read effect summaries
- do not normalize punctuation/case

Read `ELEVENLABS_API_KEY` only from the existing secure local mechanism (`.env.local` / process environment).

Never:

- print the key
- commit the key
- put it in client env
- put it in Cloudflare bindings
- put it in manifests
- ask the user to paste it into chat

If the key is missing, finish implementation/tests and report the exact local command the user should run after adding it.

### 6. Generate Batch 1 now

After all planning validation passes, generate all required unique title variants for the three enabled characters:

- Gog
- Dimli
- Fleck

Do not generate Deirdre/Fiona/Gerki/Zot/Eve yet.

Before making the first paid/quota-consuming API request:

1. run the title/variant build
2. run `npm run voice:plan`
3. confirm zero title-mapping errors for all configured characters
4. print only a concise plan:
   - enabled characters
   - number of unique voice assets required
   - current cache hits
   - assets that will require API calls

Then proceed automatically if `ELEVENLABS_API_KEY` is available.

On provider quota/auth/rate errors:

- stop safely
- preserve completed files
- do not delete successful clips
- report HTTP class and remaining asset count
- do not change model or voice ID to work around the error

### 7. Client integration

Update the card voice catalog and playback lookup to use:

`characterId + cardDefinitionId + presentationVariantId`

Keep the existing serialized voice queue, card-voice volume/mute settings and music ducking.

Do not create a second audio system.

Do not change BGM, SFX, Sometimes attention voice, or unrelated UI.

If an expected variant asset is absent:

- skip speech
- continue gameplay
- optionally log a development-only warning
- never fall back to a different printed title

## Tests — mandatory

Add/update automated tests covering at least:

### Title import / validation

1. all 8 printed-title files load
2. each character has exactly 40 physical assignments
3. total = 320
4. row title count equals row quantity
5. every row maps to exactly one production definition
6. per-definition variant quantities equal the production deck quantity
7. distinct printed titles under the same definition remain distinct variants
8. duplicate same-title copies dedupe to one audio variant with quantity > 1
9. unknown/missing rows fail before network requests

### Physical instance identity

10. setup creates exactly the expected variant distribution per definition
11. a card keeps its variant through draw/discard/reshuffle
12. shuffle does not reroll variants
13. reconnect/state serialization preserves variant identity
14. legacy single-variant instances can resolve safely
15. legacy multi-variant instances without identity do not guess

### Narration / playback

16. LIVE CARD_PLAYED includes/resolves the correct variant
17. the exact matching variant MP3 is queued
18. two cards with the same definition but different variants queue different assets
19. HISTORY stays silent
20. rerender/resync does not replay
21. missing variant asset does not block gameplay
22. card voice mute/volume still works
23. existing voice queue serialization and music ducking still work

### Generation/cache/security

24. exact printed title is sent as ElevenLabs `text`
25. configured voice ID/model/output are exact
26. valid cache hit makes no request
27. stale/corrupt variant regenerates individually
28. partial failure is resumable
29. manifest rejects duplicate character+definition+variant keys
30. runtime/client build contains no ElevenLabs API key or API call

Keep all existing tests passing.

## Required verification commands

Install dependencies with the repository's existing package manager if needed, then run the relevant existing suites.

At minimum run:

```bash
npm run voice:test
npm run voice:plan
npm run voice:security
npm run typecheck
npm run lint
npm test
npm run build
```

After Batch 1 generation:

```bash
npm run voice:verify:partial
```

Also run the focused client/public-narration tests covering card voices.

Do NOT run strict `npm run voice:verify` as a release gate yet because five characters intentionally have no Voice ID.

Strict verification should remain designed to pass later once all eight voice mappings are configured.

## Documentation

Update `docs/voice-generation.md` so it accurately describes:

- physical title variants
- deterministic per-instance assignment
- manifest v2 / variant asset paths
- Batch 1 generated characters
- remaining five characters blocked only on Voice IDs
- resume/cache behavior
- how to add a new Voice ID and generate only newly enabled assets

Create a concise completion report, for example:

```text
docs/step26-card-title-voice-integration.md
```

It must include:

- changed architecture
- source title files used
- per-character physical title count
- unique generated variant count for Gog/Dimli/Fleck
- actual generated/cache-hit/failure counts
- partial verification result
- tests run and pass/fail
- exact remaining blockers

## Guardrails

- Do not modify card mechanics.
- Do not change printed-title wording.
- Do not re-research card titles.
- Do not replace printed titles with pack display names.
- Do not generate a random title at playback time.
- Do not choose voices for the five unconfigured characters.
- Do not expose hidden physical-card identity before reveal.
- Do not delete or regenerate valid cached audio unnecessarily.
- Do not begin RDI3+ work.
- Do not declare all-eight-character voice completion while five Voice IDs are absent.

## Final acceptance criteria

This step is complete when:

1. all eight characters have validated 40-card physical printed-title mappings in the new variant layer
2. new games assign each physical character card a stable title variant
3. public LIVE CARD_PLAYED narration carries the played card's correct safe variant identity
4. client voice lookup uses the exact played variant
5. Gog/Dimli/Fleck voice assets are generated or safely resumable if provider quota/auth blocks the run
6. `voice:verify:partial` passes for every currently enabled character whose assets were generated
7. no gameplay mechanic changed
8. no existing audio/reconnect/history behavior regressed
9. the remaining five characters require only Voice IDs plus another `voice:generate` run, not additional architecture work

When finished, report:

- files changed
- generated asset counts per character
- cache hits
- failed/pending assets
- verification results
- the five still-missing Voice IDs
- whether it is safe for me to provide the next Voice IDs and continue generation
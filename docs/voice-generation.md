# Offline character title voices

Step 25R uses manually selected ElevenLabs Voice IDs. API Voice Design returned `403 feature_unavailable` on the user's Free account and is no longer part of the required workflow. No project command creates or promotes a voice. The user independently verified Free-plan TTS using `eleven_flash_v2_5` and `mp3_44100_128`.

1. Manually create/select a voice on the ElevenLabs website.
2. Provide its Voice ID and add it to `content/presentation/character-voices.json`.
3. Supply verified printed English title associations in ignored `content-private/voice/canonical-titles.json`.
4. Run `npm run voice:plan`, then `npm run voice:generate`.
5. Run `npm run voice:verify:partial` while some voices remain unconfigured.
6. Run strict `npm run voice:verify` only when all eight mappings and assets are ready for the final audit.

Batch 1 configures Gog, Dimli and Fleck with the exact user-selected IDs, Flash v2.5 and MP3 44.1 kHz/128 kbps. Deirdre, Fiona, Gerki, Zot and Eve remain explicitly unconfigured. Pooky is not a separate selectable voice.

## Canonical text and ownership

The locked production combined pack provides primary CHARACTER decks and `deckCards` membership. Required assets deduplicate repeated physical copies only by character and definition; no Drink or Drink Event deck assets are generated. Names or card-name prefixes never determine ownership.

Many current pack names are intentional paraphrases. They are unsuitable as spoken printed titles. The private title input must use:

```json
{
  "schemaVersion": 1,
  "entries": [
    {
      "characterId": "character_rdi_gog_the_half_ogre",
      "cardDefinitionId": "carddef_rdi2_gog_force_extra_drink_during_other_drink_phase",
      "spokenText": "Gog say you drink MORE!",
      "evidence": "User-confirmed printed title; locked M21 ownership"
    }
  ]
}
```

Generation rejects unknown ownership, duplicate title mappings or any missing configured title before making API requests. It never substitutes `name`, rules, localized text, IDs or effect summaries. `.tools/voice-generation/title-audit.json` lists unresolved associations using clearly labeled descriptive names. If a normalized mechanic definition combines different physical printed titles, a verified physical presentation mapping is required; do not arbitrarily pick one title.

## Generation and cache

The offline command reads `ELEVENLABS_API_KEY` through Node's `--env-file-if-exists=.env.local`. Keep it out of chat, source, client env variables, Worker bindings and manifests. `.env.example` contains only an empty variable. Runtime tooling disables Cloudflare dotenv loading. No live API requests occur in normal automated tests.

Only the [Text-to-Speech endpoint](https://elevenlabs.io/docs/api-reference/text-to-speech/convert) is called. Requests submit the exact canonical `text`, configured `model_id`, MP3 format and explicit voice settings. No model fallback occurs.

The manifest is `public/audio/cards/manifest.json`. Deterministic assets use `public/audio/cards/<characterId>/<cardDefinitionId>.mp3`. Each entry stores character, definition, exact title, selected voice/model/format/settings, input content hash, audio SHA-256, asset path, generation date, source service, author and terms. Voice IDs are public configuration; API keys are not.

Unchanged valid assets skip without any API request, even if no key is available. Cached and newly returned MP3s must also decode successfully in Chromium; header validation alone does not establish valid compressed audio. Missing, corrupted or changed-input assets regenerate individually. Decoding happens before replacing any existing file. Each successful asset and manifest entry save immediately through temporary-file rename. Retryable 409/429/500/502/503/504 responses get at most three retries with 500/1000/2000 ms waits. A terminal error stops the batch and preserves completed work. Network timeouts do not automatically retry because the provider may already have charged the request. Resume with the same command; do not restart the batch.

## Verification

`voice:verify:partial` requires every configured association to be complete and current. Unconfigured characters are listed without failing. It checks file existence, byte hashes, MPEG-1 Layer III frames at the exact requested 44.1 kHz/128 kbps, mapping uniqueness, canonical input hashes, orphan files and stale records. It then decodes every required asset in Chromium using Web Audio. Strict verification additionally requires all eight mappings. It must not be reported as passing before the missing voices are supplied.

`voice:test` uses sample content and mocked HTTP to exercise title-only payloads, deck ownership, cache hits, repairs, partial failures/resume, retry bounds and verifier rejection. `voice:security` checks source/build isolation. No voices may be deleted from ElevenLabs until all configured Batch 1 assets pass both generation and partial verification.

## Playback

The browser loads only the bundled local manifest and MP3 paths. Only LIVE `CARD_PLAYED` public narration can enqueue title speech, using the actor's selectable character and definition association. HISTORY, rerender and reconnect are silent; consumed timeline identities persist for the session. Missing mappings/assets remain optional and never block gameplay.

Title speech and the existing Sometimes attention voice share one serialized media queue. Card voices have independent enable/mute/volume controls; music ducking temporarily multiplies the current music volume and restores it when speech ends, fails or is muted. A broken clip advances the queue; autoplay unlock still requires a gesture. The queue has no server state, prompt or command access. Response controls and countdowns remain immediately usable while voices play or wait.

Free-plan asset attribution and terms are documented in `public/audio/LICENSES.md`; no commercial license is inferred. Step 25 remains incomplete. The final strict audit and RDI3+ work do not begin with this batch.

# Physical card-title voices

Step 26 extends the existing offline ElevenLabs Text-to-Speech pipeline. Batch 1 generated 82 local MP3s: Dimli 28, Fleck 29 and Gog 25. Their 120 physical cards reuse clips when copies have identical titles. Deirdre, Fiona, Gerki, Zot and Eve have complete title mappings but remain disabled until their Voice IDs are supplied. No Voice Design or model fallback is used.

## Authoritative inputs and import

`npm run voice:titles` reads the four `content-private/imports/rdi1/rdi1-<character>-printed-titles.json` files and the four corresponding RDI2 files, plus the locked combined pack. It validates all eight 40-card decks, 320 physical title assignments, exact row title counts, deck membership, definition ownership and quantities. Unknown, duplicate, missing or ambiguous rows fail before TTS. Gog's existing project overrides remain unchanged. Two historical Gog input keys map explicitly to the locked `ignore_card_fortitude` and `order_two_extra_drinks_paid` definitions at the import boundary; no engine rule changes are involved.

The deterministic private output is `content-private/voice/canonical-titles.json`, schema version 2:

```json
{
  "schemaVersion": 2,
  "entries": [
    {
      "characterId": "character_rdi_gog_the_half_ogre",
      "cardDefinitionId": "carddef_rdi2_gog_force_extra_drink_during_other_drink_phase",
      "variants": [
        {
          "variantId": "v_<24 hexadecimal SHA-256 digits>",
          "spokenText": "Gog say you drink MORE!",
          "quantity": 2
        }
      ]
    }
  ]
}
```

Variant IDs derive from the exact UTF-8 title bytes. Reordering input rows or physical copies does not change the output. Repeated identical titles within a definition deduplicate; distinct titles never merge. The importer also emits `content/presentation/card-title-assignments.json`, containing only character/definition/variant IDs and quantities, pinned to the combined content version. It contains no title text, source evidence or credentials. Rebuild before planning if any input changes; planning rejects an outdated private mapping.

## Physical identity and replay

The server pins presentation assignments in the replay setup for new matches using the combined pack. At engine setup, character-card instances receive an optional `presentationVariantId` from sorted variant IDs and their quantities, before any shuffle. Gameplay still uses only `definitionId`. Assignment consumes no RNG. Drawing, discarding, reshuffling, snapshots, Durable Object eviction and replay preserve each instance's identity. Old states without assignments remain compatible.

Public/private game projections do not publish the hidden instance variants. Only revealed `CARD_PLAYED` domain/public narration includes the played variant ID. No title selection takes place at playback time.

## Generation and cache

```bash
npm run voice:titles
npm run voice:plan
npm run voice:generate
npm run voice:verify:partial
npm run voice:security
```

Keep `ELEVENLABS_API_KEY` in ignored `.env.local` or the process environment. `voice:generate` loads it using Node's existing secure environment-file mechanism. Never put the key in chat, source, client environment variables, Worker bindings or manifests. The offline generator calls only Text-to-Speech, sending exact `spokenText` without prefixes, rules, translations, case changes or punctuation normalization. The configured model is `eleven_flash_v2_5`, format `mp3_44100_128`; existing explicit voice settings are preserved.

Before requests, planning validates all eight decks and reports enabled characters, unique assets, valid cache hits and required API assets. Batch 1 used the existing user-selected IDs:

| Character | Voice ID             | Generated clips |
| --------- | -------------------- | --------------: |
| Dimli     | iDHk3E7ojf3zi6XPDM2o |              28 |
| Fleck     | kJ1WJLsLiz0CnWmEPesT |              29 |
| Gog       | LSaaFXnHBKjbbNrMtOsH |              25 |

Manifest v2 is `public/audio/cards/manifest.json`. Assets use `/audio/cards/<characterId>/<cardDefinitionId>/<variantId>.mp3`. Entries include exact title, variant, character/definition, voice/model/format/settings, input hash, audio SHA-256, path, generation timestamp, service, author and license. Complete `families` metadata lists every definition's variants, including disabled voices, so a partial asset manifest cannot accidentally imply that a multi-title definition has only one title.

Unchanged clips with matching hashes, valid MP3 frames and successful Chromium decoding require zero requests. Missing, stale or corrupt clips regenerate individually. Every successful file and manifest update uses temporary-file rename; a later failure preserves earlier work. Authentication, quota and rate errors stop safely. Transient 409/500/502/503/504 responses have at most three retries; network failures do not automatically retry, since a request may already have consumed credits. Resume with `npm run voice:generate`.

To enable another character, add only its supplied Voice ID in `content/presentation/character-voices.json` and set `enabled` to true. Then run `voice:plan`, `voice:generate` and `voice:verify:partial`. Existing clips remain cache hits; only newly enabled or invalid assets need requests. Do not choose IDs automatically. Strict `voice:verify` remains a final gate for all eight characters and intentionally fails while five mappings are disabled.

## Verification and playback

Partial verification requires every enabled variant to be present and current. It checks input hashes, physical ownership, family metadata, duplicate keys/paths, orphan files, audio hashes and MPEG-1 Layer III format, then decodes every clip in Chromium. `voice:test` uses mocked HTTP for request text/configuration, cache repair, partial failure/resume, newly enabled voices and invalid mappings. `voice:security` checks runtime/build isolation and exposed credentials.

The existing browser audio system loads bundled manifest/MP3s only. LIVE `CARD_PLAYED` lookup uses character + definition + variant. HISTORY, reconnect, rerender and late manifest loading do not replay speech. Missing assets skip speech without blocking gameplay. Legacy instances without a variant may resolve only a family known to contain exactly one variant; multi-variant legacy cards remain silent, even when only one family asset has been generated.

Card-title speech and Sometimes attention speech share the existing serialized voice queue, card voice enable/mute/volume settings and music ducking. Autoplay still unlocks after a gesture. Response controls and countdowns stay usable during speech. BGM, SFX and Sometimes attention behavior are unchanged. Free-plan attribution and terms remain in `public/audio/LICENSES.md`; generation asserts no commercial license and never deletes provider voices.

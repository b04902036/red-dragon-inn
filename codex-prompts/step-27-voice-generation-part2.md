# Step 27 — Generate Deirdre, Fiona and Gerki Voices

Work from the current real Git repository state.

This step generates the next three character voice packs only:

- Deirdre the Priestess
- Fiona the Volatile
- Gerki the Sneak

Do not redesign the voice system.
Do not modify card mechanics.
Do not alter printed titles.
Do not start Zot or Eve generation.

---

# Exact ElevenLabs Voice IDs

Use these exact IDs:

```text
Deirdre the Priestess
ibnhBcLBWxcYWoX4UnKM

Fiona the Volatile
xHqJi2lm2hAQvkVx9T7x

Gerki the Sneak
zYfyR7H02UOvJyj7Z2kG
```

Do not search for voices.
Do not use Voice Design.
Do not substitute another Voice ID.

Use the same production model/output already used by the project:

```text
model: eleven_flash_v2_5
output: mp3_44100_128
```

Preserve the existing production `voiceSettings`.

---

# Important: old three ElevenLabs voices may have been deleted

The user's ElevenLabs Free plan only allows three saved voices.

The already-completed voices for:

- Gog
- Dimli
- Fleck

may now have been deleted from the ElevenLabs account to free the three slots.

Their previously generated local audio is already complete:

```text
82 valid clips
82 Chromium-decodable clips
```

Runtime playback uses the local generated MP3 files.

Therefore:

- keep their existing Voice IDs in project metadata/manifest for provenance
- do NOT require the provider to still contain those voices
- do NOT call ElevenLabs for Gog/Dimli/Fleck
- do NOT regenerate their existing clips
- do NOT validate old voices by making provider/API lookup calls
- their assets must be accepted through the existing local cache/integrity/decode validation

CRITICAL:

If ANY Gog/Dimli/Fleck asset is missing, stale, corrupt, hash-invalid or undecodable:

STOP before generation.

Report exactly which old asset is invalid.

Do NOT attempt to regenerate an old clip, because the original provider voice may no longer exist.

Expected old-cache state:

```text
Gog + Dimli + Fleck:
82 required
82 cache hits
0 API calls
0 invalid
```

---

# Preconditions

The two Step 26 regression issues must already be fixed before spending ElevenLabs quota.

Run:

```bash
npm run content:verify:rdi1-rdi2-release
npm test
```

Required:

```text
content:verify:rdi1-rdi2-release = PASS
npm test = 0 failures, 0 suite-load failures
```

If either fails:

STOP.

Do not generate voice audio.

Report the failing check.

---

# Configure the three new characters

Update the existing character voice configuration, expected at:

```text
content/presentation/character-voices.json
```

Configure and enable:

```text
Deirdre:
voiceId = ibnhBcLBWxcYWoX4UnKM

Fiona:
voiceId = xHqJi2lm2hAQvkVx9T7x

Gerki:
voiceId = zYfyR7H02UOvJyj7Z2kG
```

Use:

```text
model = eleven_flash_v2_5
outputFormat = mp3_44100_128
```

Preserve the same voice-settings schema used by the already working characters.

Do not enable:

```text
Zot/Pooky
Eve
```

Do not change Gog/Dimli/Fleck configuration except where absolutely required to preserve compatibility.

---

# Expected title/clip counts

The physical printed-title variant mapping is already complete.

Do not research titles again.

Do not use normalized display labels or card-effect summaries.

Expected unique voice clips:

```text
Deirdre: 28
Fiona:   28
Gerki:   27
----------------
New batch: 83
```

Existing cache:

```text
Gog + Dimli + Fleck: 82
```

Expected enabled total after this batch:

```text
82 + 83 = 165 unique clips
```

The generator must continue using exact canonical `spokenText` from the existing Step 26 title-variant mapping.

Preserve exact punctuation and capitalization.

Different printed titles under the same gameplay definition must remain different audio variants.

Identical printed titles reused by multiple physical copies should remain one deduplicated audio variant.

If the required unique counts are not exactly:

```text
Deirdre 28
Fiona 28
Gerki 27
```

STOP before API generation and investigate the mapping.

Do not merge or delete title variants just to match the expected number.

---

# Security

Read the ElevenLabs key only from the project's existing secure local mechanism:

```text
ELEVENLABS_API_KEY
```

Never:

- print it
- commit it
- write it into a manifest
- expose it to client code
- add it to `public/`
- add it to Cloudflare client/runtime bindings
- paste it into documentation

If the API key is unavailable, STOP after completing configuration/planning and report the exact local setup command/path expected by the existing project.

---

# Mandatory planning gate before paid API calls

Run:

```bash
npm run voice:titles
npm run voice:test
npm run voice:plan
npm run voice:security
```

Before generation, inspect the plan.

Expected enabled characters:

```text
Gog
Dimli
Fleck
Deirdre
Fiona
Gerki
```

Expected old assets:

```text
Gog/Dimli/Fleck:
82 cache hits
0 API required
```

Expected new requirements on a fresh run:

```text
Deirdre: 28 required
Fiona:   28 required
Gerki:   27 required
```

Expected approximate total before first generation:

```text
82 old cache hits
83 new API-required assets
```

If some of the new three already have valid generated assets, fewer than 83 API calls are acceptable.

But their total unique requirements must still be exactly 83.

STOP before paid generation if:

- an old Gog/Dimli/Fleck asset needs regeneration
- old cache count is not 82
- new unique count is not 83
- a canonical-title mapping error exists
- a Voice ID differs from the exact supplied values
- model/output differs from the required configuration

---

# Generate

Only after all planning checks pass:

```bash
npm run voice:generate
```

Generate only missing assets.

The existing generator's resumable cache behavior must be preserved.

Requirements:

- each successful clip is persisted immediately/atomically
- manifest progress is saved safely
- valid cache hits make zero API requests
- reruns resume from completed assets
- no model fallback
- no alternate Voice ID fallback
- no old-character regeneration

---

# Provider error handling

If ElevenLabs returns:

- 401/403 authentication failure
- quota failure
- rate limit
- provider/server failure

STOP safely.

Do not change models or Voice IDs.

Preserve all successfully generated clips.

Report:

```text
character
asset/variant currently failing
HTTP status/error class
new clips successfully generated
new cache hits
remaining pending clips
```

A rerun must resume without regenerating completed new clips.

---

# Decode and integrity verification

Every new MP3 must pass the project's existing validation.

At minimum verify:

- file exists
- non-empty
- manifest entry exists
- content hash/asset SHA-256 matches
- Chromium successfully decodes it

Run:

```bash
npm run voice:verify:partial
```

Do not accept a file merely because ElevenLabs returned HTTP 200.

---

# Runtime behavior must remain unchanged

The current system already resolves:

```text
characterId
+ cardDefinitionId
+ presentationVariantId
```

Do not change that architecture.

Verify no regression in:

- LIVE `CARD_PLAYED` plays exact printed-title variant
- HISTORY is silent
- reconnect does not replay
- rerender does not replay
- voice queue remains serialized
- missing audio never blocks gameplay
- card-voice mute/volume still works
- BGM ducking still works

No runtime/client changes should normally be necessary for this generation batch.

---

# Required verification after generation

Run:

```bash
npm run voice:test
npm run voice:plan
npm run voice:verify:partial
npm run voice:security
npm run typecheck
npm run lint
npm test
npm run build
git diff --check
```

If runtime/client code was unexpectedly modified, also run:

```bash
npm run test:e2e
```

Expected final voice plan:

```text
Enabled:
Gog
Dimli
Fleck
Deirdre
Fiona
Gerki

Required enabled clips: 165
Cache hits: 165
API calls required: 0
Failed: 0
Pending: 0
```

Zot and Eve must remain disabled.

---

# Do not run strict all-eight verification yet

If:

```bash
npm run voice:verify
```

requires all eight characters, do not use it as the completion gate yet.

Use the project's current-enabled / partial verification:

```bash
npm run voice:verify:partial
```

The final strict verification will happen after Zot and Eve receive voices.

---

# Do not remove old generated voice metadata

Even though the old three ElevenLabs voices may no longer exist in the user's provider account, keep the existing generation metadata in the repository for provenance.

Do not interpret a provider-side deleted Voice ID as a reason to invalidate a locally verified MP3.

Local validation for already generated clips is authoritative for runtime use:

```text
manifest metadata
+ local file SHA-256
+ content/config hash
+ Chromium decode
```

Do not add a provider-existence requirement to cache validation.

---

# Documentation

Update the existing Step 26/voice-generation completion documentation with this batch.

Record:

```text
Deirdre
Voice ID: ibnhBcLBWxcYWoX4UnKM
Required clips: 28

Fiona
Voice ID: xHqJi2lm2hAQvkVx9T7x
Required clips: 28

Gerki
Voice ID: zYfyR7H02UOvJyj7Z2kG
Required clips: 27
```

Also record:

- old cache hits
- new cache hits before generation
- newly generated count
- provider failures/retries if any
- decode results
- final cache count
- all verification results

Do not record the API key.

---

# Acceptance criteria

Complete only when all are true:

1. Deirdre uses exactly `ibnhBcLBWxcYWoX4UnKM`.
2. Fiona uses exactly `xHqJi2lm2hAQvkVx9T7x`.
3. Gerki uses exactly `zYfyR7H02UOvJyj7Z2kG`.
4. Deirdre has exactly 28 required unique clips.
5. Fiona has exactly 28 required unique clips.
6. Gerki has exactly 27 required unique clips.
7. All 83 new required assets are generated or valid cache hits.
8. Every new asset passes Chromium decode validation.
9. Existing Gog/Dimli/Fleck 82 clips remain valid cache hits.
10. Zero API requests are made for Gog/Dimli/Fleck.
11. No provider-existence lookup invalidates deleted old voices.
12. Final enabled total is 165 clips.
13. Final plan shows 165 cache hits and 0 API calls required.
14. `voice:verify:partial` passes.
15. `voice:security` passes.
16. `npm test` has zero failures and zero suite-load failures.
17. typecheck/lint/build pass.
18. Zot and Eve remain disabled.
19. No card mechanics or printed titles changed.

---

# Final response format

Return exactly this information, with actual values:

```text
Voice Batch — Deirdre / Fiona / Gerki

Preconditions
RDI1/RDI2 release audit: PASS/FAIL
npm test before generation: PASS/FAIL

Old cache
Gog/Dimli/Fleck required: 82
Old cache hits: <n>
Old API calls: <n>
Old invalid assets: <n>

Deirdre
Voice ID: ibnhBcLBWxcYWoX4UnKM
Required: 28
Pre-generation cache hits: <n>
Generated: <n>
Failed/pending: <n>
Decode: PASS/FAIL

Fiona
Voice ID: xHqJi2lm2hAQvkVx9T7x
Required: 28
Pre-generation cache hits: <n>
Generated: <n>
Failed/pending: <n>
Decode: PASS/FAIL

Gerki
Voice ID: zYfyR7H02UOvJyj7Z2kG
Required: 27
Pre-generation cache hits: <n>
Generated: <n>
Failed/pending: <n>
Decode: PASS/FAIL

Final
Required enabled clips: 165
Cache hits: <n>
API required: <n>
Failed: <n>
Pending: <n>

Verification
voice:test: PASS/FAIL
voice:plan: PASS/FAIL
voice:verify:partial: PASS/FAIL
voice:security: PASS/FAIL
npm test: PASS/FAIL
typecheck: PASS/FAIL
lint: PASS/FAIL
build: PASS/FAIL

Remaining characters:
- Zot/Pooky
- Eve

Ready for final two voices: YES/NO
```

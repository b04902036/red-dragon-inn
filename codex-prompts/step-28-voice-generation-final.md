# step28 — Zot/Pooky and Eve

Work from the current real Git repository state.

Generate and integrate voices only for:
- Zot the Wizard and Pooky
- Eve the Illusionist

Do not redesign the voice system.
Do not alter card mechanics or canonical printed titles.
Do not start RDI3+ work.

## Exact ElevenLabs Voice IDs

Use exactly:

Zot the Wizard and Pooky
NyOVn5ARPZNbHhtn85Q5

Eve the Illusionist
y3149AIxOR0XAmN0KFsj

Do not search for substitutes.
Do not use Voice Design.
Do not invent or modify the IDs.

Use the same production settings:
- model: eleven_flash_v2_5
- output: mp3_44100_128
- preserve existing production voiceSettings

## Free-plan constraint

The user's ElevenLabs Free plan only retains three saved provider voices at once.
Earlier voices may already have been deleted from ElevenLabs after their local MP3s were generated.

Runtime playback uses local MP3 assets.

Therefore:
- keep old Voice IDs in project metadata/manifest for provenance
- do NOT require old provider voices to still exist
- do NOT make ElevenLabs calls for completed characters
- do NOT regenerate completed old-character clips
- do NOT perform provider-existence checks for completed voices

If ANY completed old clip is missing, stale, corrupt, hash-invalid or undecodable:
STOP before generation.
Report the exact invalid asset.
Do NOT attempt regeneration with an old/deleted provider voice.

## Mandatory precondition

Before enabling Zot or Eve run:

npm run content:verify:rdi1-rdi2-release
npm test
npm run voice:titles
npm run voice:test
npm run voice:plan
npm run voice:verify:partial
npm run voice:security

The previous six characters must already be complete:
- Gog
- Dimli
- Fleck
- Deirdre
- Fiona
- Gerki

Expected previous state before this batch:
- required clips: 165
- cache hits: 165
- API calls required: 0
- failed: 0
- pending: 0

If this is not true, STOP before spending API quota and report exactly what is invalid or missing.

## Configure Zot and Eve

Update the existing character voice configuration.

Zot/Pooky:
voiceId = NyOVn5ARPZNbHhtn85Q5

Eve:
voiceId = y3149AIxOR0XAmN0KFsj

Enable only these two additional characters.

Do not remove historical Voice IDs for already-completed characters.

## Expected unique clip counts

Use the existing physical printed-title variant mapping.
Do not research titles again.

Expected:
- Zot/Pooky: 28 unique clips
- Eve: 27 unique clips
- new batch total: 55

Expected previous cache:
- 165 clips

Expected all-eight total after completion:
- 220 unique clips

If Zot is not exactly 28 or Eve is not exactly 27:
STOP before API generation and investigate the mapping.
Do not merge or remove title variants to force the count.

## Spoken-text rules

For every generated asset:
- use exact canonical spokenText
- preserve punctuation and capitalization
- do not prepend character name
- do not read mechanic labels
- do not read rules/effects
- do not paraphrase
- do not normalize wording

Different printed titles under one gameplay definition remain separate variants.
Identical repeated titles continue to reuse one deduplicated audio asset.

## Security

Read ELEVENLABS_API_KEY only through the existing secure local generation mechanism.

Never:
- print it
- commit it
- place it in public/
- write it into manifest
- expose it to client code
- include it in docs

If the API key is unavailable, stop before generation and report the existing local setup required.

## Planning gate

After enabling Zot and Eve run:

npm run voice:titles
npm run voice:test
npm run voice:plan
npm run voice:security

Expected enabled characters:
Gog
Dimli
Fleck
Deirdre
Fiona
Gerki
Zot
Eve

Expected first-run plan:
- old cache hits: 165
- Zot required: 28
- Eve required: 27
- new API-required assets: 55
- total required assets: 220

Fewer than 55 API calls are acceptable only if some Zot/Eve assets already exist and validate.

STOP before generation if:
- any old completed asset needs regeneration
- previous cache is not 165 valid clips
- Zot/Eve total is not 55
- title mapping has errors
- Voice IDs differ from the exact supplied IDs
- model/output differs from production settings

## Generation

Only after all planning checks pass:

npm run voice:generate

Generate only missing Zot/Eve assets.

Preserve existing resumable/cache behavior:
- persist successful clips immediately/atomically
- update manifest safely
- valid cache hits make zero requests
- rerun resumes from completed clips
- no model fallback
- no alternate Voice ID fallback
- no old-character regeneration

## Provider failures

If ElevenLabs returns auth/quota/rate-limit/server errors:
STOP safely.
Do not change models or Voice IDs.
Preserve all successfully generated clips.

Report:
- character
- failing asset/variant
- HTTP status/error class
- new clips generated
- cache hits
- remaining pending assets

## Decode/integrity verification

Every new MP3 must pass:
- exists
- non-empty
- manifest entry exists
- SHA-256 matches
- content/config hash matches
- Chromium decode succeeds

Run:
npm run voice:verify:partial

## Final all-eight verification

After successful generation run:

npm run voice:test
npm run voice:plan
npm run voice:verify:partial
npm run voice:verify
npm run voice:security
npm run typecheck
npm run lint
npm test
npm run build
git diff --check

If runtime/client code changed unexpectedly, also run:
npm run test:e2e

Expected final state:
- all 8 characters complete
- required clips: 220
- cache hits: 220
- API calls required: 0
- failed: 0
- pending: 0

At this point strict npm run voice:verify must pass.

## Runtime non-regression

Do not change runtime behavior.

Verify:
- LIVE CARD_PLAYED plays exact physical title variant
- HISTORY stays silent
- reconnect/rerender does not replay
- lookup remains characterId + cardDefinitionId + presentationVariantId
- voice queue remains serialized
- missing audio never blocks gameplay
- mute/volume and BGM ducking still work

## Acceptance criteria

Complete only when:
1. Zot uses exactly NyOVn5ARPZNbHhtn85Q5.
2. Eve uses exactly y3149AIxOR0XAmN0KFsj.
3. Zot requires exactly 28 unique clips.
4. Eve requires exactly 27 unique clips.
5. Previous six characters have exactly 165 valid cached clips before this batch.
6. Zero API requests are made for previous characters.
7. All 55 Zot/Eve assets are generated or valid cache hits.
8. Every Zot/Eve asset passes Chromium decoding.
9. All-eight total is exactly 220 clips.
10. Final voice:plan reports 220 cache hits and zero API-required assets.
11. voice:verify:partial passes.
12. strict voice:verify passes.
13. voice:security passes.
14. npm test has zero failures and zero suite-load failures.
15. typecheck/lint/build pass.
16. no old-character audio was regenerated.
17. no card mechanics or printed titles changed.

## Final response format

Final Voice Batch — Zot/Pooky + Eve

Preconditions
Previous six required: 165
Previous six cache hits: <n>
Old API calls required: <n>
RDI1/RDI2 release audit: PASS/FAIL
npm test before generation: PASS/FAIL

Zot/Pooky
Voice ID: NyOVn5ARPZNbHhtn85Q5
Required: 28
Pre-generation cache hits: <n>
Generated: <n>
Failed/pending: <n>
Decode: PASS/FAIL

Eve
Voice ID: y3149AIxOR0XAmN0KFsj
Required: 27
Pre-generation cache hits: <n>
Generated: <n>
Failed/pending: <n>
Decode: PASS/FAIL

Final
Required all-eight clips: 220
Cache hits: <n>
API required: <n>
Failed: <n>
Pending: <n>

Verification
voice:test: PASS/FAIL
voice:plan: PASS/FAIL
voice:verify:partial: PASS/FAIL
voice:verify (strict): PASS/FAIL
voice:security: PASS/FAIL
npm test: PASS/FAIL
typecheck: PASS/FAIL
lint: PASS/FAIL
build: PASS/FAIL

All eight character voices complete: YES/NO

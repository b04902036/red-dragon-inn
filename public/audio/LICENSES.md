# Audio provenance

The user supplied both local WAV files on 2026-10-03, after the initial audio implementation. Their original download dates and any prior edits were not recorded. This integration preserves the supplied bytes; no runtime hotlinks are used.

| Local filename              | Title                                  | Author     | Source page                                                | License | Attribution required | Retrieval date                                           | Modifications            |
| --------------------------- | -------------------------------------- | ---------- | ---------------------------------------------------------- | ------- | -------------------- | -------------------------------------------------------- | ------------------------ |
| `bgm/the-old-tower-inn.wav` | Medieval: The Old Tower Inn (loop WAV) | RandomMind | https://opengameart.org/content/medieval-the-old-tower-inn | CC0 1.0 | No                   | User supplied 2026-10-03; original download date unknown | None by this integration |
| `sfx/turn-chime.wav`        | wind chimes - single 01.wav            | Anthousai  | https://freesound.org/people/Anthousai/sounds/398494/      | CC0 1.0 | No                   | User supplied 2026-10-03; original download date unknown | None by this integration |

License URL: https://creativecommons.org/publicdomain/zero/1.0/

Both source pages were checked on 2026-10-03 and list CC0. This is the source-page verification date, not an audio-file retrieval date.

The source references above identify the selected assets. The music file's embedded title and author match the reference; the supplied chime has no embedded source identity. Both files use 44.1 kHz, 16-bit PCM. Music is stereo (49.951 seconds); the chime is mono (1.414 seconds). No trimming, transcoding or other modification was performed by this integration.

SHA-256 of the supplied files:

- Music: `e18b497fb0edde74a745c4b5a0b90b3fc346c44555f33e3a1485411bbcc171bc`
- Chime: `7ef1ed4e5d68938228923ee8cf79c578a26e899d1b506db24a6c52940bf5ee73`

Audio starts on the first ordinary click, tap or typing gesture, respecting saved mute preferences. Sound → Enable sound remains available to retry blocked playback. Audio remains optional and failed/missing media never blocks gameplay. Automated behavior tests mock playback; local browser verification can additionally check decoding and playback of these WAV files without depending on hearing sound.

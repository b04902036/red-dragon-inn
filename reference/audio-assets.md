# Audio asset reference

## Background music — preferred

**Medieval: The Old Tower Inn**  
Author: RandomMind  
Source: https://opengameart.org/content/medieval-the-old-tower-inn  
License: CC0 1.0 / public-domain dedication  
OpenGameArt provides both a full MP3 and a loop WAV. The source page states that the track can be freely used for any purpose.

Recommended local target:

```text
public/audio/bgm/the-old-tower-inn.wav
```

Prefer the loop WAV for seamless game-table looping. If bundle size is a concern, use the MP3 and test the loop seam.

## Background alternatives

**Medieval: The Bard's Tale** — RandomMind — CC0  
https://opengameart.org/content/medieval-the-bards-tale

**Tavern** — yd — CC0  
https://lpc.opengameart.org/content/tavern-0

**Crowded Pub** — Bobjt — CC0  
https://opengameart.org/content/crowded-pub

Do not rotate through tracks until one-track looping is stable and tested.

## Turn / attention sound — preferred

**wind chimes - single 01.wav**  
Author: Anthousai  
Source: https://freesound.org/people/Anthousai/sounds/398494/  
License: Creative Commons 0  
Duration: approximately 5 seconds  
Description: single wind-chime tube hit.

Recommended:

- trim only silence if needed
- do not time-stretch or make it harsh
- normalize conservatively
- the audible transient should be brief and clear

Recommended local target:

```text
public/audio/sfx/turn-chime.wav
```

Freesound may require a free account to download the original file.

Alternative:
**wind chimes - single 03.wav** — same author — CC0  
https://freesound.org/people/Anthousai/sounds/398492/

## Provenance file

For every bundled audio asset, record in:

```text
public/audio/LICENSES.md
```

Fields:

- local filename
- asset title
- author
- source URL
- license
- license URL
- retrieved date
- modifications made

Do not rely on memory of a license; keep the source link in the repository.

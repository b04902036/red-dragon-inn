# Optional tavern audio

The compact Sound menu appears beside Language on every page. Music and turn sounds have independent volume and mute controls, plus a master switch. Preferences persist under `rdi:audio`. Defaults are music 20%, SFX 60%, both enabled, with playback locked until the user presses Enable sound. Music continues across landing, lobby and game; rerenders and resyncs reuse the same loop element. Unmount pauses both elements and removes listeners. Missing media or rejected autoplay produces a nonblocking notice; gameplay remains available and playback is not automatically retried.

`AudioEngine` is the only media construction/playback boundary. The server projection supplies an `attention` object with player, kind and stable key. Turn identity uses match/turn/phase; responses use window/priority/pass/submission identity; choices use window/operation identity; gambling uses source/priority/pass identity. State version, locale and private-state arrival are excluded. The audio layer consumes each local key once and stores a bounded history in sessionStorage, so reconnect, refresh and resync cannot replay an already observed prompt. Locked or muted prompts are consumed without queuing a later surprise sound. A new phase or priority prompt receives its own key.

## Assets

The specified files are absent. Following Step 15, exact local paths and manual original-file placement are documented in [audio provenance](../public/audio/LICENSES.md). No alternate music, preview streams, hotlinks or differently licensed substitutes were added. Both selected source pages list CC0; the originals have not been retrieved. The implementation and tests operate without the files, but actual audible playback requires manual placement.

## Visual and audio verification

Run `npm run dev:fixture`. Open Sound, adjust each volume and reload to confirm persistence. Before pressing Enable sound, there should be no audio request/playback. After placing the two original files, press Enable sound: music should loop once. Create/join in separate windows and complete a turn; only the player whose new prompt needs attention should hear a chime. Switch language and reconnect the same pending prompt: no repeated chime. Disable all audio and complete another turn. The controls also have Traditional Chinese accessible labels. Browser tests mock the playback boundary so CI never needs to hear sound.

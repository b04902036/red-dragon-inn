import type { AudioSettings } from './settings';
import { BufferedMusic } from './buffered-music';
import { VoiceQueue } from './voice-queue';
export const audioPaths = {
  music: '/audio/bgm/the-old-tower-inn.wav',
  chime: '/audio/sfx/turn-chime.wav',
  voice: '/audio/voice/en-US/sometimes-response.mp3',
};
export interface AudioElement {
  loop: boolean;
  volume: number;
  currentTime: number;
  play: () => Promise<void>;
  pause: () => void;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
  dispose?: () => void;
}
export type AudioStatus = 'locked' | 'ready' | 'unavailable';
/** One playback boundary; no audio resources are created before a gesture. */
export class AudioEngine {
  private music: AudioElement | null = null;
  private chime: AudioElement | null = null;
  private voices: VoiceQueue;
  private voiceActive = false;
  private cardSeen = new Set<string>();
  private musicPlaying = false;
  private unlocked = false;
  private disposed = false;
  private seen = new Set<string>();
  private listener: ((status: AudioStatus) => void) | null = null;
  status: AudioStatus = 'locked';
  constructor(
    private settings: AudioSettings,
    private factory: (path: string) => AudioElement = (path) =>
      path === audioPaths.music ? new BufferedMusic(path) : new Audio(path),
    private session: Pick<Storage, 'getItem' | 'setItem'> | null = null,
  ) {
    this.voices = new VoiceQueue(settings, factory, (active) => {
      this.voiceActive = active;
      if (this.music) this.music.volume = this.musicVolume();
    });
    try {
      const cards: unknown = JSON.parse(
        session?.getItem('rdi:card-voice-seen') ?? '[]',
      );
      if (Array.isArray(cards))
        this.cardSeen = new Set(
          cards.filter((key): key is string => typeof key === 'string'),
        );
      const saved: unknown = JSON.parse(
        session?.getItem('rdi:attention-seen') ?? '[]',
      );
      if (Array.isArray(saved))
        this.seen = new Set(
          saved
            .filter((key): key is string => typeof key === 'string')
            .slice(-256),
        );
    } catch {
      /* Restricted storage keeps in-memory deduplication. */
    }
  }
  subscribe(listener: (status: AudioStatus) => void) {
    this.disposed = false;
    this.listener = listener;
    listener(this.status);
    return () => {
      this.listener = null;
    };
  }
  private update(status: AudioStatus) {
    this.status = status;
    this.listener?.(status);
  }
  private mediaError = () => {
    this.music?.pause();
    this.musicPlaying = false;
    this.update('unavailable');
  };
  private playbackError = (error: unknown) => {
    this.musicPlaying = false;
    if (
      typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      error.name === 'NotAllowedError'
    ) {
      // Policy rejection needs another gesture, not a manual settings action.
      this.unlocked = false;
      this.update('locked');
      return;
    }
    this.mediaError();
  };
  async unlock() {
    if (this.disposed || !this.settings.enabled) return;
    this.unlocked = true;
    try {
      if (!this.music) {
        this.music = this.factory(audioPaths.music);
        this.music.loop = true;
        this.music.addEventListener('error', this.mediaError);
      }
      if (!this.chime) {
        this.chime = this.factory(audioPaths.chime);
        this.chime.addEventListener('error', this.mediaError);
      }
      this.update('ready');
      this.applySettings(this.settings);
    } catch {
      this.update('unavailable');
    }
  }
  applySettings(settings: AudioSettings) {
    this.settings = settings;
    this.voices.applySettings(settings);
    if (this.music) this.music.volume = this.musicVolume();
    if (this.chime) this.chime.volume = settings.sfxVolume;
    if (!settings.enabled || settings.sfxMuted || settings.sfxVolume === 0)
      this.chime?.pause();
    if (
      !settings.enabled ||
      settings.musicMuted ||
      settings.musicVolume === 0
    ) {
      this.music?.pause();
      this.musicPlaying = false;
      return;
    }
    if (
      this.unlocked &&
      this.music &&
      !this.musicPlaying &&
      this.status === 'ready'
    ) {
      this.musicPlaying = true;
      const music = this.music;
      void music
        .play()
        .then(() => {
          if (this.disposed) music.pause();
        })
        .catch((error: unknown) => {
          if (!this.disposed && this.music === music) this.playbackError(error);
        });
    }
  }
  observe(key: string | null, local: boolean, voice = false) {
    if (!key || !local || this.seen.has(key)) return;
    this.seen.add(key);
    try {
      this.session?.setItem(
        'rdi:attention-seen',
        JSON.stringify([...this.seen].slice(-256)),
      );
    } catch {
      /* Keep in-memory deduplication. */
    }
    if (
      this.disposed ||
      !this.unlocked ||
      !this.settings.enabled ||
      this.settings.sfxMuted ||
      this.settings.sfxVolume === 0 ||
      this.status !== 'ready'
    )
      return;
    try {
      if (voice) {
        this.voices.enqueue({ path: audioPaths.voice, kind: 'ATTENTION' });
        return;
      }
      const audio = this.chime;
      if (!audio) return;
      audio.volume = this.settings.sfxVolume;
      audio.currentTime = 0;
      void audio.play().catch(this.playbackError);
    } catch {
      /* Missing optional voice does not affect gameplay. */
    }
  }
  private musicVolume() {
    return (
      this.settings.musicVolume *
      (this.voiceActive && this.settings.duckMusic ? 0.3 : 1)
    );
  }
  observeCard(key: string, path: string | null, live: boolean) {
    if (this.cardSeen.has(key)) return;
    this.cardSeen.add(key);
    try {
      this.session?.setItem(
        'rdi:card-voice-seen',
        JSON.stringify([...this.cardSeen]),
      );
    } catch {
      /* In-memory deduplication remains active. */
    }
    if (
      !live ||
      !path ||
      !/^\/audio\/cards\/[a-z][a-z0-9_]*\/[a-z][a-z0-9_]*\.mp3$/.test(path) ||
      this.disposed ||
      !this.unlocked ||
      this.status !== 'ready'
    )
      return;
    this.voices.enqueue({ path, kind: 'CARD' });
  }
  dispose() {
    this.disposed = true;
    this.voices.dispose();
    for (const audio of [this.music, this.chime]) {
      audio?.pause();
      audio?.removeEventListener('error', this.mediaError);
      audio?.dispose?.();
    }
    this.music = null;
    this.chime = null;
    this.musicPlaying = false;
    this.unlocked = false;
    this.status = 'locked';
  }
}

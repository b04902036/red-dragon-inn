import type { AudioElement } from './audio-engine';
import type { AudioSettings } from './settings';
type Voice = { path: string; kind: 'CARD' | 'ATTENTION' };
/** A media-only queue; it never owns game state, prompts or command availability. */
export class VoiceQueue {
  private queue: Voice[] = [];
  private active: {
    item: Voice;
    audio: AudioElement;
    finish: () => void;
  } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private cache = new Map<string, AudioElement>();
  constructor(
    private settings: AudioSettings,
    private factory: (path: string) => AudioElement,
    private changed: (active: boolean) => void,
  ) {}
  private volume(item: Voice) {
    if (!this.settings.enabled) return 0;
    return item.kind === 'CARD'
      ? !this.settings.cardVoicesEnabled || this.settings.voiceMuted
        ? 0
        : this.settings.voiceVolume
      : this.settings.sfxMuted
        ? 0
        : this.settings.sfxVolume;
  }
  enqueue(item: Voice) {
    if (this.volume(item) === 0) return;
    this.queue.push(item);
    this.advance();
  }
  applySettings(settings: AudioSettings) {
    this.settings = settings;
    this.queue = this.queue.filter((item) => this.volume(item) > 0);
    if (this.active) {
      this.active.audio.volume = this.volume(this.active.item);
      if (this.active.audio.volume === 0) this.active.finish();
    }
  }
  private advance() {
    if (this.active) return;
    const item = this.queue.shift();
    if (!item) {
      this.changed(false);
      return;
    }
    let audio: AudioElement;
    try {
      audio = this.cache.get(item.path) ?? this.factory(item.path);
      this.cache.set(item.path, audio);
    } catch {
      this.advance();
      return;
    }
    const finish = () => {
      if (this.active?.finish !== finish) return;
      if (this.timer !== null) clearTimeout(this.timer);
      this.timer = null;
      audio.removeEventListener('ended', finish);
      audio.removeEventListener('error', finish);
      audio.pause();
      this.active = null;
      this.advance();
    };
    this.active = { item, audio, finish };
    audio.addEventListener('ended', finish);
    audio.addEventListener('error', finish);
    audio.volume = this.volume(item);
    audio.currentTime = 0;
    this.changed(true);
    // A broken optional asset cannot stall later speech forever.
    this.timer = setTimeout(finish, 30000);
    try {
      void audio.play().catch(finish);
    } catch {
      finish();
    }
  }
  dispose() {
    this.queue = [];
    this.active?.finish();
    for (const audio of this.cache.values()) {
      audio.pause();
      audio.dispose?.();
    }
    this.cache.clear();
  }
}

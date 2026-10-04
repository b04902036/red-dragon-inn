import type { AudioElement } from './audio-engine';

/** Decode once and loop on the audio rendering clock, without media-element seeks. */
export class BufferedMusic implements AudioElement {
  loop = true;
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private buffer: Promise<AudioBuffer> | null = null;
  private source: AudioBufferSourceNode | null = null;
  private offset = 0;
  private startedAt = 0;
  private level = 1;
  private generation = 0;
  private disposed = false;
  private controller = new AbortController();

  constructor(private path: string) {}

  get volume() {
    return this.level;
  }
  set volume(value: number) {
    this.level = value;
    if (this.gain) this.gain.gain.value = value;
  }
  get currentTime() {
    return this.source
      ? (this.offset + this.context!.currentTime - this.startedAt) %
          this.source.buffer!.duration
      : this.offset;
  }
  set currentTime(value: number) {
    this.pause();
    this.offset = value;
  }

  async play() {
    if (this.disposed || this.source) return;
    const generation = ++this.generation;
    if (!this.context) {
      this.context = new AudioContext();
      this.gain = this.context.createGain();
      this.gain.gain.value = this.level;
      this.gain.connect(this.context.destination);
    }
    const context = this.context;
    // Resume synchronously in the user gesture, before fetching/decoding the WAV.
    const resumed = context.resume();
    if (!this.buffer) {
      this.buffer = fetch(this.path, { signal: this.controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error('Music unavailable');
          return response.arrayBuffer();
        })
        .then((bytes) => context.decodeAudioData(bytes))
        .catch((error: unknown) => {
          this.buffer = null;
          throw error;
        });
    }
    const [, buffer] = await Promise.all([resumed, this.buffer]);
    if (this.disposed || generation !== this.generation) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = this.loop;
    source.connect(this.gain!);
    this.offset %= buffer.duration;
    source.start(0, this.offset);
    this.startedAt = context.currentTime;
    this.source = source;
  }

  pause() {
    ++this.generation;
    if (!this.source) return;
    this.offset = this.currentTime;
    this.source.stop();
    this.source.disconnect();
    this.source = null;
  }

  // Fetch, decode and context errors reject play() at the shared playback boundary.
  addEventListener() {}
  removeEventListener() {}

  dispose() {
    this.disposed = true;
    this.pause();
    this.controller.abort();
    this.gain?.disconnect();
    if (this.context) void this.context.close().catch(() => {});
    this.context = null;
    this.gain = null;
    this.buffer = null;
  }
}

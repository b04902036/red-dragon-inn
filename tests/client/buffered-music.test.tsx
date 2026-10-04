import { beforeEach, expect, it, vi } from 'vitest';
import { BufferedMusic } from '../../src/client/audio/buffered-music';
import { AudioEngine, audioPaths } from '../../src/client/audio/audio-engine';
import { defaultAudioSettings } from '../../src/client/audio/settings';

const bufferSource = () => ({
  buffer: null,
  loop: false,
  connect: vi.fn(),
  disconnect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
});
class Context {
  static instances: Context[] = [];
  currentTime = 0;
  destination = {};
  gain = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
  sources: ReturnType<typeof bufferSource>[] = [];
  resume = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);
  decodeAudioData = vi.fn().mockResolvedValue({ duration: 50 });
  constructor() {
    Context.instances.push(this);
  }
  createGain() {
    return this.gain;
  }
  createBufferSource() {
    const source = bufferSource();
    this.sources.push(source);
    return source;
  }
}
const bytes = new ArrayBuffer(8);
const fetchMusic = vi.fn();
beforeEach(() => {
  Context.instances = [];
  fetchMusic.mockReset().mockResolvedValue({
    ok: true,
    arrayBuffer: async () => bytes,
  });
  vi.stubGlobal('AudioContext', Context);
  vi.stubGlobal('fetch', fetchMusic);
});

it('resumes on the gesture before loading, then loops one decoded buffer without seeking', async () => {
  const music = new BufferedMusic(audioPaths.music);
  music.volume = 0.2;
  expect(Context.instances).toHaveLength(0);
  expect(fetchMusic).not.toHaveBeenCalled();
  const playing = music.play();
  const context = Context.instances[0]!;
  expect(context.resume).toHaveBeenCalledTimes(1);
  expect(context.resume.mock.invocationCallOrder[0]).toBeLessThan(
    fetchMusic.mock.invocationCallOrder[0]!,
  );
  await playing;
  expect(fetchMusic).toHaveBeenCalledWith(audioPaths.music, {
    signal: expect.any(AbortSignal),
  });
  expect(context.decodeAudioData).toHaveBeenCalledExactlyOnceWith(bytes);
  expect(context.sources).toHaveLength(1);
  expect(context.sources[0]).toMatchObject({
    loop: true,
    buffer: { duration: 50 },
  });
  expect(context.sources[0]!.start).toHaveBeenCalledExactlyOnceWith(0, 0);
  expect(context.sources[0]!.connect).toHaveBeenCalledWith(context.gain);
  expect(context.gain.gain.value).toBe(0.2);
  context.currentTime = 102;
  expect(music.currentTime).toBe(2);
  await music.play();
  expect(context.sources).toHaveLength(1);
  expect(fetchMusic).toHaveBeenCalledTimes(1);
  music.dispose();
});

it('mute pauses at the loop position and unmute reuses the buffer at that position', async () => {
  const music = new BufferedMusic(audioPaths.music);
  await music.play();
  const context = Context.instances[0]!;
  context.currentTime = 53;
  music.pause();
  expect(music.currentTime).toBe(3);
  expect(context.sources[0]!.stop).toHaveBeenCalledTimes(1);
  expect(context.sources[0]!.disconnect).toHaveBeenCalledTimes(1);
  context.currentTime = 100;
  music.volume = 0.4;
  expect(music.volume).toBe(0.4);
  expect(context.gain.gain.value).toBe(0.4);
  await music.play();
  expect(context.sources[1]!.start).toHaveBeenCalledWith(0, 3);
  context.currentTime = 104;
  expect(music.currentTime).toBe(7);
  expect(fetchMusic).toHaveBeenCalledTimes(1);
  expect(context.decodeAudioData).toHaveBeenCalledTimes(1);
  music.currentTime = 51;
  await music.play();
  expect(context.sources[2]!.start).toHaveBeenCalledWith(0, 1);
  music.dispose();
});

it('stops late loading from starting after mute, and supports unmute during the same load', async () => {
  let decode!: (buffer: { duration: number }) => void;
  const music = new BufferedMusic(audioPaths.music);
  // Create the context synchronously; fetch's continuation has not decoded yet.
  const first = music.play();
  const context = Context.instances[0]!;
  context.decodeAudioData.mockReturnValueOnce(
    new Promise((resolve) => {
      decode = resolve;
    }),
  );
  await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalled());
  music.pause();
  const second = music.play();
  decode({ duration: 50 });
  await Promise.all([first, second]);
  expect(context.sources).toHaveLength(1);
  expect(fetchMusic).toHaveBeenCalledTimes(1);
  music.dispose();
});

it('mute while loading leaves playback stopped until a later play', async () => {
  const music = new BufferedMusic(audioPaths.music);
  const playing = music.play();
  music.pause();
  await playing;
  expect(Context.instances[0]!.sources).toHaveLength(0);
  await music.play();
  expect(Context.instances[0]!.sources).toHaveLength(1);
  music.dispose();
});

it('dispose cancels loading, closes the context and never starts late audio', async () => {
  const music = new BufferedMusic(audioPaths.music);
  const playing = music.play();
  const context = Context.instances[0]!;
  const signal = fetchMusic.mock.calls[0]![1].signal as AbortSignal;
  music.dispose();
  await playing;
  expect(signal.aborted).toBe(true);
  expect(context.close).toHaveBeenCalledTimes(1);
  expect(context.gain.disconnect).toHaveBeenCalledTimes(1);
  expect(context.sources).toHaveLength(0);
  await music.play();
  expect(Context.instances).toHaveLength(1);
});

it.each(['http', 'network', 'decode'])(
  'a %s failure rejects playback and retries on the next play',
  async (kind) => {
    if (kind === 'http') fetchMusic.mockResolvedValueOnce({ ok: false });
    if (kind === 'network')
      fetchMusic.mockRejectedValueOnce(new Error('Offline'));
    const music = new BufferedMusic(audioPaths.music);
    const failed = music.play();
    const context = Context.instances[0]!;
    if (kind === 'decode')
      context.decodeAudioData.mockRejectedValueOnce(new Error('Invalid WAV'));
    await expect(failed).rejects.toThrow();
    expect(context.sources).toHaveLength(0);
    await music.play();
    expect(context.sources).toHaveLength(1);
    expect(fetchMusic).toHaveBeenCalledTimes(2);
    music.dispose();
  },
);

it('autoplay rejection is retried with another resume and the cached decoded buffer', async () => {
  vi.stubGlobal(
    'AudioContext',
    class extends Context {
      constructor() {
        super();
        this.resume.mockRejectedValueOnce(
          new DOMException('Blocked', 'NotAllowedError'),
        );
      }
    },
  );
  const music = new BufferedMusic(audioPaths.music);
  await expect(music.play()).rejects.toMatchObject({ name: 'NotAllowedError' });
  await music.play();
  const context = Context.instances[0]!;
  expect(context.sources).toHaveLength(1);
  expect(context.resume).toHaveBeenCalledTimes(2);
  expect(fetchMusic).toHaveBeenCalledTimes(1);
  music.dispose();
});

it('the default engine uses buffered music, preserves SFX, and disposes its context', async () => {
  const media = {
    volume: 1,
    currentTime: 0,
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  const audio = vi.fn(function () {
    return media;
  });
  vi.stubGlobal('Audio', audio);
  const engine = new AudioEngine(defaultAudioSettings);
  expect(Context.instances).toHaveLength(0);
  await engine.unlock();
  await vi.waitFor(() => expect(Context.instances[0]!.sources).toHaveLength(1));
  expect(audio).toHaveBeenCalledExactlyOnceWith(audioPaths.chime);
  const context = Context.instances[0]!;
  engine.applySettings({ ...defaultAudioSettings, musicVolume: 0.5 });
  expect(context.gain.gain.value).toBe(0.5);
  expect(context.sources).toHaveLength(1);
  engine.observe('turn', true);
  expect(media.play).toHaveBeenCalledTimes(1);
  engine.applySettings({ ...defaultAudioSettings, musicMuted: true });
  expect(context.sources[0]!.stop).toHaveBeenCalledTimes(1);
  engine.applySettings(defaultAudioSettings);
  await vi.waitFor(() => expect(context.sources).toHaveLength(2));
  engine.dispose();
  expect(context.close).toHaveBeenCalledTimes(1);
  expect(media.pause).toHaveBeenCalled();
});

it('a fetch rejection after engine disposal cannot overwrite locked status', async () => {
  let reject!: (error: Error) => void;
  fetchMusic.mockReturnValueOnce(
    new Promise((_, failure) => {
      reject = failure;
    }),
  );
  vi.stubGlobal(
    'Audio',
    class {
      addEventListener() {}
      pause() {}
      removeEventListener() {}
    },
  );
  const engine = new AudioEngine(defaultAudioSettings);
  await engine.unlock();
  engine.dispose();
  reject(new Error('Aborted'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(engine.status).toBe('locked');
});

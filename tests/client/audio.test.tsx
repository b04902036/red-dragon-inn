import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, it, expect, vi } from 'vitest';
import { AudioEngine, audioPaths } from '../../src/client/audio/audio-engine';
import type { AudioElement } from '../../src/client/audio/audio-engine';
import {
  defaultAudioSettings,
  readAudioSettings,
  saveAudioSettings,
  AUDIO_STORAGE_KEY,
} from '../../src/client/audio/settings';
import {
  AudioProvider,
  AudioControls,
} from '../../src/client/audio/AudioProvider';
import {
  LocaleProvider,
  LanguageSelector,
} from '../../src/client/i18n/LocaleProvider';
import { useAttentionChime } from '../../src/client/audio/use-attention-chime';
import { projectPublicGame } from '../../src/protocol/projections';
import type { PublicGameView } from '../../src/protocol/views';
import { started } from '../fixtures/core-match';
class Media implements AudioElement {
  static instances: Media[] = [];
  loop = false;
  volume = 1;
  currentTime = 0;
  play = vi.fn().mockResolvedValue(undefined);
  pause = vi.fn();
  listeners = new Map<string, () => void>();
  constructor(readonly path: string) {
    Media.instances.push(this);
  }
  addEventListener(type: string, listener: () => void) {
    this.listeners.set(type, listener);
  }
  removeEventListener(type: string) {
    this.listeners.delete(type);
  }
}
beforeEach(() => {
  Media.instances = [];
  sessionStorage.clear();
  vi.stubGlobal('Audio', Media);
});
const factory = (path: string) => new Media(path);
it('media construction failure remains optional, deduplicates prompts and recovers only after another gesture', async () => {
  let unavailable = true;
  const engine = new AudioEngine(defaultAudioSettings, (path) => {
    if (unavailable) throw new Error('Media unavailable');
    return factory(path);
  });
  await engine.unlock();
  expect(engine.status).toBe('unavailable');
  engine.observe('failed-local-prompt', true);
  expect(Media.instances).toHaveLength(0);
  unavailable = false;
  await engine.unlock();
  expect(engine.status).toBe('ready');
  expect(Media.instances[0]!.play).toHaveBeenCalledTimes(1);
  engine.observe('failed-local-prompt', true);
  expect(Media.instances[1]!.play).not.toHaveBeenCalled();
  engine.observe('new-local-prompt', true);
  expect(Media.instances[1]!.play).toHaveBeenCalledTimes(1);
  engine.dispose();
});
function Probe({ view }: { view: PublicGameView }) {
  useAttentionChime(view, 'player_0');
  return null;
}
it('loads sensible independent defaults, clamps persisted volume and tolerates bad or restricted storage', () => {
  expect(readAudioSettings(localStorage)).toEqual(defaultAudioSettings);
  saveAudioSettings(localStorage, {
    ...defaultAudioSettings,
    musicVolume: 0.1,
    sfxVolume: 0.9,
    sfxMuted: true,
  });
  expect(readAudioSettings(localStorage)).toMatchObject({
    musicVolume: 0.1,
    sfxVolume: 0.9,
    sfxMuted: true,
  });
  localStorage.setItem(
    AUDIO_STORAGE_KEY,
    JSON.stringify({
      musicVolume: 4,
      sfxVolume: -2,
      enabled: false,
      musicMuted: 'wrong',
    }),
  );
  expect(readAudioSettings(localStorage)).toMatchObject({
    musicVolume: 1,
    sfxVolume: 0,
    enabled: false,
    musicMuted: false,
  });
  localStorage.setItem(AUDIO_STORAGE_KEY, 'bad');
  expect(readAudioSettings(localStorage)).toEqual(defaultAudioSettings);
  expect(
    readAudioSettings({
      getItem: () => {
        throw new Error('blocked');
      },
    }),
  ).toEqual(defaultAudioSettings);
  expect(() =>
    saveAudioSettings(
      {
        setItem: () => {
          throw new Error('blocked');
        },
      },
      defaultAudioSettings,
    ),
  ).not.toThrow();
});
it('creates no media before a gesture and starts one loop that survives repeated unlock/settings', async () => {
  const engine = new AudioEngine({ ...defaultAudioSettings }, factory);
  engine.applySettings(defaultAudioSettings);
  engine.observe('locked', true);
  expect(Media.instances).toHaveLength(0);
  await engine.unlock();
  await engine.unlock();
  engine.applySettings({ ...defaultAudioSettings, sfxVolume: 0.3 });
  expect(Media.instances).toHaveLength(2);
  expect(Media.instances[0]).toMatchObject({
    path: audioPaths.music,
    loop: true,
    volume: 0.2,
  });
  expect(Media.instances[0]!.play).toHaveBeenCalledTimes(1);
  expect(Media.instances[1]!.volume).toBe(0.3);
  engine.dispose();
  expect(
    Media.instances.every((media) => media.pause.mock.calls.length > 0),
  ).toBe(true);
});
it.each([{ musicMuted: true }, { enabled: false }, { musicVolume: 0 }])(
  'music mute/disable/zero prevents playback: %s',
  async (settings) => {
    const engine = new AudioEngine(
      { ...defaultAudioSettings, ...settings },
      factory,
    );
    await engine.unlock();
    expect(Media.instances[0]?.play.mock.calls.length ?? 0).toBe(0);
    engine.observe('a', true);
    engine.dispose();
  },
);
it.each([{ sfxMuted: true }, { sfxVolume: 0 }, { enabled: false }])(
  'SFX mute/disable/zero prevents a chime: %s',
  async (settings) => {
    const engine = new AudioEngine(
      { ...defaultAudioSettings, ...settings },
      factory,
    );
    await engine.unlock();
    engine.observe('a', true);
    expect(Media.instances[1]?.play.mock.calls.length ?? 0).toBe(0);
  },
);
it('plays exactly once per new local key, ignores remote/repeated prompts, and deduplicates refresh/reconnect', async () => {
  const engine = new AudioEngine(defaultAudioSettings, factory, sessionStorage);
  await engine.unlock();
  engine.observe('remote', false);
  engine.observe(null, true);
  engine.observe('a', true);
  engine.observe('a', true);
  engine.observe('b', true);
  expect(Media.instances[1]!.play).toHaveBeenCalledTimes(2);
  engine.dispose();
  const restored = new AudioEngine(
    defaultAudioSettings,
    factory,
    sessionStorage,
  );
  await restored.unlock();
  restored.observe('b', true);
  expect(Media.instances[3]!.play).not.toHaveBeenCalled();
  restored.observe('c', true);
  expect(Media.instances[3]!.play).toHaveBeenCalledTimes(1);
});
it('handles rejected autoplay, rejected chimes, media errors and cleanup without retry loops', async () => {
  const engine = new AudioEngine(defaultAudioSettings, (path) => {
    const media = new Media(path);
    media.play.mockRejectedValue(new Error('Blocked'));
    return media;
  });
  const listener = vi.fn();
  const unsubscribe = engine.subscribe(listener);
  await engine.unlock();
  await waitFor(() => expect(engine.status).toBe('unavailable'));
  engine.applySettings(defaultAudioSettings);
  engine.observe('one', true);
  expect(Media.instances[0]!.play).toHaveBeenCalledTimes(1);
  unsubscribe();
  engine.dispose();
  await engine.unlock();
  expect(Media.instances).toHaveLength(2);
  const second = new AudioEngine(defaultAudioSettings, factory);
  await second.unlock();
  Media.instances.at(-1)!.play.mockRejectedValue(new Error('missing'));
  second.observe('two', true);
  await waitFor(() => expect(second.status).toBe('unavailable'));
  Media.instances.at(-1)!.listeners.get('error')!();
  expect(Media.instances.at(-2)!.pause).toHaveBeenCalled();
});
it('consumes a locked prompt, handles storage failures and caps attention history', async () => {
  const engine = new AudioEngine(defaultAudioSettings, factory, {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
  });
  engine.observe('locked', true);
  await engine.unlock();
  engine.observe('locked', true);
  expect(Media.instances[1]!.play).not.toHaveBeenCalled();
  for (let index = 0; index < 260; index++) engine.observe(String(index), true);
  expect(Media.instances[1]!.play).toHaveBeenCalledTimes(260);
  engine.observe('0', true);
  expect(Media.instances[1]!.play).toHaveBeenCalledTimes(260);
  engine.dispose();
  engine.observe('disposed', true);
});
it('unlocks via an explicit accessible button, localizes labels and never replays for locale, private state or rerenders', async () => {
  const user = userEvent.setup();
  let view = projectPublicGame(started(1, 7));
  const initial = { ...view, attention: null };
  const tree = (state: PublicGameView) => (
    <LocaleProvider>
      <AudioProvider>
        <LanguageSelector />
        <AudioControls />
        <Probe view={state} />
      </AudioProvider>
    </LocaleProvider>
  );
  const rendered = render(tree(initial));
  expect(Media.instances).toHaveLength(0);
  await user.click(screen.getByText('Sound', { exact: true }));
  await user.click(screen.getByRole('button', { name: 'Enable sound' }));
  expect(Media.instances[0]!.play).toHaveBeenCalledTimes(1);
  rendered.rerender(tree(view));
  await waitFor(() =>
    expect(Media.instances[1]!.play).toHaveBeenCalledTimes(1),
  );
  rendered.rerender(tree({ ...view }));
  await user.selectOptions(screen.getByLabelText('Language'), 'zh-TW');
  expect(screen.getByLabelText('音樂音量')).toBeVisible();
  expect(screen.getByLabelText('提示音音量')).toBeVisible();
  expect(Media.instances[1]!.play).toHaveBeenCalledTimes(1);
  expect(Media.instances).toHaveLength(2);
  await user.click(screen.getByLabelText('回合提示音'));
  expect(readAudioSettings(localStorage).sfxMuted).toBe(true);
  view = { ...view, attention: { ...view.attention!, key: 'new' } };
  act(() => rendered.rerender(tree(view)));
  expect(Media.instances[1]!.play).toHaveBeenCalledTimes(1);
  rendered.unmount();
  expect(Media.instances[0]!.pause).toHaveBeenCalled();
});

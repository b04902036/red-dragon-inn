import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { AudioEngine } from './audio-engine';
import type { AudioStatus } from './audio-engine';
import { AudioContext, useAudio } from './context';
import {
  readAudioSettings,
  saveAudioSettings,
  defaultAudioSettings,
} from './settings';
import { useLocale } from '../i18n/context';
export function AudioProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(() => {
    try {
      return readAudioSettings(localStorage);
    } catch {
      return { ...defaultAudioSettings };
    }
  });
  const [engine] = useState(() => {
    try {
      return new AudioEngine(settings, undefined, sessionStorage);
    } catch {
      return new AudioEngine(settings);
    }
  });
  const [status, setStatus] = useState<AudioStatus>('locked');
  useEffect(() => {
    const unsubscribe = engine.subscribe(setStatus);
    return () => {
      unsubscribe();
      engine.dispose();
    };
  }, [engine]);
  return (
    <AudioContext
      value={{
        engine,
        status,
        settings,
        update: (next) => {
          setSettings(next);
          engine.applySettings(next);
          try {
            saveAudioSettings(localStorage, next);
          } catch {
            /* Settings remain active for this visit. */
          }
        },
        unlock: () => {
          void engine.unlock();
        },
      }}
    >
      {children}
    </AudioContext>
  );
}
export function AudioControls() {
  const { settings, update, unlock, status } = useAudio();
  const { t } = useLocale();
  return (
    <details className="audio-settings">
      <summary>{t('audio.settings')}</summary>
      <div className="audio-controls">
        <button onClick={unlock} disabled={!settings.enabled}>
          {t(status === 'ready' ? 'audio.enabled' : 'audio.enable')}
        </button>
        {status === 'unavailable' && <p>{t('audio.unavailable')}</p>}
        <label>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(event) =>
              update({ ...settings, enabled: event.target.checked })
            }
          />
          {t('audio.master')}
        </label>
        <label>
          <input
            type="checkbox"
            checked={!settings.musicMuted}
            onChange={(event) =>
              update({ ...settings, musicMuted: !event.target.checked })
            }
          />
          {t('audio.music')}
        </label>
        <label>
          {t('audio.musicVolume')}
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.musicVolume}
            onChange={(event) =>
              update({ ...settings, musicVolume: Number(event.target.value) })
            }
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={!settings.sfxMuted}
            onChange={(event) =>
              update({ ...settings, sfxMuted: !event.target.checked })
            }
          />
          {t('audio.sfx')}
        </label>
        <label>
          {t('audio.sfxVolume')}
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.sfxVolume}
            onChange={(event) =>
              update({ ...settings, sfxVolume: Number(event.target.value) })
            }
          />
        </label>
      </div>
    </details>
  );
}

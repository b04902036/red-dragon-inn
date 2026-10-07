import { useState, useEffect, useCallback } from 'react';
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
import { parseCardVoices, emptyCardVoices } from './card-voice-catalog';
import type { CardVoiceCatalog } from './card-voice-catalog';
export function AudioProvider({ children }: { children: ReactNode }) {
  const [cardVoices, setCardVoices] = useState<CardVoiceCatalog | null>(null);
  const [catalogRequested, setCatalogRequested] = useState(false);
  const requestCardVoices = useCallback(() => setCatalogRequested(true), []);
  useEffect(() => {
    if (!catalogRequested) return;
    let canceled = false;
    void fetch('/audio/cards/manifest.json')
      .then((response) => {
        if (!response.ok) throw new Error('Voice catalog unavailable');
        return response.json() as Promise<unknown>;
      })
      .then((value) => {
        if (!canceled) setCardVoices(parseCardVoices(value));
      })
      .catch(() => {
        if (!canceled) setCardVoices(emptyCardVoices);
      });
    return () => {
      canceled = true;
    };
  }, [catalogRequested]);
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
    const unlockOnInteraction = () => {
      if (engine.status === 'locked') void engine.unlock();
    };
    const unlockOnClickCapture = (event: MouseEvent) => {
      // Card buttons can stop bubbling; sound controls must apply settings first.
      if (
        event.target instanceof Element &&
        event.target.closest('.audio-settings')
      )
        return;
      unlockOnInteraction();
    };
    const unlockOnSoundControlClick = (event: MouseEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest('.audio-settings')
      )
        unlockOnInteraction();
    };
    const unlockOnPointerUp = (event: PointerEvent) => {
      if (event.button === 0) unlockOnClickCapture(event);
    };
    const unlockOnKey = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        ['Escape', 'Tab', 'Shift', 'Control', 'Alt', 'Meta'].includes(event.key)
      )
        return;
      unlockOnInteraction();
    };
    // Bubble after React controls so disabling audio never starts playback.
    document.addEventListener('click', unlockOnClickCapture, true);
    document.addEventListener('click', unlockOnSoundControlClick);
    document.addEventListener('pointerup', unlockOnPointerUp, true);
    document.addEventListener('keydown', unlockOnKey, true);
    return () => {
      document.removeEventListener('click', unlockOnClickCapture, true);
      document.removeEventListener('click', unlockOnSoundControlClick);
      document.removeEventListener('pointerup', unlockOnPointerUp, true);
      document.removeEventListener('keydown', unlockOnKey, true);
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
        cardVoices,
        requestCardVoices,
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
        <label>
          <input
            type="checkbox"
            checked={settings.cardVoicesEnabled}
            onChange={(event) =>
              update({ ...settings, cardVoicesEnabled: event.target.checked })
            }
          />
          {t('audio.cardVoices')}
        </label>
        <label>
          <input
            type="checkbox"
            checked={!settings.voiceMuted}
            onChange={(event) =>
              update({ ...settings, voiceMuted: !event.target.checked })
            }
          />
          {t('audio.voiceSound')}
        </label>
        <label>
          {t('audio.voiceVolume')}
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.voiceVolume}
            onChange={(event) =>
              update({ ...settings, voiceVolume: Number(event.target.value) })
            }
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.duckMusic}
            onChange={(event) =>
              update({ ...settings, duckMusic: event.target.checked })
            }
          />
          {t('audio.duckMusic')}
        </label>
      </div>
    </details>
  );
}

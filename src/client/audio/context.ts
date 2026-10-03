import { createContext, useContext } from 'react';
import type { AudioEngine, AudioStatus } from './audio-engine';
import { defaultAudioSettings } from './settings';
import type { AudioSettings } from './settings';
export const AudioContext = createContext<{
  engine: AudioEngine | null;
  status: AudioStatus;
  settings: AudioSettings;
  update: (settings: AudioSettings) => void;
  unlock: () => void;
}>({
  engine: null,
  status: 'locked',
  settings: defaultAudioSettings,
  update: () => {},
  unlock: () => {},
});
export const useAudio = () => useContext(AudioContext);

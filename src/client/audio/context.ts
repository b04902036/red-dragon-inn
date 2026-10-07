import { createContext, useContext } from 'react';
import type { AudioEngine, AudioStatus } from './audio-engine';
import { defaultAudioSettings } from './settings';
import type { AudioSettings } from './settings';
import type { CardVoiceCatalog } from './card-voice-catalog';
export const AudioContext = createContext<{
  engine: AudioEngine | null;
  status: AudioStatus;
  settings: AudioSettings;
  update: (settings: AudioSettings) => void;
  unlock: () => void;
  cardVoices: CardVoiceCatalog | null;
  requestCardVoices?: () => void;
}>({
  engine: null,
  status: 'locked',
  settings: defaultAudioSettings,
  update: () => {},
  unlock: () => {},
  cardVoices: null,
});
export const useAudio = () => useContext(AudioContext);

export interface AudioSettings {
  enabled: boolean;
  musicMuted: boolean;
  sfxMuted: boolean;
  musicVolume: number;
  sfxVolume: number;
}
export const AUDIO_STORAGE_KEY = 'rdi:audio';
export const defaultAudioSettings: AudioSettings = {
  enabled: true,
  musicMuted: false,
  sfxMuted: false,
  musicVolume: 0.2,
  sfxVolume: 0.6,
};
export function readAudioSettings(
  storage: Pick<Storage, 'getItem'>,
): AudioSettings {
  try {
    const input: unknown = JSON.parse(
      storage.getItem(AUDIO_STORAGE_KEY) ?? 'null',
    );
    if (!input || typeof input !== 'object') return { ...defaultAudioSettings };
    const record = input as Record<string, unknown>;
    const result = { ...defaultAudioSettings };
    for (const key of ['enabled', 'musicMuted', 'sfxMuted'] as const)
      if (typeof record[key] === 'boolean') result[key] = record[key];
    for (const key of ['musicVolume', 'sfxVolume'] as const)
      if (typeof record[key] === 'number' && Number.isFinite(record[key]))
        result[key] = Math.max(0, Math.min(1, record[key]));
    return result;
  } catch {
    return { ...defaultAudioSettings };
  }
}
export function saveAudioSettings(
  storage: Pick<Storage, 'setItem'>,
  settings: AudioSettings,
) {
  try {
    storage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* Audio remains usable with restricted storage. */
  }
}

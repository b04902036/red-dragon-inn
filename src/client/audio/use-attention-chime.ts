import { useEffect } from 'react';
import type { PublicGameView } from '../../protocol/views';
import { useAudio } from './context';
export function useAttentionChime(view: PublicGameView, playerId: string) {
  const { engine } = useAudio();
  const key = view.attention?.key ?? null;
  const local = view.attention?.playerId === playerId;
  useEffect(() => {
    engine?.observe(key, local);
  }, [engine, key, local]);
}

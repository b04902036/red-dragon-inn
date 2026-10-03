import { useEffect } from 'react';
import type { PrivatePlayerView } from '../../protocol/views';
import { useAudio } from './context';
export function useResponseVoice(
  view: PrivatePlayerView | null,
  playerId: string,
) {
  const { engine } = useAudio();
  const prompt = view?.responsePrompt;
  const key =
    prompt?.hasLegalSometimes && prompt.kind === 'RESPONSE_DECISION'
      ? `voice:${prompt.promptId}`
      : null;
  const local =
    view?.playerId === playerId && prompt?.priorityPlayerId === playerId;
  useEffect(() => {
    engine?.observe(key, local, true);
  }, [engine, key, local]);
}

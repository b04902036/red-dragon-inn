import { useEffect } from 'react';
import type { RoomClientState } from '../room-state';
import { useAudio } from './context';
export function useCardVoices(state: RoomClientState) {
  const { engine, cardVoices, requestCardVoices } = useAudio();
  useEffect(() => requestCardVoices?.(), [requestCardVoices]);
  useEffect(() => {
    if (!engine || !state.publicView) return;
    const live = new Set(state.liveEventIds);
    for (const event of state.log) {
      if (event.type !== 'CARD_PLAYED') continue;
      const character = state.publicView.players.find(
        (player) => player.id === event.playerId,
      )?.characterId;
      const path = character
        ? (cardVoices?.get(
            `${character}:${event.cardDefinitionId}${event.presentationVariantId === undefined ? '' : `:${event.presentationVariantId}`}`,
          ) ?? null)
        : null;
      engine.observeCard(event.id, path, live.has(event.id));
    }
  }, [engine, cardVoices, state.log, state.liveEventIds, state.publicView]);
}

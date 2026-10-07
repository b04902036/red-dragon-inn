import { useEffect, useState, useSyncExternalStore } from 'react';
import { PresentationDirector } from './PresentationDirector';
import type { RoomClientState } from './room-state';

export function usePresentation(state: RoomClientState) {
  const [director] = useState(() => new PresentationDirector());
  const snapshot = useSyncExternalStore(
    director.subscribe,
    director.getSnapshot,
    director.getSnapshot,
  );
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const update = () => director.setReducedMotion(query?.matches ?? false);
    update();
    query?.addEventListener('change', update);
    return () => query?.removeEventListener('change', update);
  }, [director]);
  useEffect(() => {
    director.start();
    return () => director.pause();
  }, [director]);
  useEffect(() => {
    director.ingest(state.log, state.liveEventIds);
  }, [director, state.log, state.liveEventIds]);
  return { ...snapshot, skip: director.skip, toggleFast: director.toggleFast };
}

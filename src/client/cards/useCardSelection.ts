import { useState } from 'react';
/** Eligible IDs and limits come from the server projection; this stores presentation choices only. */
export function useCardSelection(
  eligible: readonly string[],
  max = Number.MAX_SAFE_INTEGER,
) {
  const [stored, setStored] = useState<string[]>([]);
  const selected = stored.filter((id) => eligible.includes(id));
  const toggle = (id: string) => {
    if (!eligible.includes(id)) return;
    setStored((previous) => {
      const current = previous.filter((value) => eligible.includes(value));
      if (current.includes(id)) return current.filter((value) => value !== id);
      return current.length < max ? [...current, id] : current;
    });
  };
  return { selected, toggle, clear: () => setStored([]) };
}

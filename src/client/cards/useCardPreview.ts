import { useEffect, useRef, useState } from 'react';
export function useCardPreview() {
  const pendingHide = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelHide = () => {
    if (pendingHide.current !== null) clearTimeout(pendingHide.current);
    pendingHide.current = null;
  };
  useEffect(() => cancelHide, []);
  const [value, setValue] = useState<{ id: string; pinned: boolean } | null>(
    null,
  );
  return {
    id: value?.id ?? null,
    show: (id: string) => {
      cancelHide();
      setValue((previous) =>
        previous?.id === id ? previous : { id, pinned: false },
      );
    },
    pin: (id: string) => {
      cancelHide();
      setValue({ id, pinned: true });
    },
    hide: (id: string) => {
      cancelHide();
      pendingHide.current = setTimeout(() => {
        pendingHide.current = null;
        setValue((previous) =>
          previous?.id === id && !previous.pinned ? null : previous,
        );
      }, 100);
    },
    close: () => {
      cancelHide();
      setValue(null);
    },
  };
}

import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';

export function Modal({
  title,
  children,
  onClose,
  mandatory = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  mandatory?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    return () => {
      if (typeof dialog.close === 'function') dialog.close();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!mandatory) onClose();
      }}
    >
      <h2 id={titleId}>{title}</h2>
      {children}
      {!mandatory && (
        <button className="secondary" onClick={onClose}>
          Close
        </button>
      )}
    </dialog>
  );
}

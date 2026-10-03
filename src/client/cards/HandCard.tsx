import type { ReactNode } from 'react';
import type { Presentation } from '../../protocol/presentation';
import { useLocale } from '../i18n/context';
export function HandCard({
  id,
  definition,
  selectable = false,
  selected = false,
  disabled = false,
  onToggle,
  onPreview,
  onLeave,
  onInspect,
  onClosePreview,
  children,
}: {
  id: string;
  definition: Presentation['cards'][number];
  selectable?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onToggle?: (id: string) => void;
  onPreview: (id: string) => void;
  onLeave: (id: string) => void;
  onInspect: (id: string) => void;
  onClosePreview: () => void;
  children?: ReactNode;
}) {
  const { t } = useLocale();
  const toggle = () => {
    if (selectable && !disabled) onToggle?.(id);
  };
  return (
    <article
      className={`hand-card${selected ? ' selected-card' : ''}${selectable ? ' selectable-card' : ''}`}
      data-card-id={id}
      onClick={toggle}
      onPointerEnter={(event) => {
        if (event.pointerType !== 'touch') onPreview(definition.id);
      }}
      onPointerMove={(event) => {
        if (event.pointerType !== 'touch') onPreview(definition.id);
      }}
      onPointerLeave={(event) => {
        if (!event.currentTarget.contains(document.activeElement))
          onLeave(definition.id);
      }}
      onFocusCapture={() => onPreview(definition.id)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          onLeave(definition.id);
      }}
    >
      <div
        className="card-body"
        role={selectable ? 'checkbox' : 'group'}
        tabIndex={0}
        aria-label={
          selectable
            ? t('card.discard', { name: definition.name })
            : definition.name
        }
        aria-checked={selectable ? selected : undefined}
        aria-disabled={selectable ? disabled : undefined}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onClosePreview();
          } else if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            if (selectable) toggle();
            else onInspect(definition.id);
          }
        }}
      >
        <p className="card-kind">{t(`card.${definition.type}`)}</p>
        <h3>{definition.name}</h3>
        {selected && (
          <span className="selection-indicator" aria-hidden="true">
            ✓ {t('card.selected')}
          </span>
        )}
      </div>
      <div
        className="card-controls"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="touch-details"
          onClick={() => onInspect(definition.id)}
        >
          {t('card.details', { name: definition.name })}
        </button>
        {children}
      </div>
    </article>
  );
}

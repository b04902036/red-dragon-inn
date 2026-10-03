import type { Presentation } from '../../protocol/presentation';
import { useLocale } from '../i18n/context';
export function CardPreview({
  card,
  onClose,
  onEngage,
  embedded = false,
}: {
  card: Presentation['cards'][number] | null | undefined;
  onClose: () => void;
  onEngage?: () => void;
  embedded?: boolean;
}) {
  const { t } = useLocale();
  if (!card) return null;
  return (
    <section
      className={`card-preview${embedded ? ' embedded-preview' : ''}`}
      role="region"
      aria-label={t('card.preview')}
      aria-live="polite"
      tabIndex={0}
      onPointerEnter={onEngage}
      onFocusCapture={onEngage}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <button
        className="preview-close"
        onClick={onClose}
        aria-label={t('card.closePreview')}
      >
        ×
      </button>
      <p className="card-kind">{t(`card.${card.type}`)}</p>
      <h3>{card.name}</h3>
      <p>{card.rulesText}</p>
    </section>
  );
}

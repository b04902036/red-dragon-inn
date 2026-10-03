import { isLocale } from '../../shared/locales';
import type { Locale } from '../../shared/locales';
export const LOCALE_STORAGE_KEY = 'rdi:locale';
export function preferredLocale(
  storage: Pick<Storage, 'getItem'>,
  browserLocale: string,
): Locale {
  try {
    const saved = storage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    /* Restricted storage keeps a usable default. */
  }
  return browserLocale.toLowerCase().startsWith('zh-tw') ? 'zh-TW' : 'en-US';
}

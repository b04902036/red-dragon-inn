import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { isLocale } from '../../shared/locales';
import type { Locale } from '../../shared/locales';
import { formatMessage } from '../../shared/ui-messages';
import { LocaleContext, useLocale } from './context';
import { LOCALE_STORAGE_KEY, preferredLocale } from './preference';

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setSelectedLocale] = useState<Locale>(() => {
    try {
      return preferredLocale(localStorage, navigator.language);
    } catch {
      return preferredLocale({ getItem: () => null }, navigator.language);
    }
  });
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const setLocale = (next: Locale) => {
    setSelectedLocale(next);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      /* Preference still applies for this page. */
    }
  };
  return (
    <LocaleContext
      value={{
        locale,
        setLocale,
        t: (key, values) => formatMessage(locale, key, values),
        message: (value) => formatMessage(locale, value.key, value.values),
      }}
    >
      {children}
    </LocaleContext>
  );
}
export function LanguageSelector() {
  const { locale, setLocale, t } = useLocale();
  return (
    <label className="language-selector">
      {t('language.label')}
      <select
        value={locale}
        onChange={(event) => {
          if (isLocale(event.target.value)) setLocale(event.target.value);
        }}
      >
        <option value="en-US">English</option>
        <option value="zh-TW">繁體中文</option>
      </select>
    </label>
  );
}

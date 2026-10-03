import { createContext, useContext } from 'react';
import { formatMessage } from '../../shared/ui-messages';
import type { MessageKey, UiMessage } from '../../shared/ui-messages';
import type { Locale } from '../../shared/locales';
export interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, values?: UiMessage['values']) => string;
  message: (message: UiMessage) => string;
}
export const LocaleContext = createContext<LocaleContextValue>({
  locale: 'en-US',
  setLocale: () => {},
  t: (key, values) => formatMessage('en-US', key, values),
  message: (message) => formatMessage('en-US', message.key, message.values),
});
export const useLocale = () => useContext(LocaleContext);

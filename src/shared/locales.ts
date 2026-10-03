export const locales = ['en-US', 'zh-TW'] as const;
export type Locale = (typeof locales)[number];
export function isLocale(value: unknown): value is Locale {
  return value === 'en-US' || value === 'zh-TW';
}

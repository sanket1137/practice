/**
 * Formats a number as currency using Intl.NumberFormat, locale-aware.
 * Default locale is en-IN (Indian Rupee).
 */
export function formatCurrency(
  amount: number,
  locale = 'en-IN',
  currency = 'INR',
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Returns the currency locale string for a given i18n language code.
 */
export function currencyLocaleForLanguage(languageCode: string): string {
  const localeMap: Record<string, string> = {
    en: 'en-IN',
    hi: 'hi-IN',
    bn: 'bn-IN',
    ta: 'ta-IN',
    te: 'te-IN',
    mr: 'mr-IN',
    ar: 'ar-IN',
    ur: 'ur-IN',
  };
  return localeMap[languageCode] ?? 'en-IN';
}

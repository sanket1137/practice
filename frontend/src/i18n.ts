import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', dir: 'ltr' as const },
  { code: 'hi', name: 'हिन्दी', dir: 'ltr' as const },
  { code: 'bn', name: 'বাংলা', dir: 'ltr' as const },
  { code: 'ta', name: 'தமிழ்', dir: 'ltr' as const },
  { code: 'te', name: 'తెలుగు', dir: 'ltr' as const },
  { code: 'mr', name: 'मराठी', dir: 'ltr' as const },
  { code: 'ar', name: 'العربية', dir: 'rtl' as const },
  { code: 'ur', name: 'اردو', dir: 'rtl' as const },
] as const;

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

export const RTL_LANGUAGES: SupportedLanguageCode[] = ['ar', 'ur'];

export function isRtlLanguage(code: string): boolean {
  return RTL_LANGUAGES.includes(code as SupportedLanguageCode);
}

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    defaultNS: 'common',
    ns: ['common'],
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'pixelspot_language',
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: true,
    },
  });

export default i18n;

import type { I18nConfig } from 'next-i18next/proxy';

export const i18nConfig: I18nConfig = {
  supportedLngs: ['en', 'ru'],
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: ['common'],
  localeParamName: 'locale',
  // /bare is the framework-size baseline route of the spike (no locale)
  ignoredPaths: ['/api', '/_next', '/static', '/bare'],
  resourceLoader: (language, namespace) => import(`./locales/${language}/${namespace}.json`),
};

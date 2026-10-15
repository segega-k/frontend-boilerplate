import { createInstance } from 'i18next';
import type { Translate } from './runtime.ts';

export const API_ERRORS_NS = 'apiErrors';

/**
 * i18next `t` for the `apiErrors` namespace. Catalogs come from the app (translations/<locale>/apiErrors.json); the
 * namespace is eager because a toast can arrive on any screen and translation is synchronous.
 */
export function createApiErrorsT(resources: Record<string, object>, lng: string, fallbackLng = 'en'): Translate {
  const instance = createInstance();

  void instance.init({
    lng,
    fallbackLng,
    ns: [API_ERRORS_NS],
    defaultNS: API_ERRORS_NS,
    resources: Object.fromEntries(Object.entries(resources).map(([l, cat]) => [l, { [API_ERRORS_NS]: cat }])),
    interpolation: { escapeValue: false },
    initAsync: false,
  });

  return (key, params) => instance.t(key, { ns: API_ERRORS_NS, ...params });
}

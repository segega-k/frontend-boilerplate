import type { Translate } from '../runtime.ts';
import type { RawResolution, ResolvedResponse } from './types.ts';

export const RESOLUTION_KEY = '_resolution';

/** Unlike xRocket (own lookup over a TS object), texts come from i18next namespace `apiErrors`. */
export function translateResolution(raw: RawResolution, t: Translate, params?: Record<string, string>): ResolvedResponse {
  return {
    type: raw.type,
    severity: raw.severity,
    title: t(raw.translationKey, params),
    ...(raw.subtitleTranslationKey && { subtitle: t(raw.subtitleTranslationKey, params) }),
    ...(raw.support && { support: true }),
  };
}

export function getRawResolution(dataOrError: unknown): RawResolution | null {
  if (!dataOrError || typeof dataOrError !== 'object' || !(RESOLUTION_KEY in dataOrError)) {
    return null;
  }

  return (dataOrError as Record<string, unknown>)[RESOLUTION_KEY] as RawResolution;
}

/** Manual variant for domains (`custom` surfaces: form fields, inline blocks). */
export function getApiResponseResolution(
  dataOrError: unknown,
  t: Translate,
  params?: Record<string, string>,
): ResolvedResponse | null {
  const raw = getRawResolution(dataOrError);

  return raw ? translateResolution(raw, t, params) : null;
}

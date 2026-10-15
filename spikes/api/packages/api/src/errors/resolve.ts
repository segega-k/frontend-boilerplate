import type { RawResolution, ResponseMappingEntry, ServiceMappings } from './types.ts';

// Lookup order is 1:1 with xRocket `resolveApiResponse.ts`:
// exact METHOD_STATUS_type → (2xx) METHOD_STATUS → any METHOD_2xx → (≥400) METHOD_ERR → null.
// The only change: mappings are keyed by service first, so equal schemaPaths of two services never collide.

const registry = new Map<string, ServiceMappings>();

export function registerMappings(service: string, mappings: ServiceMappings): void {
  registry.set(service, mappings);
}

export function getRegisteredServices(): string[] {
  return [...registry.keys()];
}

function buildResolution(match: ResponseMappingEntry<string>): RawResolution {
  return {
    type: match.type,
    severity: match.severity,
    translationKey: match.i18n?.title ?? '',
    ...(match.i18n?.subtitle && { subtitleTranslationKey: match.i18n.subtitle }),
    ...(match.support && { support: true }),
  };
}

export function resolveApiResponse(
  service: string,
  path: string,
  method: string,
  status: number,
  responseType: string,
): RawResolution | null {
  const endpoint = registry.get(service)?.[path];

  if (!endpoint) {
    return null;
  }

  const m = method.toUpperCase();
  const exact = endpoint.responses.find((r) => r.variants.includes(`${m}_${status}_${responseType}`));

  if (exact) {
    return buildResolution(exact);
  }

  if (status >= 200 && status < 300) {
    const success = endpoint.responses.find((r) => r.variants.includes(`${m}_${status}`));

    if (success) {
      return buildResolution(success);
    }

    // Backend may answer 201/204 where the spec says 200 (NestJS default for POST is 201).
    const anySuccess = new RegExp(`^${m}_2\\d\\d$`);
    const anySuccessMatch = endpoint.responses.find((r) => r.variants.some((v) => anySuccess.test(v)));

    if (anySuccessMatch) {
      return buildResolution(anySuccessMatch);
    }
  }

  if (status >= 400) {
    const fallback = endpoint.responses.find((r) => r.variants.includes(`${m}_ERR`));

    if (fallback) {
      return { ...buildResolution(fallback), isErrorFallback: true };
    }
  }

  return null;
}

/** Network failure (fetch threw TypeError): METHOD_NET. */
export function resolveNetworkError(service: string, path: string, method: string): RawResolution | null {
  const endpoint = registry.get(service)?.[path];
  const match = endpoint?.responses.find((r) => r.variants.includes(`${method.toUpperCase()}_NET`));

  return match ? buildResolution(match) : null;
}

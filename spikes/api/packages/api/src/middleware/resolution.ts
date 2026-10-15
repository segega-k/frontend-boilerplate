import { resolveApiResponse, resolveNetworkError } from '../errors/resolve.ts';
import { RESOLUTION_KEY, translateResolution } from '../errors/translate.ts';
import { extractErrorContext, formatErrorContextMessage, readJsonBody } from '../errors/loadError.ts';
import type { RawResolution } from '../errors/types.ts';
import type { ApiRuntime } from '../runtime.ts';
import type { NamedMiddleware } from './types.ts';

const NULL_BODY_STATUSES = new Set([101, 103, 204, 205, 304]);

/** Support text with code and status only for unexpected errors (`_ERR` catch-all or ≥ 500), as in xRocket. */
export function shouldAttachSupportContext(resolution: RawResolution, status: number): boolean {
  return Boolean(resolution.isErrorFallback) || status >= 500;
}

function bodyParams(body: Record<string, unknown>): Record<string, string> {
  const params: Record<string, string> = {};

  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string' || typeof value === 'number') {
      params[key] = String(value);
    }
  }

  return params;
}

function pushToast(rt: ApiRuntime, resolution: RawResolution, body: Record<string, unknown>, status: number): void {
  const resolved = translateResolution(resolution, rt.t, bodyParams(body));
  const attach = shouldAttachSupportContext(resolution, status);

  rt.toasts.push({
    title: resolved.title,
    ...(resolved.subtitle && { subtitle: resolved.subtitle }),
    severity: resolved.severity,
    ...(resolved.support && {
      action: {
        label: rt.t('support'),
        onClick: () => rt.openSupport(formatErrorContextMessage(extractErrorContext(attach ? body : {}))),
      },
    }),
  });
}

/**
 * onResponse: lookup `(service, schemaPath, METHOD_STATUS_type)`, push the toast itself, stamp `_resolution` and
 * `_httpStatus` into the body for `modal`/`custom` consumers.
 * onError (new, fixes xRocket §4.2): fetch threw a TypeError → `METHOD_NET`; toast is pushed here, deduplicated within
 * `netToastDedupMs`; the error is re-thrown unchanged so `errorKind` stays `network`.
 */
// Shared by all clients of one runtime: an outage fails requests of every service at once.
const lastNetToastAt = new WeakMap<ApiRuntime, number>();

export function responseResolutionMiddleware(service: string, rt: ApiRuntime): NamedMiddleware {
  return {
    name: 'responseResolution',
    async onResponse({ response, schemaPath, request }) {
      const hasJson = (response.headers.get('content-type') ?? '').includes('json');
      const parsed = hasJson ? await readJsonBody(response) : {};

      if (parsed === null) {
        return undefined;
      }

      const body = parsed;
      const problemType = typeof body.type === 'string' ? body.type : typeof body.name === 'string' ? body.name : '';
      const resolution = resolveApiResponse(service, schemaPath, request.method, response.status, problemType);

      if (resolution?.type === 'toast' && rt.isClient()) {
        pushToast(rt, resolution, body, response.status);
      }

      const isError = response.status >= 400;

      if ((!isError && !resolution) || NULL_BODY_STATUSES.has(response.status)) {
        return undefined;
      }

      // Found in the spike: xRocket spreads any body into an object, so a mapped 2xx with an ARRAY body comes back as
      // {0: …, 1: …, _resolution}. Only plain-object bodies are stamped; arrays/primitives pass through untouched.
      if (Array.isArray(body) || typeof body !== 'object') {
        return undefined;
      }

      return new Response(
        JSON.stringify({ _httpStatus: response.status, ...body, ...(resolution && { [RESOLUTION_KEY]: resolution }) }),
        { status: response.status, statusText: response.statusText, headers: response.headers },
      );
    },
    onError({ error, schemaPath, request }) {
      if (!(error instanceof TypeError)) {
        return undefined; // AbortError (query cancelled) and others: no UI
      }

      const resolution = resolveNetworkError(service, schemaPath, request.method);

      if (resolution?.type === 'toast' && rt.isClient()) {
        const now = rt.now();

        if (now - (lastNetToastAt.get(rt) ?? Number.NEGATIVE_INFINITY) >= rt.netToastDedupMs) {
          lastNetToastAt.set(rt, now);
          pushToast(rt, resolution, {}, 0);
        }
      }

      return undefined;
    },
  };
}

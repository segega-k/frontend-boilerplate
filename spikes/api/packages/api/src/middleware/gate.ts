import { FATAL_APP_STATUSES } from '../state/AppStore.ts';
import type { ApiRuntime } from '../runtime.ts';
import type { NamedMiddleware } from './types.ts';

/**
 * onRequest: when appStatus is fatal, answer a synthetic 503 without touching the network. openapi-fetch skips the
 * whole onResponse chain for a Response returned from onRequest (checked on 0.17.0), so the 503 is not retried, not
 * resolved and never toasted. Recovery probes do not go through this client.
 */
export function appStatusGateMiddleware(rt: ApiRuntime): NamedMiddleware {
  return {
    name: 'appStatusGate',
    onRequest({ request }) {
      if (FATAL_APP_STATUSES.includes(rt.appStore.appStatus)) {
        return new Response(JSON.stringify({ _httpStatus: 503, _blockedByAppStatus: true }), {
          status: 503,
          headers: { 'content-type': 'application/json' },
        });
      }

      return request;
    },
  };
}

/** onRequest: credentials through the auth adapter (header format is the adapter's business). */
export function authMiddleware(rt: ApiRuntime): NamedMiddleware {
  return {
    name: 'auth',
    onRequest({ request }) {
      rt.auth.applyAuth(request);

      return request;
    },
  };
}

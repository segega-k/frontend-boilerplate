import type { AuthAdapter } from '../contract.ts';
import { isBannedResponse, isMaintenanceResponse, readJsonBody } from '../errors/loadError.ts';
import type { ApiRuntime } from '../runtime.ts';
import type { NamedMiddleware } from './types.ts';

/** onResponse: 503 + maintenance problem type (or legacy `PLATFORM_MAINTENANCE`) → appStatus `maintenance`. */
export function maintenanceMiddleware(rt: ApiRuntime): NamedMiddleware {
  return {
    name: 'maintenance',
    async onResponse({ response }) {
      if (response.ok) {
        return undefined;
      }

      if (isMaintenanceResponse(response.status, await readJsonBody(response))) {
        rt.appStore.setMaintenance(true);
      }

      return undefined;
    },
  };
}

/** onResponse: 403 + blocked/banned marker on any endpoint → ban bound to the session of this request. */
export function bannedGuardMiddleware(rt: ApiRuntime): NamedMiddleware {
  return {
    name: 'bannedGuard',
    async onResponse({ request, response }) {
      if (response.status !== 403) {
        return undefined;
      }

      if (isBannedResponse(response.status, await readJsonBody(response))) {
        rt.userStore.markBanned(rt.auth.credentialOf(request));
      }

      return undefined;
    },
  };
}

export function shouldRetryStatus(status: number | undefined): boolean {
  return !status || status >= 500;
}

export function retryDelay(rt: ApiRuntime, attempt: number): number {
  return Math.min(rt.retry.baseDelayMs * 2 ** attempt, rt.retry.maxDelayMs);
}

/**
 * onResponse: GET only, status ≥ 500, up to `maxRetries` with 1s·2^n (≤ 30s). The retried fetch goes straight to the
 * client's fetch (no middleware), like xRocket. One change: a maintenance 503 is not retried (it would only delay the
 * maintenance screen by 7 s).
 */
export function retryMiddleware(rt: ApiRuntime): NamedMiddleware {
  return {
    name: 'retry',
    async onResponse({ request, response, options }) {
      if (request.method !== 'GET' || !shouldRetryStatus(response.status)) {
        return undefined;
      }
      if (isMaintenanceResponse(response.status, await readJsonBody(response))) {
        return undefined;
      }

      for (let attempt = 1; attempt <= rt.retry.maxRetries; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay(rt, attempt - 1)));

        try {
          const retried = await options.fetch(request.clone());

          if (!shouldRetryStatus(retried.status) || attempt === rt.retry.maxRetries) {
            return retried;
          }
        } catch {
          if (attempt === rt.retry.maxRetries) {
            return undefined; // keep the last real response
          }
        }
      }

      return undefined;
    },
  };
}

export type UnauthorizedKind = 'current-session' | 'superseded-token' | 'anonymous-request';

/** 1:1 with xRocket `classifyUnauthorized`, over adapter credentials instead of raw Bearer headers. */
export function classifyUnauthorized(requestCredential: string | null, currentCredential: string | null): UnauthorizedKind {
  if (!currentCredential) {
    return 'current-session';
  }
  if (requestCredential === null) {
    return 'anonymous-request';
  }

  return requestCredential === currentCredential ? 'current-session' : 'superseded-token';
}

// One refresh per adapter at a time: concurrent 401s share it (user decision 18, no-BFF case).
const inflightRefresh = new WeakMap<AuthAdapter, Promise<boolean>>();

export function refreshOnce(auth: AuthAdapter): Promise<boolean> {
  const refresh = auth.refresh;

  if (!refresh) {
    return Promise.resolve(false);
  }

  let pending = inflightRefresh.get(auth);

  if (!pending) {
    pending = refresh()
      .catch(() => false)
      .finally(() => inflightRefresh.delete(auth));
    inflightRefresh.set(auth, pending);
  }

  return pending;
}

/**
 * 401 handling through the AuthAdapter:
 * - anonymous request → not about the session;
 * - superseded credential (the session moved on) → never logs out; retried once with the current credential
 *   (addition to xRocket, which just returned);
 * - current session: if the adapter has `refresh` → one shared refresh → retry once → still 401 or refresh failed →
 *   clear the session, but only while it is still the one this request (or its refresh) used. No `refresh` (cookie/BFF,
 *   server refreshes itself) → clear right away (xRocket behaviour).
 * The request body is consumed by fetch, so `onRequest` keeps a clone for the retry (this middleware is last in the
 * array, its onRequest runs right before fetch).
 */
export function unauthorizedMiddleware(rt: ApiRuntime): NamedMiddleware {
  const pristine = new WeakMap<Request, Request>();

  return {
    name: 'unauthorized',
    onRequest({ request }) {
      pristine.set(request, request.clone());

      return undefined;
    },
    async onResponse({ request, response, options }) {
      if (response.status !== 401) {
        return undefined;
      }

      const { auth, userStore } = rt;
      const requestCredential = auth.credentialOf(request);
      const kind = classifyUnauthorized(requestCredential, auth.currentCredential());
      const retry = async (): Promise<Response> => {
        const again = new Request(pristine.get(request) ?? request);

        auth.applyAuth(again);

        return options.fetch(again);
      };
      const clear = async (): Promise<void> => {
        await Promise.allSettled([auth.clearSession(), userStore.clearStoredData()]);
      };

      if (kind === 'anonymous-request') {
        return undefined;
      }
      if (kind === 'superseded-token') {
        return retry();
      }
      if (!auth.refresh) {
        await clear();

        return undefined;
      }

      const refreshed = await refreshOnce(auth);
      const credentialAfterRefresh = auth.currentCredential();
      let retried: Response | undefined;

      if (refreshed) {
        retried = await retry();

        if (retried.status !== 401) {
          return retried;
        }
      }

      const current = auth.currentCredential();

      if (current === null || current === requestCredential || (refreshed && current === credentialAfterRefresh)) {
        await clear();
      }

      return retried;
    },
  };
}

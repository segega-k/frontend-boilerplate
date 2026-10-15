import createClient from 'openapi-fetch';
import type { ApiRuntime } from '../runtime.ts';
import { appStatusGateMiddleware, authMiddleware } from './gate.ts';
import { bannedGuardMiddleware, maintenanceMiddleware, retryMiddleware, unauthorizedMiddleware } from './guards.ts';
import { responseResolutionMiddleware } from './resolution.ts';
import type { MiddlewareName, NamedMiddleware } from './types.ts';

// THE ORDER IS A CONTRACT (locked by tests/middleware-order.test.ts).
// openapi-fetch runs onRequest in array order and onResponse/onError in REVERSE order:
//   onRequest : appStatusGate → auth → unauthorized (keeps a clone of the request for the 401 retry)
//   onResponse: unauthorized → retry → bannedGuard → responseResolution → maintenance
// - responseResolution must sit BEFORE retry in the array, so it runs AFTER retry and stamps `_resolution` on the
//   final response (otherwise MobxQuery.rawResolution is always null and PageQueryGuard never shows the modal);
// - unauthorized is last, so a refreshed+retried response still passes retry, bannedGuard and resolution;
// - a Response returned by the gate skips every onResponse (openapi-fetch 0.17.0: the chain sits in `if (!response)`).
export const MIDDLEWARE_ORDER: readonly MiddlewareName[] = [
  'appStatusGate',
  'auth',
  'maintenance',
  'responseResolution',
  'bannedGuard',
  'retry',
  'unauthorized',
];

export function buildMiddlewares(service: string, rt: ApiRuntime): NamedMiddleware[] {
  return [
    appStatusGateMiddleware(rt),
    authMiddleware(rt),
    maintenanceMiddleware(rt),
    responseResolutionMiddleware(service, rt),
    bannedGuardMiddleware(rt),
    retryMiddleware(rt),
    unauthorizedMiddleware(rt),
  ];
}

/**
 * Auth client (login, refresh) without gate, auth and 401 handling — they would break re-login and refresh
 * (xRocket: `auth.use(responseResolution, bannedGuard)`). Maintenance is added (it can arrive on login too).
 */
export function buildAuthClientMiddlewares(service: string, rt: ApiRuntime): NamedMiddleware[] {
  return [maintenanceMiddleware(rt), responseResolutionMiddleware(service, rt), bannedGuardMiddleware(rt)];
}

export interface ServiceClientOptions {
  baseUrl: string;
  /** Lazy by default so devtools (eruda) and test doubles can patch globalThis.fetch later. */
  fetch?: (input: Request) => Promise<Response>;
  credentials?: RequestCredentials;
  /** `sign-in`: client for login/refresh endpoints — no gate, auth or 401 handling (xRocket auth client). */
  kind?: 'default' | 'sign-in';
}

/** One openapi-fetch client per service; middleware is attached here and nowhere else. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export function createServiceClient<Paths extends {}>(service: string, rt: ApiRuntime, options: ServiceClientOptions) {
  const client = createClient<Paths>({
    baseUrl: options.baseUrl,
    credentials: options.credentials ?? 'include',
    fetch: options.fetch ?? ((input: Request) => globalThis.fetch(input)),
  });

  client.use(...(options.kind === 'sign-in' ? buildAuthClientMiddlewares : buildMiddlewares)(service, rt));

  return client;
}

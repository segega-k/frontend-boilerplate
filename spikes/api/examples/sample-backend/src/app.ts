// FIXTURE: app-level composition for the sample backend. Shows the two adapter points an app fills in:
// the AuthAdapter (here a bearer token with refresh through this backend's /auth/refresh) and the health probe.
import {
  BearerTokenAuth,
  CookieSessionAuth,
  createApiErrorsT,
  createRuntime,
  healthPing,
  type ApiRuntime,
  type RuntimeOptions,
} from '@repo/api';
import en from '../translations/en/apiErrors.json' with { type: 'json' };
import ru from '../translations/ru/apiErrors.json' with { type: 'json' };
import { createSampleApi, type SampleApi, type SampleApiOptions } from './api.ts';

export interface SampleAppOptions extends SampleApiOptions, Omit<RuntimeOptions, 'auth' | 't'> {
  lng?: 'en' | 'ru';
  /** `token`: bearer + refresh (no BFF); `cookie`: BFF session, no client refresh. */
  session?: 'token' | 'cookie';
}

export interface SampleApp<A> {
  rt: ApiRuntime;
  api: SampleApi;
  auth: A;
  /** Health probe for no-network recovery: this backend has GET /api/v1/health. */
  ping: () => Promise<boolean>;
}

export function createSampleApp(options: SampleAppOptions & { session?: 'token' }): SampleApp<BearerTokenAuth>;
export function createSampleApp(options: SampleAppOptions & { session: 'cookie' }): SampleApp<CookieSessionAuth>;
export function createSampleApp(options: SampleAppOptions): SampleApp<BearerTokenAuth | CookieSessionAuth> {
  let api: SampleApi | undefined;
  const auth =
    options.session === 'cookie'
      ? new CookieSessionAuth()
      : new BearerTokenAuth({
          refresh: async (refreshToken) => {
            if (!api || !refreshToken) return null;

            const { data } = await api.clients.auth.POST('/api/v1/auth/refresh', { body: { refreshToken } });

            return data ?? null;
          },
        });
  const rt = createRuntime({ ...options, auth, t: createApiErrorsT({ en, ru }, options.lng ?? 'en') });

  api = createSampleApi(rt, options);

  const fetchFn = options.fetch ?? ((input: Request) => globalThis.fetch(input));

  return {
    rt,
    api,
    auth,
    ping: healthPing((input, init) => fetchFn(new Request(input, init)), `${options.baseUrl}/api/v1/health`),
  };
}

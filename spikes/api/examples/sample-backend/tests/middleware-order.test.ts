import createClient, { type Middleware } from 'openapi-fetch';
import { describe, expect, it } from 'vitest';
import type { paths } from '../src/generated/wallet.ts';
import { buildAuthClientMiddlewares, buildMiddlewares, MIDDLEWARE_ORDER, RESOLUTION_KEY } from '@repo/api';
import type { NamedMiddleware } from '../../../packages/api/src/middleware/types.ts';
import { BASE, fakeBackend, problem, setup } from './harness.ts';

function traced(list: NamedMiddleware[], log: string[]): Middleware[] {
  return list.map((m): Middleware => ({
    ...(m.onRequest && {
      onRequest: (p: Parameters<NonNullable<Middleware['onRequest']>>[0]) => {
        log.push(`req:${m.name}`);

        return m.onRequest!(p);
      },
    }),
    ...(m.onResponse && {
      onResponse: (p: Parameters<NonNullable<Middleware['onResponse']>>[0]) => {
        log.push(`res:${m.name}`);

        return m.onResponse!(p);
      },
    }),
    ...(m.onError && {
      onError: (p: Parameters<NonNullable<Middleware['onError']>>[0]) => {
        log.push(`err:${m.name}`);

        return m.onError!(p);
      },
    }),
  }) as Middleware);
}

describe('middleware order (contract)', () => {
  const { rt } = setup({});

  it('array order is exactly [appStatusGate, auth, maintenance, responseResolution, bannedGuard, retry, unauthorized]', () => {
    expect(MIDDLEWARE_ORDER).toEqual([
      'appStatusGate',
      'auth',
      'maintenance',
      'responseResolution',
      'bannedGuard',
      'retry',
      'unauthorized',
    ]);
    expect(buildMiddlewares('wallet', rt).map((m) => m.name)).toEqual(MIDDLEWARE_ORDER);
  });

  it('responseResolution comes before retry in the array (so it runs after retry on the response)', () => {
    const names = buildMiddlewares('wallet', rt).map((m) => m.name);

    expect(names.indexOf('responseResolution')).toBeLessThan(names.indexOf('retry'));
    expect(names[0]).toBe('appStatusGate');
    expect(names.at(-1)).toBe('unauthorized');
  });

  it('auth client has no gate, auth or 401 handling', () => {
    expect(buildAuthClientMiddlewares('auth', rt).map((m) => m.name)).toEqual([
      'maintenance',
      'responseResolution',
      'bannedGuard',
    ]);
  });

  it('openapi-fetch 0.17 runs onRequest in order and onResponse/onError in reverse', async () => {
    const log: string[] = [];
    const backend = fakeBackend({ 'GET /api/v1/wallet/assets/x': () => problem(404, '/api/problems/asset_not_found') });
    const client = createClient<paths>({ baseUrl: BASE, fetch: backend.fetch });

    client.use(...traced(buildMiddlewares('wallet', rt), log));
    await client.GET('/api/v1/wallet/assets/{code}', { params: { path: { code: 'x' } } });

    expect(log).toEqual([
      'req:appStatusGate',
      'req:auth',
      'req:unauthorized',
      'res:unauthorized',
      'res:retry',
      'res:bannedGuard',
      'res:responseResolution',
      'res:maintenance',
    ]);

    log.length = 0;

    const down = createClient<paths>({ baseUrl: BASE, fetch: () => Promise.reject(new TypeError('fetch failed')) });

    down.use(...traced(buildMiddlewares('wallet', rt), log));
    await expect(down.GET('/api/v1/health')).rejects.toBeInstanceOf(TypeError);
    expect(log.filter((l) => l.startsWith('err:'))).toEqual(['err:responseResolution']);
  });

  it('a Response from the gate skips every onResponse (no retry, no resolution, no toast)', async () => {
    const s = setup({ 'GET /api/v1/wallet/balances': () => problem(500, '/api/problems/internal_error') });
    const log: string[] = [];
    const client = createClient<paths>({ baseUrl: BASE, fetch: s.backend.fetch });

    s.rt.userStore.markBanned(null);
    client.use(...traced(buildMiddlewares('wallet', s.rt), log));

    const { error, response } = await client.GET('/api/v1/wallet/balances');

    expect(response.status).toBe(503);
    expect(error).toEqual({ _httpStatus: 503, _blockedByAppStatus: true });
    expect(log).toEqual(['req:appStatusGate']);
    expect(s.backend.calls).toHaveLength(0);
    expect(s.rt.toasts.toasts).toHaveLength(0);
  });

  it('_resolution lands on the final (post-retry) response; the swapped order loses it', async () => {
    const routes = { 'GET /api/v1/wallet/balances': () => problem(500, '/api/problems/internal_error') };
    const s = setup(routes);
    const good = await s.api.clients.wallet.GET('/api/v1/wallet/balances');

    expect(s.backend.count('GET /api/v1/wallet/balances')).toBe(4); // 1 + 3 retries
    expect((good.error as Record<string, unknown>)[RESOLUTION_KEY]).toMatchObject({ type: 'modal' });

    const swapped = buildMiddlewares('wallet', s.rt);
    const [res, , retry] = [swapped[3]!, swapped[4]!, swapped[5]!];

    swapped[3] = retry;
    swapped[5] = res;

    const backend = fakeBackend(routes);
    const client = createClient<paths>({ baseUrl: BASE, fetch: backend.fetch });

    client.use(...swapped);

    const bad = await client.GET('/api/v1/wallet/balances');

    expect((bad.error as Record<string, unknown>)[RESOLUTION_KEY]).toBeUndefined();
  });
});

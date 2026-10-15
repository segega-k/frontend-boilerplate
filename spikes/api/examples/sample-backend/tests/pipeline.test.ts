import { autorun } from 'mobx';
import { describe, expect, it } from 'vitest';
import {
  BearerTokenAuth,
  createMutation,
  createQuery,
  createRuntime,
  createServiceClient,
  pageQueryGuardState,
  RESOLUTION_KEY,
} from '@repo/api';
import type { paths as WalletPaths } from '../src/generated/wallet.ts';
import { BASE, json, networkDown, problem, setup, setupCookie, until } from './harness.ts';

const TRANSFERS = 'POST /api/v1/wallet/transfers';
const BALANCES = 'GET /api/v1/wallet/balances';
const transferBody = { body: { asset: 'USDT', amount: '1', to: 'bob' } };

describe('surfaces', () => {
  it('toast on 4xx with an exact variant (pushed by the middleware itself)', async () => {
    const s = setup({ [TRANSFERS]: () => problem(400, '/api/problems/insufficient_balance') });
    const m = createMutation(s.queryClient, s.api.mutations.wallet.createTransfer());

    await expect(m.mutate(transferBody)).rejects.toMatchObject({ _httpStatus: 400 });
    expect(s.rt.toasts.toasts).toEqual([
      expect.objectContaining({ title: 'Not enough funds on the balance', severity: 'error' }),
    ]);
    expect(s.rt.toasts.toasts[0]?.action).toBeUndefined();
    expect(m.status).toBe('failed');
    expect(m.errorKind).toBe('server');
  });

  it('ERR catch-all: toast + Support button with code and status', async () => {
    const s = setup({ [TRANSFERS]: () => problem(422, '/api/problems/unexpected', { instance: '/errors/abc-123' }) });

    await s.api.clients.wallet.POST('/api/v1/wallet/transfers', transferBody);

    const toast = s.rt.toasts.toasts[0];

    expect(toast).toMatchObject({ title: 'Something went wrong', subtitle: 'Please try again later' });
    expect(toast?.action?.label).toBe('Support');
    toast?.action?.onClick();
    expect(s.supportTexts).toEqual(['Error code: abc-123\nStatus: 422']);
  });

  it('success is data too: spec says 200, backend answers 201 → success toast', async () => {
    const s = setup({ [TRANSFERS]: () => json(201, { id: 't1', status: 'sent' }) });
    const m = createMutation(s.queryClient, s.api.mutations.wallet.createTransfer());
    const data = await m.mutate(transferBody);

    expect(data).toMatchObject({ id: 't1', [RESOLUTION_KEY]: { type: 'toast', severity: 'success' } });
    expect(s.rt.toasts.toasts.map((t) => [t.title, t.severity])).toEqual([['Transfer sent', 'success']]);
  });

  it('custom: no toast, the domain reads the translated resolution with params (ru)', async () => {
    const s = setup({ [TRANSFERS]: () => problem(400, '/api/problems/amount_too_small', { minAmount: '10' }) }, { lng: 'ru' });
    const m = createMutation(s.queryClient, s.api.mutations.wallet.createTransfer());

    await m.mutate(transferBody).catch(() => undefined);

    const minAmount = String((m.toResult(s.rt.t).error as { minAmount: string }).minAmount);

    expect(s.rt.toasts.toasts).toHaveLength(0);
    expect(m.toResult(s.rt.t, { minAmount }).resolution).toEqual({
      type: 'custom',
      severity: 'error',
      title: 'Минимальная сумма: 10',
    });
  });

  it('silent: nothing shown', async () => {
    const s = setup({ 'GET /api/v1/wallet/assets/USDT': () => json(200, { code: 'USDT', name: 'Tether' }) });
    const { data } = await s.api.clients.wallet.GET('/api/v1/wallet/assets/{code}', { params: { path: { code: 'USDT' } } });

    expect(data?.name).toBe('Tether');
    expect(s.rt.toasts.toasts).toHaveLength(0);
  });

  it('SSR (isClient false): _resolution is stamped, no toast is pushed', async () => {
    const s = setup({ [TRANSFERS]: () => problem(400, '/api/problems/insufficient_balance') }, { isClient: () => false });
    const { error } = await s.api.clients.wallet.POST('/api/v1/wallet/transfers', transferBody);

    expect((error as Record<string, unknown>)[RESOLUTION_KEY]).toMatchObject({ type: 'toast' });
    expect(s.rt.toasts.toasts).toHaveLength(0);
  });
});

describe('NET toast through onError (fix of xRocket §4.2)', () => {
  it('fetch TypeError → METHOD_NET toast, error re-thrown, errorKind network', async () => {
    const s = setup({ [TRANSFERS]: networkDown });
    const m = createMutation(s.queryClient, s.api.mutations.wallet.createTransfer());

    await expect(m.mutate(transferBody)).rejects.toBeInstanceOf(TypeError);
    expect(s.rt.toasts.toasts.map((t) => t.title)).toEqual(['No internet connection']);
    expect(m.errorKind).toBe('network');
    expect(m.rawResolution).toMatchObject({ type: 'toast', translationKey: 'noInternetConnection' });
  });

  it('identical NET toasts collapse inside the dedup window', async () => {
    let now = 0;
    const s = setup({ [TRANSFERS]: networkDown, 'GET /api/v1/wallet/assets/x': networkDown }, { now: () => now });
    const fire = () =>
      Promise.allSettled([
        s.api.clients.wallet.POST('/api/v1/wallet/transfers', transferBody),
        s.api.clients.wallet.GET('/api/v1/wallet/assets/{code}', { params: { path: { code: 'x' } } }),
      ]);

    await fire();
    expect(s.rt.toasts.toasts).toHaveLength(1);
    now = 3000;
    await fire();
    expect(s.rt.toasts.toasts).toHaveLength(2);
  });

  it('an aborted request (query cancelled) shows nothing', async () => {
    const s = setup({ [TRANSFERS]: () => json(200, {}) });
    const controller = new AbortController();

    controller.abort();
    await expect(s.api.clients.wallet.POST('/api/v1/wallet/transfers', { ...transferBody, signal: controller.signal })).rejects.toThrow();
    expect(s.rt.toasts.toasts).toHaveLength(0);
  });
});

describe('modal via PageQueryGuard (page-load GET)', () => {
  it('500 after retries → MobxQuery.rawResolution modal → guard modal with mapping texts; Try again recovers', async () => {
    const s = setup({
      [BALANCES]: [...Array(4).fill(() => problem(500, '/api/problems/internal_error')), () => json(200, [])],
    });
    const q = createQuery(s.queryClient, () => s.api.queries.wallet.getBalances());
    const dispose = autorun(() => void q.status);

    await until(() => q.status === 'failed');
    expect(s.backend.count(BALANCES)).toBe(4);
    expect(s.rt.toasts.toasts).toHaveLength(0);
    expect(q.errorKind).toBe('server');

    const modal = pageQueryGuardState([q], s.rt.t);

    expect(modal).toMatchObject({
      kind: 'server',
      title: 'The server is not responding',
      subtitle: 'Please try again later',
      support: true,
    });

    await modal?.retry();
    await until(() => q.status === 'succeeded');
    expect(pageQueryGuardState([q], s.rt.t)).toBeNull();
    dispose();
  });

  it('network failure → guard shows the connection modal', async () => {
    const s = setup({ [BALANCES]: networkDown });
    const q = createQuery(s.queryClient, () => s.api.queries.wallet.getBalances());
    const dispose = autorun(() => void q.status);

    await until(() => q.status === 'failed');
    expect(q.errorKind).toBe('network');
    expect(q.rawResolution?.type).toBe('modal');
    expect(pageQueryGuardState([q], s.rt.t)).toMatchObject({ kind: 'network', title: 'Something is wrong with your connection' });
    dispose();
  });
});

describe('retry: GET and ≥ 500 only', () => {
  it.each([
    ['GET 500 → 3 retries', BALANCES, () => problem(500, '/api/problems/internal_error'), 4],
    ['GET 404 → none', 'GET /api/v1/wallet/assets/x', () => problem(404, '/api/problems/asset_not_found'), 1],
    ['POST 500 → none', TRANSFERS, () => problem(500, '/api/problems/internal_error'), 1],
    ['GET 503 maintenance → none', BALANCES, () => problem(503, '/api/problems/maintenance'), 1],
  ] as const)('%s', async (_name, route, handler, calls) => {
    const s = setup({ [route]: handler });
    const [method] = route.split(' ');

    if (method === 'GET' && route.includes('assets')) {
      await s.api.clients.wallet.GET('/api/v1/wallet/assets/{code}', { params: { path: { code: 'x' } } });
    } else if (method === 'GET') {
      await s.api.clients.wallet.GET('/api/v1/wallet/balances');
    } else {
      await s.api.clients.wallet.POST('/api/v1/wallet/transfers', transferBody);
    }
    expect(s.backend.count(route)).toBe(calls);
  });

  it('recovers when a retry succeeds; delays are 1s·2^n capped at 30s', async () => {
    const s = setup({ [BALANCES]: [() => problem(500, '/api/problems/internal_error'), () => json(200, [{ asset: 'TON', amount: '1' }])] });
    const { data } = await s.api.clients.wallet.GET('/api/v1/wallet/balances');
    const { retryDelay } = await import('../../../packages/api/src/middleware/guards.ts');
    const real = setup({}, { retry: { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 30_000 } }).rt;

    expect(data).toHaveLength(1);
    expect([0, 1, 2, 5, 10].map((n) => retryDelay(real, n))).toEqual([1000, 2000, 4000, 30_000, 30_000]);
  });
});

describe('fatal states through the chain', () => {
  it('403 banned on any endpoint → appStatus banned → gate answers 503 without network', async () => {
    const s = setup({
      'GET /api/v1/wallet/assets/x': () => problem(403, '/api/problems/user_blocked'),
      [BALANCES]: () => json(200, []),
    });

    s.auth.setSession({ token: 'tok', refreshToken: 'r' });
    s.auth.markInitialized();
    await s.api.clients.wallet.GET('/api/v1/wallet/assets/{code}', { params: { path: { code: 'x' } } });

    expect(s.rt.appStore.appStatus).toBe('banned');

    const before = s.backend.calls.length;
    const { response, error } = await s.api.clients.wallet.GET('/api/v1/wallet/balances');

    expect(response.status).toBe(503);
    expect(error).toMatchObject({ _blockedByAppStatus: true });
    expect(s.backend.calls.length).toBe(before);
  });

  it('a late 403 from a superseded token does not ban the new session', async () => {
    const s = setup({
      [BALANCES]: () => {
        s.auth.setSession({ token: 'new', refreshToken: 'r2' }); // re-login while the request is in flight

        return problem(403, '/api/problems/user_blocked');
      },
    });

    s.auth.setSession({ token: 'old', refreshToken: 'r' });
    s.auth.markInitialized();
    await s.api.clients.wallet.GET('/api/v1/wallet/balances');
    expect(s.backend.calls[0]?.auth).toBe('Bearer old');
    expect(s.rt.appStore.appStatus).toBe('app');
  });

  it('503 maintenance → appStatus maintenance → gate closed, no toast (mapped silent)', async () => {
    const s = setup({ [BALANCES]: () => problem(503, '/api/problems/maintenance', { retryAfterSec: 600 }) });

    s.auth.markInitialized();
    await s.api.clients.wallet.GET('/api/v1/wallet/balances');

    expect(s.rt.appStore.appStatus).toBe('maintenance');
    expect(s.rt.toasts.toasts).toHaveLength(0);
    expect((await s.api.clients.wallet.GET('/api/v1/health')).response.status).toBe(503);
    expect(s.backend.count('GET /api/v1/health')).toBe(0);
  });
});

describe('401: single-flight refresh, retry once, clear only the current session', () => {
  const refreshOk = () => json(200, { token: 'new', refreshToken: 'r2' });
  const authed = (req: Request) => (req.headers.get('Authorization') === 'Bearer new' ? json(200, { id: 'u1', name: 'Ann' }) : problem(401, '/api/problems/unauthorized'));

  it('parallel 401s share one refresh; requests are retried with the new token; no logout', async () => {
    const s = setup({
      'GET /api/v1/profile': authed,
      [TRANSFERS]: (req) => (req.headers.get('Authorization') === 'Bearer new' ? json(201, { id: 't', status: 'ok' }) : problem(401, '/api/problems/unauthorized')),
      'POST /api/v1/auth/refresh': async () => {
        await new Promise((r) => setTimeout(r, 20));

        return refreshOk();
      },
    });

    s.auth.setSession({ token: 'old', refreshToken: 'r1' });

    const [a, b] = await Promise.all([
      s.api.clients.wallet.GET('/api/v1/profile'),
      s.api.clients.wallet.POST('/api/v1/wallet/transfers', transferBody),
    ]);

    expect(a.data?.name).toBe('Ann');
    expect(b.data?.id).toBe('t');
    expect(s.backend.count('POST /api/v1/auth/refresh')).toBe(1);
    expect(s.auth.refreshCalls).toBe(1);
    expect(s.auth.token).toBe('new');
    const retriedPost = s.backend.calls.filter((c) => c.path === '/api/v1/wallet/transfers').at(-1);

    expect(retriedPost?.body).toBe(JSON.stringify(transferBody.body)); // body survived the retry
  });

  it('refresh fails → the current session is cleared (auth screen), not a fatal screen', async () => {
    const s = setup({
      'GET /api/v1/profile': () => problem(401, '/api/problems/unauthorized'),
      'POST /api/v1/auth/refresh': () => problem(401, '/api/problems/refresh_token_expired'),
    });

    s.auth.setSession({ token: 'old', refreshToken: 'r1' });
    s.auth.markInitialized();
    await s.api.clients.wallet.GET('/api/v1/profile');

    expect(s.auth.token).toBeNull();
    expect(s.rt.appStore.appStatus).toBe('app');
    expect(s.rt.toasts.toasts).toHaveLength(0); // 401 mapped silent, refresh silent
  });

  it('401 with an old (superseded) token does not log out', async () => {
    const s = setup({
      'GET /api/v1/profile': [
        () => {
          s.auth.setSession({ token: 'new', refreshToken: 'r2' }); // the session moved on meanwhile

          return problem(401, '/api/problems/unauthorized');
        },
        authed,
      ],
    });

    s.auth.setSession({ token: 'old', refreshToken: 'r1' });

    const { data } = await s.api.clients.wallet.GET('/api/v1/profile');

    expect(s.auth.token).toBe('new');
    expect(s.backend.count('POST /api/v1/auth/refresh')).toBe(0);
    expect(data?.name).toBe('Ann'); // retried once with the current token
  });

  it('cookie/BFF adapter (no refresh): no client refresh, 401 clears the session, no Authorization header', async () => {
    const s = setupCookie({ 'GET /api/v1/profile': () => problem(401, '/api/problems/unauthorized'), 'POST /api/v1/auth/refresh': refreshOk });

    s.auth.setAuthorized(true);
    await s.api.clients.wallet.GET('/api/v1/profile');

    expect(s.backend.count('POST /api/v1/auth/refresh')).toBe(0);
    expect(s.backend.calls[0]?.auth).toBeNull();
    expect(s.auth.isAuthorized).toBe(false);
  });

  it('custom header format comes from the adapter (e.g. TMA `Authorization: tma <initData>`)', async () => {
    const s = setup({ 'GET /api/v1/profile': () => json(200, { id: 'u', name: 'Ann' }) });
    const tma = new BearerTokenAuth({ scheme: 'tma' });
    const rt = createRuntime({ auth: tma });
    const client = createServiceClient<WalletPaths>('wallet', rt, { baseUrl: BASE, fetch: s.backend.fetch });

    tma.setSession({ token: 'query_id=1&user=2' });
    await client.GET('/api/v1/profile');
    expect(s.backend.calls[0]?.auth).toBe('tma query_id=1&user=2');
  });
});

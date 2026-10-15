// The library on its own: no generated code, no sample backend, neutral defaults only.
import { describe, expect, it } from 'vitest';
import {
  createRuntime,
  createServiceClient,
  noAuth,
  onlineEventOnly,
  registerMappings,
  startNetworkRecovery,
} from '../src/index.ts';

type AnyPaths = Record<string, Record<string, unknown>>;

const problemResponse = (status: number, type: string) =>
  new Response(JSON.stringify({ type, status }), { status, headers: { 'content-type': 'application/problem+json' } });

describe('neutral defaults', () => {
  it('createRuntime() needs nothing: anonymous auth, app status, keys as texts', () => {
    const rt = createRuntime({ isClient: () => true });

    expect(rt.auth).toBe(noAuth);
    expect(rt.appStore.appStatus).toBe('app');
    expect(rt.t('anyKey')).toBe('anyKey');
  });

  it('a hand-registered mapping works without the generator; 401 with noAuth clears nothing and does not retry', async () => {
    const rt = createRuntime({ isClient: () => true });
    const calls: string[] = [];
    const fetchFn = async (req: Request) => {
      calls.push(`${req.method} ${new URL(req.url).pathname} ${req.headers.get('Authorization')}`);

      return new URL(req.url).pathname === '/things/1' ? problemResponse(404, '/p/not_found') : problemResponse(401, '/p/unauthorized');
    };

    registerMappings('any', {
      '/things/{id}': { responses: [{ variants: ['GET_404_/p/not_found'], type: 'toast', severity: 'error', i18n: { title: 'notFound' } }] },
    });

    const client = createServiceClient<AnyPaths>('any', rt, { baseUrl: 'https://x.test', fetch: fetchFn });
    const get = client.GET as unknown as (path: string, init?: object) => Promise<{ error?: unknown }>;

    await get('/things/{id}', { params: { path: { id: '1' } } });
    expect(rt.toasts.toasts.map((t) => t.title)).toEqual(['notFound']);

    const { error } = await get('/me');

    expect(error).toMatchObject({ _httpStatus: 401 });
    expect(calls).toEqual(['GET /things/1 null', 'GET /me null']);
  });

  it('no-network recovery without any health endpoint (onlineEventOnly)', async () => {
    const rt = createRuntime();
    const events = new EventTarget();
    let recovered = 0;

    rt.appStore.setFoundationQueries([{ data: undefined, status: 'failed', errorKind: 'network' }]);
    // noAuth is not authorized → foundation-query rules do not apply (as xRocket: no session → `app`)
    expect(rt.appStore.appStatus).toBe('app');

    const authed = createRuntime({ auth: { ...noAuth, isAuthorized: true } });

    authed.appStore.setFoundationQueries([{ data: undefined, status: 'failed', errorKind: 'network' }]);
    expect(authed.appStore.appStatus).toBe('no-network');
    startNetworkRecovery({ appStore: authed.appStore, events, ping: onlineEventOnly, recover: () => recovered++ });
    events.dispatchEvent(new Event('online'));
    await new Promise((r) => setTimeout(r, 5));
    expect(recovered).toBe(1);
  });
});

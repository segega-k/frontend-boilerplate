import { onlineManager } from '@tanstack/query-core';
import { autorun } from 'mobx';
import { afterEach, describe, expect, it } from 'vitest';
import { createQuery, healthPing, startNetworkRecovery } from '@repo/api';
import { BASE, json, networkDown, problem, setup, until } from './harness.ts';

const PROFILE = 'GET /api/v1/profile';

function bootWithFoundation(routes: Parameters<typeof setup>[0]) {
  const s = setup(routes);
  const profile = createQuery(s.queryClient, () => s.api.queries.wallet.getProfile());
  const dispose = autorun(() => void profile.status); // the shell observes it

  s.rt.appStore.setFoundationQueries([profile]);
  s.auth.setSession({ token: 'tok', refreshToken: 'r' });

  return { ...s, profile, dispose };
}

afterEach(() => onlineManager.setOnline(true));

describe('appStatus (computed)', () => {
  it('initial until auth is initialized, then app', () => {
    const s = setup({});

    expect(s.rt.appStore.appStatus).toBe('initial');
    s.auth.markInitialized();
    expect(s.rt.appStore.appStatus).toBe('app');
  });

  it('banned overrides initial', () => {
    const s = setup({});

    s.rt.userStore.markBanned(null);
    expect(s.rt.appStore.appStatus).toBe('banned');
  });

  it('first load of a foundation query fails on the network → no-network; gate then answers 503', async () => {
    const s = bootWithFoundation({ [PROFILE]: networkDown });

    s.auth.markInitialized();
    await until(() => s.profile.status === 'failed');
    expect(s.rt.appStore.appStatus).toBe('no-network');
    expect((await s.api.clients.wallet.GET('/api/v1/wallet/balances')).response.status).toBe(503);
    s.dispose();
  });

  it('first load fails on the server → server-error', async () => {
    const s = bootWithFoundation({ [PROFILE]: () => problem(500, '/api/problems/internal_error') });

    s.auth.markInitialized();
    await until(() => s.profile.status === 'failed');
    expect(s.rt.appStore.appStatus).toBe('server-error');
    s.dispose();
  });

  it('a failed refetch with data already loaded is not fatal', async () => {
    const s = bootWithFoundation({
      [PROFILE]: [() => json(200, { id: 'u', name: 'Ann' }), ...Array(4).fill(() => problem(500, '/api/problems/internal_error'))],
    });

    s.auth.markInitialized();
    await until(() => s.profile.status === 'succeeded');
    await s.profile.refetch();
    await until(() => s.profile.status === 'failed');
    expect(s.rt.appStore.appStatus).toBe('app');
    s.dispose();
  });

  it('offline at start: the paused query counts as no-network (xRocket §4.8 hypothesis confirmed and fixed)', async () => {
    onlineManager.setOnline(false);

    const s = bootWithFoundation({ [PROFILE]: () => json(200, { id: 'u', name: 'Ann' }) });

    s.auth.markInitialized();
    await until(() => s.profile.errorKind === 'network');
    // xRocket status stays `initial` here (never `failed`), so its appStatus would be 'app' with an empty profile.
    expect(s.profile.status).not.toBe('failed');
    expect(s.backend.calls).toHaveLength(0);
    expect(s.rt.appStore.appStatus).toBe('no-network');
    s.dispose();
  });
});

describe('no-network auto-recovery: `online` + health ping', () => {
  it('pings through a raw fetch (the gate is closed) and recovers when the backend answers', async () => {
    const s = bootWithFoundation({ [PROFILE]: networkDown, 'GET /api/v1/health': [networkDown, () => json(200, { ok: true })] });
    const events = new EventTarget();
    let recovered = 0;

    s.auth.markInitialized();
    await until(() => s.rt.appStore.appStatus === 'no-network');

    const stop = startNetworkRecovery({
      appStore: s.rt.appStore,
      events,
      ping: healthPing((input, init) => s.backend.fetch(new Request(input, init)), `${BASE}/api/v1/health`),
      recover: () => recovered++,
      delayMs: 1,
    });

    events.dispatchEvent(new Event('online'));
    await until(() => recovered === 1);
    expect(s.backend.count('GET /api/v1/health')).toBe(2); // first ping failed, second succeeded

    stop();
    s.dispose();
  });

  it('does nothing for other statuses', async () => {
    const s = setup({});
    const events = new EventTarget();
    let pinged = 0;

    s.auth.markInitialized();
    s.rt.appStore.setMaintenance(true);
    startNetworkRecovery({ appStore: s.rt.appStore, events, ping: async () => (pinged++, true), recover: () => undefined });
    events.dispatchEvent(new Event('online'));
    await new Promise((r) => setTimeout(r, 10));
    expect(pinged).toBe(0);
  });
});

describe('MobxQuery v2 bridge', () => {
  it('subscribes on first observer, unsubscribes when unobserved; status mirrors the query', async () => {
    const s = setup({ [PROFILE]: () => json(200, { id: 'u', name: 'Ann' }) });
    const q = createQuery(s.queryClient, () => s.api.queries.wallet.getProfile());
    const cached = () => s.queryClient.getQueryCache().findAll({ queryKey: ['wallet', 'get', '/api/v1/profile'] })[0];
    const seen: string[] = [];

    expect(q.status).toBe('initial'); // not observed: no fetch
    expect(s.backend.calls).toHaveLength(0);

    const dispose = autorun(() => void seen.push(q.status));

    await until(() => q.status === 'succeeded');
    expect(cached()?.getObserversCount()).toBe(1);
    expect(seen).toEqual(['loading', 'succeeded']);
    expect(q.data).toMatchObject({ id: 'u', name: 'Ann', _resolution: { type: 'silent' } }); // xRocket stamps mapped 2xx too
    dispose();
    expect(cached()?.getObserversCount()).toBe(0);
  });
});

describe('ToastsStore', () => {
  it('keeps at most 5 and auto-dismisses', async () => {
    const s = setup({});

    for (let i = 0; i < 7; i++) s.rt.toasts.push({ title: `t${i}`, severity: 'info' }, i === 6 ? 5 : 0);
    expect(s.rt.toasts.toasts.map((t) => t.title)).toEqual(['t2', 't3', 't4', 't5', 't6']);
    await until(() => s.rt.toasts.toasts.length === 4);
  });
});

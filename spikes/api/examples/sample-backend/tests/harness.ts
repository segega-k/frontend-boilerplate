import { QueryClient } from '@tanstack/query-core';
import { createSampleApp, type SampleAppOptions } from '../src/app.ts';

export const BASE = 'https://api.test';

export type Handler = (req: Request) => Response | Promise<Response>;

export interface Call {
  method: string;
  path: string;
  auth: string | null;
  body: string;
}

export function problem(status: number, type: string, extra: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify({ type, title: type.split('/').pop(), status, ...extra }), {
    status,
    headers: { 'content-type': 'application/problem+json' },
  });
}

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

export const networkDown: Handler = () => {
  throw new TypeError('fetch failed');
};

/** In-memory backend: `routes['GET /api/v1/profile'] = handler | handler[]` (array = one handler per call, last repeats). */
export function fakeBackend(routes: Record<string, Handler | Handler[]>) {
  const calls: Call[] = [];
  const counters = new Map<string, number>();

  const fetchFn = async (req: Request): Promise<Response> => {
    if (req.signal.aborted) throw new DOMException('This operation was aborted', 'AbortError');

    const url = new URL(req.url);
    const key = `${req.method} ${url.pathname}`;
    const body = req.body ? await req.clone().text() : '';

    calls.push({ method: req.method, path: url.pathname, auth: req.headers.get('Authorization'), body });

    const route = routes[key];

    if (!route) return problem(404, '/api/problems/not_found');

    const n = counters.get(key) ?? 0;

    counters.set(key, n + 1);

    const handler = Array.isArray(route) ? (route[Math.min(n, route.length - 1)] as Handler) : route;

    return handler(req);
  };

  return { fetch: fetchFn, calls, count: (key: string) => calls.filter((c) => `${c.method} ${c.path}` === key).length };
}

type Extra = Omit<SampleAppOptions, 'baseUrl' | 'fetch' | 'session'>;

function common(routes: Record<string, Handler | Handler[]>, options: Extra) {
  const backend = fakeBackend(routes);
  const supportTexts: string[] = [];
  const base = {
    baseUrl: BASE,
    fetch: backend.fetch,
    isClient: () => true,
    retry: { maxRetries: 3, baseDelayMs: 1, maxDelayMs: 30_000 },
    openSupport: (text: string) => void supportTexts.push(text),
    ...options,
  };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

  return { backend, supportTexts, base, queryClient };
}

/** Sample app with a bearer-token session (refresh through /auth/refresh). */
export function setup(routes: Record<string, Handler | Handler[]>, options: Extra = {}) {
  const c = common(routes, options);
  const app = createSampleApp({ ...c.base, session: 'token' });

  return { ...app, backend: c.backend, queryClient: c.queryClient, supportTexts: c.supportTexts };
}

/** Sample app with a cookie (BFF) session: no client refresh. */
export function setupCookie(routes: Record<string, Handler | Handler[]>, options: Extra = {}) {
  const c = common(routes, options);
  const app = createSampleApp({ ...c.base, session: 'cookie' });

  return { ...app, backend: c.backend, queryClient: c.queryClient, supportTexts: c.supportTexts };
}

export async function until(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();

  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('until(): timed out');
    await new Promise((r) => setTimeout(r, 2));
  }
}

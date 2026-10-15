import { authAdapter } from '@/auth.config';
import { backendConfig } from '@/shared/config/backend.server';
import { getSessionData } from '@/shared/lib/session/dal';

// BFF: proxies allowlisted calls to the configured upstream and attaches authorization from the session cookie.
// It knows nothing about the backend's API beyond the allowlist configuration.
const FORWARDED_REQUEST_HEADERS = ['accept', 'content-type', 'accept-language'];
const FORWARDED_RESPONSE_HEADERS = ['content-type', 'cache-control', 'etag'];

function isAllowed(method: string, path: string): boolean {
  return backendConfig.bffAllow.some((rule) => {
    const [m, pattern] = rule.split(':');
    if (m !== method || !pattern) return false;
    const re = new RegExp(`^${pattern.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]+')}$`);
    return re.test(path);
  });
}

async function proxy(request: Request, ctx: RouteContext<'/api/bff/[...path]'>) {
  const { path } = await ctx.params;
  if (path.some((seg) => seg === '..' || seg === '.' || seg.includes('\\'))) return new Response(null, { status: 400 });
  const upstreamPath = `/${path.map(encodeURIComponent).join('/')}`;
  if (!backendConfig.apiUrl) return new Response(null, { status: 503 });
  if (!isAllowed(request.method, upstreamPath)) return new Response(null, { status: 404 });
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const site = request.headers.get('sec-fetch-site');
    if (site && site !== 'same-origin') return new Response(null, { status: 403 });
  }
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const session = await getSessionData();
  if (session) authAdapter.authorize(session, headers);
  const search = new URL(request.url).search;
  const upstream = await fetch(`${backendConfig.apiUrl}${upstreamPath}${search}`, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer(),
    cache: 'no-store',
  });
  const out = new Headers({ 'cache-control': 'private, no-store' });
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };

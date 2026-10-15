import 'server-only';
import { authAdapter } from '@/auth.config';
import { backendConfig } from '@/shared/config/backend.server';
import { getSessionData } from '@/shared/lib/session/dal';

// Server-side upstream call: fixed base URL from config, authorization applied by the adapter.
// The generated API SDK (packages/api) would sit on top of this in the real template.
export async function serverFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!backendConfig.apiUrl) throw new Error('API_URL is not configured');
  const headers = new Headers(init.headers);
  const session = await getSessionData();
  if (session) authAdapter.authorize(session, headers);
  return fetch(`${backendConfig.apiUrl}${path}`, { ...init, headers, cache: 'no-store' });
}

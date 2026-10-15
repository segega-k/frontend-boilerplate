import 'server-only';
import { getIronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import { connection } from 'next/server';
import type { SessionData } from './types';

const SPIKE_ONLY_PASSWORD = 'spike-only-password-change-me-0123456789abcdef';

const options: SessionOptions = {
  // __Host- prefix: browser enforces Secure, Path=/ and no Domain attribute.
  cookieName: '__Host-session',
  password: process.env.SESSION_PASSWORD ?? SPIKE_ONLY_PASSWORD,
  ttl: 60 * 60 * 8,
  cookieOptions: { httpOnly: true, secure: true, sameSite: 'lax', path: '/' },
};

export async function openSession() {
  // iron-session checks expiry with Date.now(); under cacheComponents that must happen after a request
  // boundary, otherwise a runtime prerender logs "unstable value Date.now()". Layout and page render in
  // parallel, so the layout's connection() does not cover the page — the DAL marks it itself.
  await connection();
  return getIronSession<Partial<SessionData>>(await cookies(), options);
}

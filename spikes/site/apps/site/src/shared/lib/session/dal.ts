import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { openSession } from './cookie';
import type { SessionData, SessionUser } from './types';

// Data Access Layer: the only way pages, actions and route handlers read the session.
// Access is checked here next to the data, not in proxy.ts or a layout.
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const session = await openSession();
  if (!session.subject) return null;
  return { subject: session.subject, displayName: session.displayName };
});

// Server-only: full session including adapter credentials, for the BFF and server data fetches.
export const getSessionData = cache(async (): Promise<SessionData | null> => {
  const session = await openSession();
  if (!session.subject || !session.credentials) return null;
  return { subject: session.subject, displayName: session.displayName, credentials: session.credentials };
});

export async function requireSession(locale: string): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect(`/${locale}/login?returnTo=${encodeURIComponent(`/${locale}/account`)}`);
  return user;
}

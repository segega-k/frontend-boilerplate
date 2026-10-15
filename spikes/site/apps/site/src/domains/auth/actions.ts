'use server';

import { redirect } from 'next/navigation';
import { authAdapter } from '@/auth.config';
import { openSession } from '@/shared/lib/session/cookie';
import { getSessionData } from '@/shared/lib/session/dal';

function safeReturnTo(value: FormDataEntryValue | null, locale: string): string {
  const path = typeof value === 'string' ? value : '';
  return /^\/(en|ru)(\/[\w\-/]*)?$/.test(path) ? path : `/${locale}/account`;
}

export async function loginAction(_prev: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const locale = form.get('locale') === 'ru' ? 'ru' : 'en';
  const returnTo = safeReturnTo(form.get('returnTo'), locale);
  const fields: Record<string, string> = {};
  for (const [key, value] of form) if (typeof value === 'string' && !key.startsWith('$') && key !== 'locale' && key !== 'returnTo') fields[key] = value;
  const result = await authAdapter.signIn(
    form.get('mode') === 'redirect' ? { kind: 'redirect', returnTo } : { kind: 'credentials', fields },
  );
  if (result.kind === 'error') return { error: result.code };
  if (result.kind === 'redirect') redirect(result.url);
  const session = await openSession();
  Object.assign(session, result.session);
  await session.save();
  redirect(returnTo);
}

export async function logoutAction(form: FormData): Promise<void> {
  const locale = form.get('locale') === 'ru' ? 'ru' : 'en';
  const data = await getSessionData();
  if (data) await authAdapter.signOut(data);
  const session = await openSession();
  session.destroy();
  redirect(`/${locale}`);
}

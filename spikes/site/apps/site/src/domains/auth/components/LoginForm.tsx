'use client';

import { Button } from '@spike/ui';
import { useT } from 'next-i18next/client';
import { useActionState } from 'react';
import { loginAction } from '../actions';

export function LoginForm({ locale, returnTo }: { locale: string; returnTo: string }) {
  const { t } = useT();
  const [state, action, pending] = useActionState(loginAction, {});
  return (
    <form action={action} data-testid="login-form">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input name="username" aria-label="username" defaultValue="alice" />
      <input name="password" aria-label="password" type="password" defaultValue="secret" />
      <Button type="submit" disabled={pending} testId="login-submit">
        {t('login')}
      </Button>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}

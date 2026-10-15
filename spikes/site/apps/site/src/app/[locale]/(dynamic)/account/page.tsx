import { Button } from '@spike/ui';
import { logoutAction } from '@/domains/auth/actions';
import { getT } from '@/shared/lib/i18n/i18n.server';
import { requireSession } from '@/shared/lib/session/dal';
import { PageTransition } from '@/shared/ui/PageTransition';

export default async function AccountPage({ params }: PageProps<'/[locale]/account'>) {
  const { locale } = await params;
  const user = await requireSession(locale);
  const { t } = await getT();
  return (
    <PageTransition>
      <section data-testid="account">
        <h1>{t('account')}</h1>
        <p data-testid="welcome">{t('welcome', { name: user.displayName ?? user.subject })}</p>
        <form action={logoutAction}>
          <input type="hidden" name="locale" value={locale} />
          <Button type="submit" tone="ghost" testId="logout">
            {t('logout')}
          </Button>
        </form>
      </section>
    </PageTransition>
  );
}

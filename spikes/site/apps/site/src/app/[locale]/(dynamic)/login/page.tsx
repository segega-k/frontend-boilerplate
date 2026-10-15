import { LoginForm } from '@/domains/auth/components/LoginForm';
import { getT } from '@/shared/lib/i18n/i18n.server';
import { PageTransition } from '@/shared/ui/PageTransition';

export default async function LoginPage({ params, searchParams }: PageProps<'/[locale]/login'>) {
  const { locale } = await params;
  const { returnTo } = await searchParams;
  const { t } = await getT();
  return (
    <PageTransition>
      <section data-testid="login">
        <h1>{t('login')}</h1>
        <LoginForm locale={locale} returnTo={typeof returnTo === 'string' ? returnTo : `/${locale}/account`} />
      </section>
    </PageTransition>
  );
}

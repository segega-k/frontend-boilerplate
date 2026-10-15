import Link from 'next/link';
import { getT } from '@/shared/lib/i18n/i18n.server';
import { PageTransition } from '@/shared/ui/PageTransition';

export default async function AboutPage({ params }: PageProps<'/[locale]/about'>) {
  const { locale } = await params;
  const { t } = await getT();
  return (
    <PageTransition>
      <section data-testid="about">
        <h1>{t('about')}</h1>
        <p>{t('aboutText')}</p>
        <Link href={`/${locale}`} transitionTypes={['nav-back']} data-testid="to-home">
          ← {t('home')}
        </Link>
      </section>
    </PageTransition>
  );
}

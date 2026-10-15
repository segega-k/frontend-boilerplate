import Link from 'next/link';
import { getNews } from '@/domains/news/api.server';
import { ClickCounter } from '@/domains/home/components/ClickCounter';
import { getT } from '@/shared/lib/i18n/i18n.server';
import { PageTransition } from '@/shared/ui/PageTransition';

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  const { t } = await getT();
  const news = await getNews(locale);
  return (
    <PageTransition>
      <section data-testid="home">
        <h1>{t('home')}</h1>
        <h2>{t('news')}</h2>
        <ul>
          {news.items.map((item) => (
            <li key={item.id}>{item.title}</li>
          ))}
        </ul>
        <p data-testid="news-generated">{news.generatedAt}</p>
        <ClickCounter />
        <Link href={`/${locale}/about`} transitionTypes={['nav-forward']} data-testid="to-about">
          {t('about')} →
        </Link>
      </section>
    </PageTransition>
  );
}

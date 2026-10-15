import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';

export type NewsItem = { id: number; title: string };

// Public data only: 'use cache' lives in api.server.ts and always carries a cacheTag.
export async function getNews(locale: string): Promise<{ items: NewsItem[]; generatedAt: string }> {
  'use cache';
  cacheTag('news', `news:${locale}`);
  cacheLife('hours');
  return {
    items: [
      { id: 1, title: locale === 'ru' ? 'Первая новость' : 'First news' },
      { id: 2, title: locale === 'ru' ? 'Вторая новость' : 'Second news' },
    ],
    generatedAt: new Date().toISOString(),
  };
}

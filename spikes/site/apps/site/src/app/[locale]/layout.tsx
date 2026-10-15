import Link from 'next/link';
import { I18nProvider } from 'next-i18next/client';
import type { ReactNode } from 'react';
import { Providers } from '../_root/providers';
import { generateI18nStaticParams, getResources, getT } from '@/shared/lib/i18n/i18n.server';
import { layout } from '@/shared/ui/Layout.styled';
import '../globals.css';

// The generic "/[locale]" shell (unknown locale) cannot be prerendered: the root layout needs the locale.
// `instant = false` lets that shell block instead of logging NEXT_STATIC_GEN_BAILOUT on every prefetch;
// en/ru pages are still prerendered via generateStaticParams. (dynamicParams is rejected with cacheComponents.)
export const instant = false;

export function generateStaticParams() {
  return generateI18nStaticParams();
}

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t('title') };
}

const s = layout();

export default async function RootLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  const { t, i18n } = await getT();
  return (
    <html lang={locale}>
      <body className={s.body()}>
        <I18nProvider language={locale} resources={getResources(i18n, ['common'], [locale])}>
          <Providers>
            <header className={s.header()}>
              <strong>{t('title')}</strong>
              <nav className={s.nav()}>
                <Link href={`/${locale}`} transitionTypes={['nav-back']}>{t('home')}</Link>
                <Link href={`/${locale}/about`} transitionTypes={['nav-forward']}>{t('about')}</Link>
                <Link href={`/${locale}/items`} transitionTypes={['nav-forward']}>{t('items')}</Link>
                <Link href={`/${locale}/account`} transitionTypes={['nav-forward']}>{t('account')}</Link>
                <Link href={locale === 'en' ? '/ru' : '/en'}>{locale === 'en' ? 'RU' : 'EN'}</Link>
              </nav>
            </header>
            <main className={s.main()}>{children as ReactNode}</main>
          </Providers>
        </I18nProvider>
      </body>
    </html>
  );
}

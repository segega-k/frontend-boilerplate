import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { getItems } from '@/domains/items/api.server';
import { ItemsPanel } from '@/domains/items/components/ItemsPanel';
import { ITEMS_KEY } from '@/domains/items/queries';
import { getT } from '@/shared/lib/i18n/i18n.server';
import { PageTransition } from '@/shared/ui/PageTransition';

async function PrefetchedItems() {
  await connection();
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({ queryKey: ITEMS_KEY, queryFn: getItems });
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ItemsPanel />
    </HydrationBoundary>
  );
}

export default async function ItemsPage() {
  const { t } = await getT();
  return (
    <PageTransition>
      <section data-testid="items-page">
        <h1>{t('itemsTitle')}</h1>
        <Suspense fallback={<p>…</p>}>
          <PrefetchedItems />
        </Suspense>
      </section>
    </PageTransition>
  );
}

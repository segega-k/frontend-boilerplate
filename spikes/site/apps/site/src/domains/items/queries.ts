import { queryOptions } from '@tanstack/react-query';
import type { Item } from './types';

export const ITEMS_KEY = ['items'] as const;

// Client query: same key as the RSC prefetch, so the hydrated cache entry is reused without a request.
export const itemsQuery = queryOptions({
  queryKey: ITEMS_KEY,
  queryFn: async (): Promise<Item[]> => {
    const res = await fetch('/api/bff/items');
    if (!res.ok) throw new Error(`items ${res.status}`);
    return res.json();
  },
  staleTime: 60_000,
});

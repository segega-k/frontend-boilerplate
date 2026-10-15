import 'server-only';
import { serverFetch } from '@/shared/lib/http/serverFetch';
import type { Item } from './types';

// Per-request (uncached, may be personal) data for the RSC prefetch. The path is the example backend's.
export async function getItems(): Promise<Item[]> {
  const res = await serverFetch('/items');
  if (!res.ok) throw new Error(`items ${res.status}`);
  return res.json();
}

import { connection } from 'next/server';
import type { ReactNode } from 'react';

// Nonce-CSP zone: the whole segment renders per request (no prerendered shell), because a static shell
// cannot carry the per-request nonce that proxy.ts puts into the CSP header.
export const instant = false;

export default async function DynamicZoneLayout({ children }: { children: ReactNode }) {
  await connection();
  return children;
}

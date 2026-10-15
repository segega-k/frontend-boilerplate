'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { enableStaticRendering } from 'mobx-react-lite';
import { useState, type ReactNode } from 'react';

// observer() must not subscribe during SSR: server renders are one-shot and would leak reactions.
enableStaticRendering(typeof window === 'undefined');

export function Providers({ children }: { children: ReactNode }) {
  // One QueryClient per request on the server and one per tab in the browser; never a module singleton.
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } }),
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

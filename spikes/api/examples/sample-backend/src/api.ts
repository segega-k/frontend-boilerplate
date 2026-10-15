// FIXTURE wiring: what an app's `shared/api` would contain for THIS sample backend.
import { createServiceClient, type ApiRuntime } from '@repo/api';
import type { paths as AuthPaths } from './generated/auth.ts';
import type { paths as WalletPaths } from './generated/wallet.ts';
import {
  createAuthMutations,
  createAuthQueries,
  createWalletMutations,
  createWalletQueries,
} from './mappings/index.generated.ts';

export interface SampleApiOptions {
  baseUrl: string;
  fetch?: (input: Request) => Promise<Response>;
}

export function createSampleApi(rt: ApiRuntime, options: SampleApiOptions) {
  const wallet = createServiceClient<WalletPaths>('wallet', rt, options);
  const auth = createServiceClient<AuthPaths>('auth', rt, { ...options, kind: 'sign-in' });

  return {
    clients: { wallet, auth },
    queries: { wallet: createWalletQueries(wallet), auth: createAuthQueries(auth) },
    mutations: { wallet: createWalletMutations(wallet), auth: createAuthMutations(auth) },
  };
}

export type SampleApi = ReturnType<typeof createSampleApi>;

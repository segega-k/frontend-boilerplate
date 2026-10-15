import type { AuthAdapter } from './contract.ts';
import type { AppStore } from './state/AppStore.ts';
import type { ToastsStore } from './state/ToastsStore.ts';
import type { UserStore } from './state/UserStore.ts';

export type Translate = (key: string, params?: Record<string, string>) => string;

/**
 * Everything the middleware chain needs. Built once per app (client) or once per request (SSR), so nothing is
 * resolved from a process-global container (fixes xRocket §4.7). Beyond the fixed error contract, backend specifics live in `auth`.
 */
export interface ApiRuntime {
  appStore: AppStore;
  auth: AuthAdapter;
  userStore: UserStore;
  toasts: ToastsStore;
  /** Translation of mapping keys (namespace `apiErrors`). */
  t: Translate;
  /** false on the server: resolution still stamps `_resolution`, but no toast is pushed. */
  isClient: () => boolean;
  /** Opens support with a prefilled text (TMA: bot link; web: mailto/form). */
  openSupport: (text: string) => void;
  /** Window for collapsing identical NET toasts (ms). */
  netToastDedupMs: number;
  retry: { maxRetries: number; baseDelayMs: number; maxDelayMs: number };
  now: () => number;
}

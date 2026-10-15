import { noAuth, type AuthAdapter } from './contract.ts';
import type { ApiRuntime, Translate } from './runtime.ts';
import { AppStore } from './state/AppStore.ts';
import { ToastsStore } from './state/ToastsStore.ts';
import { UserStore } from './state/UserStore.ts';

export interface RuntimeOptions {
  /** Default: `noAuth` (anonymous API). */
  auth?: AuthAdapter;
  /** Default: identity (shows keys) — apps pass i18next `t` bound to `apiErrors`. */
  t?: Translate;
  isClient?: () => boolean;
  openSupport?: (text: string) => void;
  netToastDedupMs?: number;
  retry?: ApiRuntime['retry'];
  now?: () => number;
}

/** What `app/` builds once on the client (or per request on SSR) and hands to clients and React context. */
export function createRuntime(options: RuntimeOptions = {}): ApiRuntime {
  const auth = options.auth ?? noAuth;
  const userStore = new UserStore(auth);

  return {
    auth,
    userStore,
    appStore: new AppStore(auth, userStore),
    toasts: new ToastsStore(),
    t: options.t ?? ((key) => key),
    isClient: options.isClient ?? (() => typeof window !== 'undefined'),
    openSupport: options.openSupport ?? (() => undefined),
    netToastDedupMs: options.netToastDedupMs ?? 3000,
    retry: options.retry ?? { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 30_000 },
    now: options.now ?? (() => Date.now()),
  };
}

import type { AppStore } from './AppStore.ts';

export interface NetworkRecoveryOptions {
  appStore: AppStore;
  /** window in the browser. */
  events: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  /** Health ping with a raw fetch: it must bypass the gate, which answers 503 while the status is fatal. */
  ping: () => Promise<boolean>;
  /** What the "Try again" button does. Default in apps: full reload (xRocket: rebuilds stores and opens the gate). */
  recover: () => void;
  attempts?: number;
  delayMs?: number;
}

/**
 * New vs xRocket (plan §4): `no-network` recovers on its own. On `online` it pings the health endpoint (a few tries,
 * because `online` fires before DNS/TLS are ready) and, if the backend answers, runs the same recovery as the button.
 * Other fatal statuses are not touched. Returns a disposer.
 */
export function startNetworkRecovery(options: NetworkRecoveryOptions): () => void {
  const { appStore, events, ping, recover, attempts = 3, delayMs = 2000 } = options;
  let running = false;

  const onOnline = async (): Promise<void> => {
    if (running || appStore.appStatus !== 'no-network') {
      return;
    }

    running = true;

    try {
      for (let i = 0; i < attempts; i++) {
        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }

        const ok = await ping().catch(() => false);

        if (ok) {
          recover();

          return;
        }
      }
    } finally {
      running = false;
    }
  };

  const listener = () => void onOnline();

  events.addEventListener('online', listener);

  return () => events.removeEventListener('online', listener);
}

/** Probe option 1: GET a configured URL (any endpoint the backend answers with 2xx; no payload is read). */
export function healthPing(fetchFn: typeof fetch, url: string): () => Promise<boolean> {
  return async () => {
    const response = await fetchFn(url, { cache: 'no-store' });

    return response.ok;
  };
}

/**
 * Probe option 2, for backends without a health URL: trust the `online` event; the recovered app's first request is the
 * real check (if it fails on the network, the status goes back to `no-network`).
 */
export const onlineEventOnly = (): Promise<boolean> => Promise.resolve(true);

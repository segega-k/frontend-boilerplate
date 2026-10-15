import { action, computed, makeObservable, observable, observableShallow } from 'mobx';
import type { AuthAdapter } from '../contract.ts';
import type { UserStore } from './UserStore.ts';
import type { LoadingStatus } from '../query/MobxQuery.ts';

export type AppStatus = 'initial' | 'app' | 'no-network' | 'server-error' | 'banned' | 'maintenance';

/** Statuses that unmount the router, show FailureScreen and close the gate. */
export const FATAL_APP_STATUSES: readonly AppStatus[] = ['no-network', 'server-error', 'banned', 'maintenance'];

export interface FoundationQuery {
  readonly data: unknown;
  readonly status: LoadingStatus;
  readonly errorKind: 'network' | 'server' | null;
}

/**
 * `appStatus` is computed, never set (xRocket `AppStore.appStatus`). Order: banned → maintenance (new) → initial →
 * not authorized → hard-failed foundation queries (first load only) → app. The TMA-login branch is app-specific and
 * not part of the spike.
 */
export class AppStore {
  maintenance = false;
  private foundationQueries: FoundationQuery[] = [];
  private readonly authStore: AuthAdapter;
  private readonly userStore: UserStore;

  constructor(authStore: AuthAdapter, userStore: UserStore) {
    this.authStore = authStore;
    this.userStore = userStore;
    makeObservable<AppStore, 'foundationQueries'>(this, {
      maintenance: observable,
      foundationQueries: observableShallow,
      appStatus: computed,
      setMaintenance: action,
      setFoundationQueries: action,
    });
  }

  setFoundationQueries(queries: FoundationQuery[]): void {
    this.foundationQueries = queries;
  }

  setMaintenance(value: boolean): void {
    this.maintenance = value;
  }

  get appStatus(): AppStatus {
    if (this.userStore.isBanned) {
      return 'banned';
    }
    if (this.maintenance) {
      return 'maintenance';
    }
    if (!this.authStore.isInitialized) {
      return 'initial';
    }
    if (!this.authStore.isAuthorized) {
      return 'app';
    }

    // First load failed (data never arrived). Offline-paused queries count as network failures: fixes the xRocket
    // hypothesis §4.8 where a paused query stayed `initial` and the app opened with an empty profile.
    const hardFailed = this.foundationQueries.filter(
      (q) => q.data === undefined && (q.status === 'failed' || q.errorKind === 'network'),
    );

    if (hardFailed.length === 0) {
      return 'app';
    }

    return hardFailed.some((q) => q.errorKind === 'network') ? 'no-network' : 'server-error';
  }

  get isFatal(): boolean {
    return FATAL_APP_STATUSES.includes(this.appStatus);
  }
}

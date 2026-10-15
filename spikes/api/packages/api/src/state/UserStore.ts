import { action, computed, makeObservable, observable } from 'mobx';
import type { AuthAdapter } from '../contract.ts';

const BANNED_WITHOUT_TOKEN = '\u0000banned-without-token';

/** Ban bound to the token of the request that got the 403 (1:1 with xRocket `UserStore.markBanned`). */
export class UserStore {
  private bannedToken: string | null = null;

  private readonly authStore: AuthAdapter;

  constructor(authStore: AuthAdapter) {
    this.authStore = authStore;
    makeObservable<UserStore, 'bannedToken'>(this, {
      bannedToken: observable,
      isBanned: computed,
      markBanned: action,
      clearStoredData: action,
    });
  }

  markBanned(token: string | null): void {
    // A response to a request sent before the token changed says nothing about the current session.
    if (token !== null && token !== this.authStore.currentCredential()) {
      return;
    }

    this.bannedToken = token ?? BANNED_WITHOUT_TOKEN;
  }

  get isBanned(): boolean {
    if (this.bannedToken === null) {
      return false;
    }
    if (this.bannedToken === BANNED_WITHOUT_TOKEN) {
      return true;
    }

    return this.bannedToken === this.authStore.currentCredential();
  }

  async clearStoredData(): Promise<void> {
    this.bannedToken = null;
  }
}

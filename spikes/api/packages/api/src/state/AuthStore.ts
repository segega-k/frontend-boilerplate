import { action, computed, makeObservable, observable } from 'mobx';
import type { AuthAdapter } from '../contract.ts';

export interface SessionTokens {
  token: string;
  refreshToken?: string;
}

export interface BearerTokenAuthOptions {
  /** Header name. Default `Authorization`. */
  header?: string;
  /** Scheme prefix. Default `Bearer` (TMA backends often use `tma`). Empty string → raw token. */
  scheme?: string;
  /** Optional refresh. Without it a 401 on the current session just clears it. */
  refresh?: (refreshToken: string | null) => Promise<SessionTokens | null>;
}

/**
 * Ready-made adapter for token sessions (header + optional refresh). One of the adapters, not a requirement.
 * Observable so the app shell and `appStatus` react to sign-in/out.
 */
export class BearerTokenAuth implements AuthAdapter {
  token: string | null = null;
  refreshToken: string | null = null;
  isInitialized = false;
  refreshCalls = 0;
  readonly refresh: (() => Promise<boolean>) | undefined;
  private readonly header: string;
  private readonly scheme: string;

  constructor(options: BearerTokenAuthOptions = {}) {
    this.header = options.header ?? 'Authorization';
    this.scheme = options.scheme ?? 'Bearer';

    const refreshFn = options.refresh;

    this.refresh = refreshFn
      ? async () => {
          this.refreshCalls++;

          const session = await refreshFn(this.refreshToken).catch(() => null);

          if (session) this.setSession(session);

          return session !== null;
        }
      : undefined;

    makeObservable(this, {
      token: observable,
      refreshToken: observable,
      isInitialized: observable,
      isAuthorized: computed,
      setSession: action,
      markInitialized: action,
      clearSession: action,
    });
  }

  get isAuthorized(): boolean {
    return this.token !== null;
  }

  setSession(session: SessionTokens): void {
    this.token = session.token;
    this.refreshToken = session.refreshToken ?? null;
  }

  markInitialized(): void {
    this.isInitialized = true;
  }

  async clearSession(): Promise<void> {
    this.token = null;
    this.refreshToken = null;
  }

  applyAuth(request: Request): void {
    if (this.token) request.headers.set(this.header, this.scheme ? `${this.scheme} ${this.token}` : this.token);
  }

  credentialOf(request: Request): string | null {
    const raw = request.headers.get(this.header);

    if (!raw) return null;

    const token = (this.scheme && raw.startsWith(`${this.scheme} `) ? raw.slice(this.scheme.length + 1) : raw).trim();

    return token && token !== 'null' ? token : null; // 'Bearer null' = anonymous (xRocket)
  }

  currentCredential(): string | null {
    return this.token;
  }
}

/**
 * Cookie / BFF sessions: the browser sends the cookie, the server refreshes transparently, so there is no client
 * refresh and every 401 means the session is gone.
 */
export class CookieSessionAuth implements AuthAdapter {
  isInitialized = false;
  isAuthorized = false;

  constructor() {
    makeObservable(this, {
      isInitialized: observable,
      isAuthorized: observable,
      setAuthorized: action,
      clearSession: action,
    });
  }

  setAuthorized(value: boolean): void {
    this.isAuthorized = value;
    this.isInitialized = true;
  }

  applyAuth(): void {}

  credentialOf(): string | null {
    return null;
  }

  currentCredential(): string | null {
    return null;
  }

  async clearSession(): Promise<void> {
    this.isAuthorized = false;
  }
}

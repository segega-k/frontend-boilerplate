// Backend contract surface of the library.
//
// FIXED (not configurable, xRocket semantics, see errors/loadError.ts):
//   - error key = problem+json `type` (NestJS-style `name` as the xRocket fallback) → `METHOD_STATUS_type`;
//   - banned = HTTP 403 + `blocked`/`banned` in type|name|instance|kind;
//   - maintenance = HTTP 503 + `type: /api/problems/maintenance` (or the legacy `message: PLATFORM_MAINTENANCE`).
// ADAPTER: authentication and what a 401 means (below). No endpoint or payload shape is assumed beyond the above;
// the health probe for no-network recovery is configured by the app (state/networkRecovery.ts).

/**
 * How requests are authenticated and what a 401 means. The library never assumes a header format or a refresh flow.
 * `credential` identifies the session a request was sent with (token, session epoch…); it binds a ban or a 401 to that
 * session so a late answer to an old session never affects the new one.
 */
export interface AuthAdapter {
  /** Observable for the app shell: false until the stored session is restored. */
  readonly isInitialized: boolean;
  /** Observable: there is a session. */
  readonly isAuthorized: boolean;
  /** Adds credentials to an outgoing request (header, query…). Cookie sessions: no-op. */
  applyAuth(request: Request): void;
  /** Session this request was sent with; null = anonymous request. */
  credentialOf(request: Request): string | null;
  /** Current session; null = none known on the client (cookie/BFF). */
  currentCredential(): string | null;
  /** Optional. Present → 401 on the current session triggers ONE shared refresh and a single retry. */
  refresh?: () => Promise<boolean>;
  /** Drops the session (the app shell then shows sign-in). */
  clearSession(): Promise<void>;
}

/** Neutral default stub: anonymous API, nothing to refresh or clear. */
export const noAuth: AuthAdapter = {
  isInitialized: true,
  isAuthorized: false,
  applyAuth: () => undefined,
  credentialOf: () => null,
  currentCredential: () => null,
  clearSession: async () => undefined,
};

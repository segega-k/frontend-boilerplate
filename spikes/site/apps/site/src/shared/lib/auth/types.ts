import type { SessionData } from '../session/types';

export type SignInInput =
  | { kind: 'credentials'; fields: Record<string, string> }
  | { kind: 'redirect'; returnTo: string };

export type SignInResult =
  | { kind: 'session'; session: SessionData }
  | { kind: 'redirect'; url: string }
  | { kind: 'error'; code: string };

// Backends vary, so the template assumes no endpoint, payload or header format. Everything backend-specific
// lives behind this interface; the template only stores the returned SessionData in the __Host- cookie.
export interface AuthAdapter {
  readonly id: string;
  signIn(input: SignInInput): Promise<SignInResult>;
  // redirect flows (OIDC and similar) finish here from /api/auth/callback
  completeSignIn?(params: URLSearchParams): Promise<SignInResult>;
  // returns a renewed session, or null when the session can no longer be renewed
  refresh?(session: SessionData): Promise<SessionData | null>;
  signOut(session: SessionData): Promise<void>;
  // how upstream requests are authorized (header name and format belong to the adapter)
  authorize(session: SessionData, headers: Headers): void;
}

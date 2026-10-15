import 'server-only';
import type { AuthAdapter } from '../types';

export type OidcAdapterConfig = { issuer: string; clientId: string; redirectUri: string; scope?: string };

// Stub for the shape only. The real adapter uses openid-client: discovery, PKCE verifier and state in a
// short-lived cookie, code exchange in completeSignIn, refresh with single-flight, authorize() with the
// access token. Nothing here assumes a particular identity provider.
export function createOidcAdapter(config: OidcAdapterConfig): AuthAdapter {
  return {
    id: 'oidc',
    async signIn(input) {
      if (input.kind !== 'redirect') return { kind: 'error', code: 'unsupported' };
      const url = new URL(config.issuer);
      url.searchParams.set('client_id', config.clientId);
      url.searchParams.set('redirect_uri', config.redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', config.scope ?? 'openid');
      return { kind: 'redirect', url: url.toString() };
    },
    async completeSignIn() {
      return { kind: 'error', code: 'not_implemented_in_spike' };
    },
    async signOut() {},
    authorize() {},
  };
}

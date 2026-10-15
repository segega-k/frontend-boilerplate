import 'server-only';
import { credentialsExample } from '../examples/auth/credentials.example';
import { createCredentialsAdapter } from '@/shared/lib/auth/adapters/credentialsAdapter';
import { noneAdapter } from '@/shared/lib/auth/adapters/noneAdapter';
import { createOidcAdapter } from '@/shared/lib/auth/adapters/oidcAdapter';
import type { AuthAdapter } from '@/shared/lib/auth/types';
import { backendConfig } from '@/shared/config/backend.server';

// Project wiring point (init would generate this file from the chosen adapter).
// The spike wires the *example* credentials mapping from examples/; a real project replaces it.
function selectAdapter(): AuthAdapter {
  switch (process.env.AUTH_ADAPTER) {
    case 'api-login':
      return backendConfig.apiUrl ? createCredentialsAdapter(credentialsExample(backendConfig.apiUrl)) : noneAdapter;
    case 'oidc':
      return createOidcAdapter({
        issuer: process.env.OIDC_AUTHORIZE_URL ?? '',
        clientId: process.env.OIDC_CLIENT_ID ?? '',
        redirectUri: process.env.OIDC_REDIRECT_URI ?? '',
      });
    default:
      return noneAdapter;
  }
}

export const authAdapter = selectAdapter();

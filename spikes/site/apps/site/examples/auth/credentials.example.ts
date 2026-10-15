// EXAMPLE ONLY — not template code. Shows how a project maps its own login endpoint onto the generic
// credentials adapter. The path, payload, response fields and Authorization header format below are those of
// examples/mock-backend, not an expected backend contract.
import type { CredentialsAdapterConfig } from '../../src/shared/lib/auth/adapters/credentialsAdapter';

type ExampleLoginResponse = { userId: string; name: string; accessToken: string };

export function credentialsExample(apiUrl: string): CredentialsAdapterConfig {
  return {
    buildRequest: (fields) => ({
      url: `${apiUrl}/auth/login`,
      init: {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: fields.username, password: fields.password }),
      },
    }),
    async parseResponse(res) {
      if (res.status === 401) return { error: 'invalid_credentials' };
      if (!res.ok) return null;
      const body = (await res.json()) as ExampleLoginResponse;
      return { subject: body.userId, displayName: body.name, credentials: { accessToken: body.accessToken } };
    },
    authorize(session, headers) {
      if (session.credentials.accessToken) headers.set('authorization', `Bearer ${session.credentials.accessToken}`);
    },
  };
}

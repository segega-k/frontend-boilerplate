import 'server-only';
import type { SessionData } from '../../session/types';
import type { AuthAdapter } from '../types';

// Generic "own login endpoint" adapter (`api-login`). The template fixes no URL, payload or response shape:
// the project supplies them as configuration (see examples/auth/credentials.example.ts).
export type CredentialsAdapterConfig = {
  buildRequest(fields: Record<string, string>): { url: string; init: RequestInit };
  // maps the backend response to a session, or to an error code (null = unexpected response)
  parseResponse(response: Response): Promise<SessionData | { error: string } | null>;
  authorize(session: SessionData, headers: Headers): void;
  buildLogoutRequest?(session: SessionData): { url: string; init: RequestInit } | null;
};

export function createCredentialsAdapter(config: CredentialsAdapterConfig): AuthAdapter {
  return {
    id: 'api-login',
    async signIn(input) {
      if (input.kind !== 'credentials') return { kind: 'error', code: 'unsupported' };
      const { url, init } = config.buildRequest(input.fields);
      const result = await config.parseResponse(await fetch(url, { ...init, cache: 'no-store' }));
      if (!result) return { kind: 'error', code: 'unexpected_response' };
      if ('error' in result) return { kind: 'error', code: result.error };
      return { kind: 'session', session: result };
    },
    async signOut(session) {
      const req = config.buildLogoutRequest?.(session);
      if (req) await fetch(req.url, { ...req.init, cache: 'no-store' }).catch(() => undefined);
    },
    authorize: config.authorize,
  };
}

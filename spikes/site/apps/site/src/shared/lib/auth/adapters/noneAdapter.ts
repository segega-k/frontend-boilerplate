import 'server-only';
import type { AuthAdapter } from '../types';

// Neutral default when no adapter is configured: sign-in is unavailable, upstream calls go unauthenticated.
export const noneAdapter: AuthAdapter = {
  id: 'none',
  async signIn() {
    return { kind: 'error', code: 'auth_not_configured' };
  },
  async signOut() {},
  authorize() {},
};

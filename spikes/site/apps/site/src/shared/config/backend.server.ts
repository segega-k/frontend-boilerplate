import 'server-only';

// All backend coordinates are configuration. Nothing in the template hard-codes a URL or a path.
export const backendConfig = {
  // upstream base URL for server fetches and the BFF proxy; unset = no backend
  apiUrl: process.env.API_URL?.replace(/\/$/, '') || null,
  // BFF allowlist "METHOD:/path" entries, `*` matches one segment, e.g. "GET:/items,GET:/items/*"
  bffAllow: (process.env.BFF_ALLOW ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};

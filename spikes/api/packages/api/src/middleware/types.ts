import type { Middleware } from 'openapi-fetch';

export type MiddlewareName =
  | 'appStatusGate'
  | 'auth'
  | 'maintenance'
  | 'responseResolution'
  | 'bannedGuard'
  | 'retry'
  | 'unauthorized';

export type NamedMiddleware = Middleware & { readonly name: MiddlewareName };

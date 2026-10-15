import { describe, expect, it } from 'vitest';
import '../src/mappings/index.generated.ts';
import { resolveApiResponse, resolveNetworkError } from '@repo/api';
import { classifyUnauthorized } from '../../../packages/api/src/middleware/guards.ts';
import { isBannedResponse, isMaintenanceResponse } from '../../../packages/api/src/errors/loadError.ts';

const T = '/api/v1/wallet/transfers';

describe('lookup order: exact → METHOD_2xx → METHOD_ERR → null', () => {
  it('exact METHOD_STATUS_type wins', () => {
    expect(resolveApiResponse('wallet', T, 'post', 400, '/api/problems/insufficient_balance')).toEqual({
      type: 'toast',
      severity: 'error',
      translationKey: 'notEnoughFundsOnTheBalance',
    });
  });

  it('2xx: exact status, then any 2xx of the method (spec 200, backend 201)', () => {
    expect(resolveApiResponse('wallet', T, 'POST', 200, '')?.translationKey).toBe('transferSent');
    expect(resolveApiResponse('wallet', T, 'POST', 201, '')?.translationKey).toBe('transferSent');
  });

  it('unknown error type → METHOD_ERR with isErrorFallback', () => {
    expect(resolveApiResponse('wallet', T, 'POST', 422, '/api/problems/whatever')).toMatchObject({
      type: 'toast',
      support: true,
      isErrorFallback: true,
    });
  });

  it('no endpoint / other service / 3xx → null', () => {
    expect(resolveApiResponse('wallet', '/nope', 'GET', 500, '')).toBeNull();
    expect(resolveApiResponse('auth', T, 'POST', 400, '/api/problems/insufficient_balance')).toBeNull();
    expect(resolveApiResponse('wallet', T, 'POST', 302, '')).toBeNull();
  });

  it('NET → METHOD_NET', () => {
    expect(resolveNetworkError('wallet', T, 'post')?.translationKey).toBe('noInternetConnection');
    expect(resolveNetworkError('wallet', '/api/v1/wallet/balances', 'get')?.type).toBe('modal');
  });
});

describe('markers and 401 classification (1:1 xRocket)', () => {
  it('banned: 403 + blocked/banned in type|name|instance|kind', () => {
    expect(isBannedResponse(403, { type: '/api/problems/user_blocked' })).toBe(true);
    expect(isBannedResponse(403, { name: 'UserBlockedException' })).toBe(true);
    expect(isBannedResponse(403, { type: '/api/problems/forbidden' })).toBe(false);
    expect(isBannedResponse(400, { type: '/api/problems/user_blocked' })).toBe(false);
  });

  it('maintenance: 503 + problem type, or the legacy message', () => {
    expect(isMaintenanceResponse(503, { type: '/api/problems/maintenance' })).toBe(true);
    expect(isMaintenanceResponse(500, { type: '/api/problems/maintenance' })).toBe(false);
    expect(isMaintenanceResponse(503, { message: 'PLATFORM_MAINTENANCE' })).toBe(true);
    expect(isMaintenanceResponse(503, { type: '/api/problems/internal_error' })).toBe(false);
  });

  it('classifyUnauthorized', () => {
    expect(classifyUnauthorized('a', 'a')).toBe('current-session');
    expect(classifyUnauthorized('old', 'new')).toBe('superseded-token');
    expect(classifyUnauthorized(null, 'new')).toBe('anonymous-request');
    expect(classifyUnauthorized('x', null)).toBe('current-session');
  });
});

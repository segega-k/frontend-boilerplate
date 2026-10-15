// Type-level contract, checked by `pnpm typecheck` (tsc fails on an unused @ts-expect-error).
import type { paths } from '../src/generated/wallet.ts';
import type { EndpointResponseMapping, VariantsOf } from '@repo/api';

type Transfers = VariantsOf<paths, '/api/v1/wallet/transfers'>;

export const ok: Transfers[] = [
  'POST_200',
  'POST_400_/api/problems/insufficient_balance',
  'POST_400_/api/problems/amount_too_small',
  'POST_409_/api/problems/duplicate_transfer',
  'POST_ERR',
  'POST_NET',
];

// @ts-expect-error a problem type that the spec does not declare
export const unknownType: Transfers = 'POST_400_/api/problems/removed_from_backend';
// @ts-expect-error wrong method for this path
export const wrongMethod: Transfers = 'GET_ERR';
// @ts-expect-error status not in the spec
export const wrongStatus: Transfers = 'POST_201';

export const mapping = {
  responses: [
    // @ts-expect-error the generated file uses `satisfies`, so a variant removed from the spec breaks typecheck
    { variants: ['POST_400_/api/problems/gone'], type: 'toast', severity: 'error' },
  ],
} satisfies EndpointResponseMapping<Transfers>;

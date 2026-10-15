import type { QueryClient } from '@tanstack/query-core';
import { MobxMutation, MobxQuery, type MutationOptionsLike } from './MobxQuery.ts';

type SuccessKey = 200 | 201 | 202 | 204;

/** Success body of an openapi-typescript operation (any JSON-ish media type). */
export type SuccessData<Op> = Op extends { responses: infer R }
  ? R[SuccessKey & keyof R] extends infer S
    ? S extends { content: infer C }
      ? C[keyof C]
      : undefined
    : never
  : never;

type LooseClient = Record<string, (path: string, init?: Record<string, unknown>) => Promise<{
  data?: unknown;
  error?: unknown;
  response: Response;
}>>;

/** Shared body of every generated queryFn/mutationFn: throw the (already `_resolution`-stamped) error body. */
export async function callApi<TData>(
  client: unknown,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  init: unknown,
  signal?: AbortSignal,
): Promise<TData> {
  const call = (client as LooseClient)[method];

  if (!call) {
    throw new Error(`Unknown method ${method}`);
  }

  const { data, error, response } = await call(path, { ...(init as object | undefined), ...(signal && { signal }) });

  if (error !== undefined || !response.ok) {
    throw error ?? { _httpStatus: response.status };
  }

  return data as TData;
}

export interface QueryOptionsLike<TData> {
  queryKey: readonly unknown[];
  meta: Record<string, unknown>;
  queryFn: (ctx: { signal: AbortSignal }) => Promise<TData>;
}

export function createQuery<TData>(queryClient: QueryClient, getOptions: () => QueryOptionsLike<TData>): MobxQuery<TData> {
  return new MobxQuery<TData>(queryClient, getOptions as never);
}

export function createMutation<TData, TVariables>(
  queryClient: QueryClient,
  options: MutationOptionsLike<TData, TVariables>,
): MobxMutation<TData, TVariables> {
  return new MobxMutation<TData, TVariables>(queryClient, options);
}

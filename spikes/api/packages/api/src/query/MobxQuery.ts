import { createAtom, reaction, type IAtom } from 'mobx';
import {
  MutationObserver,
  QueryObserver,
  type MutationObserverResult,
  type QueryClient,
  type QueryObserverOptions,
  type QueryObserverResult,
} from '@tanstack/query-core';
import { resolveNetworkError } from '../errors/resolve.ts';
import { getRawResolution, translateResolution } from '../errors/translate.ts';
import type { RawResolution, ResolvedResponse } from '../errors/types.ts';
import type { Translate } from '../runtime.ts';

export type LoadingStatus = 'initial' | 'loading' | 'refreshing' | 'succeeded' | 'failed';

/** Set by the generated factories: lets NET lookup work without parsing the queryKey. */
export interface ApiMeta {
  service: string;
  method: string;
  path: string;
}

export type ErrorKind = 'network' | 'server' | null;

export interface QueryResult<TData> {
  data: TData | undefined;
  status: LoadingStatus;
  error: unknown;
  errorKind: ErrorKind;
  resolution: ResolvedResponse | null;
}

function apiMeta(meta: unknown): ApiMeta | null {
  const m = meta as Partial<ApiMeta> | undefined;

  return m && m.service && m.method && m.path ? (m as ApiMeta) : null;
}

/**
 * MobxQuery v2, minimal: one QueryObserver → one MobX atom. Subscribes on `onBecomeObserved`, unsubscribes on
 * `onBecomeUnobserved`; every getter reads from the current observer result, so `status` always mirrors the query.
 * Not covered by the spike: detached option sync for SSR and the hydration races xRocket solved (512 lines).
 */
export class MobxQuery<TData = unknown> {
  private readonly observer: QueryObserver<TData, unknown, TData, TData, readonly unknown[]>;
  private readonly atom: IAtom;
  private result: QueryObserverResult<TData, unknown>;
  private unsubscribe: (() => void) | undefined;
  private disposeReaction: (() => void) | undefined;
  private readonly getOptions: () => QueryObserverOptions<TData, unknown, TData, TData, readonly unknown[]>;

  constructor(
    queryClient: QueryClient,
    getOptions: () => QueryObserverOptions<TData, unknown, TData, TData, readonly unknown[]>,
  ) {
    this.getOptions = getOptions;
    this.observer = new QueryObserver(queryClient, getOptions());
    this.result = this.observer.getCurrentResult();
    this.atom = createAtom(
      'MobxQuery',
      () => {
        this.unsubscribe = this.observer.subscribe((result) => {
          this.result = result;
          this.atom.reportChanged();
        });
        this.disposeReaction = reaction(
          () => this.getOptions(),
          (options) => this.observer.setOptions(options),
        );
      },
      () => {
        this.disposeReaction?.();
        this.unsubscribe?.();
        this.disposeReaction = undefined;
        this.unsubscribe = undefined;
      },
    );
  }

  private read(): QueryObserverResult<TData, unknown> {
    this.atom.reportObserved();

    return this.result;
  }

  get data(): TData | undefined {
    return this.read().data;
  }

  get error(): unknown {
    return this.read().error ?? undefined;
  }

  get status(): LoadingStatus {
    const r = this.read();

    if (r.isLoading) return 'loading';
    if (r.isRefetching) return 'refreshing';
    if (r.isSuccess) return 'succeeded';
    if (r.isError) return 'failed';

    return 'initial';
  }

  get errorKind(): ErrorKind {
    const r = this.read();

    if (r.isPaused) return 'network';
    if (!r.isError) return null;

    return r.error instanceof TypeError ? 'network' : 'server';
  }

  get rawResolution(): RawResolution | null {
    const r = this.read();

    if (r.error instanceof TypeError || r.isPaused) {
      const meta = apiMeta(this.getOptions().meta);
      const net = meta ? resolveNetworkError(meta.service, meta.path, meta.method) : null;

      if (net) return net;
    }

    return getRawResolution(r.error ?? r.data);
  }

  toResult(t: Translate, params?: Record<string, string>): QueryResult<TData> {
    const raw = this.rawResolution;

    return {
      data: this.data,
      status: this.status,
      error: this.error,
      errorKind: this.errorKind,
      resolution: raw ? translateResolution(raw, t, params) : null,
    };
  }

  async refetch(): Promise<void> {
    const result = await this.observer.refetch();

    if (!this.unsubscribe) {
      this.result = result;
      this.atom.reportChanged();
    }
  }

  destroy(): void {
    this.disposeReaction?.();
    this.unsubscribe?.();
    this.observer.destroy();
  }
}

export interface MutationOptionsLike<TData, TVariables> {
  mutationKey: readonly unknown[];
  meta?: Record<string, unknown>;
  mutationFn: (variables: TVariables) => Promise<TData>;
}

/** Minimal MobxMutation: rawResolution from `_resolution`, NET lookup through `meta` (xRocket: mutationKey). */
export class MobxMutation<TData = unknown, TVariables = void> {
  private readonly observer: MutationObserver<TData, unknown, TVariables>;
  private readonly atom: IAtom;
  private result: MutationObserverResult<TData, unknown, TVariables>;
  private readonly meta: ApiMeta | null;

  constructor(queryClient: QueryClient, options: MutationOptionsLike<TData, TVariables>) {
    this.meta = apiMeta(options.meta);
    this.observer = new MutationObserver(queryClient, options);
    this.result = this.observer.getCurrentResult();
    this.atom = createAtom('MobxMutation');
    this.observer.subscribe((result) => {
      this.result = result;
      this.atom.reportChanged();
    });
  }

  private read(): MutationObserverResult<TData, unknown, TVariables> {
    this.atom.reportObserved();

    return this.result;
  }

  get status(): LoadingStatus {
    const r = this.read();

    if (r.isPending) return 'loading';
    if (r.isSuccess) return 'succeeded';
    if (r.isError) return 'failed';

    return 'initial';
  }

  get errorKind(): ErrorKind {
    const r = this.read();

    if (!r.isError) return null;

    return r.error instanceof TypeError ? 'network' : 'server';
  }

  get rawResolution(): RawResolution | null {
    const r = this.read();
    const raw = getRawResolution(r.error ?? r.data);

    if (raw) return raw;
    if (r.error instanceof TypeError && this.meta) {
      return resolveNetworkError(this.meta.service, this.meta.path, this.meta.method);
    }

    return null;
  }

  toResult(t: Translate, params?: Record<string, string>): QueryResult<TData> {
    const r = this.read();
    const raw = this.rawResolution;

    return {
      data: r.data,
      status: this.status,
      error: r.error ?? undefined,
      errorKind: this.errorKind,
      resolution: raw ? translateResolution(raw, t, params) : null,
    };
  }

  mutate(variables: TVariables): Promise<TData> {
    return this.observer.mutate(variables);
  }
}

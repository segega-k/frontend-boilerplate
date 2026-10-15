import {
  QueryObserver,
  type QueryClient,
  type QueryKey,
  type QueryObserverOptions,
  type QueryObserverResult,
} from '@tanstack/react-query';
import { makeObservable, observableRef, runInAction } from 'mobx';

// Minimal MobxQuery sketch: a QueryObserver mirrored into a MobX observable.
// The initial result comes from the (hydrated) cache synchronously; subscribe() only in an effect.
export class MobxQuery<TData, TKey extends QueryKey = QueryKey> {
  result: QueryObserverResult<TData, Error>;
  private readonly observer: QueryObserver<TData, Error, TData, TData, TKey>;

  constructor(client: QueryClient, options: QueryObserverOptions<TData, Error, TData, TData, TKey>) {
    this.observer = new QueryObserver(client, options);
    this.result = this.observer.getOptimisticResult(client.defaultQueryOptions(options));
    // MobX 7: `observable.ref` is gone, the annotation is the named export `observableRef`.
    makeObservable<MobxQuery<TData, TKey>, never>(this, { result: observableRef });
  }

  subscribe(): () => void {
    return this.observer.subscribe((next) => {
      runInAction(() => {
        this.result = next;
      });
    });
  }
}

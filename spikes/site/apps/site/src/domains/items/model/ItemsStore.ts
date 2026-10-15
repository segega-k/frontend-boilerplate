import type { QueryClient } from '@tanstack/react-query';
import { computed, makeObservable } from 'mobx';
import { MobxQuery } from '@/shared/lib/query/MobxQuery';
import { itemsQuery } from '../queries';
import type { Item } from '../types';

export class ItemsStore {
  readonly query: MobxQuery<Item[], readonly ['items']>;

  constructor(client: QueryClient) {
    this.query = new MobxQuery(client, itemsQuery);
    makeObservable(this, { names: computed });
  }

  get names(): string[] {
    return (this.query.result.data ?? []).map((item) => item.name);
  }
}

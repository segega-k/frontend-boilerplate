'use client';

import { Button } from '@spike/ui';
import { useQueryClient } from '@tanstack/react-query';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { ItemsStore } from '../model/ItemsStore';

export const ItemsPanel = observer(function ItemsPanel() {
  const client = useQueryClient();
  const [store] = useState(() => new ItemsStore(client));
  const [subscribed, setSubscribed] = useState(false);
  useEffect(() => {
    const unsubscribe = store.query.subscribe();
    setSubscribed(true);
    return unsubscribe;
  }, [store]);
  const { result } = store.query;
  return (
    <div
      data-testid="items"
      data-status={result.status}
      data-fetching={String(result.isFetching)}
      data-subscribed={String(subscribed)}
    >
      <ul>
        {store.names.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
      <p data-testid="items-rendered-at">{result.data?.[0]?.renderedAt}</p>
      <Button tone="ghost" size="sm" testId="items-refetch" onClick={() => void result.refetch()}>
        refetch
      </Button>
    </div>
  );
});

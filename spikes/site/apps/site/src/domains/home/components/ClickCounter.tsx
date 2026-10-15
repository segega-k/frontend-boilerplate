'use client';

import { Button } from '@spike/ui';
import { observer } from 'mobx-react-lite';
import { useT } from 'next-i18next/client';
import { useEffect, useState } from 'react';
import { CounterStore } from '../model/CounterStore';

export const ClickCounter = observer(function ClickCounter() {
  // Store per component instance (per request on the server), never a module-level singleton.
  const [store] = useState(() => new CounterStore());
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const { t } = useT();
  return (
    <span data-testid="counter-root" data-hydrated={String(hydrated)}>
      <Button testId="counter" onClick={() => store.increment()}>
        {t('increment', { count: store.count })}
      </Button>
    </span>
  );
});

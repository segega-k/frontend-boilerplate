'use client';

import { startTransition, useState, ViewTransition } from 'react';

// Isolates React from the Next router: a plain startTransition update inside <ViewTransition>.
export function VtLab() {
  const [on, setOn] = useState(false);
  return (
    <div>
      <button data-testid="vt-toggle" onClick={() => startTransition(() => setOn((v) => !v))}>
        toggle
      </button>
      <ViewTransition>
        <p data-testid="vt-content">{on ? 'ON' : 'OFF'}</p>
      </ViewTransition>
      <p data-testid="vt-has-component">{String(typeof ViewTransition)}</p>
    </div>
  );
}

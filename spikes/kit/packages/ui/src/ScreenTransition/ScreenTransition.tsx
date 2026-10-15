import type { ReactElement } from 'react';
import { screenTransition } from './ScreenTransition.styled';
import type { ScreenTransitionProps } from './types';

export function ScreenTransition({ transitionKey, layout, children }: ScreenTransitionProps): ReactElement {
  return (
    <div key={transitionKey} className={screenTransition({ layout })}>
      {children}
    </div>
  );
}

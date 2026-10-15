import type { ReactNode } from 'react';
import type { ScreenTransitionVariants } from './ScreenTransition.styled';

export type ScreenTransitionProps = ScreenTransitionVariants & {
  transitionKey: string;
  children: ReactNode;
};

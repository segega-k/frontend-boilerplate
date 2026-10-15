import type { ReactNode } from 'react';
import type { VariantProps } from 'tailwind-variants';
import type { button } from './Button.styled';

export type ButtonProps = VariantProps<typeof button> & {
  children: ReactNode;
  type?: 'button' | 'submit';
  disabled?: boolean;
  onClick?: () => void;
  testId?: string;
};

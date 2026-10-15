'use client';

import { button } from './Button.styled';
import type { ButtonProps } from './types';

export function Button({ tone, size, children, type = 'button', disabled, onClick, testId }: ButtonProps) {
  return (
    <button type={type} disabled={disabled} onClick={onClick} data-testid={testId} className={button({ tone, size })}>
      {children}
    </button>
  );
}

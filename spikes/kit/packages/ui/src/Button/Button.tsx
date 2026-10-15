import { Button as BaseButton } from '@base-ui/react/button';
import type { ReactElement } from 'react';
import { button } from './Button.styled';
import type { ButtonProps } from './types';

export function Button({ tone, size, fullWidth, loading, disabled, children, ...props }: ButtonProps): ReactElement {
  const styles = button({ tone, size, fullWidth, loading });

  return (
    <BaseButton
      {...props}
      className={styles.root()}
      disabled={disabled === true || loading === true}
      focusableWhenDisabled={loading === true}
      aria-busy={loading === true ? true : undefined}
    >
      {loading === true ? <span className={styles.spinner()} aria-hidden /> : null}
      <span className={styles.label()}>{children}</span>
    </BaseButton>
  );
}

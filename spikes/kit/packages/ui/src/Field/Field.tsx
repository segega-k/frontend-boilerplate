import { Field as BaseField } from '@base-ui/react/field';
import type { ReactElement } from 'react';
import { field } from './Field.styled';
import type { FieldProps } from './types';

export function Field({ label, description, errorMessage, invalid, size, disabled, ...props }: FieldProps): ReactElement {
  const styles = field({ size });

  return (
    <BaseField.Root className={styles.root()} invalid={invalid} disabled={disabled}>
      <BaseField.Label className={styles.label()}>{label}</BaseField.Label>
      <BaseField.Control {...props} className={styles.control()} />
      {description === undefined ? null : (
        <BaseField.Description className={styles.description()}>{description}</BaseField.Description>
      )}
      {errorMessage === undefined ? null : (
        <BaseField.Error className={styles.error()} match={invalid === true}>
          {errorMessage}
        </BaseField.Error>
      )}
    </BaseField.Root>
  );
}

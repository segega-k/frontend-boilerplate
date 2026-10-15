import type { Field as BaseField } from '@base-ui/react/field';
import type { FieldVariants } from './Field.styled';

export type FieldProps = Omit<BaseField.Control.Props, 'className' | 'style' | 'size'> &
  FieldVariants & {
    label: string;
    description?: string;
    errorMessage?: string;
    invalid?: boolean;
  };

import type { Button as BaseButton } from '@base-ui/react/button';
import type { ButtonVariants } from './Button.styled';

export type ButtonProps = Omit<BaseButton.Props, 'className' | 'style'> & ButtonVariants;

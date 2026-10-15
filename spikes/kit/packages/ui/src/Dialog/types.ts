import type { Dialog as BaseDialog } from '@base-ui/react/dialog';
import type { ReactElement, ReactNode } from 'react';
import type { DialogVariants } from './Dialog.styled';

export type DialogProps = Pick<BaseDialog.Root.Props, 'open' | 'defaultOpen' | 'onOpenChange' | 'onOpenChangeComplete'> &
  DialogVariants & {
    trigger: ReactElement;
    title: string;
    description?: string;
    closeLabel: string;
    children?: ReactNode;
    actions?: ReactNode;
  };

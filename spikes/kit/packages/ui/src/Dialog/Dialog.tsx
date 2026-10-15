import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import type { ReactElement } from 'react';
import { Button } from '../Button';
import { dialog } from './Dialog.styled';
import type { DialogProps } from './types';

export function Dialog({
  trigger,
  title,
  description,
  closeLabel,
  children,
  actions,
  size,
  ...rootProps
}: DialogProps): ReactElement {
  const styles = dialog({ size });

  return (
    <BaseDialog.Root {...rootProps}>
      <BaseDialog.Trigger render={trigger} />
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className={styles.backdrop()} />
        <BaseDialog.Viewport className={styles.viewport()}>
          <BaseDialog.Popup className={styles.popup()}>
            <div className={styles.header()}>
              <BaseDialog.Title className={styles.title()}>{title}</BaseDialog.Title>
              {description === undefined ? null : (
                <BaseDialog.Description className={styles.description()}>{description}</BaseDialog.Description>
              )}
            </div>
            {children === undefined ? null : <div className={styles.body()}>{children}</div>}
            <div className={styles.footer()}>
              <BaseDialog.Close render={<Button tone="neutral" />}>{closeLabel}</BaseDialog.Close>
              {actions}
            </div>
          </BaseDialog.Popup>
        </BaseDialog.Viewport>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

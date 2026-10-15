import { Button } from '@kit/ui/Button';
import { Dialog } from '@kit/ui/Dialog';
import type { ReactElement } from 'react';

export default function CancelDialog(): ReactElement {
  return (
    <Dialog
      trigger={<Button tone="ghost">Cancel order</Button>}
      title="Cancel this order?"
      description="Items stay in your cart."
      closeLabel="Keep order"
      actions={<Button tone="danger">Cancel order</Button>}
    />
  );
}

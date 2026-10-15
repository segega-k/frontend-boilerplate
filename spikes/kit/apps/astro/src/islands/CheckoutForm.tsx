import { Button } from '@kit/ui/Button';
import { Field } from '@kit/ui/Field';
import type { ReactElement } from 'react';

export default function CheckoutForm(): ReactElement {
  return (
    <>
      <Field label="Email" placeholder="name@example.com" description="We send the receipt here" />
      <Field label="Promo code" invalid errorMessage="This code has expired" defaultValue="AUTUMN" />
      <Button loading>Pay 42.00</Button>
    </>
  );
}

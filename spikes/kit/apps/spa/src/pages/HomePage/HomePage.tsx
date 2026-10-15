import { Button } from '@kit/ui/Button';
import { Dialog } from '@kit/ui/Dialog';
import { Field } from '@kit/ui/Field';
import type { ReactElement } from 'react';
import { homePage } from './HomePage.styled';

const styles = homePage();

export function HomePage(): ReactElement {
  return (
    <section className={styles.root()}>
      <h1 className={styles.title()}>Checkout</h1>
      <p className={styles.lead()}>Kit consumed as source by a Vite SPA.</p>
      <div className={styles.form()}>
        <Field label="Email" placeholder="name@example.com" description="We send the receipt here" />
        <Field label="Promo code" invalid errorMessage="This code has expired" defaultValue="AUTUMN" />
        <div className={styles.actions()}>
          <Dialog
            trigger={<Button tone="ghost">Cancel order</Button>}
            title="Cancel this order?"
            description="Items stay in your cart."
            closeLabel="Keep order"
            actions={<Button tone="danger">Cancel order</Button>}
          />
          <Button loading>Pay 42.00</Button>
        </div>
      </div>
    </section>
  );
}

import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button';
import { Dialog } from '../Dialog';
import { Field } from '../Field';
import { overview } from './Overview.styled';

const meta = {
  title: 'Overview/Showcase',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const styles = overview();

export const Showcase: Story = {
  render: () => (
    <main className={styles.page()}>
      <header className={styles.header()}>
        <h1 className={styles.title()}>Checkout</h1>
        <p className={styles.lead()}>Kit primitives composed into one realistic screen.</p>
      </header>
      <form className={styles.card()}>
        <Field label="Full name" placeholder="Ada Lovelace" />
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
          <Button type="submit">Pay 42.00</Button>
        </div>
      </form>
    </main>
  ),
};

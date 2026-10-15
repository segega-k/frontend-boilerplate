import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';
import { Matrix } from '../storybook';
import { FIELD_SIZES } from './consts';
import { Field } from './Field';

const meta = {
  title: 'Kit/Field',
  component: Field,
  args: { label: 'Email', placeholder: 'name@example.com', description: 'We send the receipt here' },
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvas }) => {
    const input = canvas.getByLabelText('Email');
    await userEvent.type(input, 'a@b.c');
    await expect(input).toHaveValue('a@b.c');
  },
};

export const Invalid: Story = {
  args: { invalid: true, errorMessage: 'Enter a valid email' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Enter a valid email')).toBeVisible();
    await expect(canvas.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  },
};

const STATES = ['default', 'filled', 'invalid', 'disabled'] as const;

export const Matrix_: Story = {
  name: 'Matrix',
  render: () => (
    <Matrix
      title="Field: state × size"
      columns={FIELD_SIZES}
      rows={STATES.map((state) => ({
        caption: state,
        cells: FIELD_SIZES.map((size) => (
          <Field
            key={size}
            size={size}
            label={`Email ${size} ${state}`}
            placeholder="name@example.com"
            defaultValue={state === 'filled' ? 'name@example.com' : undefined}
            invalid={state === 'invalid'}
            errorMessage={state === 'invalid' ? 'Enter a valid email' : undefined}
            disabled={state === 'disabled'}
          />
        )),
      }))}
      rtlCaption="RTL specimen"
      rtlSpecimen={<Field label="البريد الإلكتروني" description="نرسل الإيصال هنا" />}
    />
  ),
};

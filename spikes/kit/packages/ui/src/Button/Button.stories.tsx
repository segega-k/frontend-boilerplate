import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';
import { Matrix } from '../storybook';
import { Button } from './Button';
import { BUTTON_SIZES, BUTTON_TONES } from './consts';

const meta = {
  title: 'Kit/Button',
  component: Button,
  args: { children: 'Continue', onClick: fn() },
  argTypes: {
    tone: { control: 'inline-radio', options: BUTTON_TONES },
    size: { control: 'inline-radio', options: BUTTON_SIZES },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Continue' }));
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};

export const LoadingIsNotClickable: Story = {
  args: { loading: true },
  play: async ({ args, canvas }) => {
    const button = canvas.getByRole('button', { name: 'Continue' });
    await expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};

const STATES = ['default', 'disabled', 'loading'] as const;

export const Matrix_: Story = {
  name: 'Matrix',
  render: () => (
    <Matrix
      title="Button: tone × state × size"
      columns={BUTTON_SIZES}
      rows={BUTTON_TONES.flatMap((tone) =>
        STATES.map((state) => ({
          caption: `${tone} · ${state}`,
          cells: BUTTON_SIZES.map((size) => (
            <Button key={size} tone={tone} size={size} disabled={state === 'disabled'} loading={state === 'loading'}>
              Continue
            </Button>
          )),
        })),
      )}
      rtlCaption="RTL specimen"
      rtlSpecimen={<Button fullWidth>متابعة</Button>}
    />
  ),
};

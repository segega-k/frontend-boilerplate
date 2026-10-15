import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, screen, userEvent, waitFor } from 'storybook/test';
import { Button } from '../Button';
import { Matrix } from '../storybook';
import { DIALOG_SIZES } from './consts';
import { Dialog } from './Dialog';

const meta = {
  title: 'Kit/Dialog',
  component: Dialog,
  args: {
    trigger: <Button>Open dialog</Button>,
    title: 'Delete project?',
    description: 'This removes all builds and cannot be undone.',
    closeLabel: 'Cancel',
    actions: <Button tone="danger">Delete</Button>,
  },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ExitAnimationAndFocusReturn: Story = {
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole('button', { name: 'Open dialog' });
    await userEvent.click(trigger);
    const popup = await screen.findByRole('dialog');
    await waitFor(() => expect(popup).not.toHaveAttribute('data-starting-style'));
    await waitFor(() => expect(popup).toBeVisible());
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(popup).toHaveAttribute('data-ending-style'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await expect(trigger).toHaveFocus();
  },
};

export const Matrix_: Story = {
  name: 'Matrix',
  render: (args) => (
    <Matrix
      title="Dialog: size (open each to inspect enter/exit)"
      columns={DIALOG_SIZES}
      rows={[
        {
          caption: 'with description + actions',
          cells: DIALOG_SIZES.map((size) => (
            <Dialog key={size} {...args} size={size} trigger={<Button tone="neutral">{`Open ${size}`}</Button>} />
          )),
        },
        {
          caption: 'title only',
          cells: DIALOG_SIZES.map((size) => (
            <Dialog
              key={size}
              size={size}
              title="Saved"
              closeLabel="Close"
              trigger={<Button tone="ghost">{`Open ${size} minimal`}</Button>}
            />
          )),
        },
      ]}
      rtlCaption="RTL specimen"
      rtlSpecimen={<Dialog title="حذف المشروع؟" closeLabel="إلغاء" trigger={<Button>فتح</Button>} />}
    />
  ),
};

import { tv, type VariantProps } from '../styles/tv';

export const dialog = tv({
  slots: {
    backdrop: [
      'fixed inset-0 bg-scrim',
      'transition-opacity duration-base ease-standard',
      'data-starting-style:opacity-0 data-ending-style:opacity-0',
      'motion-reduce:transition-none',
    ],
    viewport: 'fixed inset-0 flex items-center justify-center p-4',
    popup: [
      'flex w-full flex-col gap-4 rounded-surface bg-surface-1 p-6 text-fg shadow-overlay font-sans',
      'transition-presence',
      'data-starting-style:scale-95 data-starting-style:opacity-0',
      'data-ending-style:scale-95 data-ending-style:opacity-0 data-ending-style:ease-exit',
      'motion-reduce:transition-none',
      'focus-visible:outline-2 focus-visible:outline-focus',
    ],
    header: 'flex flex-col gap-1',
    title: 'text-title-md text-fg',
    description: 'text-body-md text-fg-muted',
    body: 'text-body-md',
    footer: 'flex justify-end gap-3',
  },
  variants: {
    size: {
      sm: { popup: 'max-w-dialog' },
      md: { popup: 'max-w-page' },
    },
  },
  defaultVariants: { size: 'sm' },
});

export type DialogVariants = VariantProps<typeof dialog>;

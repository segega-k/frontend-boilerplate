import { tv, type VariantProps } from '../styles/tv';

export const field = tv({
  slots: {
    root: 'flex flex-col gap-1.5 font-sans',
    label: 'text-label-sm text-fg data-disabled:opacity-disabled',
    control: [
      'w-full rounded-control border border-border bg-surface-1 px-3 text-fg',
      'transition-colors duration-fast ease-standard',
      'placeholder:text-fg-muted',
      'hover:not-data-disabled:border-border-strong',
      'focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus',
      'data-invalid:border-danger',
      'data-disabled:cursor-not-allowed data-disabled:opacity-disabled',
    ],
    description: 'text-label-sm text-fg-muted',
    error: 'text-label-sm text-danger',
  },
  variants: {
    size: {
      md: { control: 'h-control-md text-body-md' },
      lg: { control: 'h-control-lg text-body-md' },
    },
  },
  defaultVariants: { size: 'md' },
});

export type FieldVariants = VariantProps<typeof field>;

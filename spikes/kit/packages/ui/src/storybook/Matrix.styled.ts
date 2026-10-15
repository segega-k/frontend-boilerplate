import { tv, type VariantProps } from '../styles/tv';

export const matrix = tv({
  slots: {
    root: 'flex flex-col gap-6 font-sans text-fg',
    title: 'text-title-md',
    grid: 'grid items-center gap-x-6 gap-y-4',
    head: 'text-label-sm text-fg-muted',
    caption: 'text-label-sm text-fg-muted',
    cell: 'flex items-center',
    specimen: 'flex flex-col gap-2 rounded-surface border border-border p-4',
  },
  variants: {
    columns: {
      1: { grid: 'grid-cols-2' },
      2: { grid: 'grid-cols-3' },
      3: { grid: 'grid-cols-4' },
      4: { grid: 'grid-cols-5' },
    },
  },
  defaultVariants: { columns: 3 },
});

export type MatrixVariants = VariantProps<typeof matrix>;

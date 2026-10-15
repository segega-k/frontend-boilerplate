import { tv, type VariantProps } from '../styles/tv';

export const button = tv({
  slots: {
    root: [
      'relative inline-flex items-center justify-center gap-2 rounded-control font-sans whitespace-nowrap select-none',
      'transition-colors duration-fast ease-standard',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
      'data-disabled:cursor-not-allowed data-disabled:opacity-disabled',
    ],
    label: 'inline-flex items-center gap-2',
    spinner: 'absolute size-4 animate-spin rounded-pill border-2 border-current border-t-transparent motion-reduce:animate-none',
  },
  variants: {
    tone: {
      primary: { root: 'bg-accent text-on-accent hover:not-data-disabled:bg-accent-hover active:not-data-disabled:bg-accent-hover' },
      neutral: { root: 'bg-surface-2 text-fg hover:not-data-disabled:bg-surface-3 active:not-data-disabled:bg-surface-3' },
      ghost: { root: 'bg-bg text-fg hover:not-data-disabled:bg-surface-2 active:not-data-disabled:bg-surface-3' },
      danger: { root: 'bg-danger text-on-danger hover:not-data-disabled:bg-danger-hover active:not-data-disabled:bg-danger-hover' },
    },
    size: {
      sm: { root: 'h-control-sm px-3 text-label-sm' },
      md: { root: 'h-control-md px-4 text-label-md' },
      lg: { root: 'h-control-lg px-6 text-label-lg' },
    },
    fullWidth: {
      true: { root: 'w-full' },
    },
    loading: {
      true: { root: 'cursor-progress', label: 'opacity-0' },
    },
  },
  defaultVariants: { tone: 'primary', size: 'md', fullWidth: false, loading: false },
});

export type ButtonVariants = VariantProps<typeof button>;

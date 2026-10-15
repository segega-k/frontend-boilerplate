import { tv } from 'tailwind-variants';

export const button = tv({
  base: 'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50',
  variants: {
    tone: {
      primary: 'bg-brand text-white hover:bg-brand-strong',
      ghost: 'bg-transparent text-brand hover:bg-brand/10',
    },
    size: {
      sm: 'h-8 px-3 text-sm',
      md: 'h-10 px-4 text-base',
    },
  },
  defaultVariants: { tone: 'primary', size: 'md' },
});

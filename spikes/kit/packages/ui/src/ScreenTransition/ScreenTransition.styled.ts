import { tv, type VariantProps } from '../styles/tv';

export const screenTransition = tv({
  base: 'no-vt:animate-screen-in motion-reduce:animate-none',
  variants: {
    layout: {
      block: 'block',
      fill: 'flex min-h-dvh flex-col',
    },
  },
  defaultVariants: { layout: 'block' },
});

export type ScreenTransitionVariants = VariantProps<typeof screenTransition>;

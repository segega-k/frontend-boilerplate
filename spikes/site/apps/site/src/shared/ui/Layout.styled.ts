import { tv } from 'tailwind-variants';

// tv() is called from a Server Component (layout.tsx) without 'use client' — part of the smoke.
export const layout = tv({
  slots: {
    body: 'min-h-dvh bg-white text-neutral-900 antialiased',
    header: 'site-header flex items-center gap-4 border-b border-neutral-200 px-6 py-3',
    nav: 'flex gap-3 text-brand underline-offset-4',
    main: 'mx-auto max-w-3xl px-6 py-8',
  },
});

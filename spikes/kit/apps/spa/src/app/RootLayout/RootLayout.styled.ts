import { tv } from '@kit/ui/tv';

export const rootLayout = tv({
  slots: {
    shell: 'mx-auto flex min-h-dvh max-w-page flex-col gap-6 p-6 font-sans',
    header: 'flex items-center justify-between gap-4 border-b border-border pb-4',
    nav: 'flex gap-4',
    link: 'text-label-md text-fg-muted transition-colors hover:text-fg link-active:text-accent',
  },
});

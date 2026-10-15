import { tv } from '@kit/ui/tv';

export const page = tv({
  slots: {
    shell: 'mx-auto flex min-h-dvh max-w-page flex-col gap-6 p-6 font-sans',
    header: 'flex items-center justify-between gap-4 border-b border-border pb-4',
    nav: 'flex gap-4',
    link: 'text-label-md text-fg-muted transition-colors hover:text-fg',
    title: 'text-title-lg text-fg',
    lead: 'text-body-md text-fg-muted',
    card: 'flex flex-col gap-4 rounded-surface border border-border bg-surface-1 p-6',
    actions: 'flex flex-wrap justify-end gap-3',
  },
});

import { tv } from '../styles/tv';

export const overview = tv({
  slots: {
    page: 'mx-auto flex min-h-dvh max-w-page flex-col gap-8 bg-bg p-6 font-sans text-fg',
    header: 'flex flex-col gap-2',
    title: 'text-title-lg',
    lead: 'text-body-md text-fg-muted',
    card: 'flex flex-col gap-4 rounded-surface border border-border bg-surface-1 p-6',
    actions: 'flex justify-end gap-3',
  },
});

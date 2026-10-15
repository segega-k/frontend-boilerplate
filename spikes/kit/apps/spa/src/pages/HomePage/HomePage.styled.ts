import { tv } from '@kit/ui/tv';

export const homePage = tv({
  slots: {
    root: 'flex flex-col gap-6',
    title: 'text-title-lg text-fg',
    lead: 'text-body-md text-fg-muted',
    form: 'flex flex-col gap-4 rounded-surface border border-border bg-surface-1 p-6',
    actions: 'flex flex-wrap justify-end gap-3',
  },
});

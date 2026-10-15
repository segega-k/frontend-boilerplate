import { tv } from '../../packages/ui/src/styles/tv';

export const bad = tv({
  base: 'bg-indigo-500 text-white shadow-lg',
  variants: {
    tone: {
      arbitrary: 'bg-[#ff00aa] p-[13px] w-[calc(100%-2rem)]',
      motion: 'transition-all transition animate-bounce hover:scale-105',
      theme: 'dark:bg-surface-2 bg-linear-to-r from-accent',
      spacing: 'p-5 gap-7 mt-13 p-4 gap-6',
      conflict: 'text-fg text-fg-muted flex flex',
      raw: '#ffffff',
    },
  },
});

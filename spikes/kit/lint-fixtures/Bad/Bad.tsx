import type { ReactElement } from 'react';
import { tv } from 'tailwind-variants';
import { twMerge } from 'tailwind-merge';
import { bad } from './Bad.styled';

const highlight = tv({ base: 'text-accent' });

export function Bad({ active }: { active: boolean }): ReactElement {
  return (
    <div className="flex gap-4 p-4">
      <span className={`text-fg ${active ? 'bg-accent' : ''}`}>a</span>
      <span className={active ? 'text-fg' : 'text-fg-muted'}>b</span>
      <span className={twMerge('p-2', 'p-4')}>c</span>
      <span style={{ marginTop: 13 }}>d</span>
      <span style={{ '--progress': '40%' } as never}>ok: custom property</span>
      <span className={bad({ tone: 'raw' })}>ok: recipe call</span>
      <span className={highlight()}>e</span>
    </div>
  );
}

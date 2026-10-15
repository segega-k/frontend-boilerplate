import { createTV } from 'tailwind-variants';
import { describe, expect, it } from 'vitest';
import { button } from '../Button/Button.styled';
import { tv } from './tv';

const plainTv = createTV({});

describe('tailwind-merge with custom tokens', () => {
  it('default twMerge drops one of text-fg / text-label-md', () => {
    const recipe = plainTv({ base: 'text-fg text-label-md' });
    expect(recipe()).not.toBe('text-fg text-label-md');
  });

  it('kit tv with generated twMergeConfig keeps color and size', () => {
    const recipe = tv({ base: 'text-fg text-label-md' });
    expect(recipe()).toBe('text-fg text-label-md');
  });

  it('kit tv still resolves real conflicts', () => {
    const recipe = tv({ base: 'text-fg text-fg-muted text-label-sm text-label-md' });
    expect(recipe()).toBe('text-fg-muted text-label-md');
  });

  it('default twMerge misses radius token conflicts, kit tv resolves them', () => {
    expect(plainTv({ base: 'rounded-control rounded-pill' })()).toBe('rounded-control rounded-pill');
    expect(tv({ base: 'rounded-control rounded-pill' })()).toBe('rounded-pill');
  });

  it('button recipe keeps colour, size and radius classes', () => {
    const cls = button({ tone: 'neutral', size: 'md' }).root();
    expect(cls).toContain('text-fg');
    expect(cls).toContain('text-label-md');
    expect(cls).toContain('rounded-control');
    expect(cls).toContain('bg-surface-2');
  });
});

import { Button } from '@kit/ui/Button';
import { startScreenTransition } from '@kit/ui/ScreenTransition';
import type { ReactElement } from 'react';

const toggleTheme = (): void => {
  const root = document.documentElement;
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  startScreenTransition(() => {
    root.dataset.theme = next;
  });
  try {
    localStorage.setItem('theme', next);
  } catch {
    return;
  }
};

export default function ThemeToggle(): ReactElement {
  return (
    <Button tone="ghost" size="sm" onClick={toggleTheme}>
      Toggle theme
    </Button>
  );
}

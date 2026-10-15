import { ScreenTransition } from '@kit/ui/ScreenTransition';
import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import type { ReactElement } from 'react';
import { ThemeToggle } from '../ThemeToggle/ThemeToggle';
import { rootLayout } from './RootLayout.styled';

const styles = rootLayout();

export function RootLayout(): ReactElement {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <div className={styles.shell()}>
      <header className={styles.header()}>
        <nav className={styles.nav()}>
          <Link to="/" className={styles.link()}>
            Home
          </Link>
          <Link to="/about" className={styles.link()}>
            About
          </Link>
        </nav>
        <ThemeToggle />
      </header>
      <main>
        <ScreenTransition transitionKey={pathname}>
          <Outlet />
        </ScreenTransition>
      </main>
    </div>
  );
}

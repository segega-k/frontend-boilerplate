import { ViewTransition, type ReactNode } from 'react';

const DIRECTIONAL = { 'nav-forward': 'nav-forward', 'nav-back': 'nav-back', default: 'none' } as const;

// Wraps each page.tsx (not the layout: layouts do not remount, so enter/exit never fire there).
// Untyped transitions (browser back, refresh, Suspense reveals) animate nothing.
// The inner div remounts with the page, so the CSS fade (.page-fallback, only under
// `@supports not (view-transition-name: x)`) covers browsers without View Transitions.
// Do not use app/template.tsx for that fallback: with a template the <ViewTransition> never fired (wave 0).
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter={DIRECTIONAL} exit={DIRECTIONAL} default="none">
      <div className="page-fallback">{children}</div>
    </ViewTransition>
  );
}

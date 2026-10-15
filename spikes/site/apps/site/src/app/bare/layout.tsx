import type { ReactNode } from 'react';

// Measurement baseline only: a separate root layout without providers, kit, MobX, Query or i18n.
export default function BareLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

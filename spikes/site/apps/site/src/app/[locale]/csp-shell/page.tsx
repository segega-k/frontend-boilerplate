import { cookies } from 'next/headers';
import { Suspense } from 'react';
import { ClickCounter } from '@/domains/home/components/ClickCounter';

// Negative control: a PPR page (static shell + dynamic hole) served under the nonce profile.
// Expectation from the docs: the prerendered shell scripts carry no nonce, so CSP blocks them.
async function Hole() {
  const c = await cookies();
  return <p data-testid="hole">cookies: {c.size}</p>;
}

export default function CspShellPage() {
  return (
    <section data-testid="csp-shell">
      <Suspense fallback={<p>…</p>}>
        <Hole />
      </Suspense>
      <ClickCounter />
    </section>
  );
}

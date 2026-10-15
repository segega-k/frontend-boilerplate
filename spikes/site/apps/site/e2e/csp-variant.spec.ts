import { test } from '@playwright/test';

// Observation only (no asserts): run against builds with SPIKE_CSP_STRICT=1 and/or SPIKE_SRI=1.
test('static page under the current static CSP: violations + hydration', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __csp: string[] };
    w.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => w.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  const res = await page.goto('/en');
  await page.waitForTimeout(1500);
  const html = await res!.text();
  const report = {
    csp: res!.headers()['content-security-policy'],
    integrityAttrs: (html.match(/integrity="/g) ?? []).length,
    hydrated: await page.getByTestId('counter-root').getAttribute('data-hydrated'),
    violations: await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp),
  };
  console.log(JSON.stringify(report));
});

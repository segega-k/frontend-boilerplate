import { expect, test, type Page } from '@playwright/test';

// Collect CSP violations and record every document.startViewTransition call (with its types).
async function instrument(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __csp: string[]; __vt: unknown[] };
    w.__csp = [];
    w.__vt = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      w.__csp.push(`${e.violatedDirective} ${e.blockedURI}`);
    });
    const orig = document.startViewTransition?.bind(document);
    if (orig) {
      document.startViewTransition = ((arg: unknown) => {
        const types = arg && typeof arg === 'object' && 'types' in arg ? (arg as { types: string[] }).types : null;
        w.__vt.push(types);
        return orig(arg as never);
      }) as typeof document.startViewTransition;
    }
  });
}

const cspViolations = (page: Page) => page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);

test.beforeEach(async ({ page }) => instrument(page));

test('prerendered home: static CSP, hydration, kit + tv + MobX + i18n', async ({ page }) => {
  const res = await page.goto('/en');
  const csp = res!.headers()['content-security-policy'];
  expect(csp).toContain("script-src 'self' 'unsafe-inline'");
  expect(csp).not.toContain('nonce-');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Home');
  const counter = page.getByTestId('counter');
  await expect(counter).toHaveText('Clicks: 0');
  // tv() class from the kit source made it into the Tailwind output (bg-brand = #3346d3)
  await expect(counter).toHaveCSS('background-color', 'rgb(51, 70, 211)');
  await expect(page.getByTestId('counter-root')).toHaveAttribute('data-hydrated', 'true');
  await counter.click();
  await counter.click();
  await expect(counter).toHaveText('Clicks: 2');
  expect(await cspViolations(page)).toEqual([]);
});

test('locale routing: / redirects by Accept-Language, ru renders Russian', async ({ page, browser }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/en$/);
  const ru = await browser.newContext({ locale: 'ru-RU' });
  const ruPage = await ru.newPage();
  await ruPage.goto('/');
  await expect(ruPage).toHaveURL(/\/ru$/);
  await expect(ruPage.getByRole('heading', { level: 1 })).toHaveText('Главная');
  await expect(ruPage.getByTestId('counter')).toHaveText('Нажатий: 0');
  await expect(ruPage.locator('html')).toHaveAttribute('lang', 'ru');
  await ru.close();
});

const backendHits = async () =>
  (await (await fetch('http://127.0.0.1:4010/__hits')).json()) as { items: number; itemsAuthorized: number };

test('items: RSC prefetch + HydrationBoundary + MobxQuery, no client refetch, nonce CSP', async ({ page }) => {
  const apiCalls: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/bff/items')) apiCalls.push(r.url());
  });
  const before = await backendHits();
  const res = await page.goto('/en/items');
  const csp = res!.headers()['content-security-policy'];
  expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  const nonce = /'nonce-([^']+)'/.exec(csp)![1];
  const items = page.getByTestId('items');
  await expect(items).toHaveAttribute('data-status', 'success');
  await expect(items.locator('li')).toHaveCount(2);
  await page.waitForTimeout(1500);
  // one upstream call for the whole page (the RSC prefetch), zero client calls after hydration
  expect(apiCalls).toEqual([]);
  expect((await backendHits()).items - before.items).toBe(1);
  // every inline script and every script in the server HTML carries the request nonce
  // (chunks loaded later by the runtime need none: 'strict-dynamic' trusts them)
  const html = await (await page.request.get('/en/items')).text();
  const htmlScripts = [...html.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]);
  const htmlWithoutNonce = htmlScripts.filter((tag) => !/\snonce="/.test(tag));
  test.info().annotations.push({ type: 'scripts', description: JSON.stringify({ total: htmlScripts.length, htmlWithoutNonce }) });
  expect(htmlScripts.length).toBeGreaterThan(0);
  expect(htmlWithoutNonce).toEqual([]);
  expect(nonce.length).toBeGreaterThan(10);
  // client is hydrated and the bridge reacts: refetch goes through the BFF exactly once
  await expect(items).toHaveAttribute('data-subscribed', 'true');
  await page.getByTestId('items-refetch').click();
  await expect.poll(() => apiCalls.length).toBe(1);
  expect(await cspViolations(page)).toEqual([]);
});

test('BFF session: protected route redirects, login sets __Host- cookie, DAL reads it', async ({ page, context, playwright }) => {
  const anon = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  const raw = await anon.get('/en/account', { maxRedirects: 0 });
  test.info().annotations.push({
    type: 'unauthenticated-account-response',
    description: JSON.stringify({ status: raw.status(), location: raw.headers()['location'] ?? null, hasWelcome: (await raw.text()).includes('data-testid="welcome"') }),
  });
  await anon.dispose();
  await page.goto('/en/account');
  await expect(page).toHaveURL(/\/en\/login\?returnTo=/);
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/\/en\/account$/);
  await expect(page.getByTestId('welcome')).toHaveText('Welcome, alice');
  const cookie = (await context.cookies()).find((c) => c.name === '__Host-session');
  expect(cookie).toBeDefined();
  expect(cookie!.httpOnly).toBe(true);
  expect(cookie!.secure).toBe(true);
  expect(cookie!.path).toBe('/');
  expect(await page.evaluate(() => document.cookie)).not.toContain('__Host-session');
  // does the browser send the Secure cookie back over plain http://localhost?
  const html = await (await page.goto('/en/account'))!.text();
  const sentBack = html.includes('data-testid="welcome"');
  test.info().annotations.push({ type: 'secure-cookie-over-http-localhost', description: String(sentBack) });
  test.skip(!sentBack, 'this browser does not send Secure cookies over http://localhost (needs HTTPS)');
  // with a session, both the RSC prefetch and the BFF proxy authorize upstream calls via the adapter
  const before = await backendHits();
  await page.goto('/en/items');
  await expect(page.getByTestId('items')).toHaveAttribute('data-status', 'success');
  await expect(page.getByTestId('items')).toHaveAttribute('data-subscribed', 'true');
  await page.getByTestId('items-refetch').click();
  await expect.poll(async () => (await backendHits()).itemsAuthorized - before.itemsAuthorized).toBe(2);
  await page.goto('/en/account');
  await page.getByTestId('logout').click();
  await expect(page).toHaveURL(/\/en$/);
  await page.goto('/en/account');
  await expect(page).toHaveURL(/\/en\/login/);
  expect(await cspViolations(page)).toEqual([]);
});

test('view transitions: Link transitionTypes reach startViewTransition', async ({ page }) => {
  await page.goto('/en');
  await expect(page.getByTestId('counter-root')).toHaveAttribute('data-hydrated', 'true');
  const supported = await page.evaluate(() => typeof document.startViewTransition === 'function');
  await page.getByTestId('to-about').click();
  await expect(page.getByTestId('about')).toBeVisible();
  await page.getByTestId('to-home').click();
  await expect(page.getByTestId('home')).toBeVisible();
  const calls = await page.evaluate(() => (window as unknown as { __vt: unknown[] }).__vt);
  test.info().annotations.push({ type: 'vt', description: JSON.stringify({ supported, calls }) });
  if (supported) {
    expect(calls).toContainEqual(['nav-forward']);
    expect(calls).toContainEqual(['nav-back']);
  } else {
    // fallback: template.tsx root fades in via CSS
    const anim = await page.locator('.page-fallback').evaluate((el) => getComputedStyle(el).animationName);
    expect(anim).toBe('vt-fade');
  }
});

test('no View Transitions API: navigation still works (instant swap)', async ({ page }) => {
  await page.addInitScript(() => {
    // simulate an engine without the API (iOS < 18, old WebViews)
    delete (Document.prototype as { startViewTransition?: unknown }).startViewTransition;
  });
  await page.goto('/en');
  await expect(page.getByTestId('counter-root')).toHaveAttribute('data-hydrated', 'true');
  await page.getByTestId('to-about').click();
  await expect(page.getByTestId('about')).toBeVisible();
  await page.getByTestId('to-home').click();
  await expect(page.getByTestId('home')).toBeVisible();
});

test('use cache + cacheTag: revalidateTag refreshes the prerendered news', async ({ page, request }) => {
  await page.goto('/en');
  const before = await page.getByTestId('news-generated').textContent();
  await request.post('/api/revalidate?tag=news');
  await page.reload();
  await page.reload();
  const after = await page.getByTestId('news-generated').textContent();
  expect(after).not.toBe(before);
});

test('negative control: PPR page under the nonce profile', async ({ page }) => {
  await page.goto('/en/csp-shell');
  await page.waitForTimeout(1000);
  const violations = await cspViolations(page);
  const hydrated = await page.getByTestId('counter-root').getAttribute('data-hydrated');
  const hole = await page.getByTestId('hole').count();
  test.info().annotations.push({ type: 'csp-shell', description: JSON.stringify({ violations, hydrated, hole }) });
});

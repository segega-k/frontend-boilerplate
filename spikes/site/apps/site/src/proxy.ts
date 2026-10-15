import { NextRequest, NextResponse } from 'next/server';
import { createProxy } from 'next-i18next/proxy';
import { i18nConfig } from './i18n.config';

const i18nProxy = createProxy(i18nConfig);

const DYNAMIC_ZONE = /^\/(en|ru)\/(account|items|login|csp-shell)(\/|$)/;

function nonceCsp(nonce: string) {
  const dev = process.env.NODE_ENV === 'development';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' ${dev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export function proxy(request: NextRequest): NextResponse {
  const requestId = crypto.randomUUID();
  const headers = new Headers(request.headers);
  headers.set('x-request-id', requestId);

  // Optimistic redirect only (UX + a real 307): the DAL still checks the session next to the data.
  // Without it, redirect() from a streamed page answers 200 and redirects on the client.
  const protectedMatch = /^\/(en|ru)\/account(\/|$)/.exec(request.nextUrl.pathname);
  if (protectedMatch && !request.cookies.has('__Host-session')) {
    const url = request.nextUrl.clone();
    url.pathname = `/${protectedMatch[1]}/login`;
    url.search = `?returnTo=${encodeURIComponent(request.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }

  let csp: string | undefined;
  if (DYNAMIC_ZONE.test(request.nextUrl.pathname)) {
    const nonce = btoa(crypto.randomUUID());
    csp = nonceCsp(nonce);
    // Next reads the nonce from the request CSP header while rendering and stamps its own scripts with it.
    headers.set('content-security-policy', csp);
    headers.set('x-nonce', nonce);
  }

  const response = i18nProxy(new NextRequest(request, { headers }));
  if (csp) response.headers.set('Content-Security-Policy', csp);
  response.headers.set('x-request-id', requestId);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};

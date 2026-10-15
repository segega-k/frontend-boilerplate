import path from 'node:path';
import type { NextConfig } from 'next';

// Static CSP profile for prerendered/public pages. Next's inline RSC payload scripts (self.__next_f.push)
// carry no nonce on prerendered HTML, so script-src needs 'unsafe-inline' here (SPIKE_CSP_STRICT=1 drops it
// to prove the point). The dynamic zone gets a nonce profile from proxy.ts instead.
const strictStatic = process.env.SPIKE_CSP_STRICT === '1';
const staticCsp = [
  "default-src 'self'",
  `script-src 'self'${strictStatic ? '' : " 'unsafe-inline'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  deploymentId: process.env.DEPLOYMENT_ID || undefined,
  transpilePackages: ['@spike/ui'],
  experimental: process.env.SPIKE_SRI === '1' ? { sri: { algorithm: 'sha256' } } : {},
  async headers() {
    return [
      {
        // static profile: everything except the dynamic zone, where proxy.ts sets the nonce policy
        source: '/:locale(en|ru)/:path((?!account|items|login|csp-shell).*)?',
        headers: [{ key: 'Content-Security-Policy', value: staticCsp }],
      },
    ];
  },
};

export default nextConfig;

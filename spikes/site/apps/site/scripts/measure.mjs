// Measures first-load JS/CSS (gzip) per page and TTFB of prerendered vs dynamic pages against a running server.
// Usage: node scripts/measure.mjs [baseUrl]
import { request } from 'node:http';
import { brotliCompressSync, gzipSync } from 'node:zlib';

const base = process.argv[2] ?? 'http://localhost:3100';
const pages = ['/bare', '/en', '/en/about', '/en/items', '/en/login'];

const kb = (n) => Math.round((n / 1024) * 10) / 10;

async function firstLoad(path) {
  const html = await (await fetch(base + path)).text();
  // noModule polyfills are skipped: modern browsers never load them
  const srcs = [...html.matchAll(/<script(?![^>]*noModule)[^>]+src="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  const css = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('');
  let js = 0;
  let jsBr = 0;
  let jsRaw = 0;
  for (const src of new Set(srcs)) {
    const buf = Buffer.from(await (await fetch(new URL(src, base))).arrayBuffer());
    jsRaw += buf.length;
    js += gzipSync(buf).length;
    jsBr += brotliCompressSync(buf).length;
  }
  let cssGz = 0;
  for (const href of new Set(css)) cssGz += gzipSync(Buffer.from(await (await fetch(new URL(href, base))).arrayBuffer())).length;
  return {
    path,
    scripts: new Set(srcs).size,
    jsGzKB: kb(js),
    jsBrKB: kb(jsBr),
    jsRawKB: kb(jsRaw),
    inlineGzKB: kb(gzipSync(Buffer.from(inline)).length),
    cssGzKB: kb(cssGz),
    htmlGzKB: kb(gzipSync(Buffer.from(html)).length),
  };
}

function ttfbOnce(path) {
  return new Promise((resolve, reject) => {
    const start = process.hrtime.bigint();
    const req = request(base + path, { headers: { 'accept-encoding': 'gzip' } }, (res) => {
      const first = Number(process.hrtime.bigint() - start) / 1e6;
      res.resume();
      res.on('end', () => resolve({ first, total: Number(process.hrtime.bigint() - start) / 1e6, status: res.statusCode }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function ttfb(path, n = 50) {
  for (let i = 0; i < 5; i++) await ttfbOnce(path);
  const firsts = [];
  const totals = [];
  let status;
  for (let i = 0; i < n; i++) {
    const r = await ttfbOnce(path);
    firsts.push(r.first);
    totals.push(r.total);
    status = r.status;
  }
  const q = (arr, p) => [...arr].sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor(arr.length * p))].toFixed(1);
  return { path, status, ttfbP50ms: q(firsts, 0.5), ttfbP95ms: q(firsts, 0.95), fullP50ms: q(totals, 0.5) };
}

const results = { firstLoad: [], ttfb: [] };
for (const p of pages) results.firstLoad.push(await firstLoad(p));
for (const p of pages) results.ttfb.push(await ttfb(p));
console.table(results.firstLoad);
console.table(results.ttfb);
console.log(JSON.stringify(results));

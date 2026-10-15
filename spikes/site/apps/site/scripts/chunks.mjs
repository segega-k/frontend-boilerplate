// Per-chunk gzip breakdown of a page's first-load scripts with library fingerprints.
import { gzipSync } from 'node:zlib';

const base = process.argv[2] ?? 'http://localhost:3100';
const path = process.argv[3] ?? '/en';
const marks = {
  'react-dom': /react-dom|__reactContainer|ReactDOM/,
  next: /next-router-prefetch|__next_f|NEXT_REDIRECT/,
  mobx: /\[MobX\]|mobx-react-lite|makeAutoObservable|observableRef/,
  'tanstack-query': /QueryObserver|HydrationBoundary|queryHash/,
  i18next: /i18next|getFixedT|I18nProvider/,
  'tailwind-merge': /twMerge|tailwind-merge|createTailwindMerge/,
  'tailwind-variants': /tailwind-variants|compoundVariants/,
  'iron-session': /iron-session|sealData/,
};
const html = await (await fetch(base + path)).text();
const srcs = [...new Set([...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&')))];
const rows = [];
for (const src of srcs) {
  const text = await (await fetch(new URL(src, base))).text();
  rows.push({
    chunk: src.split('/').pop().split('?')[0],
    gzKB: Math.round(gzipSync(Buffer.from(text)).length / 102.4) / 10,
    libs: Object.entries(marks).filter(([, re]) => re.test(text)).map(([k]) => k).join(','),
  });
}
rows.sort((a, b) => b.gzKB - a.gzKB);
console.table(rows);

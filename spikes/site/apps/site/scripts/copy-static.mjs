// standalone output does not include .next/static and public/; the Dockerfile copies them the same way.
// Manual recursive copy: fs.cpSync over an existing target crashed Node 24.18 on Windows (0xC0000409)
// in this Cyrillic path, so it is not used here.
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

function copyDir(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const src = join(from, entry.name);
    const dst = join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst);
    else copyFileSync(src, dst);
  }
}

const target = '.next/standalone/apps/site';
rmSync(`${target}/.next/static`, { recursive: true, force: true });
copyDir('.next/static', `${target}/.next/static`);
if (existsSync('public')) copyDir('public', `${target}/public`);

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';

export function readJson<T = unknown>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

export function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/**
 * The only write path of CLI and utils: stays inside `root`, only allow-listed targets, atomic (tmp + rename) so a
 * crashed write never leaves half a JSON file for pre-commit to "sync".
 */
export function writeFileAtomic(root: string, file: string, content: string, allow: readonly RegExp[]): void {
  const abs = resolve(file);
  const rel = relative(resolve(root), abs).split(sep).join('/');

  if (rel.startsWith('..') || rel.includes('/../')) {
    throw new Error(`Refusing to write outside the project: ${abs}`);
  }
  if (!allow.some((re) => re.test(rel))) {
    throw new Error(`Path is not in the write allowlist: ${rel}`);
  }

  mkdirSync(dirname(abs), { recursive: true });

  const tmp = `${abs}.${process.pid}.tmp`;

  writeFileSync(tmp, content, 'utf8');
  renameSync(tmp, abs);
}

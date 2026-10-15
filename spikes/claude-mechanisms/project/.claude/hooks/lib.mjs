// Shared helpers for spike hooks: read stdin JSON, append a log line to .work/hooklog.jsonl.
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export async function readInput() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(raw);
  } catch {
    return { _raw: raw };
  }
}

export function projectDir(input) {
  return process.env.CLAUDE_PROJECT_DIR || input?.cwd || process.cwd();
}

export function log(input, extra) {
  const dir = join(projectDir(input), '.work');
  mkdirSync(dir, { recursive: true });
  const line = {
    t: new Date().toISOString(),
    event: input?.hook_event_name,
    tool: input?.tool_name,
    ...extra,
  };
  appendFileSync(join(dir, 'hooklog.jsonl'), JSON.stringify(line) + '\n');
}

// node --test .claude/hooks/guard.test.mjs — feeds hook JSON to guard.mjs and checks the exit code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const guard = join(dirname(fileURLToPath(import.meta.url)), 'guard.mjs');

function run(tool, tool_input, setup) {
  const dir = mkdtempSync(join(tmpdir(), 'guard-Тест '));
  mkdirSync(join(dir, '.work'));
  setup?.(dir);
  const input = { hook_event_name: 'PreToolUse', tool_name: tool, tool_input, cwd: dir };
  const r = spawnSync(process.execPath, [guard], {
    input: JSON.stringify(input),
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
    encoding: 'utf8',
  });
  return r.status;
}

const cases = [
  ['Bash', { command: 'git push' }, 2],
  ['PowerShell', { command: 'git push origin main' }, 2],
  ['Bash', { command: 'git -C . push' }, 2],
  ['Bash', { command: 'git push' }, 0, (d) => writeFileSync(join(d, '.work', 'push-ok'), 'x')],
  ['Bash', { command: 'git commit -m "Add thing"' }, 0],
  ['Bash', { command: 'git commit -am "Add thing"' }, 0],
  ['Bash', { command: 'git commit -am "first\nsecond"' }, 2],
  ['Bash', { command: 'git commit -m "a" -m "b"' }, 2],
  ['Bash', { command: 'git commit -m "a" -m "Co-Authored-By: x <y@z>"' }, 2],
  ['Bash', { command: 'git commit -F msg.txt' }, 2],
  ['Bash', { command: 'git commit -m "$(cat <<\'EOF\'\nAdd\nEOF\n)"' }, 2],
  ['PowerShell', { command: "git commit -m @'\nAdd\n\nbody\n'@" }, 2],
  ['PowerShell', { command: 'git commit -m "Add`nbody"' }, 2],
  ['Bash', { command: 'node .claude/skills/push/mark.mjs && git push' }, 2],
  ['Bash', { command: 'echo x > .work/push-ok' }, 2],
  ['Write', { file_path: 'C:\\Работа\\x\\.work\\push-ok', content: 'x' }, 2],
  ['Bash', { command: `node -e "console.log(require('fs').readFileSync('apps/demo/.env.local','utf8'))"` }, 2],
  ['Bash', { command: 'cat .env' }, 2],
  ['PowerShell', { command: 'Get-Content apps\\demo\\.env' }, 2],
  ['Bash', { command: 'cat .env.example' }, 0],
  ['Bash', { command: 'pnpm dotenv-cli --help' }, 0],
  ['Read', { file_path: 'C:\\Работа\\x\\.env' }, 2],
  ['Read', { file_path: 'C:\\Работа\\x\\.env.local' }, 2],
  ['Read', { file_path: 'C:\\Работа\\x\\.env.example' }, 0],
  ['Read', { file_path: 'C:\\Работа\\x\\src\\a.ts' }, 0],
];

for (const [tool, input, expected, setup] of cases) {
  test(`${tool} ${JSON.stringify(input)} -> ${expected}`, () => {
    assert.equal(run(tool, input, setup), expected);
  });
}

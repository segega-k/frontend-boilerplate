// PreToolUse guard (spike): push needs a one-shot marker, commit message must be one line without trailers,
// .env reads are blocked. Exit 2 = block, stderr goes to the model.
import { existsSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { readInput, log, projectDir } from './lib.mjs';

const MARKER_TTL_MS = 10 * 60 * 1000;

const input = await readInput();
const dir = projectDir(input);
if (existsSync(join(dir, '.work', 'guard-crash'))) throw new Error('simulated guard crash');
if (existsSync(join(dir, '.work', 'guard-hang'))) await new Promise((r) => setTimeout(r, 60_000));

const tool = input.tool_name;
const cmd = String(input.tool_input?.command ?? '');
const filePath = String(input.tool_input?.file_path ?? input.tool_input?.path ?? '');

function block(reason) {
  log(input, { decision: 'block', reason, cmd, filePath });
  process.stderr.write(`guard: ${reason}\n`);
  process.exit(2);
}

// Only the /push skill preprocessing (which does not pass through PreToolUse) may create the marker.
if (/push-ok|skills[\\/]push[\\/]mark\.mjs/.test(JSON.stringify(input.tool_input ?? {})))
  block('the push marker is written only by the user-run /push skill');

if (tool === 'Bash' || tool === 'PowerShell') {
  // Read(.env) deny covers cat/Get-Content but not interpreters (node -e readFileSync('.env') only asks).
  if (/(^|[\s'"`=\\/(])\.env(\.(?!example\b)[\w.-]+)?(?=$|[\s'"`)\\/;|&])/.test(cmd))
    block('commands that touch .env files are blocked (only .env.example is allowed)');
  if (/\bgit\b[^\n|;&]*\bpush\b/.test(cmd)) {
    const marker = join(dir, '.work', 'push-ok');
    const fresh = existsSync(marker) && Date.now() - statSync(marker).mtimeMs < MARKER_TTL_MS;
    if (!fresh) block('git push needs the user to run /push first (no fresh .work/push-ok marker)');
    rmSync(marker);
    log(input, { decision: 'allow-push-marker-consumed', cmd });
  }
  if (/\bgit\b[^\n|;&]*\bcommit\b/.test(cmd)) {
    if (/co-authored-by/i.test(cmd)) block('no Co-Authored-By trailer in commit messages');
    // -m, -am, -vm, --message; combined short flags were missed by a plain "-m" match in the first run.
    const ms = [...cmd.matchAll(/(?:^|\s)(?:-[a-zA-Z]*m|--message)(?=\s|=|["'])/g)];
    if (ms.length > 1) block('commit message must be a single -m line');
    if (/(?:^|\s)(?:-[a-zA-Z]*F|--file)(?=\s|=)/.test(cmd)) block('commit message must be a single -m line, not a file');
    if (/<<-?\s*['"]?\w+/.test(cmd) || /\$\(cat\b/.test(cmd) || /@['"]\r?\n/.test(cmd))
      block('commit message must be a plain one-line -m (no heredoc / here-string)');
    // A one-line commit command never contains a line break; this also covers `n in PowerShell strings.
    if (/[\r\n]/.test(cmd) || /`n/.test(cmd)) block('commit message must be one line, no body');
  }
}

if (/(^|[\\/])\.env(\.(?!example$)[^\\/]*)?$/.test(filePath)) block(`reading secrets is blocked: ${filePath}`);

log(input, { decision: 'pass', cmd, filePath });

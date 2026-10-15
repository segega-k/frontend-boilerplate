// SessionStart: prints a marker block that lands in the model context, plus the active speed mode.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readInput, log, projectDir } from './lib.mjs';

const started = Date.now();
const input = await readInput();
const dir = projectDir(input);
const modeFile = join(dir, '.work', 'mode');
const mode = existsSync(modeFile) ? readFileSync(modeFile, 'utf8').trim() : 'comfort';
console.log('[session-check v1]');
console.log(`SESSION_MARK_7Q2 source=${input.source} node=${process.version} mode=${mode} cwd=${dir}`);
log(input, { source: input.source, ms: Date.now() - started, cwd: dir, argv: process.argv.slice(2) });

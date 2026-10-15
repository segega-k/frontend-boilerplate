// Writes the one-shot push marker that guard.mjs consumes. Runs from the /push skill preprocessing.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.env.CLAUDE_PROJECT_DIR || process.cwd(), '.work');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'push-ok'), new Date().toISOString());
console.log(`PUSH_MARKER_WRITTEN ${join(dir, 'push-ok')}`);

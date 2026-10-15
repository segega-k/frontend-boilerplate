// Writes .work/mode for the speed skill. Unknown values are rejected.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MODES = ['comfort', 'econom', 'business'];
const mode = (process.argv[2] || '').trim();
if (!MODES.includes(mode)) {
  console.log(`SPEED_ERROR unknown mode "${mode}", expected one of ${MODES.join(', ')}`);
  process.exit(0);
}
const dir = join(process.env.CLAUDE_PROJECT_DIR || process.cwd(), '.work');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'mode'), mode + '\n');
console.log(`SPEED_SET mode=${mode}`);

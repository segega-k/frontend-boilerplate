// Stop: blocks once when .work/stop-block-once exists; stop_hook_active prevents a loop.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readInput, log, projectDir } from './lib.mjs';

const input = await readInput();
const flag = join(projectDir(input), '.work', 'stop-block-once');
log(input, { stop_hook_active: input.stop_hook_active, flag: existsSync(flag) });
if (existsSync(flag) && !input.stop_hook_active) {
  console.log(
    JSON.stringify({ decision: 'block', reason: 'STOP_MARK_9D: leftovers found, reply with the word STOP_ACK and stop.' }),
  );
}

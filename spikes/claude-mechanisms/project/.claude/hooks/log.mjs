// Generic logger: records the hook input (used for InstructionsLoaded).
import { readInput, log } from './lib.mjs';

const input = await readInput();
const { transcript_path, session_id, ...rest } = input;
log(input, { input: rest, argv: process.argv.slice(2), envProjectDir: process.env.CLAUDE_PROJECT_DIR ?? null });

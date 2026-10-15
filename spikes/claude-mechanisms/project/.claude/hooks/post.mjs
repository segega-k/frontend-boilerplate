// PostToolUse on Edit|Write: adds a context line (stands in for format + lint of the touched file).
import { readInput, log } from './lib.mjs';

const input = await readInput();
const file = input.tool_input?.file_path ?? '';
log(input, { file });
console.log(
  JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: `POST_MARK_5K formatted ${file}` },
  }),
);

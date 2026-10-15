#!/usr/bin/env bash
# One headless session in <project-dir>: prints the model result, permission denials and the hook log.
# Usage: ask.sh <project-dir> "<prompt>" [extra claude args...]
set -uo pipefail
cd "$1"
prompt="$2"
# "@name" reads the prompt from prompts/<name>.txt next to this script
# and adds --settings prompts/<name>.settings.json when that file exists
shift 2
if [[ "$prompt" == @* ]]; then
  name="${prompt#@}"
  pdir="$(dirname "$0")/prompts"
  prompt="$(cat "$pdir/$name.txt")"
  if [ -f "$pdir/$name.settings.json" ]; then set -- --settings "$(cygpath -m "$pdir/$name.settings.json")" "$@"; fi
fi
rm -f .work/hooklog.jsonl
if [ -n "${DEBUGFILE:-}" ]; then set -- --debug-file "$DEBUGFILE" "$@"; fi
start=$(date +%s%3N)
out=$(claude -p --model "${MODEL:-haiku}" --output-format json --permission-prompts none "$@" "$prompt" 2>../ask.err)
end=$(date +%s%3N)
printf '%s' "$out" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  try{const r=JSON.parse(s);
    console.log("RESULT:", (r.result||"").replace(/\n/g," / "));
    console.log("DENIALS:", JSON.stringify(r.permission_denials));
    console.log("MODELS:", Object.keys(r.modelUsage||{}).join(","), "turns:", r.num_turns, "is_error:", r.is_error);
  }catch(e){console.log("RAW:", s.slice(0,2000))}})'
echo "WALL_MS: $((end-start))"
[ -s ../ask.err ] && { echo "STDERR:"; head -c 1500 ../ask.err; echo; }
[ -f .work/hooklog.jsonl ] && grep -v InstructionsLoaded .work/hooklog.jsonl | sed -E 's/"cwd":"[^"]*",?//; s/C:\\\\Users[^"]*механизмы\\\\//g'
true

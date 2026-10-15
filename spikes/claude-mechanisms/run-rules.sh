#!/usr/bin/env bash
# For each file: fresh headless session that reads only that file; prints which instruction files the
# InstructionsLoaded hook saw (beyond session start) and which _MARK_ tokens the model says it has in context.
# Usage: run-rules.sh <project-dir> [tool]   tool = Read (default) | Edit | Bash
set -uo pipefail
cd "$1"
tool="${2:-Read}"
files=(src/root.ts apps/demo/src/a.ts apps/demo/src/x.css apps/demo/src/notes.md apps/demo/src/api/client.ts
  packages/ui/src/Button.tsx packages/ui/src/user.store.ts docs/imported.md)
for f in "${files[@]}"; do
  rm -f .work/hooklog.jsonl
  case "$tool" in
    Read) p="Use the Read tool once on $f. Then, without more tools, list every token containing _MARK_ that is in your context (system prompt, memory, system reminders, tool results), one per line." ;;
    Edit) p="Use the Edit tool once on $f to append a newline-terminated comment line ' ' at the end (any trivial change). Then, without more tools, list every token containing _MARK_ in your context, one per line." ;;
    Bash) p="Run exactly this one Bash command: cat $f . Then, without more tools, list every token containing _MARK_ in your context, one per line." ;;
  esac
  out=$(claude -p --model haiku --output-format json --permission-prompts none "$p" 2>/dev/null)
  loaded=$(grep '"InstructionsLoaded"' .work/hooklog.jsonl | grep -v session_start | sed -E 's/.*"file_path":"([^"]*)".*"load_reason":"([^"]*)".*/\2: \1/' | sed -E 's/.*механизмы\\\\//' | tr '\n' ';')
  marks=$(printf '%s' "$out" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const r=JSON.parse(s).result||"";console.log([...new Set(r.match(/[A-Z_]*_MARK_[A-Z0-9_]+/g)||[])].join(","))}catch(e){console.log("PARSE_ERR")}})')
  echo "$tool $f | hook: ${loaded:-none} | model: $marks"
done
git checkout -q -- . 2>/dev/null || true

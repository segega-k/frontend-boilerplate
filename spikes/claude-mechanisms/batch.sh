#!/usr/bin/env bash
# Runs ask.sh for several prompt files. Usage: batch.sh <project-dir> name1 name2 ...
export MSYS_NO_PATHCONV=1
here="$(cd "$(dirname "$0")" && pwd)"
proj="$1"
shift
for n in "$@"; do
  echo "== $n"
  bash "$here/ask.sh" "$proj" "@$n" 2>&1 | grep -v -i "has not been trusted"
done

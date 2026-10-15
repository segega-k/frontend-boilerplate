#!/usr/bin/env bash
# Copies the spike project into a fresh directory (Cyrillic + space in the path), makes it a git repo with a bare
# remote, and adds a fake .env (dummy value, not a secret). Usage: setup.sh <target-dir>
set -euo pipefail
src="$(cd "$(dirname "$0")/project" && pwd)"
dst="$1"
rm -rf "$dst" "$dst.remote.git"
mkdir -p "$dst"
cp -r "$src/." "$dst/"
printf 'FAKE_SECRET=not-a-real-secret\n' > "$dst/.env"
git init -q --bare "$dst.remote.git"
cd "$dst"
git init -q -b main
git config user.name spike
git config core.autocrlf false
git config user.email spike@example.invalid
printf '.work/\n.env\n' > .gitignore
git add -A
git commit -q -m "spike baseline"
git remote add origin "$dst.remote.git"
git push -q -u origin main
echo "ready: $dst"

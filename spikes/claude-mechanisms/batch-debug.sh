#!/usr/bin/env bash
# batch.sh with a main model and a debug log. Usage: batch-debug.sh <model> <debug-file> <project-dir> name...
export MODEL="$1" DEBUGFILE="$2"
shift 2
exec bash "$(dirname "$0")/batch.sh" "$@"

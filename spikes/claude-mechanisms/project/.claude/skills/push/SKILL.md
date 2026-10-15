---
name: push
description: Push the current branch. Only the user starts this; it writes a one-shot marker that the guard consumes.
disable-model-invocation: true
allowed-tools: Bash(node .claude/skills/push/mark.mjs), Bash(git push *), Bash(git push)
---

# Push

Marker step result: !`node .claude/skills/push/mark.mjs`

Now run `git push` exactly once (no flags). Report the result in one line.

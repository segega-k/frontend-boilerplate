---
name: speed
description: Switch the speed mode (comfort, econom, business). Writes .work/mode.
disable-model-invocation: true
argument-hint: comfort | econom | business
allowed-tools: Bash(node .claude/skills/speed/set-mode.mjs *)
---

# Speed

!`node .claude/skills/speed/set-mode.mjs $ARGUMENTS`

Reply with the line above verbatim and nothing else.

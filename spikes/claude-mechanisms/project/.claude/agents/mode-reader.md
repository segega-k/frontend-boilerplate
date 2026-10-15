---
name: mode-reader
description: Spike agent. Reads the speed mode file and reports it. Use when asked to check the speed mode.
tools: Read, Glob
model: haiku
effort: low
---

Read the file `.work/mode` in the project root (if it is missing, the mode is `comfort`). Reply with exactly one line:
`AGENT_MODE=<mode> AGENT_LIMIT=<limit>` where limit is `1` for econom, `2` for comfort and `unlimited` for business.

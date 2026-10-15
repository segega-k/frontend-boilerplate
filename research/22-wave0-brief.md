# 22. Wave 0 brief (read first, every wave-0 agent)

Status: active · Started: 2026-10-15 · Mode: `comfort` (Opus 5.5 medium; each agent may launch at most one sub-agent,
also Opus medium; never Fable)

## Goal of wave 0

Prove on this machine that the risky mechanisms of the master plan work before wave 1 builds on them. Output is
evidence: a report with a table "mechanism → works / workaround / fails", measured numbers, and minimal spike code that
reproduces it. Spikes are throwaway unless the report says a piece is ready to promote into wave 1.

Read: `research/12-master-plan.md` (§3, §4, §11 wave 0, §13), `research/21-user-validation.md` (user decisions that
override the plan), and the reports your task cites.

## Environment (Windows 11, Cyrillic path)

- Repo: `C:/Работа/Frontend-boiler/frontend-boilerplate` (path contains Cyrillic — a known source of tool bugs; test it).
- System Node is 22. Use Node 24: prepend `C:/Users/Сергей/.local/node-v24.18.0-win-x64` to PATH in every shell command.
  Use pnpm 11 through corepack (`corepack enable` with Node 24, then `corepack pnpm@11 ...` or a `packageManager`
  field), not the global pnpm 10.
- Bash (Git Bash) and PowerShell are available. Playwright can use system Edge (`channel: 'msedge'`).
- Disk is fine. RAM is limited: keep at most one dev server and one browser alive at a time; stop them when done.

## Rules

- Work only inside your own git worktree / spike folder. Never touch another agent's files. No `git stash`, no
  `git reset --hard`, no `git worktree remove --force`, no shared `node_modules` links.
- Do not push. Commit only on your own branch, only your files, one-line English messages without trailers.
- Never read `.env` files or secrets anywhere. Do not install global tools without saying so in the report.
- Version pins: latest patch older than 7 days (plan rule). Record exact versions you used.
- If something fails, record the exact error and the workaround you tried; do not silently change the plan's decision —
  propose the change in the report.

## Report format

`research/22<letter>-<topic>.md` in Russian: Status / Resume notes / Summary (≤ 15 lines) / Results table / Details with
commands and numbers / What wave 1 should take as is / Plan changes proposed / Open issues. Update it as you go so
work can resume after an interruption.

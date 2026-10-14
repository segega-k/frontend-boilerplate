# Research brief (read first, every agent)

Orchestrator: main Claude session. Date: 2026-10-14. Final deliverable: a 5–10 page PDF master plan for the user (in
Russian), synthesized later in a fresh context from the files in this folder. Your report is the only thing that
survives — write everything important into it.

## 1. What we are building

A frontend boilerplate repository (`C:/Работа/Frontend-boiler/frontend-boilerplate`):

- one shared Claude Code setup that makes every agent, in every session, on every machine, work the same way;
- full code/architecture/design rules with bad/good practice;
- a one-time init script run from the terminal: the user picks templates, everything not needed is deleted (code,
  packages, configs, docs, Claude rules), dependencies are updated, the result builds and runs;
- one infrastructure for install, dev, deploy on any machine.

Candidate templates (not final): landing, shop, Telegram Mini App (TMA), admin panel, web games, possibly more.

## 2. Decisions already made by the user

1. **Several templates per project.** Init lets the user pick several at once (e.g. TMA + landing + admin) inside one
   monorepo with a shared UI kit and tokens. Unpicked templates are deleted.
2. **Frontend only.** The backend is always external (API by OpenAPI contract). A shop integrates headless
   commerce/CMS providers; no own business backend or DB. An SSR server or thin proxy layer that is part of the frontend
   app is fine.
3. **Deploy on own servers via Docker** (VPS / k8s, GitLab or GitHub CI). No vendor lock-in to Vercel/Netlify.
4. **Web only, no React Native.** TMA, web, PWA. The stack must not carry RN / React Native Web compromises (the past
   project xRocket did, with Tamagui + RNW).
5. Consta UI Kit is irrelevant, ignore it.
6. Codex compatibility is a side concern, not a priority. Design for Claude Code only; at most one short note on how
   Codex could be added later.

## 3. Existing material (read what is relevant, do not redo it blindly)

- Boilerplate docs already written from past sessions: `CLAUDE.md`, `docs/*.md` in the repo root. They contain the
  user's rules and corrections. Treat them as the user's preferences; you may challenge them with evidence.
- Earlier analysis reports (Russian) from another project's session, in
  `C:/Users/D899~1/AppData/Local/Temp/claude/C---------awaaz-awaaz-sehat/4e2bf6ee-034a-49e7-a333-392d92019ac4/scratchpad/`:
  `00-xrocket-session-context.md` (user preferences), `03-xrocket-codebase-transfer.md`, `04-xrocket-design-structure.md`,
  `06-xrocket-architecture.md`, `02-design-ai-analysis.md`. Useful starting points; verify against code, go deeper.
- xRocket repo (read-only, never modify, never run git commands that change state, never read `.env`):
  `C:/Работа/xRocket/xrocket-front`. "Modern" = files with commits in the last 12 months
  (`git log --since=2025-10-14`). The most recent work is AI-assisted.

## 4. Rules for every agent

- **Read-only** everywhere except your own report files in `research/`. Do not modify xRocket or boilerplate code.
- **At most one sub-agent** of your own (the templates-tech agent is the only exception: one per template). Give it a
  precise task and make it write to its own file `research/<your NN><letter>-<topic>.md`.
- Web research is allowed and encouraged where the task says so. Cite sources (URL) for non-obvious claims. Prefer
  sources from 2025–2026; flag anything that may be outdated.
- Be concrete: versions, file paths, examples, numbers. No filler. Separate facts (verified) from opinions.
- Write in **Russian** (code and identifiers as is).

## 5. Report format and checkpointing (mandatory)

File: `research/<NN>-<topic>.md`. Structure:

```
# <NN>. <Topic>
Status: in_progress | done
Updated: <date time>

## Resume notes
- Done: <sections finished>
- Next: <exact next steps>
- Sub-agent: <its file and status, if any>

## Summary (≤ 15 lines)
<the conclusions the master plan needs>

## Findings
<detailed sections>

## Recommendations for the boilerplate
<concrete, prioritized; what to take, what to avoid, why>

## Open questions for the user
<only general decisions, numbered>
```

- Create the file with `Status: in_progress` **before** heavy work and update it after every major step (at least
  every few findings). If the session is cut, a new agent must be able to continue from `Resume notes` without loss.
- If the file already exists with `Status: in_progress` when you start, **continue from its Resume notes** instead of
  starting over.
- Set `Status: done` only when the report is complete. Your final reply to the orchestrator: 5–10 lines summary plus
  the file path.

# Orchestration status

For resuming after an interruption. Each agent's own progress is in its report's `Status` and `Resume notes`.

## User decisions (2026-10-14)

Several templates per project in one monorepo; frontend only; Docker on own servers; web only, no React Native;
Consta removed from docs. Codex compatibility: keep in mind as a possible later addition, not a priority at all;
design for Claude Code only.

## Model rules (user, 2026-10-14)

- Research agents and their sub-agents: model `opus`, effort `medium`; `sonnet` only for very simple tasks.
- `fable` is forbidden for every sub-agent except one: the master-plan co-author in Phase 2.
- Agents 01–06, 09–11 were launched before this rule: Opus, default effort. Their sub-agents were told by message to
  use Opus medium.

## Phase 1 — research

| #   | Report                                 | Depends on   | State    |
| --- | -------------------------------------- | ------------ | -------- |
| 01  | 01-xrocket-architecture.md             | —            | done     |
| 02  | 02-xrocket-tech.md                     | —            | done     |
| 03  | 03-xrocket-design.md                   | —            | done     |
| 04  | 04-xrocket-ai-practices.md             | —            | done     |
| 05  | 05-templates.md (+ 05a…05e per template) | —          | done     |
| 06  | 06-init-script.md                      | 05 (soft)    | done     |
| 07  | 07-anti-ai-design.md                   | 03           | done     |
| 08  | 08-claude-system.md                    | 01, 04       | done     |
| 09  | 09-pixel-perfect.md                    | —            | done     |
| 10  | 10-security.md                         | 05 (soft)    | done     |
| 11  | 11-human-maintainability.md            | —            | done     |
| 13  | 13-styling.md                          | —            | done     |
| 14  | 14-game-revisit.md (durak, dadya-shakhter) | —        | done     |
| 15  | 15-game-session-lessons.md (orchestrator)  | —        | done     |
| 16  | 16-site-template.md                        | —        | done     |
| 17  | 17-stack-report.md (+17a… per template), separate short PDF | 16 (soft) | done     |
| 18  | 18-error-mapping.md                        | —        | done     |
| 19  | 19-utils-site.md                           | 18 (soft)| done     |

## Resume procedure

1. For every report with `Status: in_progress` or missing: relaunch its agent with the same task; the agent continues
   from `Resume notes` (the brief tells it to).
2. Launch 07 when 03 is `done`; launch 08 when 01 and 04 are `done`.
3. When all are `done`: Phase 2 — the orchestrator designs the master plan together with one agent on model `fable`
   (fresh context, reads only `research/*.md`). The orchestrator sets the frame and the decisions, the Fable agent
   drafts and challenges; the orchestrator reviews and finalizes `research/12-master-plan.md` (Russian, 5–10 pages),
   then the PDF `research/master-plan.pdf`.

## Phase 2 — master plan (state)

- Phase 1 complete: all reports 01–11 `done`.
- `12-frame.md` written by the orchestrator (decisions, required sections, open questions, process).
- Fable co-author launched: step 1 writes `12-challenges.md` and stops; orchestrator answers by message; step 2 writes
  `12-master-plan.md`; review rounds; then PDF via headless Edge (`msedge --headless --print-to-pdf`) from HTML.
- If interrupted: relaunch a Fable agent with the same prompt; it continues from whichever of `12-challenges.md` /
  `12-master-plan.md` exists.
- 2026-10-14: master plan v2 (`12-master-plan.md`, v1 kept as `12-master-plan.v1.md`) accepted by the orchestrator;
  PDF `master-plan.pdf`, 10 A4 pages. Waiting for the user's answers to the 6 confirmations (§12 of the plan).
- 2026-10-15: plan revision 2 requested from the Fable co-author (game template per [14], lessons [15]).
- 2026-10-15: master plan round 4 accepted; master-plan.pdf rebuilt (10 pages); stack-report.pdf (6 pages) from [17]. No open user questions.
- 2026-10-15: round 5 (errors [18], utils [19], showcase) sent to the Fable co-author.
- 2026-10-15: backlog file 20-backlog.md created (speed skill, final README blocks). Check it before closing any implementation wave.

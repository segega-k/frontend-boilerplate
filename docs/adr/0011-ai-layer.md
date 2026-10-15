# 0011. AI layer: CLAUDE.md tree, path rules, skills, guard hook, memory in repo and local

- Status: Accepted
- Date: 2026-10-15
- Deciders: user (memory, push, commit format, speed modes, onboard), orchestrator

## Context

xRocket had a 61 KB CLAUDE.md, rules kept in memory and many rules without any check; models copied old patterns.
In the Shakhter session text bans did not stop three unrequested pushes. Rules must load where they apply, every rule
needs a mechanism, and the setup must work the same on any machine. Project knowledge must travel with the repo.

## Decision

- Instruction tree: root `CLAUDE.md` ≤ 200 lines (session start, `/onboard`, doc map, commands, 25–30 one-line rules
  with their mechanism); canonical rules in `.claude/rules/*.md` with `paths:`; `apps/<id>/CLAUDE.md` ≤ 150 lines,
  `packages/<pkg>/CLAUDE.md` ≤ 80. No template-specific rule files: template context is removed with its folder.
  AI docs in English; answers to the user in Russian. Codex is not supported.
- Skills committed in the repo (~21 core): process (`plan-task` … `commit`, `push`, `record-decision`), generation,
  design and Figma, `setup-check`, `init-project`, `onboard` (read the whole context after init, read-only,
  idempotent), `errors-map` (see [0005](0005-api-client-error-mapping.md)), `speed` (`comfort` default / `econom` /
  `business`, written to `.work/mode`). Template skills are prefixed `<id>-` and removed by init.
- Agents: `researcher`, `implementer`, `code-reviewer`, `rules-reviewer`, `design-reviewer`,
  `figma-section-inspector`; model and effort from the active speed mode; one git worktree per parallel agent.
- Settings: `acceptEdits`; deny reading secrets and destructive git/shell; ask on commit, installs, network.
- Hooks on Node: SessionStart prints `[session-check v1]` and the mode; PreToolUse `guard.mjs` blocks secrets,
  destructive commands, protected paths and `git push` without a one-time marker set only by the user-invoked `/push`;
  PostToolUse formats and lints the touched file; Stop catches leftovers. Hook tests run in the gate.
- Git: commit and push only on direct request. Commit message: one English line, no body, no trailers, no ticket
  prefix and no prefix hook.
- Memory: both. Project knowledge goes to the repo via `/record-decision` (rule, child CLAUDE.md or ADR, with diff);
  local auto memory stays on for what the user asks to remember on this device. "Запомни" writes to both when
  relevant. Nothing project-critical lives only in local memory.
- Gates: `pnpm verify` (one gate for skill, Stop hook, pre-commit, CI, init) and `pnpm ai:check` (drift tests: paths,
  commands, skill and rule validity, "enforced by" really on, AI-doc language, init markers). "Fix the doc, not the
  test."
- API rule: the realtime ticket flow has no code in the boilerplate; an AI rule describes the expected backend
  contract (see [0012](0012-auth-adapters.md)).

## Consequences

- Context stays small and relevant; rules are checked, not trusted.
- Push needs the user to run `/push`; on Windows there is no sandbox, so guard + deny/ask + branch protection are the
  boundary; long autonomous runs go to WSL2/devcontainer.
- Hook and `paths:` behaviour on Windows with a Cyrillic path must be proven in wave 0.

## Alternatives considered

- Text-only bans on push: proven to fail. Push denied outright: blocks the legitimate flow.
- Memory only in repo (first plan): the user wants device-local memory too.
- Team plugin marketplace for skills: extra infrastructure; skills live in the repo.

## References

- `research/08-claude-system.md`, `research/04-xrocket-ai-practices.md`, `research/04a-claude-code-features.md`,
  `research/10a-claude-code-safety.md`, `research/15-game-session-lessons.md` §7, `research/20-backlog.md` §1,
  `research/12-master-plan.md` §5, `research/21-user-validation.md` #10, #20–#24.

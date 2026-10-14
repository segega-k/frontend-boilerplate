# 20. Backlog of user requirements to implement later

Status: open (do not lose; check items off when implemented)
Updated: 2026-10-15

## 1. Skill `speed` (agent operating modes)

A user-invoked skill that switches how agents work in the session. Recorded verbatim intent from the user:

| Mode | Main model | Fable | Sub-agents | Effort |
| --- | --- | --- | --- | --- |
| `speed:comfort` / `speed:default` | Opus 5.5, standard settings | only for orchestration or planning | moderate; max nesting depth 2: the main agent may launch any number, each of its agents at most one | medium |
| `speed:econom` | Opus 5.5 | never | strongly limited: max nesting depth 1, at most 5 sub-agents in total, reduced capabilities; quality must stay the same as default | medium |
| `speed:business` | Opus 5.5 | allowed and used often | no limits, as many as useful | max ("ultramax"); priority: speed, quality, depth of research |

Implementation notes: the skill writes the active mode where agents read it (e.g. a line in the session context and
`.work/mode`), project agents in `.claude/agents` read the mode for model/effort; Claude Code effort levels are
low/medium/high/xhigh/max, so "ultramax" maps to `max`. Default mode is `comfort`.

## 2. Final README (write when the main code work is finished)

The README must be written carefully, in blocks, after the code is done (English, plus Russian backup README.ru.md):

1. What the boilerplate is, its advantages and features.
2. First setup: `pnpm run setup` interactive flow, all flags, non-interactive use, examples, rollback, `--remove`.
3. Templates and sub-templates with the settings/options of each template.
4. AI setup: CLAUDE.md tree, rules, all skills (including `onboard`, `errors-map`, `speed`, `orchestrate`, `verify`,
   etc.) and commands, settings and hooks, models policy, memory policy, how an agent should start.
5. Project management: commands (dev, verify, tunnel, utils, storybook), waves of work, how decisions are recorded.
6. Utils site guide: Errors, Texts, Catalog (Storybook), Screens, Tokens tabs; CLI equivalents for agents.
7. Design guide: with a mockup (pixel-perfect, Figma module, no design initiative) vs without (DESIGN.md, anti-slop
   rules, catalog-first), screen transitions, devices.
8. Error mapping and fatal screens, i18n catalogs, security, deploy and runbooks, troubleshooting.
9. Everything else needed for a newcomer human or agent to work without asking.

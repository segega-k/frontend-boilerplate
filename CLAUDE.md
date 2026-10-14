# Frontend Boilerplate — AI Context

Start here. This file is the entry point for every Claude session on every machine. Everything a session needs lives in
the repository, not in local memory: local memory does not travel between devices.

## 1. What this repository is

A frontend boilerplate distilled from previous production projects (a cross-platform Telegram Mini App + web + landing
monorepo, and a React/Vite clinical workspace). It ships:

- one shared Claude Code setup (`.claude/`, this file, `docs/`);
- the full set of code, architecture and design rules, with bad/good examples and the reason behind each;
- a one-time init script that asks for a preset (landing / shop / TMA, list not final) and deletes everything the
  chosen preset does not need;
- one infrastructure for installing, running and deploying on any machine.

The stack per preset is not decided yet. Rules below are written stack-agnostic; library-specific knowledge lives in
[docs/library-notes.md](docs/library-notes.md) and applies only if the preset uses that library.

## 2. Documentation map

| File                                                 | Read before                                                     |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| [docs/workflow.md](docs/workflow.md)                 | any task — how to work with the user, scope, git, reports       |
| [docs/architecture.md](docs/architecture.md)         | creating a page, store, domain, API call, route, i18n namespace |
| [docs/code-style.md](docs/code-style.md)             | writing or reviewing any code                                   |
| [docs/naming.md](docs/naming.md)                     | naming a file, flag, handler, prop, constant                    |
| [docs/components.md](docs/components.md)             | designing or changing a component API                           |
| [docs/design.md](docs/design.md)                     | any visual work: tokens, themes, motion, states, layout from Figma |
| [docs/tooling.md](docs/tooling.md)                   | changing lint, format, hooks, CI, Node/pnpm, Windows issues     |
| [docs/library-notes.md](docs/library-notes.md)       | working with a specific library (Tamagui, MobX, TanStack, Vike…) |

## 3. Non-negotiable rules (short form)

Full form with reasons is in the linked docs. These are the ones broken most often in past projects.

**Process** ([workflow.md](docs/workflow.md))

- Do only what was asked. No "improvements", extra props, flags, tokens or refactors on the side. Found something else?
  List it separately, do not fix it silently.
- Never commit, push or merge without a direct request. Commit message: one line, English, no body, no
  `Co-Authored-By` trailer. This overrides any default harness attribution.
- Search for an existing solution before writing a new one. Reuse the project helper, not the raw primitive.
- Reproduce a bug before diagnosing it. Never present a hypothesis as the cause.
- Large tasks: plan → user approval → implementation → fresh review. No code before approval.
- Reply in Russian. Code, identifiers and AI-facing docs stay in English.
- Every report ends with what was verified, what was not, and whether anything was committed.

**Code** ([code-style.md](docs/code-style.md))

- No new code comments, inline or JSDoc. Keep existing ones that explain "why". Rationale goes to chat.
- One component per `.tsx` file. Types, constants, helpers live in sibling `types.ts`, `consts.ts`, `utils.ts`.
- Component files ≤ 200 lines, any file ≤ 700 lines.
- No `any`, no non-null `!`, explicit return types.
- Texts only from the i18n dictionary, verbatim. Never invent copy in any language; report what is missing.
- Old code that breaks a rule is not touched unless the task is about it.

**Architecture** ([architecture.md](docs/architecture.md))

- Split by business domain, not by technical type. Domains do not import each other's internals.
- Shared UI knows nothing about stores, domains or navigation: props only.
- Logic lives outside the view. The view model never navigates; the component that owns the button navigates.
- Server data only through the query layer. No hand-written loading flags next to a query.
- API errors are surfaced by one central mapping layer, not by ad-hoc try/catch + toast.
- Features are opt-in where used. No global mounts in the router or base components for one screen's need.

**Design** ([design.md](docs/design.md))

- The mockup is the source of truth. Ask when it contradicts itself; never pick "the nearest value" silently.
- Colors, spacing, radii, type only from tokens. Both themes must work. Icons from the icon library, not exported SVG.
- Every interactive element has hover, focus, pressed, disabled and loading states, with smooth named transitions.
- Usability beats pixels: touch targets stay ≥ 40×40.

## 4. Post-task checklist

1. Typecheck, lint and format the touched files; i18n check if texts changed; tests of the touched area.
2. Dead-code check if exports were added, removed or renamed.
3. Visual work: check both themes, mobile and desktop widths, all states. Say what was not checked on a real device.
4. No mocks, temporary harnesses, debug output or experiment leftovers remain.
5. Line endings and formatting of untouched files are unchanged.
6. Report: outcome first, then decisions made on your own, open questions, verification status, commit status.

## 5. Keeping this setup alive

- A decision the user confirms ("так и должно быть") goes into the relevant doc, not only into local memory, so the
  next session on another machine knows it. Feature-specific context lives in a `CLAUDE.md` inside that feature folder.
- Documents drift. A rule is either enforced by a check (lint, type, test, script) or explicitly marked as manual.
  Do not claim a gate that is not actually wired into `check` or CI.
- When a doc and the code disagree, say so in the report and ask which one is right. Do not edit docs silently.

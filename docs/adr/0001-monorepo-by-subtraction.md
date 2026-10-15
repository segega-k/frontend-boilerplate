# 0001. Monorepo built by subtraction: pnpm + Turborepo, ownership manifest, init

- Status: Accepted
- Date: 2026-10-15
- Deciders: user (monorepo even with one template), orchestrator

## Context

The boilerplate ships six templates that share a UI kit, tokens, API layer, i18n and an AI setup. A new project picks
any subset. Generators that assemble a project from parts (create-t3-app, Better-T-Stack) or code markers (`// #if`)
leave a source tree that cannot be run, linted or tested as a whole, so combinations break unseen. Agents also need to
work on the source as an ordinary project.

## Decision

- The source repository is a working pnpm workspace with all templates, checked by normal CI. pnpm 11 with `catalog:`
  (latest patch older than 7 days), Turborepo for tasks; no Nx.
- Init (`pnpm run setup`) only removes what was not picked and regenerates a few summary files (`compose.yaml`, README
  table). Every file has exactly one owner: core, a module (template, sub-template, option), the package graph, or a
  generator. Ownership lives in a typed `boilerplate.manifest.ts`; a `manifest-coverage` test catches ownerless files.
- Shared packages are pruned by the `workspace:*` graph (like `turbo prune`); no hand-kept `usedBy` lists. CI finds
  apps by `apps/*/deploy.json`. `<!-- init:<id> -->` markers are allowed only in Markdown.
- Init is a committed Node bundle that runs before `pnpm install`; it has preflight, plan, `--dry-run`, backup to
  `.init-backup/`, automatic rollback, `--resume`/`--rollback`, idempotent re-runs, flags and `--json` for agents, and
  a final `pnpm verify --all`. It never commits; at the end it may (after asking) reset git history and set a new
  remote. Init and manifest stay so `--remove <id>` works later; `--purge-init` deletes them.
- One picked template still produces a monorepo.

## Consequences

- One source of truth; rules, lint and tests apply to all templates at once.
- Discipline required: apps never import each other; shared files carry no template knowledge (boundary checks in
  `tools/checks`).
- Adding a template after init needs a separate `add` command (wave 3).
- Init matrix cost on a private repo: PR runs only single templates touched by the change; full pairwise matrix weekly;
  Windows (Cyrillic path) and macOS jobs are manual (`workflow_dispatch`).

## Alternatives considered

- Folder per template (create-vite): shared code duplicated, no multi-select.
- Assembly from parts (create-t3-app, Better-T-Stack): source is not runnable; two sources of truth.
- Code markers: fragile, formatter breaks them, lint sees all branches.
- copier/cookiecutter: needs Python. Nx generators: pulls in Nx.

## References

- `research/06-init-script.md` (F1–F9), `research/12-master-plan.md` §1, §8, `research/21-user-validation.md` #1, #2,
  #4, `research/05-templates.md`.

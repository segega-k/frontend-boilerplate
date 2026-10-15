# 0008. Local-only utils site that writes the repo; agents use its CLI

- Status: Accepted
- Date: 2026-10-15
- Deciders: user (utils on xrocket-tools logic, local-only, agents edit mappings themselves), orchestrator

## Context

In xRocket, error mappings and their texts were edited in xRocket Tools, an external Strapi service: changes needed a
password, were not reviewable in PRs and drifted from the code. The user wants a per-project tool to edit error
mappings, view and edit every language, and see the component catalog. For now only the user edits texts. Agents must
also be able to add and change mappings and texts without clicking through a UI.

## Decision

- `apps/utils`: Hono server on `127.0.0.1` with a one-time token (cookie `SameSite=Strict`, Host and Origin checks)
  plus a Vite SPA on the kit. `pnpm utils` starts it together with Storybook.
- Tabs: Errors (service → operation → response tree, filters, edit type/severity/support, texts of all locales next to
  real `Toast`/`Modal` previews, "Sync with OpenAPI" from the committed spec), Texts (app → namespace → key, locale
  columns, missing/unused/draft badges, plural and placeholder validation), Catalog (see
  [0007](0007-component-catalog.md)), Screens (VRT snapshots), Tokens (roles and primitives, contrast).
- Flow: UI → atomic JSON write in the repo (allowlisted paths only) → split + validators → `git diff` and "Run checks".
  Utils never commits or pushes.
- All logic lives in `packages/devtools-core`, shared by UI, CLI and pre-commit. Agents never drive the UI; they use
  the CLI with `--json`: `pnpm errors:add|set|list|sync|check`, `pnpm i18n:set|missing|check`, and the `/errors-map`
  skill.
- Error texts are the only exception to "never invent texts": agent texts get `"draft": true`, are badged in utils,
  listed in the agent's report for approval; user texts always win. `errors:list --draft` is in the release checklist.
- Local-only by default (no `deploy.json`; `tools/checks` keeps it out of compose and CI deploy). `utils-deploy` is a
  late option (internal ingress, OIDC, edits only via PRs from a GitHub App).

## Consequences

- Mappings and texts are reviewed like code; no external service or secret.
- A second dev server in every project; one validation library must stay the single source of rules.
- Draft texts can reach production unnoticed unless the release checklist is followed.

## Alternatives considered

- Keep the external xRocket Tools service: secrets, no review.
- Edit JSON by hand only: no previews, error-prone plurals and placeholders.
- Deployed shared utils by default: not needed while only the user edits texts.

## References

- `research/19-utils-site.md` §1, §6, `research/18-error-mapping.md` §5, `research/12-frame.md` §8,
  `research/12-master-plan.md` §5, §8, §9.

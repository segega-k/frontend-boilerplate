# 21. User validation of the master plan (2026-10-15)

Status: done. These decisions override `12-master-plan.md` where they differ; fold them into the plan text in the next
plan revision. Numbers refer to the orchestrator's question list.

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Monorepo even with one template | OK |
| 2 | Reset boilerplate git history and set a new remote at the end of init | Yes, as an option with a question |
| 3 | `ai:sync` only for the AI layer | OK |
| 4 | Init CI matrix | Repo is private (limited Actions minutes): PR runs only single templates touched by the change; full pairwise matrix weekly, not nightly; Windows/macOS jobs manual (`workflow_dispatch`) |
| 5 | Auth backends vary | Auth is adapter-based everywhere: `api-login` (own login endpoint through BFF/cookie) and `oidc` (PKCE or BFF); init asks which adapter; no single default provider assumed |
| 6 | TMA initData contract | Yes: document `initData` → backend validation → session as a required backend contract in the tma template docs |
| 7 | Provably fair | Remove from the plan and docs entirely; outcomes simply come from the server |
| 8 | Shop backend | Usually the project's own backend: default commerce adapter = own API via OpenAPI (`packages/api` + mapping); Medusa and Shopify become optional adapters |
| 9 | Blog authors | Non-developers write posts: CMS on by default for blog (loader interface; default adapter decided in wave 2, Strapi first candidate) |
| 10 | Realtime ticket | No code for the ticket flow; only an AI rule describing the expected backend contract; `packages/realtime` takes an auth hook |
| 11 | Kit and styling props | Props for styling variance are allowed, but ~90% of styling lives in `Name.styled.ts`; kit exposes typed variant/layout props, never raw `className`/`style` strings in JSX |
| 12 | VM optional for simple screens | OK |
| 13 | Newest versions | OK |
| 14 | Sentry | Off by default until enabled (option with DSN) |
| 15 | Analytics | Off by default |
| 16 | Locales | Only `en` and `ru` by default |
| 17 | problem+json with `type` | Yes, backends follow it |
| 18 | 401 / refresh | Orchestrator: with BFF the server refreshes transparently; without BFF a single-flight refresh on 401, retry once, then the xRocket session clear |
| 19 | Fable availability | Available everywhere |
| 20 | `/commit` and `/push` skills | OK |
| 21 | `acceptEdits` | OK |
| 22 | Memory | Both: project knowledge goes to the repo via `/record-decision`; local auto memory stays enabled for what the user asks to remember on this device. "Запомни" writes to both when relevant |
| 23 | Commit format | One English line; no ticket prefix and no prefix hook at all |
| 24 | Worktree per agent | OK |
| 25 | Catalog step skipped for small tasks without new components | OK |
| 26 | Anti-slop exceptions | Recorded in the project's own `DESIGN.md` (per repository) |
| 27 | System font in tma/admin | Not OK: every template uses a deliberately chosen font from `DESIGN.md` (self-hosted), not the system stack |
| 28 | Helm | Not needed now |
| 29 | Reverse proxy / TLS | Orchestrator: optional Caddy service in the generated compose with automatic HTTPS; off when an external proxy exists |
| 30 | CI host | GitHub only for now; GitLab removed from the waves |
| 31 | Start | Wave 0 starts now in `comfort` mode |
| 32 | Merge | `master-plan` merged into `main` |

## Orchestrator resolutions of contradictions found in wave 0 (22e)

- `DESIGN.md`: one per app (`apps/<id>/DESIGN.md`) inside the project repository; #26 means design exceptions are
  recorded in that project's own DESIGN.md files, not in the boilerplate.
- Agent plans: `.work/plans/` tracked by git, agents never commit them (plan wording wins over the old frame line).
- Fonts: rule T7 (system font stack in TMA) from 07/07a is cancelled by #27.
- `--update latest` informational run: weekly, like the init matrix (Actions minutes).

## User rule: backend-agnostic templates (2026-10-15)

Templates must not be bound to any specific backend contract (backends differ per developer). Template code contains
only the basics for connecting to a backend plus minimal expectations; everything backend-specific is configuration or
an adapter with a neutral default, and concrete integrations are examples or optional adapters. Consequences:
- Error mapping: engine, middleware order, toasts/modals/fatal screens stay as specified; the error-key extractor
  (problem+json `type` by default), banned and maintenance markers, health check, auth header and refresh strategy are
  configuration/adapters.
- Auth: `AuthAdapter` interface with neutral stubs; no assumed endpoints or payloads; refresh only if the adapter has it.
- TMA: how `initData` is sent and exchanged is an adapter + documented expectation, not hardcoded.
- Shop: `CommerceProvider` interface + `mock` adapter in the template; own-API, Medusa, Shopify adapters are optional
  examples, not default code.
- Realtime and game: transport/outcome interfaces only; server contracts live in AI rules and docs.
- Each template documents a "Backend contract surface": the minimum it expects and every adapter point.

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

## Orchestrator decisions from wave 0 B (22b)

- Landing/blog: no React islands by default; components are `.astro` files using the same `tv()` recipes; React islands
  only where interactive Base UI is needed, budget ~120 KB gz JS for such pages; pages without islands ≤ 50 KB.
- One shared `createTV` in `@kit/ui/tv` with a tailwind-merge config generated from `packages/tokens`; `tailwind-variants`
  imports banned elsewhere.
- Gate includes a lint self-test: the bad-example folder must fail lint (better-tailwindcss can silently disable itself).
- `@storybook/addon-vitest` non-ASCII path bug: keep the `pnpm patch` + exact pin until fixed upstream.

Correction (user, 2026-10-15): the error contract stays fixed, not configurable — errors parsed by problem+json `type`,
banned = 403 with the marker, maintenance = 503, exactly as in xRocket. It is part of the minimal backend expectations.
The rest of the backend-agnostic rule stays (auth adapters, commerce interface + mock, initData adapter, realtime and
game interfaces only).

## Orchestrator decisions from wave 0 A (22a)

- `ai:check` parses the YAML frontmatter of every rule and skill (a broken header silently drops a rule).
- Onboarding and `ai:doctor`: run `claude` interactively once in the repo folder and accept the trust dialog (project
  `permissions.allow` is ignored until then; trust is per exact path); install required plugins explicitly
  (`claude plugin install …`) and approve project MCP servers.
- Template-specific rules may live in `apps/<id>/.claude/rules/` (paths relative to the app; deleted with the app by
  init) — this replaces the plan's "no template rule files".
- Hook scripts must run on Node 22 (hooks use the system Node); exec form with `${CLAUDE_PROJECT_DIR}`; guard with
  `onFailure: "block"`; `git push` removed from the ask list (the guard marker controls push).
- Shell scripts run from Git Bash set `MSYS_NO_PATHCONV=1` where slash arguments are passed.
- Known risk: auto-memory folders derive from the project path with Cyrillic letters replaced by `-`; two Cyrillic
  paths of equal shape may share memory — documented in the README troubleshooting.

## Orchestrator decisions from wave 0 D (22d)

- Adopt the spike's deviations from xRocket: no retry on maintenance 503; 401 with an old token retried once with the
  current session; retries via the client's own fetch; toast placeholders from error-body fields; maintenance
  middleware also on the sign-in client; status taken from the response key; any JSON media type.
- 401/refresh described through `AuthAdapter` (`noAuth` default, `BearerTokenAuth`, `CookieSessionAuth`).
- `_resolution` stamped only on object bodies (xRocket array-spread bug fixed).
- Rule for backend specs: explicit discriminator `mapping` (documented as a minimal expectation, not enforced in code).
- Code constraints: MobX 7 named exports (`observableShallow`…); `erasableSyntaxOnly` for scripts run by Node's built-in
  TS (no enums, no parameter properties) — applies to tools/CLI.
- Offline at start → `no-network` (xRocket bug fixed). Guard/fatal-screen texts in i18n `common`.
- Wave 1 backlog from the spike: CLI invoked via `node` (pnpm prints a banner), `i18n:delete`, ignore list, drift test
  for generated types, prettier on generated TS, MobxQuery v2 SSR/hydration.

## Orchestrator decisions from wave 0 C (22c)

- Site JS budget: total ≤ 200 KB gz per page and app code on top of the framework ≤ 65 KB gz (a bare Next 16.4 page with
  one client component is already 133 KB gz).
- CSP in site: prerendered and partially prerendered pages use the `'self' 'unsafe-inline'` script profile; the nonce +
  `strict-dynamic` profile only for fully dynamic segments (`connection()` + `instant = false`). Experimental SRI is
  not relied on.
- Version pins: security releases are an exception to the 7-day rule. Wave 1 takes the Next.js 16.4.1 release of
  2026-10-14 and the matching React patches, after checking the advisory.
- Server Actions key: target is one image for all environments with `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` at runtime;
  wave 1 verifies it with a closure action first, and keeps one image per environment if the check fails.
- `app/template.tsx` is banned (it stops view transitions); the CSS fade fallback lives in the page transition component.
- Session: the DAL calls `await connection()` before reading the cookie; `proxy.ts` does only an optimistic 307
  redirect, the DAL check is authoritative.
- The `[locale]` root layout sets `instant = false`; `dynamicParams` is not used with Cache Components.
- MobX 7: `observableRef` instead of `observable.ref`.
- Carried to wave 1: full e2e re-run after the last spike changes, WebKit session test over HTTPS, transitions on real
  iOS Safari, Telegram WebView and Android WebView.

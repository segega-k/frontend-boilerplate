# 12. Master plan frame (orchestrator)

Status: done
Written by the orchestrator after reading the Summary and Open questions of reports 01–11. This frame is the input for
the master plan co-authored with the Fable agent.

## 1. Deliverable

- `research/12-master-plan.md`: Russian, 5–10 printed pages, readable in under 30 minutes, no filler. Tables over
  prose where it helps. Every claim traceable to a report (cite `[05]`, `[10]` etc. in brackets, not URLs).
- Then a PDF made from it by the orchestrator.
- Audience: the user (frontend lead, knows xRocket deeply). Do not explain basics. Explain choices and trade-offs.

Required sections (user's list, order can change):

1. What the boilerplate is and its functionality (one page max).
2. Template options: the 5 templates and init options, what each is for, what each sacrifices.
3. Technologies per template and the shared core; what we take from xRocket and what we drop, with the reason.
4. Architecture and code rules (short: structure, boundaries, state, data, errors; link to rules files).
5. AI practices: CLAUDE.md tree, rules, skills, hooks, settings, verify gate, memory policy, agent workflow, models.
6. Vibe-code design system: all hard rules (compact, grouped), modes Operate vs Persuade, DESIGN.md process, enforcement.
7. Pixel-perfect mode from Figma (module), with accesses needed and tolerances.
8. Init: how the template launch is managed (CLI, flags, steps).
9. Cleanup of unpicked templates (ownership manifest, graph pruning, rollback, CI matrix).
10. Security and backups (per template, agent safety, incident runbook in brief).
11. Human maintainability (two doc layers, runbooks, magic limits, emergency path).
12. Work order: phases with deliverables and exit criteria.
13. Decisions taken by the orchestrator (one table) and decisions the user must confirm (short numbered list, ≤ 8).
14. Risks and what must be verified on a real install.

## 2. Decisions taken by the orchestrator

The user delegated small decisions to the orchestrator. Recorded here; the Fable agent may challenge any with
evidence in `12-challenges.md`.

| Area | Decision | Source |
| --- | --- | --- |
| Templates | 5: landing, shop, tma, admin, game. Blog/docs, PWA, TON Connect, BFF, CMS, analytics, 3D are init options | 05 |
| Monorepo | pnpm workspaces + `catalog:` + Turborepo; no Nx | 02, 05 |
| Node | Node 24 LTS in `.nvmrc`, `engines`, Docker base | 05, tooling |
| Rendering | landing Astro static; shop Next standalone; tma/admin/game Vite SPA | 05 |
| Styling | Tailwind v4 with default theme reset to our tokens + CSS variables in `packages/tokens`; stylelint for plain CSS; kit on Base UI (shadcn approach, code in repo) | 02, 03, 05, 07 |
| State | No MobX/tsyringe/DI. TanStack Query for server state, Zustand for client state, a hook as the view model. "Logic outside the view" and "VM never navigates" stay | 01, 02, 05, 11 |
| API | Hey API (`@hey-api/openapi-ts`, exact pin), central error mapping as data in repo | 02, 05 |
| i18n | i18next everywhere, including shop | 05 |
| React Compiler | off by default at start, revisit after smoke builds | 05 |
| Game | 2D Phaser 4 only; 3D (R3F) deferred because it caps React for the whole monorepo | 05 |
| TMA/game outside Telegram | browser only for development (mock env); a second auth scheme is not in v1 | 05 |
| Shop | provider adapter pattern, Medusa v2 reference + mock adapter; hosted checkout by default (PCI scope) | 05, 10 |
| Analytics | Umami self-hosted default; GTM not allowed under strict CSP unless explicitly enabled | 05, 10 |
| Errors | Sentry SDK; DSN may point to Sentry SaaS or GlitchTip | 02, 11 |
| Deploy | docker compose on VPS as the default target; Helm chart optional later; one image per environment allowed for SSR apps, runtime env for SPA | 02, 05 |
| Docker | one multi-stage Dockerfile, targets `static` (nginx) and `node`; BuildKit secrets, non-root, digest pins | 05, 10 |
| Touch targets | 44px on touch templates (tma, game, mobile shop); denser admin desktop controls allowed | 03 |
| Em dash | forbidden as a decorative separator in UI; allowed in Russian full sentences where grammar requires | 07 |
| Docs language | human docs (README, ARCHITECTURE, runbooks, ADR) in Russian; AI docs in English | 04, 11 |
| Codex | not supported; one note on how to add AGENTS.md later | user |
| Rules location | canonical AI rules in `.claude/rules/*.md` with `paths:`; template context in `apps/<id>/CLAUDE.md`; one copy only | 04, 08 |
| Skills | committed in repo (no team plugin marketplace); template skills prefixed `<id>-` and removed by init | 08 |
| Memory | auto memory off in project; "запомни" goes to the repo via `/record-decision` | 04, 08 |
| Git by agent | commit only on direct request (ask); push only on direct request (ask); force push and branch deletion denied | 08, 10, user |
| Permission mode | `acceptEdits` default; commands outside allowlist ask | 08 |
| Project agents | pinned to `model: opus`, `effort: medium`; Fable never used by project agents | user |
| Plans | `.work/plans/` gitignored | 08 |
| Verify gate | single `pnpm verify` used by skill, Stop hook (light), pre-commit, CI, init; `pnpm ai:check` drift tests | 04, 08 |
| Secrets scan | secretlint in pre-commit, gitleaks in CI (also over `dist/`) | 10 |
| Agent isolation | Windows: deny/ask + guard hook + no push rights + branch protection; WSL2/devcontainer recommended for long autonomous runs | 10 |
| Signed commits | recommended, not mandatory in v1 | 10 |
| Figma | pixel-perfect pipeline is an init module `figma` (removed when not picked); `data-figma` attribute stripped in prod; `design:fidelity` blocking only when the module is on | 09 |
| Anti-slop | stylelint/ESLint rules on error from day one; `design:scan` report-only for the first 1–2 projects, then blocking | 07 |
| Init | deletes itself after success (`--keep-init`); dependency update within ranges by default; `add` command is v2; distribution by git clone / template repo; prints a suggested commit command but never commits | 06 |
| Hotfix | `pnpm check:hotfix` (typecheck + unit + build) officially allowed; review after the fact | 11 |
| Flags | runtime `/config.json` kill switches with owner and expiry; no external flag service in v1 | 11 |
| Deploy config | CI templates and deploy docs live in this repo | 11 |
| Start order | core packages → tma → admin → game → landing → shop (05 recommendation) | 05 |

## 3. Questions that stay with the user (candidates, keep ≤ 8 in the plan)

1. Two meta-frameworks in one monorepo (Astro for landing + Next for shop), or one SSR stack.
2. Dropping MobX MVVM + DI in favour of Query + Zustand + hook view models.
3. Comments rule: keep "no new comments" or allow short "why" comments in 4 cases [11].
4. `types.ts`/`consts.ts` always separate (enforced by lint), or `Props` and one-off constants allowed inside the
   component file [01].
5. Git host for CI templates: GitHub, GitLab or both.
6. Figma plan and seats (decides whether the pixel-perfect module works at all) [09].
7. Shop target market (RU/CIS providers vs international) [05].
8. Human docs language confirmation (Russian) if contractors may join.

## 4. Process with the Fable agent

1. Fable reads this frame, then all reports (Summary, Recommendations, Open questions fully; Findings as needed).
2. Fable writes `12-challenges.md` first: disagreements with the frame, gaps, contradictions between reports, risky
   assumptions. Short and concrete.
3. The orchestrator answers the challenges (message), then Fable writes `12-master-plan.md`.
4. The orchestrator reviews against the reports and the user's preferences, sends corrections, Fable revises.
5. The orchestrator builds the PDF.

## 5. User decisions after the frame (2026-10-14, override §2–§3)

1. Landing on Astro: confirmed.
2. State: MobX where a state manager is needed (plain classes, `makeAutoObservable`, no tsyringe/DI, no decorators);
   TanStack Query for server state; no Zustand, no Redux; React Compiler off.
3. Comments only where code cannot be understood without them; they explain how the feature works.
4. Strict separate `types.ts` / `consts.ts` / `utils.ts` and a separate sibling styles file per component. Styling
   approach re-researched by agent 13 (`13-styling.md`).
5. GitHub is the primary git host.
6. Blog is a separate mandatory template: 6 templates (landing, blog, shop, tma, admin, game).
7. Figma: mostly view-only access, edit can be requested, most likely no paid plans. Pixel-perfect module must
   work within free-plan limits (bulk export via plugin, PNG/SVG frames, manual Dev Mode values as fallback).
8. Shop: both markets (RU/CIS and international) via one adapter interface, plus a mock adapter.
9. Styling (orchestrator, after report 13): Tailwind v4.3 with classes only via tailwind-variants `tv()` in a sibling
   `Name.styled.ts`; `.tsx` only calls the recipe. Fallback: CSS Modules + CSS variables. Kit closed for external
   `className`. Listed for user confirmation.

## 6. User answers to confirmations (2026-10-15)

1. Astro and Next in different templates: accepted. 2. Tailwind via tv() in Name.styled.ts: confirmed.
3. TMA theme: brand-capable, Telegram theme by default, easy customization. 4. Admin auth: PKCE default with BFF
threshold. 5. Figma exporter run by the user. 6. All human docs in English; README also as README.ru.md.
7. Canvas games: separate future template on PixiJS (not an init option). 8. Orchestrator mode: on request only.
New rules: no design initiative when a ready design exists; smooth screen transitions in every template; every
template targets macOS, Windows, iOS, Android with touch, mouse and keyboard.
New template requested: universal SSR "site" (agent 16, `16-site-template.md`).

## 7. Pending for round 3 (2026-10-15)

- Add template `site` per [16] (Next 16 App Router); shop = site + `commerce` preset or separate app — waiting for the
  user's answer.
- Transitions: SPA templates use the shared fade `ScreenTransition`; `site` uses React `<ViewTransition>` with the same
  CSS fade as fallback for iOS < 18 / old WebViews (reconcile with round 2 wording).
- New skill requested by the user: `onboard` (name may change). After a template is built by init, an agent runs it
  to read the whole context — root CLAUDE.md, `.claude/rules`, `apps/<id>/CLAUDE.md` and README, `packages/*/CLAUDE.md`
  of used packages, ARCHITECTURE.md, DESIGN.md, ADRs, `.boilerplate.json` (which templates/options) — then builds a
  short in-session summary (stack, commands, rules, where things live, deliberate decisions) and from then on writes
  code exactly as the docs say. Must be idempotent, cheap (reads, no installs), and referenced from the root CLAUDE.md
  session-start section; init's final message tells the user to run it.
- User (2026-10-15): shop is in practice a separate application but structurally a superset of site → template
  `site` with sub-templates `site/base` and `site/shop` (one Next app per project); further sub-templates on roadmap.
  Round 3 sent to the Fable co-author.
- User (2026-10-15): packages/lottie is mandatory only for game; opt-in option `lottie` for other React templates (tma, site, admin, Astro islands). Not part of the tma base.

## 8. User requirements (2026-10-15, round 5)

- Error mapping exactly like xRocket wherever the frontend calls a backend: automatic interceptor + toast handling;
  xRocket interceptors with a non-closable full screen for banned / no internet. Translation files sorted like
  xRocket. Research: agent 18 (`18-error-mapping.md`).
- Per-project utils site built on `C:/Работа/xrocket-tools-master`: edit error texts, view/edit every language,
  self-written component gallery. Every project larger than a landing has a component catalog; step 1 of the AI
  design process is building it. Storybook vs gallery in utils decided by the orchestrator after agent 19
  (`19-utils-site.md`).
- Orchestrator decision (2026-10-15): one Storybook 10 in packages/ui (+ app stories via glob) embedded as the Catalog tab of apps/utils; no self-written gallery. [19]
- User (2026-10-15): only the user edits texts for now → apps/utils is local-only; `utils-deploy` stays a late option.
  Crowdin: init option, off by default (texts edited in utils Texts tab).
- Showcase lessons (awaaz `/showcase`): kit components get a mandatory "Matrix" story (all variants × sizes × states,
  captioned specimens, RTL specimen, realistic data); the utils Catalog tab opens a showcase-style overview page (index +
  all Matrix stories on one scroll, theme/locale/width switches); no showcase routes inside product apps (check).
  Storybook starts together with utils by one command.
- Orchestrator decisions on [18] (2026-10-15): transport openapi-typescript + openapi-fetch (exact xRocket mechanism,
  vendor if stalled; replaces Orval default); mapping JSON in repo; error texts in i18n `apiErrors`; NET toasts via
  onError; `maintenance` AppStatus + screen; auto-recover no-network on `online`; per-request toasts on SSR.
  Round 5 sent to the Fable co-author.
- User (2026-10-15): agents must know the utils tool and add/edit error mappings and texts themselves (CLI --json + /errors-map skill, shared validation; agent texts marked draft for user approval; exception to 'never invent texts' for error texts only).

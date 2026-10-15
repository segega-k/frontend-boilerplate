# 0002. Template set and `site` sub-templates, one Next app per project

- Status: Accepted
- Date: 2026-10-15
- Deciders: user, orchestrator

## Context

Projects range from promo pages to Telegram Mini Apps, admin panels, casual games and SSR sites with accounts or
commerce. One rendering model does not fit all: static pages need no runtime, Mini Apps and admin need no SSR, SEO
sites need SSR. A shop turned out to be structurally a superset of a universal SSR site. Two Next apps in one project
would double the heaviest runtime and its cache model.

## Decision

Six templates, any subset per project:

| id | Purpose | Rendering |
| --- | --- | --- |
| `landing` | promo, marketing | Astro static, React islands, nginx; option `landing-node` |
| `blog` | articles, authors, RSS; option `docs` | Astro static; shared layer `packages/astro-shared` |
| `site` | sub-template `base` (universal SSR site with account) or `shop` (base + commerce) | Next App Router + Cache Components, Node standalone |
| `tma` | Telegram Mini App | Vite SPA, nginx |
| `admin` | admin, dashboard, SaaS cabinet | Vite SPA, nginx; option `bff` |
| `game` | casual mechanics in browser and Telegram | Vite SPA (see [0010](0010-game-stack.md)) |

- Exactly one Next app per project ("deliberate, do not fix"); a second one only through a future `add` command.
  `site/shop` adds `domains/commerce/`, the `(shop)` route group and `/api/revalidate`, which init removes for
  `site/base`.
- Shared core for all: React 19, Base UI kit, Tailwind via `tv()`, MobX + TanStack Query, smooth transitions, every
  device and input method, error mapping like xRocket.
- Commerce default adapter is the project's own backend through OpenAPI (`packages/api` + mapping); `mock` for CI;
  Medusa and Shopify are optional adapters.
- Blog has a CMS on by default behind a loader interface (default adapter chosen in wave 2, Strapi first candidate).
- Init options are removed with their code, packages, docs and skills when not picked.

## Consequences

- Two meta-frameworks (Astro, Next) live in one monorepo; the kit must work in RSC, islands and SPA without
  framework imports (lint).
- Further `site` sub-templates (courses, media) and a `game-canvas` template are roadmap items.

## Alternatives considered

- Separate `shop` template on its own Next app: duplicates the site core; rejected by the user.
- One SSR stack for everything: SSR cost for SPA-only products; Astro is lighter for static content.
- React Router framework, TanStack Start, Vike for `site`: weaker cache model and view-transition integration [16].

## References

- `research/05-templates.md`, `research/16-site-template.md`, `research/17-stack-report.md`,
  `research/12-frame.md` §5–§7, `research/12-master-plan.md` §2, `research/21-user-validation.md` #8, #9.

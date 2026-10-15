# 0006. i18n catalog layout, `en` + `ru` by default, Crowdin optional

- Status: Accepted
- Date: 2026-10-15
- Deciders: user (locales, Crowdin off, texts edited in utils), orchestrator

## Context

Every template shows text; agents must never invent copy, and texts must be editable by the user without touching
code. xRocket's catalog format (`translations/{all,<locale>}/<ns>.json` with `all/` as the single source and a sync
script) worked well, but its API error texts lived outside the catalogs, in generated TS.

## Decision

- i18next everywhere: SPA templates directly, `site` through `next-i18next` with `[locale]` routing (option
  `i18n-routing`), Astro only on the server.
- Catalogs in the xRocket format: `shared/i18n/translations/{all,<locale>}/<ns>.json`; `all/` holds every leaf as
  `{ en, ru }`; `sync` splits it into per-locale files; validators and `i18n:check` live in `packages/i18n/tools`;
  pre-commit runs `sync`. Eager namespaces only `common` and `notSorted`; others lazy.
- Default locales: `en` and `ru` only; init can add more.
- API error texts live in the `apiErrors` namespace of the same catalogs, never in generated code.
- Texts are edited by the user in the utils Texts tab (see [0008](0008-utils-site.md)); agents never invent texts,
  except draft error texts written through `/errors-map`, marked `draft` for approval.
- Crowdin is an init option, off by default; when on, its source is `en/*`.
- Checks: every key on every locale, `{{param}}` placeholders match, plurals valid, unused keys reported; `lint:copy`
  scans texts for banned patterns.

## Consequences

- One place for all texts, reviewable in diffs; the utils site and CLI share one validation library.
- Adding a locale means filling `all/` for every key; the gate fails until it is complete.

## Alternatives considered

- Per-locale files as the source (no `all/`): drift between locales.
- Error texts inside mapping files (xRocket): outside checks and translation tools.
- Crowdin on by default: an external service the user does not need yet.

## References

- `research/18-error-mapping.md` §3, `research/19-utils-site.md` §2, `research/12-master-plan.md` §3.1,
  `research/12-frame.md` §8, `research/21-user-validation.md` #16.

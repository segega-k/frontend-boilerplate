# Architecture decision records

Short records of decisions that shape the boilerplate and every project generated from it. Format: MADR-lite (Status,
Context, Decision, Consequences, Alternatives considered, References), one page each, English. Copy
[template.md](template.md) to start a new one.

## Index

| # | Decision | Status |
| --- | --- | --- |
| [0001](0001-monorepo-by-subtraction.md) | Monorepo built by subtraction: pnpm + Turborepo, ownership manifest, init | Accepted |
| [0002](0002-template-set.md) | Template set and `site` sub-templates, one Next app per project | Accepted |
| [0003](0003-styling-tailwind-tv.md) | Styling: Tailwind v4 through `tv()` in `Name.styled.ts`, typed variant props | Accepted |
| [0004](0004-state-mobx-query.md) | State: MobX plain classes without DI + TanStack Query via `MobxQuery v2` | Accepted |
| [0005](0005-api-client-error-mapping.md) | API client and error mapping exactly like xRocket, with fixes | Accepted |
| [0006](0006-i18n-catalogs.md) | i18n catalog layout, `en` + `ru` by default, Crowdin optional | Accepted |
| [0007](0007-component-catalog.md) | One Storybook in `packages/ui` with Matrix stories as the component catalog | Accepted |
| [0008](0008-utils-site.md) | Local-only utils site that writes the repo; agents use its CLI | Accepted |
| [0009](0009-screen-transitions.md) | Screen transitions: View Transitions with fade fallback, minimum iOS 16.4 | Accepted |
| [0010](0010-game-stack.md) | Game stack: DOM + dotLottie pipeline, no canvas engine | Accepted |
| [0011](0011-ai-layer.md) | AI layer: CLAUDE.md tree, path rules, skills, guard hook, memory in repo and local | Accepted |
| [0012](0012-auth-adapters.md) | Auth adapters `api-login` and `oidc`, BFF threshold, 401 refresh policy | Accepted |
| [0013](0013-deploy-and-ops-defaults.md) | Deploy and ops defaults: compose on own servers, GitHub CI, observability off | Accepted |

## When to write an ADR

Write one when a decision:

- is hard to reverse (framework, state model, monorepo layout, data format of committed files);
- deliberately differs from the obvious default or from xRocket practice ("deliberate, do not fix");
- disables or relaxes a rule (for example `max-lines` above the limit, a lint rule turned off, a CSP relaxation);
- picks between options that a newcomer would reasonably question;
- is asked to be remembered as project knowledge ("запомни" through `/record-decision`) and is bigger than one rule line.

Do not write one for routine choices that a rule file or lint already fixes, or for a single task's implementation
detail.

## How

1. Copy `template.md` to `NNNN-short-slug.md` with the next free number.
2. Status `Proposed` until the user approves, then `Accepted`. Add a row to the index above.
3. Never rewrite an accepted ADR. To change a decision, write a new ADR and mark the old one `Superseded by NNNN`.
4. Reference sources (`research/` reports, rule files, incidents) so the reasoning can be checked.

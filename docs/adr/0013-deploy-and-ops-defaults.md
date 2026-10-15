# 0013. Deploy and ops defaults: Docker compose on own servers, GitHub CI, observability off

- Status: Accepted
- Date: 2026-10-15
- Deciders: user (own servers, GitHub only, Sentry and analytics off, no Helm), orchestrator (Caddy option)

## Context

Projects deploy to the team's own servers, web only, usually without Kubernetes. The repository is private, so GitHub
Actions minutes are limited. Third-party services (error tracking, analytics) need accounts, consent and CSP changes
that not every project wants. Some hosts already have a reverse proxy, others need TLS out of the box.

## Decision

- One Dockerfile per app; build on `node:24-slim`, runtime `nginx-unprivileged` (static SPA/Astro) or Node (`site`,
  BFF); images pinned by digest, non-root, BuildKit secrets. Runtime env for SPA via `/config.json`; `site` builds one
  image per environment (the Server Actions key is baked at build).
- Init generates `compose.yaml` for the picked apps. An optional Caddy service with automatic HTTPS is offered; it is
  off when an external proxy exists. No Helm chart for now.
- CI host: GitHub Actions only (Actions pinned by SHA); GitLab CI is removed from the waves. CI templates and deploy
  docs live in this repo.
- Sentry: off by default; an init option with a DSN (Sentry SaaS or GlitchTip). `/version.json` and `log.*` work
  without it.
- Analytics: off by default; an init option (Umami, GA4, Metrika, PostHog) with consent and the matching CSP.
- Kill switches: runtime `/config.json` flags with owner and expiry; no external flag service.

## Consequences

- A new project runs on any VPS with Docker; nothing external is required to start.
- Error visibility in production is lower until Sentry is enabled; runbooks must say how to enable it.
- Moving to Kubernetes or GitLab later needs new templates.

## Alternatives considered

- Helm chart by default: not needed now.
- Sentry and Umami on by default (first plan): extra services and consent work for projects that do not want them.
- GitLab and GitHub both: double maintenance for no current user.

## References

- `research/05-templates.md`, `research/10-security.md` §1, `research/11-human-maintainability.md` R7,
  `research/16-site-template.md` §6, `research/12-frame.md` §2, `research/12-master-plan.md` §3.1, §9,
  `research/21-user-validation.md` #14, #15, #28–#30.

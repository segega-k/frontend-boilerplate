# 0005. API client and error mapping exactly like xRocket, with fixes

- Status: Accepted
- Date: 2026-10-15
- Deciders: user (error handling exactly like xRocket wherever the frontend calls a backend), orchestrator

## Context

xRocket handles API errors in one layer: a `responseResolution` middleware on `openapi-fetch` clients looks up a
mapping by `(schemaPath, METHOD, status, body.type)` and shows a toast, a modal through `PageQueryGuard`, or hands the
result to the domain. Fatal states (banned, no network, server error) render a non-closable full screen. The user wants
this everywhere. xRocket's proven gaps: mappings pulled from an external Strapi service, texts inside generated TS,
only ~73 of ~237 paths mapped (unmapped endpoints show nothing), no `*_NET` toasts, maintenance only in legacy code,
toasts in a global container on SSR.

## Decision

- Transport: `openapi-typescript` + `openapi-fetch` (needed for `schemaPath`); our own generator of query/mutation
  factories from the spec plus mapping. Vendor `openapi-fetch` into `packages/api` if it stalls. Exact pins.
- Middleware chain `[appStatusGate, auth, maintenance, responseResolution, bannedGuard, retry, unauthorized]`, order
  fixed by a test. Matching: exact variant → any `METHOD_2xx` for success → `METHOD_ERR` → `null`. Surfaces: `toast`,
  `modal` (`_resolution` in body, `PageQueryGuard` on page root), `custom`, `silent`. Retries only in middleware, GET
  and ≥ 500 only. 401 policy: see [0012](0012-auth-adapters.md).
- `appStatus` computed in `AppStore`: `initial | app | no-network | server-error | banned | maintenance`. Any status
  other than `app`/`initial` unmounts the router and renders only the non-closable `FailureScreen`; the gate answers 503
  to every request.
- Mapping is data in the repo: `packages/api/src/errors/mappings/<svc>.json` with a JSON Schema, edited in utils or by
  CLI, compiled to TS. Texts live in the i18n namespace `apiErrors` (see [0006](0006-i18n-catalogs.md)).
- Fixes over xRocket: `*_NET` toasts via `onError` with dedup; `maintenance` status and screen (503 + problem type,
  configurable); `no-network` recovers on `online` + health ping; per-request toasts on SSR; imports only through the
  `@repo/api` barrel (lint). Backends follow problem+json with `type`.
- `site` uses the same mapping in its server fetch layer: server errors go to error boundary / `not-found`, client
  errors to toasts and modals.
- An endpoint is not done until it has a mapping (`ERR`, `NET`, 2xx) and texts on all locales; `errors:check` in the
  gate. Agents add them through CLI and `/errors-map`; agent texts are marked `draft` (see [0008](0008-utils-site.md)).

## Consequences

- No silent errors; coverage is enforced, not hoped for.
- `openapi-fetch` is in maintenance mode: vendoring risk accepted. Our generator is code we maintain.
- Commerce SDKs and other clients are wrapped in the same mapping.

## Alternatives considered

- Orval (first stack-report default): needs an operation → path-template adapter for the mapping key.
- Hey API: same mismatch; not the xRocket mechanism.
- Strapi or another external service as mapping source: needs secrets, not reviewable in PRs.

## References

- `research/18-error-mapping.md` §1–§5, `research/12-frame.md` §8, `research/12-master-plan.md` §3.1, §4,
  `research/21-user-validation.md` #17, #18.

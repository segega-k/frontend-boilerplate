# 0012. Auth adapters `api-login` and `oidc`, BFF threshold, 401 refresh policy

- Status: Accepted
- Date: 2026-10-15
- Deciders: user (adapter-based auth, init asks), orchestrator (401 policy)

## Context

Backends differ from project to project: some expose their own login endpoint, some sit behind an OIDC provider
(Keycloak, Zitadel, Auth0). A single default provider would be wrong for many projects. Tokens in the browser are
exposed to XSS; IETF guidance moves sensitive apps to a backend-for-frontend (BFF) with httpOnly cookies. xRocket's 401
handling clears the session only when the 401 answers a request made with the current token, and has no refresh.
Telegram Mini Apps authenticate with `initData`.

## Decision

- Auth is adapter-based in every template that has auth, behind `app/auth` (SPA) or the session layer (`site`). Init
  asks which adapter; no default provider is assumed:
  - `api-login`: the project's own login endpoint, through a BFF with a cookie session;
  - `oidc`: Authorization Code + PKCE in the browser (`oidc-client-ts`), or through a BFF (`openid-client`).
- BFF threshold: client-facing SaaS cabinets, money, personal data → BFF (`bff` option in `admin`, `auth-bff` on by
  default in `site` and required by `site/shop`). Internal tools may use browser PKCE with tokens in memory, never
  `localStorage`.
- `site` session: `__Host-` HttpOnly cookie, API tokens only on the server, DAL `getSession()` checked at the data, not
  in proxy or layout.
- 401 policy: with a BFF the server refreshes transparently (single-flight per session). Without a BFF the client does
  a single-flight refresh on 401, retries the request once, and on failure applies the xRocket rule: clear the session
  only if the 401 answered a request made with the current token.
- `tma`: `initData` → backend validation → session is a required backend contract documented in the tma template
  docs; `initData` and Stars invoices are validated only on the backend.
- Realtime: `packages/realtime` takes an auth hook; the one-time ticket flow has no code, only an AI rule describing
  the expected backend contract.

## Consequences

- Init must ask and wire the chosen adapter; both adapters need e2e coverage.
- BFF adds a Node runtime to otherwise static SPA deployments.
- Refresh logic lives in one middleware; parallel requests never trigger parallel refreshes.

## Alternatives considered

- PKCE in the browser as the only default (first plan for admin): wrong for own-login backends and sensitive apps.
- Always BFF: forces Node for internal static admin panels.
- oauth2-proxy sidecar: less code but less control over refresh and CSRF; possible later as an alternative.

## References

- `research/05d-admin.md` (auth), `research/17f-admin.md` §2.7, `research/16-site-template.md` §5–§6,
  `research/18-error-mapping.md` §1, `research/10-security.md` §1.3, `research/12-challenges.md` #26,
  `research/21-user-validation.md` #5, #6, #10, #18.

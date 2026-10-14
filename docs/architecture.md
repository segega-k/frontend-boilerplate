# Architecture

Rules here are stack-agnostic. Where a past project used a concrete library (MobX + DI, TanStack Query, openapi-fetch,
Tamagui), the principle is stated here and the library mechanics are in [library-notes.md](library-notes.md).

## 1. Split by business domain

```
src/
├── app/        composition root: providers, init pipeline, routes table, global handlers
├── domains/    one folder per business domain (wallet, catalog, checkout…); a domain owns its pages
│   └── <domain>/
│       ├── pages/<page>/   page slice: <Page>.tsx + ui/ model/ api/ lib/ (only the segments it needs)
│       ├── shared/         code shared inside this domain only
│       └── index.ts        public API of the domain
├── common/     cross-domain code
│   ├── pages/      routed pages that belong to no single domain (auth, settings…)
│   ├── entities/   app-wide stores and their models (app, user, theme, toast…)
│   ├── widgets/    composite blocks reused across pages
│   └── shared/     no business knowledge: ui/, api/, lib/, config/, i18n/, assets/
└── stories/
```

**Why domains and not technical folders.** Splitting by type (`pages/` apart from `dialogs/`) spreads one feature over
several trees. Everything about a domain lives in one folder; its page, its forms and its socket service sit together.

**What did not work in the past project and is not repeated:**

| ❌ Past practice                                                  | Problem observed                                                        | ✅ Here                                       |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------- |
| Six FSD layers inside every domain (entities/features/widgets…)  | Filled formally: "entities" with only UI, page state in entities        | Add a segment only when it has real content  |
| `index.ts` on every slice, `export *`                            | 200+ barrels, noise, workaround barrels "for the linter"                | One `index.ts` per domain and per shared UI component; explicit named re-exports |
| Folder per domain of 1–2 files                                   | Empty structure                                                         | Small domains live in `common/`              |
| One god routes file (1200 lines)                                 | Everything conflicts there, screens registered three times              | Routes table per domain, composed in `app/`  |
| Business components inside the shared UI kit                     | Kit depends on stores and domains                                       | Shared UI is props-only (§3)                 |
| Doc per folder (`CONTEXT.md` everywhere)                         | Went stale, referenced files that no longer exist                       | A few docs, each rule tied to a check        |

## 2. Import rules

Direction: `app → domains/<d>/pages → common/widgets → common/entities → common/shared`.

1. `common/**` never imports `domains/**`.
2. A domain never imports another domain's internals. Cross-domain needs go through the other domain's `index.ts`, or
   the code moves to `common/`. (In the past project a strict "domain never imports domain" ban pushed coupling into
   global singletons instead; allow explicit composition through public APIs.)
3. `shared` never imports `entities`, `widgets`, `pages`, `app`. This is where the past project broke its own rules
   most often (dozens of shared UI files reading app stores), because no check enforced it.
4. No relative imports across slices (`../../`). Inside a slice relative imports are fine; between slices use the `@/`
   alias.
5. Generated API code and error mappings are imported only through the API barrel (direct imports caused
   module-initialization cycles).

Every rule must be machine-checked (lint rule or a small test that scans imports). Lessons:

- In ESLint flat config a later block with the same rule **replaces** the earlier one entirely. Several bans were
  silently switched off this way. Keep each restriction in its own rule or test.
- A public-API rule that only checks `@/` specifiers misses relative `../../` imports. Check both.
- A cheap alternative to lint plugins: one test file with `node:fs` that walks `src/`, extracts `from "…"` and fails
  with file, rule and reason.

## 3. Layers inside a page (view / view model / store)

The past project used MVVM with MobX; the principle holds for any state library.

| Layer          | Owns                                                        | Reads from                     | Never                                                 |
| -------------- | ----------------------------------------------------------- | ------------------------------ | ----------------------------------------------------- |
| **Store**      | domain state shared beyond one screen, server queries       | API, other stores (injected)   | browser globals in constructor, request-scoped data in a singleton |
| **View model** | screen state, derived values, orchestration of stores       | stores                         | navigation, platform SDK calls, `t()` in getters      |
| **Page root**  | creates the view model, mounts modals and the error guard   | view model only                | direct store access                                   |
| **Page view**  | rendering                                                   | view model only                | stores, direct API calls                              |
| **Widget**     | a reusable composite block                                  | global stores or its own VM    | page-load requests, the page error guard              |
| **Shared UI**  | primitives                                                  | props only                     | stores, observers, view models, navigation, i18n context it cannot get in Storybook |

Rules that came from real bugs and corrections:

- **Thin store, rich view model.** «все данные должны храниться в vm и взаимодействие с запросами через него же». The
  store holds the query; statuses, flags, counters and `pageState` are view model getters.
- **No forwarding wrappers.** Expose `state` once and an `updateState(partial)`; do not write `get x()`/`setX()` per
  field. Keep getters that transform, derive or combine.
- **Derive, do not toggle.** A phase is computed from state (`if (token) return 'widget'`), not switched by hand.
  Persisted filters are validated by an `effective*` getter, not "repaired" by a reaction.
- **Lifetime decides ownership.** Data shared app-wide and outliving the screen → store. Per-instance state, lifecycle,
  reset on unmount → view model. A ref-counted `activate/release` in a singleton means it wanted to be a view model.
- **One view model provider per component.** A second one in the same component silently drops the first from context
  ("VM not found" at runtime, invisible to TypeScript and tests). Resolve the second view model in a child component in
  its own file.
- **Release everything on unmount.** Reactions, timers, subscriptions, query `destroy()`, list `abort()`. Collect
  disposers and release them in one place. On web, focus/blur hooks may never fire.
- **Timers and subscriptions** are started by a reaction with immediate fire, not by a one-shot call on mount (a
  "dead timer" bug).
- **Component decides by its own map.** «пускай внутрь компонентов передается информация, а уже внутри компоненты сами
  определяют какую информацию показывать». A page view is pure composition: each block reads the page state, keeps its
  own state→content map in its `consts.ts`, and returns `null` when it has nothing to show. No god content map in the
  page, no JSX stored in constants.
- **A stateless presentational page** may live without a view model.

## 4. Server data

- Server data goes through the query layer (a query wrapper over TanStack Query in the past project). «почему не
  используешь MobXQuery?», «а почему Share не на танстак». Do not copy the outdated pattern from neighbouring code; new
  code follows the documented one.
- No mirrored `status` fields next to a query. `refetch()` does not reject, so a try/catch mirror shows success on a
  failed request. Read the query's own status.
- Queries activate when the view reads them. Calling `refetch()` on mount as well gives a double request. Imperative
  fetch only for disabled queries: enable, then refetch.
- "Always refetch when the page opens" is one option on the query (`refetchOnMount: 'always'`), not imperative code.
- Request options are passed as an argument, not spread over generated options («формат …api нужно реализовать без …»).
- Everything read inside the query's params closure is a reactive dependency of the key; read the language there.
- Mutations: generated factories by default; a manual one needs a `['<method>', '<path>']` key so the error mapping can
  find its message, and must throw on `error || !data` (the fetch client does not reject on HTTP errors).
- Cursor pagination is a dedicated list helper with a version guard and an AbortController, not a query.
- Request bodies and request constants live in the store, not on the page.
- Generated API files are never edited by hand. Types and error mappings are regenerated together, then typecheck.
  Review the diff for removals and narrowings (enums, optional fields); additions are safe.
- Values from the backend used as map keys are read defensively: `MAP[status] ?? FALLBACK`.
- Share links and link templates are built by the backend when possible, so the template lives in one place.

## 5. Errors

- One mapping layer decides how each endpoint × status × problem type surfaces: `toast`, `modal` (page error guard
  with retry), or `silent`. Components do not hand-roll try/catch + toast for API calls.
- «тост при падении именно из-за пост запроса не должен быть». A toast from a view model is only for errors of
  third-party SDKs, never for API calls the mapping layer handles.
- An endpoint missing from the mapping shows no UI at all. Report such gaps.
- The page error guard is rendered only in the page root and takes only page-load GET queries. Mutations and lazy
  queries never go into it.
- Fatal app states (server error, no network, banned) are a full-screen state decided at the app level.
- Error text lookup order when the backend sends a translatable detail: translated detail → table by problem code →
  HTTP status. Show the request id so support can find the log.
- Middleware order matters and is covered by a test (auth → response resolution → retry → 401 handling). Retry lives
  in middleware, the query client has `retry: false`, otherwise retries double.
- On 401 clear auth and user stores; the auth guard redirects reactively.

## 6. Navigation

- One typed universal navigation hook with explicit `goToX` methods works at any depth on every platform. The platform
  router API is allowed only in a page root.
- «как так вообще получилось что навигацию пропсом перекидывали?». The component that owns the button calls
  navigation itself. No `onGoToX` props.
- Leaving a dead-end screen (not found, error, end of a flow) resets the stack, otherwise "back" returns to the dead end.
- A view model never navigates. It exposes a semantic signal; the view reacts and navigates, then resets the signal.
- A new screen: register the route, add `goToX` to the hook types and every platform implementation, add the web URL
  pattern (most specific first), declare its i18n namespaces, register its back fallback, add deep link config and a
  test row. Check that the path is not already taken: an earlier declaration silently wins.
- Every screen has a back fallback (e.g. to Home). One back handler per page, in the page root.
- Auth-only screens are wrapped in the auth guard; auth-dependent rows are hidden by the auth flag.

## 7. i18n

- `useTranslation('<ns>')` always with a namespace. Lazy namespaces must be declared by the screen or they render raw
  keys; a test and a lint rule guard this.
- The current language comes from the reactive app store, never from the i18n instance.
- No `t()` inside getters or computed values: the string freezes in the first language. Expose the key, translate in
  the view. `t()` at event time (toast) is fine.
- Namespaces are named after our entity, not after the Figma variable prefix («это не p2pKyc а просто Kyc»).
- Texts come verbatim from the provided dictionary, including punctuation and line-by-line bold. Missing text is
  reported, not written. Translations from the translation service are not "improved". Only when the user explicitly
  allows it («переводы сам переведи, там просто») may you translate simple keys yourself.
- Whole phrases with placeholders, never glued fragments (`"days ·" + n`).
- CI checks: missing keys, placeholder mismatches, every `t("…")` literal present in the base catalog, no raw keys on
  rendered pages. Known gaps go into a baseline file.
- Adding a namespace updates every test that counts namespaces (a hard-coded count once broke CI).

## 8. Platform and SSR safety

- Code shared between web, SSR and native never touches `window`, `document`, `navigator`, `localStorage` or a platform
  SDK at module level or in store/view model constructors. Read them lazily inside functions.
- The launch environment (TMA / web / native) is read once by the composition root and passed in as a context
  snapshot. Module-level code that runs before init reads it directly, otherwise it freezes on the default.
- Platform variants are files: `.web.ts(x)` and `.native.ts(x)`, not `Platform.OS` branches. A platform with nothing to
  do gets a no-op file. With three variants, do not keep the plain `Foo.tsx` (web would pick it up).
- A shared root barrel stays SSR-safe; helpers that import a platform SDK are exported from a separate barrel.
- Persistence goes through one SSR-safe adapter; no `typeof window` guards around it.
- Request-scoped data (tokens, cookies, geo) never goes into a singleton: on the server one instance serves all
  requests.
- Telegram API calls only after checking the environment is TMA. Native back button exists only in TMA; web needs a
  visible exit.
- Responsive logic reads the breakpoint from the app store, never `window.innerWidth`.

## 9. App composition root

- Provider order is fixed and documented.
- Render gate: navigation renders only when the app status is ready; a loader before that.
- The init pipeline runs once in a fixed order (hydrate → env/i18n → profile → app status). Do not split it.
- Lazy screens load through a retrying import; after repeated chunk failures the app reloads.
- Global side effects that must run before render live in dedicated files, not scattered in components.

## 10. Opt-in features, minimal core changes

- Behaviour features (scroll-to-focused-input and similar) are mounted by the page or modal that needs them, controlled
  from outside. Not in the router, not in base modal components («насколько вообще корректно добавлять такую небольшую
  фичу аж в Роутер»).
- A field component stays passive; the scroll container owns the scrolling logic («контроль только извне»).
- Changes to shared components are additive: optional props with defaults, no behaviour change for other consumers,
  proposed and justified before being made. Two optional props beat a copy of the component.
- Changes to a shared engine (deep links, routing, middleware): first explain the impact on other consumers, show test
  coverage and offer an alternative that does not touch the engine.
- Do not rely on side effects of third-party events to drive UI (auto-closing a widget on a status event proved
  fragile).

## 11. Migrating legacy

Three steps: introduce the new thing → switch consumers in batches, each batch its own commit → delete the old one. The
old component keeps working, gets a `@deprecated` JSDoc pointing to the replacement and an `Old` suffix when the new one
takes its name. No long-lived re-export shims.

## 12. Configuration and environment

- Env variables are declared in one key list, exposed through one `config` module, documented in `.env.example` with a
  description. Never hard-code hosts or URLs.
- Runtime env injection lets one image deploy to every environment.
- Legal and other important links are built by one helper, never typed as literals in several places.
- Financial math uses one decimal library consistently with the backend; plain JS numbers never hold money.

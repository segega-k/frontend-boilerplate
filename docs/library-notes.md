# Library notes

Knowledge tied to specific libraries from the past project. Applies only if a preset uses that library. Kept short:
the gotchas that cost time, not the library docs.

## Tamagui

- All `styled()` calls live in `<Name>.styled.ts`, never in `.tsx`.
- A node with more than two inline style props goes to `.styled.ts` (`key`, `onPress`, `testID`, `children` do not
  count). Inline only trivial cases: `<YStack gap="$8">`. A breakpoint ternary is not a reason to stay inline; pass the
  value as a prop or use variants.
- Tokens: numeric token = pixels (`$14` = 14px); there is no `$10` space token. Negative tokens exist (`$-12`).
- Media: `$gtMobile` ≥600, `$gtTablet` ≥1024, `$gtLaptop` ≥1280, `$gtDesktop` ≥1440; `$mobile`/`$tablet` are
  max-width and only for the reverse case.
- Theme-dependent values: `'$theme-light'` / `'$theme-dark'`. Child themes (`success`, `error`, `gray`) with
  `$color1..12`.
- `transition` must be in the base style, not inside a variant, or `hoverStyle` does not animate. Always an object of
  named CSS properties: `transition={{ opacity: 'medium' }}`, `'background-color'` not `backgroundColor`.
- `color` is dropped on non-text components; `currentColor` in SVG does not inherit from a frame. Use the icon's own
  `color="$token"`.
- `flex: 1` collapses to 0 inside an auto-height parent. Use `flexGrow: 1; flexShrink: 1; minHeight: 0` and a numeric
  `maxHeight` on the parent.
- Hover/press/focus styles apply to the element itself, not its child. Full-bleed highlight without an absolute layer:
  `marginHorizontal: '$-12'` + `paddingHorizontal: '$12'`.
- `Dialog.Close asChild` already calls `onOpenChange`; an extra `onPress` closes twice.
- Sheet swipe needs `Sheet.ScrollView`. Sheet `max-height` must be an integer or it jerks on open.
- Button always gets `tabindex=0`; a disabled affix should render a plain frame.
- Web: `keyboardType` is dropped, use `inputMode`; `autoFocus` works only on web.
- After theme changes delete the `.tamagui` cache folders and restart the dev server.
- An empty `componentThemes` cut inline CSS from 549 KB to 165 KB.
- Atomic CSS: removing a rule can shift the order of others.
- Icons: `@tamagui/lucide-icons-2`.

## React Native Web

- `ScrollView.scrollTo` is overridden with an RN signature `{x, y, animated}`; `{top}` is ignored and jumps to 0. For DOM
  scrolling call `Element.prototype.scrollTo.call(node, { top, behavior: 'smooth' })`, lazily (SSR).
- `className` is dropped by `createDOMProps`.
- `onLayout` on web uses ResizeObserver and fires only on size change; `onLayout.y` is relative to the parent.
- `Linking.openURL` becomes `window.open`.
- A ScrollView with `flex: 1` + `minHeight: '100%'` in a non-flex parent grows with content and stops scrolling.
- In Vitest a pressable renders as a `div`; assert variant attributes, not roles.

## MobX + DI (tsyringe)

- Store: `@provide.singleton()`; view model: `@provide.transient()`, `implements ViewModel` (not `extends`:
  `makeAutoObservable` does not work with subclasses), `makeAutoObservable(this, {}, { autoBind: true })`.
- Queries declared `readonly` without initializer and assigned in the constructor after DI params. A class-field
  initializer runs before `this.appStore` is set (TDZ bug visible only in production builds).
- `makeAutoObservable(this)` is the last line of the constructor. Writes after `await` go in `runInAction`.
- `configure({ enforceActions: 'always' })`.
- Observable fields have default values; `null` rather than `undefined`.
- `reaction(expr, (cur, prev))` instead of `onViewUpdated` to track transitions; `createAtom` for read-driven activation.
- Lifecycle: `MountedSync → Mounted → Focused`; `onViewUnmounted` runs in the next microtask (StrictMode-safe). Focus
  and blur may not fire on web.
- `syncProps` of the view model provider runs every render: the action must be idempotent with an early return.
- On SSR singletons are container-scoped: one child container and one QueryClient per request.
- Persistence via `mobx-persist-store` only behind the project adapter; `meta: { persist: true }` never on private
  user data.

## TanStack Query v5 / openapi-fetch / openapi-react-query

- openapi-fetch does not reject on HTTP errors; throw manually.
- `refetchOnMount: 'always'` bypasses `staleTime`. `select` runs only on success and is recomputed only when data or
  options change (a mock in `select` of a singleton store does not update with HMR; mock in a view model getter).
- In v5 `onSuccess` fires before the state is dispatched: `mutation.data`/`status` are stale inside it; use callback
  arguments. `mutate()` on a new call clears `mutation.data`; latch values that must survive.
- Defaults: `gcTime` 5 min, `refetchOnWindowFocus: true`. `retry: false` in the client when retry lives in middleware.
- Endpoints with a side-effect check: `retry: false`, `staleTime: Infinity`.
- Lists with filters: `placeholderData: keepPreviousData`.
- Query key shape of openapi-react-query: `['<method>', '<path>']`.

## i18next

- `defaultNS` plus a small eager set; everything else lazy.
- `Trans` with `components={{ b: <Strong /> }}` for partial markup.
- `ru` plural forms `one/few/many/other` are checked for completeness.
- Translation service notes (e.g. Crowdin) for context.

## Vike (SSR)

- `+config.ts` is transpiled in a separate esbuild pass without the `@/` alias; files it imports must be import-free.
- A nested `+config.ts` overrides its parent. Guards are not inherited.
- `<ClientOnly>` is deprecated in favour of `clientOnly()`.
- Packages shipping TS sources (e.g. `react-native-svg` through some icon sets) need `ssr.noExternal`.
- `+Page.tsx` is a separate page root; view models and views are shared, page roots are not.

## Telegram Mini App (`@twa-dev/sdk`)

- Read the SDK in one place (launch context) and pass a snapshot to stores.
- Back button: screens register a local handler (`true` = consumed, `false` = propagate); one global hook drives the
  native button. Top-level screens hide it.
- `visualViewport` does not react to the keyboard in the mobile client; use `viewportHeight`/`viewportStableHeight` and
  `viewportChanged`.
- A global scroll lock in `index.html` caused iOS jumps on focusing the second field; `focus({ preventScroll: true })`.
- Safe area: `--tg-safe-area-inset-top`, `--tg-content-safe-area-inset-top`.
- `startapp` ≤ 64 chars `[A-Za-z0-9_-]`.
- Sharing: `shareMessage(messageId)` with fallback to `switchInlineQuery`; outside TMA `navigator.share` (needs a user
  gesture; Safari may refuse after an `await`) with fallback to copy + toast.
- Haptics on success and section change; closing confirmation on transactional pages; header/background colors synced
  with the theme.

## Storybook

- CSF3 with `satisfies Meta<typeof X>`; controlled components through a decorator with `useState`.
- No DI and no i18n in the preview of the past project, hence props-only shared UI.
- The preview rendered a fallback font; do not judge typography from it.

## Sumsub WebSDK (KYC)

- iframe; nothing inside can be styled from outside. `adaptIframeHeight: false` + container CSS for a fixed height.
- `expirationHandler` must return a fresh token; check with the backend whether re-calling start spends an attempt.
- Status events are only a signal to re-fetch status from our backend, which is the source of truth.
- Geo, IP and VPN blocks are handled inside the widget without events: always keep a visible exit.
- Needs `Permissions-Policy: camera=(self "https://api.sumsub.com"), microphone=(…)` on the host page.

## IntersectionObserver pagination

Create and `observe()` in one effect; observe a dedicated sentinel after the list (1px with `marginBottom: -1` so it
does not shift layout and break visual tests), not the last card. Reset the loading flag on both success and failure.

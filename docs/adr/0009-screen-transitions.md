# 0009. Screen transitions: View Transitions with fade fallback, minimum iOS 16.4

- Status: Accepted
- Date: 2026-10-15
- Deciders: user (smooth transitions in every template), orchestrator (mechanism, minimum iOS)

## Context

The user requires smooth screen transitions in every template, on macOS, Windows, iOS and Android, in browsers and
Telegram WebViews. The View Transitions API is the cheapest way to animate route changes, but same-document VT exists
only from Safari/iOS 18 and cross-document VT from Safari 18.2; Telegram on iOS uses the system WKWebView. A transition
layer must not break CSP, must respect reduced motion, and must not snapshot the screen on every real-time update.

## Decision

- One API, `ScreenTransition`, in the kit: View Transitions where supported; otherwise a CSS fade of 200–240 ms;
  `prefers-reduced-motion` → instant (or a crossfade ≤ 150 ms, never movement). Durations come from tokens and stay
  within the 100–300 ms ease-out rule.
- Per stack:
  - SPA (`tma`, `admin`, `game`): TanStack Router `defaultViewTransition` with push/pop types, CSS fade fallback.
  - `site`: React `<ViewTransition>` wrapped in `PageTransition` per page, direction from `<Link transitionTypes>`
    helpers; nested `ViewTransition` always `default="none"`; fallback fade through `template.tsx` under
    `@supports not (view-transition-name: x)`, no inline script (CSP-safe).
  - Astro (`landing`, `blog`): native cross-document VT (`@view-transition { navigation: auto }`), no `ClientRouter`
    (it breaks `security.csp`).
- Real-time updates never go through `startTransition`/`useDeferredValue` inside a transition boundary.
- System back gestures play no directional animation (no double animation over the native swipe).
- Minimum supported iOS: 16.4. Older WebViews get the fade or an instant switch.
- Verified on iOS and Android WebView, Telegram and desktop in wave 0 and wave 1.

## Consequences

- Same feel everywhere with progressive enhancement; nothing breaks without VT support.
- Three integrations to maintain behind one API; device checks are manual (emulators lie).

## Alternatives considered

- Own `ScreenTransition` only (AnimatePresence/WAAPI), no VT: more code for exit animations.
- VT only: no animation on iOS ≤ 17.
- Astro `ClientRouter`: breaks CSP and turns the site into an SPA.

## References

- `research/16-site-template.md` §4, `research/17-stack-report.md` (transitions rows), `research/17e-tma.md`,
  `research/12-frame.md` §6–§7, `research/12-master-plan.md` §3.1.

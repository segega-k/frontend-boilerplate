# 0010. Game stack: DOM + dotLottie pipeline, no canvas engine

- Status: Accepted
- Date: 2026-10-15
- Deciders: user (no canvas engine, canvas games as a future template), orchestrator

## Context

The `game` template targets casual mechanics: wheel, slots and cases, cards, mines, in the browser and in Telegram.
Both real games studied (durak, Shakhter) are DOM games without a canvas engine. Phaser 4 (the first plan) costs about
352 KB gz without tree-shaking, handles Lottie poorly, duplicates the UI kit and hurts a11y and cold start. The real
performance risk is Lottie: dotLottie on the main thread is 4–6× slower; 60 fps on iPhone came only from a Worker +
OffscreenCanvas pipeline and video prerender. iOS refuses `play()` outside a gesture; CSP silently disables workers,
video and WASM.

## Decision

- `game` = Vite SPA + React + the shared kit + DOM/CSS animations on `transform`/`opacity` (WAAPI, Motion outside the
  kit) + dotLottie through `packages/lottie`.
- `logic/` is pure TS without React, MobX or DOM (ESLint), tested in Node. Animation math (spin/reel landing curves →
  CSS `linear()`, tick moments) is pure functions; the compositor executes.
- The outcome always comes from the server: tap → immediate spin-up → server answer → landing on the result; reduced
  motion shows the result at once; balance updates when the result is shown. Server events go through a presentation
  queue, never `setTimeout` chains.
- `packages/lottie`: `@lottiefiles/dotlottie-web` (exact pin, self-hosted WASM), Worker + OffscreenCanvas, video
  prerender for heavy scenes, `play()` inside the tap, `lottie:audit`, `.lottie` format. Mandatory for `game`, opt-in
  option `lottie` elsewhere.
- CSP profile for game (`worker-src 'self'`, `media-src 'self' blob:`, `wasm-unsafe-eval`) with an e2e test for
  silent fallbacks; `?perf=1` panel; measurements only on devices and production builds.
- Canvas games (hundreds of objects, shaders) are a separate future template `game-canvas` on PixiJS, not an init
  option. No 3D.

## Consequences

- Reuses kit, i18n, a11y and the error layer; small JS budget (≤ 180 KB gz).
- Scenes with hundreds of moving objects are out of scope until `game-canvas`.
- dotLottie is 0.x and breaks APIs between minors: exact pin and smoke builds.

## Alternatives considered

- Phaser 4 + React overlay: weight, weak Lottie, duplicated UI.
- PixiJS as an init option of `game`: user chose a separate future template instead.
- lottie-web: larger and slower in the tested scenes; `framer-motion`/`lottie-web` imports are banned.

## References

- `research/14-game-revisit.md`, `research/14a-game-web.md`, `research/15-game-session-lessons.md`,
  `research/17g-game.md`, `research/12-frame.md` §6 #7, `research/12-master-plan.md` §2, §3.2,
  `research/21-user-validation.md` #7.

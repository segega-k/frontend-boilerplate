# 17g. Шаблон game: глубокая проверка стека
Status: done
Updated: 2026-10-15

## Resume notes
- Done: всё. Версии сняты `npm view` (registry.npmjs.org) 2026-10-15; поддержка браузеров — `@mdn/browser-compat-data` 8.1.5 (локальный разбор `data.json`); содержимое пакетов `@lottiefiles/dotlottie-web@0.81.0`, `motion@14.2.0`, `@tma.js/sdk@4.0.0-rc.0` и `3.3.0` разобрано из tarball (`npm pack`); CHANGELOG Motion и релизы Colyseus/tma.js — GitHub.
- Next: ничего. Follow-up вне отчёта: прототип колеса + ленты + раздачи карт на mid-Android и iPhone в Telegram (по [14]).
- Sub-agent: нет.

## Summary (≤ 15 lines)
1. Дефолт из [14] (Vite SPA + React + kit + CSS/WAAPI/Motion + dotLottie в Worker) **подтверждается** свежими версиями: все базовые пакеты активны, релизы в сентябре–октябре 2026.
2. Версии на 2026-10-15: Vite 8.3.4, React 19.3.1, `@vitejs/plugin-react` 6.1.2, TanStack Router 1.170.44, `motion` 14.2.0, `@lottiefiles/dotlottie-web` 0.81.0, MobX 7.0.6 + `mobx-react-lite` 5.1.0, Query 5.104.2, i18next 26.4.5, Vitest 5.0.4, Playwright 1.64.1, Sentry 11.7.0, `pixi.js` 8.22.0.
3. **Motion дважды сменил мажор за 2 месяца** (13.0.0 — 2026-08-05, 14.0.0 — 2026-10-02). Изломы мелкие (`isValidProp` вместо опциональной `@emotion/is-prop-valid`, удалены внутренние API), но пин точный и `minimumReleaseAge` обязательны. Лицензия MIT.
4. dotLottie 0.81.0 подтверждён: WASM 1 238 072 B / **496 347 B gzip -9**; по умолчанию WASM грузится **с jsDelivr с откатом на unpkg** → `setWasmUrl` обязателен. **Новое:** `DotLottieWorker.setWorkerUrl()` позволяет убрать `blob:` из `worker-src` (CSP строже, чем в [14] R9). Пакет 0.x — любой минор может ломать.
5. **Колизей: клиент переименован.** `colyseus.js` застрял на 0.16.22 (2025-10-22); актуальный клиент — `@colyseus/sdk` 0.18.5 (линия 0.17 с 2026-01-09). Версия клиента привязана к версии сервера (внешний бэкенд) → realtime-опция = свой интерфейс транспорта + адаптер `@colyseus/sdk` *или* нативный WS.
6. **`@tma.js/sdk(-react)` 4.0.0-rc.0 вышел 2026-10-11** — полная перестройка API (каталог `features/*` → `components/*`, объекты-компоненты). Высокий риск ломки в ближайшие месяцы; стартовать на 3.0.23 (exact), изолировать в `packages/telegram-platform`.
7. iOS-порог: CSS `linear()` — iOS 17.2; View Transitions — 18.0 (cross-document 18.2); OffscreenCanvas 2D — 16.4, WebGL в OffscreenCanvas — 17; `navigator.vibrate` в iOS нет вообще; **`requestIdleCallback` в iOS Safari/WKWebView нет** — прогрев Lottie «в idle» из Шахтёра требует полифила (`setTimeout`/`scheduler`-обёртка).
8. Рекомендация: кривые колеса/ленты генерировать как **массив keyframes WAAPI** (работает с iOS 13.4) с `linear()` как оптимизацией при `CSS.supports`; либо Motion `animate()`, который сам проверяет `supportsLinearEasing`.
9. Переходы экранов — свой `ScreenTransition` (fade 240 мс) без View Transitions по умолчанию (подтверждено: iOS < 18 нет API); TanStack Router оставить для паритета с tma.
10. Звук: свой модуль Web Audio подтверждён (`howler` 2.2.4 без релизов с 2023-09); на iOS добавить `navigator.audioSession.type = 'ambient'|'playback'` (iOS 16.4+) — иначе поведение с беззвучным режимом непредсказуемо. `zzfx` 1.4.0 (2026-10-01) — опция.
11. Pixi-опция: `pixi.js` 8.22.0 жив (релиз раз в 2–4 нед.), `@pixi/react` 8.0.5 стоит с 2025-12 → для опции — императивный mount без `@pixi/react`.

## Findings

Обозначения: **[факт]** — проверено командой/исходником 2026-10-15; **[мнение]** — оценка.

### F1. Сводная таблица

Риск = вероятность ломающего изменения, требующего правок шаблона, в ближайшие 12 месяцев [мнение по истории релизов].

| Технология | Выбор + точная версия | Дата релиза | Здоровье | Риск 12 мес. | Вердикт | Источник |
| --- | --- | --- | --- | --- | --- | --- |
| Сборщик | `vite` 8.3.4 | 2026-10-08 | очень активно; патчи 6.4/7.3/8.1/8.2 одновременно 2026-10-06 | средний (Vite 9 возможен; Rolldown-ядро) | оставить | https://www.npmjs.com/package/vite |
| React-плагин | `@vitejs/plugin-react` 6.1.2 (peer `vite ^8`) | 2026-10-05 | активно; oxc-трансформ, Babel опционален | низкий | оставить, React Compiler выкл. | https://www.npmjs.com/package/@vitejs/plugin-react |
| UI-рантайм | `react` / `react-dom` 19.3.1 | 2026-10-14 | активно (19.3.0 — 2026-09-09) | низкий (React 20 не анонсирован в registry) | оставить | https://www.npmjs.com/package/react |
| Роутер | `@tanstack/react-router` 1.170.44 (code-based) | 2026-10-12 | очень активно (несколько релизов в неделю) | низкий (v1 стабилен; v2 не в тегах) | оставить, как tma | https://www.npmjs.com/package/@tanstack/react-router |
| Анимации JS | `motion` 14.2.0 (`motion/react`, `motion/react-m`, `motion/react-mini`); MIT | 2026-10-13 | очень активно; 13.0.0 (08-05) → 14.0.0 (10-02) | **высокий по номеру мажора, низкий по объёму** (изломы — внутренние API) | оставить, exact pin | https://github.com/motiondivision/motion/blob/main/CHANGELOG.md |
| Анимации нативно | WAAPI `Element.animate` + `Animation.finished` | — | iOS/WKWebView 13.4+, Chrome 36+ | нет | основа ленты/колеса | MDN BCD 8.1.5 |
| CSS easing | `linear()` | — | iOS 17.2+, Chrome/Android WebView 113+, Firefox 112+ | нет | использовать с проверкой `CSS.supports`, фолбэк — keyframes | https://developer.mozilla.org/docs/Web/CSS/easing-function/linear |
| Переходы экранов | свой `ScreenTransition` (Motion `AnimatePresence` или WAAPI), fade 240 мс | — | — | нет | оставить | [15 §C] |
| View Transitions API | не по умолчанию; progressive enhancement | — | `startViewTransition` iOS 18.0, options/types 18.2, Chrome 111, Firefox 144 | нет | только опционально при `document.startViewTransition` | MDN BCD 8.1.5 |
| Lottie-плеер | `@lottiefiles/dotlottie-web` 0.81.0 (exact), без `dotlottie-react` | 2026-10-06 | активно: 0.79.0 (08-06), 0.80.0 (08-28), 0.81.0 (10-06) | **высокий** (0.x, API менялся между минорами) | оставить, обёртка в `packages/lottie` | https://github.com/LottieFiles/dotlottie-web |
| Lottie запасной | `lottie-web` 5.13.0 | 2025-05-21 | поддержка: до этого 5.12.2 (2023-06) | низкий (не меняется) | не брать; light-сборка только как аварийный путь в docs | https://www.npmjs.com/package/lottie-web |
| Звук | свой `sound.ts` на Web Audio (+ `navigator.audioSession`) | — | AudioContext iOS 14.5+, audioSession iOS 16.4+ | нет | оставить | MDN BCD 8.1.5 |
| Звук, синтез | `zzfx` 1.4.0 (MIT), опция | 2026-10-01 | редкие релизы (1.3.2 — 2025-09) | низкий | опция | https://www.npmjs.com/package/zzfx |
| Звук, библиотека | `howler` 2.2.4 | 2023-09-19 | не развивается | — | не брать | https://www.npmjs.com/package/howler |
| Хаптика | Telegram `hapticFeedback` (`impactOccurred`, `notificationOccurred`, `selectionChanged`) через `packages/telegram-platform`; вне TMA — `navigator.vibrate` (Android), iOS — нет | — | `vibrate` iOS/WKWebView: не поддерживается | нет | оставить, no-op на iOS-вебе | MDN BCD 8.1.5 |
| Realtime | интерфейс транспорта; адаптеры: нативный `WebSocket` (по умолчанию) или `@colyseus/sdk` 0.18.5 | 2026-10-03 | Colyseus активно (сервер `colyseus` 0.18.9 — 09-30) | **высокий** (0.x, клиент привязан к серверу; 0.16→0.17 сменил имя пакета) | `colyseus.js` не брать | https://www.npmjs.com/package/@colyseus/sdk |
| Telegram SDK | `@tma.js/sdk-react` 3.0.23 / `@tma.js/sdk` 3.3.0 (exact) | 2026-07-14 | активно, но **4.0.0-rc.0 от 2026-10-11** | **высокий** (v4 = новый API) | оставить 3.x, миграция на 4 отдельным PR через `telegram-platform` | https://www.npmjs.com/package/@tma.js/sdk |
| Canvas-опция | `pixi.js` 8.22.0 (MIT); `@pixi/react` 8.0.5 — нет | 2026-10-01 | активно (8.19→8.22 за 4 мес.); `@pixi/react` без релизов с 2025-12-01 | средний (8.x минорные, v9 не в тегах) | опция `game-pixi`, императивный mount | https://www.npmjs.com/package/pixi.js |
| Клиентское состояние | `mobx` 7.0.6 + `mobx-react-lite` 5.1.0 | 2026-10-02 / 2026-09-24 | активно, мажор 7 свежий (июль–авг 2026) | средний (патчи после мажора) | оставить; VM + очередь презентации | https://www.npmjs.com/package/mobx |
| Серверное состояние | `@tanstack/react-query` 5.104.2 | 2026-10-11 | очень активно | низкий | оставить (лобби, баланс, история; не для кадров) | https://www.npmjs.com/package/@tanstack/react-query |
| API-генератор | `@hey-api/openapi-ts` 0.99.0 (exact) | 2026-06-22 | latest не обновлялся 4 мес., `next`-сборки до 2026-09-30 | **высокий** (0.x, скорое 1.0?) | по решению 17f; для game не специфично | https://www.npmjs.com/package/@hey-api/openapi-ts |
| i18n | `i18next` 26.4.5 + `react-i18next` 17.0.16 | 2026-10-14 / 10-06 | очень активно | низкий | оставить | https://www.npmjs.com/package/i18next |
| Unit | `vitest` 5.0.4 | 2026-10-12 | активно (5.0.0 — 2026-09-03) | низкий | `logic/` и планировщики в Node-окружении | https://www.npmjs.com/package/vitest |
| E2E | `@playwright/test` 1.64.1 | 2026-10-14 | ежемесячно | низкий | на прод-сборке (`vite preview`/nginx) | https://www.npmjs.com/package/@playwright/test |
| Ошибки | `@sentry/react` 11.7.0, lazy | 2026-10-12 | очень активно (v10 ещё патчится) | средний (мажоры ~раз в год) | оставить + `?perf=1` своя панель | https://www.npmjs.com/package/@sentry/react |
| Стили / kit | `tailwindcss` 4.3.3, `tailwind-variants` 3.3.1, `@base-ui/react` 1.9.0 | 07-16 / 08-03 / 10-09 | активно | низкий | оставить; `@base-ui-components/react` **deprecated** (переименован в `@base-ui/react`) | https://www.npmjs.com/package/@base-ui/react |
| Образ | nginx static: `application/wasm`, `video/mp4`, `immutable` для хешей и fingerprint `public/`, CSP-профиль | — | — | нет | оставить, CSP ужесточить (F4) | [14 R9], README dotlottie-web |

### F2. Motion 14 [факт → мнение]
- [факт] `motion` и `framer-motion` 14.2.0 — один код (`motion` зависит от `framer-motion` 14.2.0), лицензия MIT. Экспорты: `.`, `./react`, `./react-m`, `./react-mini`, `./react-client`, `./react-animate-view`, `./mini`, `./debug`, `./three`, `./vgpu`.
- [факт] CHANGELOG: 13.0.0 — удалена опциональная зависимость `@emotion/is-prop-valid`, теперь `<MotionConfig isValidProp>`; 13.2.0 — `set()` без `useDefaultValueType`; 13.4.x — убран JS-callback `ScrollTimeline`; 14.0.0 — удалены внутренние API, оставленные в 13.5.1 для совместимости; 14.1.0 — `animateLayout` (layout-анимации в vanilla JS) и фикс «layout-анимации внутри перетаскиваемых элементов»; 14.2.0 — аппаратное ускорение независимых трансформаций `x`/`y`/`scaleX`. `LazyMotion`, `layoutId`, `drag` в 13–14 без изломов.
- [факт] В `motion-dom` 14.2.0 есть `supportsLinearEasing` и генерация `linear(` — Motion сам переводит функцию-easing в CSS `linear()` для WAAPI там, где поддерживается.
- [мнение] Для шаблона: `LazyMotion` + `m` + `domAnimation` в app shell (переходы, `AnimatePresence`); `domMax` подгружать лениво только в `features/cards` (`layoutId`, drag). `motion/react-mini` `useAnimate` (≈2–3.5 KB) — для ленты/колеса. Drag на тач: `touch-action: none` на перетаскиваемой карте обязателен (иначе Telegram/браузер перехватывает свайп), плюс `swipeBehavior.disableVertical()` в TMA. Платные «Motion+» компоненты не использовать (не в npm `motion`).
- [мнение] Темп мажоров (2 за 2 месяца) — аргумент за `catalog:` exact + `minimumReleaseAge` и за то, чтобы `logic/` не импортировал Motion (так и есть в [14 R2]).

### F3. dotLottie 0.81.0 [факт]
- Размеры: `dist/dotlottie-player.wasm` 1 238 072 B, gzip -9 **496 347 B** (совпадает с [14a]); `dotlottie.worker.js` 77 756 B; `index.js` 165 443 B; `sideEffects: false`; экспорты `./webgl`, `./webgpu` с отдельными WASM.
- По умолчанию WASM — `cdn.jsdelivr.net/npm/@lottiefiles/dotlottie-web@0.81.0/...` с откатом на `unpkg.com` (найдено в `dist/index.js`). README: явный `setWasmUrl()` **отключает CDN-откат** — неверный путь даёт `loadError`, а не тихую загрузку с CDN. Вызывать `setWasmUrl` до `preload()`.
- `DotLottieWorker` по умолчанию создаёт воркер из `blob:` (нужен `worker-src blob:`). **`DotLottieWorker.setWorkerUrl('/…/dotlottie.worker.js')`** + `DotLottieWorker.setWasmUrl(...)` позволяют CSP без `blob:`; воркер только same-origin; файлы копировать из пакета при каждом обновлении (в Vite — `?url`-импорт `@lottiefiles/dotlottie-web/dotlottie.worker.js` даёт хешированный файл автоматически [мнение]).
- Релизы: 0.79.0 (2026-08-06), 0.79.1 (08-13), 0.79.2 (08-18), 0.80.0 (08-28), 0.81.0 (10-06) — каденс 1–6 недель. Проблем DotLottieWorker на iOS 2026 в поиске не нашлось; известен WebKit bug 274300 (OffscreenCanvas transfer, iOS 17.4.1, 2024) — держать откат на главный поток с причиной в `?perf=1`.
- Поддержка: OffscreenCanvas + `transferControlToOffscreen` + 2D-контекст — iOS/WKWebView 16.4+; WebGL в OffscreenCanvas — iOS 17 → для воркера использовать софт-рендер (основной entry), не `./webgl`.
- `lottie-web` 5.13.0 (2025-05-21; до этого 2 года тишины) — не альтернатива по умолчанию; полная сборка требует `unsafe-eval` для expressions.

### F4. Браузерные возможности по платформам (MDN BCD 8.1.5) [факт]
| API | iOS Safari / WKWebView | Chrome / Android WebView | Firefox | Последствие для шаблона |
| --- | --- | --- | --- | --- |
| CSS `linear()` easing | 17.2 | 113 | 112 | фолбэк keyframes для iOS 16.x |
| `startViewTransition` | 18.0 (options 18.2) | 111 | 144 | не базовый механизм |
| OffscreenCanvas 2D / transfer | 16.4 | 69 | 105 | порог Worker-пути |
| `requestIdleCallback` | **нет** | 47 | 55 | полифил для прогрева Lottie |
| `scheduler.yield` | нет | 129 | 142 | не полагаться |
| `navigator.vibrate` | **нет** | 32 | 16 | haptics только Telegram на iOS |
| `navigator.audioSession` | 16.4 | нет | preview | iOS: тип сессии для SFX |
| `ScreenOrientation.lock` | нет | 38 | 144 | в TMA — `web_app_toggle_orientation_lock` |
| `requestFullscreen` (элемент) | Safari iOS 16.4, WKWebView нет | 71 | 64 | в TMA — `viewport.requestFullscreen()` |
| CSP `wasm-unsafe-eval` | 16 | 97 | 102 | — |
| `worker-src` | 15.5 | 59 | 58 | — |
| `Navigator.wakeLock` | 18.4 | 84 | 126 | опционально для длинных раундов |

[мнение] Целевой минимум game: iOS 16.4 (OffscreenCanvas, audioSession, wasm-unsafe-eval), полный путь — iOS 17.2+. Telegram iOS = WKWebView версии ОС; Telegram Android = системный WebView (Chromium); Telegram Desktop Windows — Qt WebEngine (Chromium-основа, отстаёт на несколько версий), macOS — WKWebView.

### F5. Telegram SDK в game-режиме [факт]
- 3.3.0 и 4.0.0-rc.0 оба содержат fullscreen (`viewport.requestFullscreen`/`safeRequestFullscreen`/`exitFullscreen`, `FullscreenFailedError`), `miniApp.isActive` (Mini Apps 8.0 — активен/неактивен; `activated`/`deactivated`), `hapticFeedback.impactOccurred/notificationOccurred/selectionChanged`, `swipeBehavior`. Блокировки ориентации **нет как метода компонента** — только `postEvent('web_app_toggle_orientation_lock', { locked })` из `@tma.js/bridge`.
- 4.0.0-rc.0 (2026-10-11): структура `dist/dts/components/*` вместо `features/*` + `composables/*`; компоненты — простые объекты с `mount()`; `safe*`-варианты возвращают `Result`; `mockTelegramEnv` сохранён. README v4 на GitHub-релизах ещё не опубликован (первая страница релизов показывает 3.3.0 как последний).
- [мнение] Это «нормальная» точка ломки на 12 месяцев: весь шаблон должен импортировать SDK только из `packages/telegram-platform` (уже правило мастер-плана), тогда миграция — один пакет.

### F6. Realtime [факт → мнение]
- `colyseus.js` 0.16.22 (2025-10-22) не помечен deprecated, но линия 0.17+ выходит как `@colyseus/sdk` (0.17.0 — 2026-01-09, 0.18.5 — 2026-10-03; зависимости `@colyseus/schema` ^5, `msgpackr`, `ws`; optional peer `@colyseus/core` 0.18.x). Сервер `colyseus` 0.18.9 (2026-09-30), `@colyseus/core` 0.18.18. durak сидит на 0.16 [14 F1].
- [мнение] Клиент Colyseus обязан совпадать по минору с сервером, которым шаблон не владеет. Поэтому опция `realtime` = `animation/transport.ts` (интерфейс: `connect`, `send`, `onEvent`, `onPatch`, переподключение с идемпотентным ключом раунда) + адаптер `native-ws` по умолчанию; адаптер `colyseus` ставит `@colyseus/sdk`, версия выбирается в init под сервер. Пакет `colyseus.js` в шаблоне не упоминать.

### F7. Остальное
- Роутер [мнение]: TanStack Router оставить (лобби, игра, история, профиль; `startapp` → маршрут; BackButton ↔ роутер), а не «без роутера»: паритет с tma позволяет переносить игру маршрутом внутрь tma ([14] вопрос 3). Его `defaultViewTransition` не включать (iOS < 18) — переходы через свой `ScreenTransition`.
- Состояние [мнение]: MobX VM держит фазу раунда и **очередь презентации** (событие → `await animation.finished` → следующее); Query — лобби, баланс, история; покадровые значения — вне React и MobX (refs, WAAPI, плеер).
- Тесты [мнение]: Vitest 5 `environment: 'node'` для `logic/` (запрещённые импорты — ESLint); Playwright 1.64 против `vite preview`/nginx-образа; тест CSP: слушать `securitypolicyviolation` + проверять, что `packages/lottie` сообщил путь `worker` (Chromium-проект), что `fetch` WASM пришёл с собственного origin (ни одного запроса к jsdelivr/unpkg).
- Наблюдаемость: Sentry 11 lazy (после первого кадра) + своя `?perf=1`; Sentry не заменяет панель (на устройстве нужен отчёт текстом [15]).
- Образ [мнение]: CSP `script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; media-src 'self' blob:; connect-src 'self' <api> <wss>`; `blob:` в `worker-src` не нужен при `setWorkerUrl`; MIME `application/wasm` (в стандартном `mime.types` nginx ≥ 1.21 уже есть — проверить в образе), `video/mp4`; `Cache-Control: immutable` для `/assets/*` и fingerprint `public/`.

### F8. Замены и отклонённое
- `colyseus.js` → `@colyseus/sdk` (или нативный WS).
- `@base-ui-components/react` → `@base-ui/react` (старый deprecated).
- `@pixi/react` → императивный mount Pixi в `useEffect` (опция).
- `requestIdleCallback` → обёртка `idle(cb)` с фолбэком `setTimeout(cb, 1)` для iOS.
- `navigator.vibrate` на iOS — no-op; хаптика только через Telegram.
- `howler`, `lottie-web`, `dotlottie-react` (жёстко пинит web 0.81.0 и тянет компонент на главном потоке) — не брать.
- View Transitions — только progressive enhancement, не основа.

### F9. Что изменилось против мастер-плана / отчёта 14
1. Colyseus: в [14] «`colyseus.js`» → правильно `@colyseus/sdk` 0.18.x, версия под сервер; дефолт realtime — нативный WS.
2. CSP game: `worker-src 'self' blob:` → `worker-src 'self'` через `DotLottieWorker.setWorkerUrl` + `setWasmUrl` (CDN-откат отключается явно).
3. Новый риск: `@tma.js/sdk` 4.0.0-rc.0 (2026-10-11) — миграция в течение 12 мес.; Motion 13→14 за 2 месяца — пин и задержка релизов.
4. iOS: нет `requestIdleCallback` (прогрев Lottie), `linear()` только с 17.2 → кривые как WAAPI keyframes с `linear()` как оптимизацией; добавить `navigator.audioSession` в звук.
5. Pixi-опция без `@pixi/react`. Остальные версии мастер-плана (Vite 8, React 19, MobX 7, Vitest 5, Sentry 11, Query 5, motion 14, dotLottie 0.81.0) подтверждены.

## Recommendations for the boilerplate
1. **[P0]** `packages/lottie`: `DotLottieWorker.setWorkerUrl(workerUrl)` + `setWasmUrl(wasmUrl)` из `?url`-импортов пакета, `preload()` на роуте лобби; e2e-проверка «0 запросов к jsdelivr/unpkg». Обёртка над 0.x API — только здесь.
2. **[P0]** Кривые в `logic/reel` и `logic/spin` отдавать как `{ keyframes, durationMs }` (сэмплы), исполнитель в `animation/` выбирает `linear()` при `CSS.supports('transition-timing-function','linear(0,1)')`, иначе многоточечные keyframes WAAPI.
3. **[P0]** `catalog:` exact для `motion`, `@lottiefiles/dotlottie-web`, `@tma.js/*`, `@colyseus/sdk`, `@hey-api/openapi-ts`; Renovate-группа «game-runtime» с ручным мержем и smoke на устройстве.
4. **[P1]** `platform/idle.ts` (requestIdleCallback с фолбэком), `animation/sound.ts` с `navigator.audioSession`, `animation/haptics.ts` (Telegram → `vibrate` на Android-вебе → no-op).
5. **[P1]** realtime: интерфейс транспорта + `native-ws` по умолчанию; адаптер `@colyseus/sdk` по запросу init с выбором версии под сервер.
6. **[P1]** Orientation lock — функция в `telegram-platform` поверх `postEvent('web_app_toggle_orientation_lock')`; fullscreen только на мобильных.
7. **[P2]** Опция `game-pixi`: `pixi.js` 8.22 императивно; `@pixi/react` не ставить, пока не выйдет релиз после 2025-12.
8. **[P2]** План миграции `@tma.js/sdk` 4 — отдельная задача после выхода stable; адаптер изолирует.

## Open questions for the user
1. Минимальная iOS для game: 16.4 (Worker-путь Lottie, без `linear()`) или 17.2 (проще код кривых)? Предложение: 16.4 с фолбэком.
2. Realtime по умолчанию — нативный WebSocket, Colyseus только адаптером под версию вашего сервера: согласны?

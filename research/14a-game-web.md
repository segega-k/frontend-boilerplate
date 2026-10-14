# 14a. Casual game stack: web research
Status: done
Updated: 2026-10-15 13:30
## Resume notes
- Done: версии npm (registry.npmjs.org, снято 2026-10-15); gzip-размеры CDN-файлов (jsdelivr, `gzip -9`); esbuild-бандлы минимальных entry (esbuild 0.25.10, `--minify`, без code splitting, react external); проверка llms.txt и `skills/` в npm-пакетах; веб-поиск по Lottie, Rive, Pixi, Phaser, Motion, GSAP, TMA, звуку, a11y.
- Next: ничего. Возможный follow-up: прототип колеса на варианте A и замер на реальном mid-Android (Chrome DevTools remote, Performance panel) в Telegram-Android.
- Методика размеров: «gz» = `gzip -9` минифицированного файла; brotli на CDN/хостинге обычно даёт ещё −15–20 % [мнение]. Скрипты замера лежат в scratchpad `14a/` (не в репо).

## Summary (≤ 15 lines)
1. Для колеса/слотов/карт с серверным исходом **канвас-движок не нужен**: всё делается на DOM/SVG + transform/opacity + Motion (или GSAP) + dotLottie для «праздничных» вставок. Это вариант **A**, он рекомендуемый [мнение].
2. Lottie-плеер по умолчанию — `@lottiefiles/dotlottie-web` 0.81.0 / `@lottiefiles/dotlottie-react` 0.20.0 (релиз 2026-10-06, выходят каждые 2–6 недель): ThorVG-WASM 1.24 MB raw / **~496 KB gz**, JS ~14–33 KB gz, есть Worker, темы/слоты, state machines, markers, `setFrame`, `tween()` [факт].
3. `lottie-web` 5.13.0 — фактически в режиме поддержки (между 5.12.2 и 5.13.0 прошло ~2 года); light-сборка ~46 KB gz без WASM — хороший fallback/лёгкий путь для простых JSON-анимаций; полная сборка использует `eval` для expressions (CSP) [факт].
4. Rive (2.44.2, релизы еженедельно) — лучший для интерактивных state-machine кнопок/персонажей, но тяжёлый: WASM 315 KB gz (canvas-lite) … 903 KB gz (webgl2) + ~72 KB JS; экспорт из редактора платный с 20.10.2025 (Cadet $9/мес) [факт].
5. PixiJS 8.22.0 — живой (минорные релизы ~ежемесячно), простая сцена ~177 KB gz; `@pixi/react` 8.0.5 не релизился с 2025-12-01; официального Lottie-плагина нет [факт]. Оправдан при сотнях спрайтов/частицах/шейдерах [мнение].
6. Phaser 4.2.1 (352 KB gz, без tree-shaking) — избыточен для колеса/карт; React-оверлей дублирует UI-кит [мнение].
7. Звук: `howler` 2.2.4 (последний релиз 2023-09) всё ещё работает, но не развивается; для 5–15 коротких SFX достаточно тонкой обёртки над Web Audio (~1–2 KB) [мнение].
8. TMA: Telegram-Android добавляет в User-Agent класс устройства `LOW|AVERAGE|HIGH` — использовать для деградации эффектов [факт].
9. AI-агенты: pixi.js (26 SKILL.md) и phaser (36) поставляют skills в npm; у motion, gsap, rive, lottiefiles есть `llms.txt`; у LottieFiles есть skill `lottiefiles/dotlottie-web` в реестрах [факт].

## Findings

### 0. Версии и даты (registry.npmjs.org, 2026-10-15) [факт]
| Пакет | latest | Дата latest | Комментарий |
|---|---|---|---|
| @lottiefiles/dotlottie-web | 0.81.0 | 2026-10-06 | 0.79.2 → 0.80.0 → 0.81.0 за 2 мес. |
| @lottiefiles/dotlottie-react | 0.20.0 | 2026-10-06 | жёстко пинит dotlottie-web 0.81.0; peer react ^17‖^18‖^19 |
| lottie-web | 5.13.0 | 2025-05-21 | до этого 5.12.2 от 2023-06-13 |
| lottie-react | 3.1.2 | 2026-09-07 | обёртка над lottie-web ^5.13.0, peer React 18/19 |
| @lottiefiles/react-lottie-player | 3.6.0 | 2025-01-14 | не помечен deprecated, но стоит на lottie-web и не развивается |
| canvaskit-wasm (Skottie) | 0.42.0 | 2026-08-18 | |
| @rive-app/canvas / canvas-lite / webgl2 | 2.44.2 | 2026-10-10 | 3 релиза за 10 дней |
| @rive-app/react-canvas / react-webgl2 | 4.36.0 | 2026-09-30 | |
| pixi.js | 8.22.0 | 2026-10-01 | dev-сборки 8.22.x ежедневно |
| @pixi/react | 8.0.5 | 2025-12-01 | 10 мес. без релиза |
| @pixi/ui | 2.4.1 | 2026-10-01 | |
| @pixi/layout | 3.2.1 | 2026-06-12 | |
| @pixi/sound | 6.0.1 | 2024-07-27 | стоит |
| @assetpack/core | 1.7.0 | 2025-11-07 | |
| phaser | 4.2.1 | 2026-07-09 | 4.1.0 (04-30), 4.2.0 (06-19) |
| @esotericsoftware/spine-pixi-v8 | 4.3.13 | 2026-07-24 | (ветка 4.2.120 от 2026-08-30) |
| @esotericsoftware/spine-phaser-v4 | 4.3.13 | 2026-07-24 | |
| motion / framer-motion | 14.2.0 | 2026-10-13 | 14.1.0 → 14.2.0 за 4 дня |
| gsap | 3.15.0 | 2026-04-13 | |
| @gsap/react | 2.1.2 | 2025-01-15 | |
| @use-gesture/react | 10.3.1 | 2024-03-21 | не развивается |
| @dnd-kit/core | 6.3.1 | 2024-12-05 | стабильная, стоит |
| @dnd-kit/react | 0.5.0 | 2026-06-11 | новый API, ещё 0.x (беты 0.5.1 в 09.2026) |
| howler | 2.2.4 | 2023-09-19 | |
| zzfx | 1.4.0 | 2026-10-01 | |

### 1. Размеры (замерено мной) [факт]
| Артефакт | raw min | gzip -9 |
|---|---|---|
| dotlottie-web `dist/dotlottie-player.wasm` (software/canvas2d) | 1 238 KB | **496 KB** |
| dotlottie-web `dist/webgl/dotlottie-player.wasm` | 1 366 KB | 542 KB |
| dotlottie-web `dist/webgpu/…wasm` | 1 398 KB | — |
| dotlottie-web `dist/index.js` (весь entry) | 165 KB | 33 KB |
| dotlottie-web: esbuild `import {DotLottie}` | 62 KB | **13.8 KB** |
| dotlottie-web `dist/dotlottie.worker.js` | 78 KB | 15.5 KB |
| lottie-web `lottie.min.js` (full, svg+canvas+html, expressions) | 306 KB | 76 KB |
| lottie-web `lottie_svg.min.js` | 243 KB | 62 KB |
| lottie-web `lottie_light.min.js` (svg, без expressions) | 168 KB | **46 KB** |
| lottie-web `lottie_light_canvas.min.js` | 203 KB | 54 KB |
| canvaskit-wasm `canvaskit.wasm` (Skottie) | 7 317 KB | **2 939 KB** |
| Rive `rive.js` (canvas) / esbuild `import {Rive}` | 570 / 281 KB | 125 / **72 KB** |
| Rive `rive.wasm` canvas | 2 057 KB | 849 KB |
| Rive `rive.wasm` canvas-lite | 772 KB | **315 KB** |
| Rive `rive.wasm` webgl2 | 2 179 KB | 903 KB |
| pixi.js: esbuild «Application+Sprite+Graphics+Text+Assets+ticker» | 603 KB | **177 KB** |
| pixi.js `dist/pixi.min.js` (всё) | 841 KB | 237 KB |
| phaser `phaser.min.js` / `phaser-arcade-physics.min.js` | 1 376 / 1 266 KB | **352 / 320 KB** |
| motion/react: `motion` + `AnimatePresence` (esbuild) | 139 KB | **46.8 KB** |
| motion/react: `useAnimate` hybrid | 66 KB | 24.5 KB |
| motion/react-mini: `useAnimate` (WAAPI-only) | 8.7 KB | 3.5 KB |
| gsap core + Draggable + InertiaPlugin + Flip + CustomEase (esbuild) | 141 KB | **53.3 KB** |
| gsap core (`gsap.min.js`) | 73 KB | 28.3 KB |
| howler.min.js / howler.core.min.js | 36 / 27 KB | 9.7 / 7.9 KB |
| zzfx `ZzFX.js` (не минифицирован) | 10 KB | 3.6 KB |

Официальные цифры Motion (Rollup, лучше тришейкинг, чем esbuild): `motion` компонент 34 KB, `m`+`LazyMotion` 4.6 KB + `domAnimation` 15 KB / `domMax` 25 KB, `useAnimate` mini 2.3 KB, hybrid 17 KB — https://motion.dev/docs/react-reduce-bundle-size [факт]. Важно: Pixi-замер без code splitting включает оба рендерера (WebGL+WebGPU); в Vite с динамическими чанками initial будет меньше [мнение].

### 2. Lottie-плееры
**lottie-web (airbnb) 5.13.0** [факт]
- Последний релиз 2025-05-21 после двухлетней паузы; DepScope: maintenance 10/25 — https://depscope.dev/pkg/npm/lottie-web. ~1.7 M скачиваний/нед. — https://snyk.io/advisor/npm-package/lottie-web.
- Expressions реализованы через `eval`; сопровождающий предлагал как обход только light-сборку или worker-сборку — https://github.com/airbnb/lottie-web/issues/2927, обзор https://lightrun.com/answers/airbnb-lottie-web-xss-vulnerability. Т.е. full build требует `'unsafe-eval'` в CSP; `lottie_light` — нет.
- Рендер SVG в DOM: каждый слой — SVG-узел; много экземпляров = много DOM + main-thread JS на кадр [мнение, общеизвестно].

**@lottiefiles/dotlottie-web 0.81.0** (ThorVG, Rust/C++→WASM) [факт]
- API (https://docs.lottiefiles.com/en/runtimes/distributions/js/v0.x/api/reference): конфиг `src|data, autoplay, loop, loopCount, speed, mode, segment, marker, themeId, layout, renderConfig, useFrameInterpolation, stateMachineId, stateMachineConfig, assetResolver`; методы `setFrame, setSegment, setMarker, markers(), tween(), tweenToMarker(), freeze/unfreeze, setTheme/setThemeData, setSlots/setColorSlot/setTextSlot/…, setLayout({fit:'contain'|'cover'|'fill'|'fit-width'|'fit-height'|'none', align:[x,y]}), setRenderConfig({devicePixelRatio, freezeOnOffscreen (default true), autoResize, quality})`, state machine `stateMachineLoad/Start/Stop/FireEvent/Set*Input/Post*Event`, события `ready, load, frame, complete, loop, render, freeze, stateMachine*`.
- Static `DotLottie.setWasmUrl()`, `DotLottie.preload()`, `DotLottie.registerFont()`; `DotLottieWorker.setWasmUrl()/setWorkerUrl()` — https://github.com/LottieFiles/dotlottie-web/blob/main/packages/web/README.md.
- Worker по умолчанию стартует из `blob:` → нужен `worker-src blob:` или self-hosted `dotlottie.worker.js` (same-origin). При явном wasm URL CDN-fallback отключается (ошибка `loadError`) — тот же README.
- В worker-режиме методы в React через ref возвращают Promise — https://docs.lottiefiles.com/en/runtimes/distributions/react/v0.x/api-reference.
- Рендереры: software (canvas2d) по умолчанию, отдельные `/webgl` и `/webgpu` entry со своими WASM (см. размеры).
- CSP: WASM требует `'wasm-unsafe-eval'` (а не полного `'unsafe-eval'`) в `script-src`; self-host снимает нужду в `connect-src` для CDN — https://github.com/LottieFiles/dotlottie-web/wiki/CSP-and-WASM-Self%E2%80%90Hosting-Guide, разъяснение директивы https://next.centralcsp.com/en/blog/unsafe-eval-csp.md.
- Self-host в Vite (из того же гайда):
  ```ts
  import wasmUrl from '@lottiefiles/dotlottie-web/dist/dotlottie-player.wasm?url';
  import { setWasmUrl } from '@lottiefiles/dotlottie-react';
  setWasmUrl(wasmUrl); // до первого рендера плеера
  ```
  Сервер должен отдавать `application/wasm`. Lazy: компонент-плеер через `React.lazy`, а `DotLottie.preload()` вызвать на входе в игровой роут, чтобы WASM качался параллельно с API-запросом [мнение на основе README].

**Прочие** [факт/мнение]
- `lottie-react` 3.1.2 — живая тонкая обёртка над lottie-web (тянет его целиком; наследует CSP-проблему full build).
- `@lottiefiles/react-lottie-player` 3.6.0 (2025-01) — легаси на lottie-web; LottieFiles продвигает dotlottie-react [мнение].
- Skottie/canvaskit 0.42.0 — 2.9 MB gz WASM, для TMA неприемлемо [мнение].

**Какой плеер для чего** [мнение]
| Задача | Выбор | Почему |
|---|---|---|
| Праздник выигрыша (one-shot, 1–3 с) | dotlottie-web, `freezeOnOffscreen`, `segment`/`marker` | Точная синхронизация через `setFrame`/`complete`, темы/слоты (подставить сумму, цвет) |
| Зацикленный idle (много штук на экране) | lottie-web light (SVG) **или** один dotlottie-канвас | dotlottie на каждый экземпляр — отдельный canvas + WASM-рендер; >6–10 одновременных лучше Worker либо заменить CSS-анимацией |
| Интерактивная state-machine кнопка | Rive (если есть дизайнер Rive) иначе dotLottie state machines | Rive SM + data binding зрелее; dotLottie SM новее, но в том же рантайме |
| Синхронизация с колесом/слотом | Lottie только как overlay; само вращение — Motion/GSAP | Сервер-исход проще контролировать твин-движком |

### 3. Rive [факт]
- Рантаймы MIT, без runtime fees; **экспорт .riv с 20.10.2025 только на платных планах**, Cadet $9/мес (годовой) / $17 помесячно, редактор бесплатен для экспериментов — https://rive.app/blog/rive-s-new-9-mo-plan. Цены Voyager/Enterprise в сторонних источниках расходятся — https://frontdeskreview.com/software/design-tools/rive/.
- `@rive-app/webgl2` = Rive Renderer (как в редакторе, vector feathering); `@rive-app/canvas` = Canvas2D, без feathering; `canvas-lite` выкидывает text, layout, audio, scripting. Много экземпляров: canvas — «нет практического лимита», webgl2 — `useOffscreenRenderer: true` для общего контекста (лимит WebGL-контекстов) — https://rive.app/docs/runtimes/web/canvas-vs-webgl.
- Data binding (view models) в React: `useViewModel`, `useViewModelInstance`, типизированные хуки свойств — https://rive.app/docs/runtimes/react/data-binding.
- Оценка: идеален для «живой» кнопки SPIN, маскота, интерактивных иконок; не подходит как основа игровой логики карт (нет React-DOM, a11y, drag) [мнение]. Импорт Lottie в Rive в 2026 не проверял.

### 4. Lottie/Spine внутри канвас-движков
- Официального Lottie-плагина для PixiJS 8 / Phaser 4 поиск не нашёл (2025–2026) [факт: отсутствие результатов]. Рабочий паттерн [мнение]: `new DotLottie({ canvas: offscreenOrHiddenCanvas })` → `Texture.from(canvas)` (Pixi) / `CanvasTexture` (Phaser), на событие `render`/`frame` вызывать `texture.source.update()`. Цена: WASM 496 KB + аплоад текстуры каждый кадр; годится для 1–3 одновременных анимаций.
- Spine: `@esotericsoftware/spine-pixi-v8` и `spine-phaser-v4` 4.3.13 (2026-07-24) [факт]. Лицензия: рантаймы можно интегрировать, но нужна лицензия Spine Editor; Essential $69 (sale)/$99, лимит выручки $500k/12 мес, иначе Enterprise — https://en.esotericsoftware.com/spine-purchase, https://en.esotericsoftware.com/spine-editor-license [факт]. Для казуальных колёс Spine избыточен [мнение].

### 5. DOM/SVG + Motion/GSAP для колеса, слотов, карт
**Motion 14.2.0** [факт]: `motion/react` (компоненты, `layout`, `layoutId`, `drag` с constraints/elastic/momentum, spring), `useAnimate` (императивные последовательности), `MotionConfig reducedMotion="user"` / `useReducedMotion`. Примеры shared layout / card stack — https://motion.dev/examples/react-shared-layout-animation, https://motion.dev/examples/react-card-stack. `motion` и `framer-motion` версии синхронны (одна кодовая база).

**GSAP 3.15.0** [факт]: после покупки Webflow весь GSAP, включая бывшие Club-плагины (SplitText, MorphSVG, InertiaPlugin, Draggable, Flip, CustomEase, MotionPath), бесплатен в т.ч. для коммерции, всё в пакете `gsap`; `gsap-trial` deprecated — https://webflow.com/blog/gsap-becomes-free, https://gsap.com/community/standard-license/. Лицензия «Standard No Charge» не OSI-open-source: «Prohibited Uses» — визуальные no-code-конструкторы анимаций, конкурирующие с Webflow; обычные сайты/веб-приложения разрешены — https://scancode-licensedb.aboutcode.org/gsap-standard-no-charge-2025.html [факт]. Для игр в TMA ограничение не применимо [мнение].

**Жесты/drag** [факт/мнение]: `@use-gesture/react` 10.3.1 (2024-03) — стоит; `@dnd-kit/core` 6.3.1 стабилен, но не развивается, `@dnd-kit/react` 0.5.0 ещё 0.x. Для карт (перетащить в стол/руку) достаточно Motion `drag` + hit-test по `getBoundingClientRect` или GSAP Draggable+Inertia; dnd-kit полезен, если нужна клавиатурная доступность drag из коробки [мнение].

**Паттерн колеса с серверным исходом** [мнение, подтверждён общими гайдами https://vp0.com/blogs/wheel-of-fortune-spinner-ui-template-ios, https://www.rapidevelopers.com/md/bubble-tutorial/implement-a-roulette-wheel-feature-in-bubble]:
1. По тапу сразу начать «разгон» (бесконечное вращение с постоянной скоростью) — скрывает латентность API.
2. Получив `{segmentIndex, seed}`, вычислить `target = current - (current mod 360) + N*360 + (360 - (i + 0.5)*seg) + jitter`, где `jitter ∈ ±0.35*seg` (не центр сегмента — выглядит честнее).
3. Тормозить твином с easing, у которого начальная скорость совпадает с текущей (Motion `animate(value, target, { type: 'inertia' | custom cubic-bezier })` либо GSAP `CustomEase` с overshoot ≤ 2–3°, затем settle).
4. «Тики»: подписка на `onUpdate`, при пересечении границы сегмента — звук + маленький bounce указателя; на low performance class — без звука-на-каждый-тик и без motion blur.
5. Финал: `onComplete` → dotLottie celebration (`play()`), ответ сервера — единственный источник истины, клиентский угол лишь визуализация.

**Слот-барабаны** [мнение]: каждая колонка — вертикальная полоса символов (повторённая 2–3 раза), анимируется `translateY` с `modulo`; во время быстрого вращения подменять символы на заранее размытые спрайты вместо `filter: blur()` (blur дорог — https://gsap.com/community/forums/topic/36817-is-it-possible-to-add-a-bit-of-motion-blur-to-a-simple-animation/); остановка по колонкам с задержкой 150–300 мс, каждая доезжает до серверного символа с overshoot. Пример keyframe-барабанов с overshoot: https://incode.com/styles/pages/gambling.css.

**Карты** [мнение]: flip — `transform-style: preserve-3d` + `rotateY(180deg)` + `backface-visibility: hidden`; перемещение между рукой/столом — Motion `layoutId` (FLIP под капотом) или GSAP `Flip.from()`; раздача — stagger. 36 карт дурака + стол — это <100 анимируемых узлов, в пределах возможностей DOM на mid-Android при анимации только `transform/opacity` [мнение; принцип compositor-only — https://web.dev/articles/animations-guide].

**Производительность DOM на Android WebView** [мнение]: анимировать только `transform`/`opacity`; `will-change: transform` ставить на время анимации, а не постоянно (каждый слой — GPU-память); SVG-колесо лучше вращать как один `<svg>`/`<div>` через CSS transform, а не SVG-атрибут `transform` (последний ре-растеризует); избегать `box-shadow`/`filter` на движущихся элементах; порог джанка зависит от площади слоёв, а не числа узлов — ориентир «десятки одновременно движущихся слоёв ок, сотни — канвас».

**Реальные примеры** [факт]: slots-TMA на React+Tailwind+Framer Motion+Canvas (только барабаны), сервер-провабли-фэйр — https://dev.to/automate_ai/complete-guide-to-telegram-mini-apps-in-2026-40b0 (самоотчёт, без бенчмарков). Открытых durak-клиентов с хорошей анимацией не найдено (https://github.com/vijexa/durak-online — React, сам автор называет фронт «janky»).

### 6. PixiJS 8 и Phaser 4
- pixi.js 8.22.0 (2026-10-01), ежедневные dev-сборки; в npm поставляется `skills/` (26 SKILL.md, в т.ч. `pixijs-accessibility`, `pixijs-performance`, `pixijs-migration-v8`) [факт].
- `@pixi/react` v8 — «exclusively for React 19», `extend()` для тришейкинга — https://pixijs.com/blog/pixi-react-v8-live; последний релиз 8.0.5 от 2025-12-01 [факт].
- `@pixi/ui` 2.4.1, `@pixi/layout` 3.2.1 (Yoga flexbox), `@pixi/sound` 6.0.1 (2024), AssetPack 1.7.0 [факт]. Accessibility-система Pixi создаёт поверх канваса DOM-«тени» для фокусируемых объектов [факт: skill `pixijs-accessibility`]; полноценного семантического дерева нет [мнение].
- Phaser 4.2.1 (2026-07-09), 352 KB gz одним файлом; scaffolder `npm create @phaserjs/game@latest` с опцией React — https://emanueleferonato.com/2026/04/17/getting-started-with-phaser-4-vite-typescript-setup-using-the-official-create-game-app/; официальный template-react-ts на момент поиска ещё на Phaser 3.90 [факт по https://awesome.ecosyste.ms/projects/github.com%2Fphaserjs%2Ftemplate-react-ts].
- Когда канвас реально оправдан [мнение]: >100–200 одновременно движущихся объектов (монетный дождь, частицы), полноэкранные шейдеры/фильтры (glow, displacement), физика, тайловые карты, скелетная анимация Spine, «бесконечные» спрайт-анимации. Для монетного дождя в варианте A достаточно одного `<canvas>` с 2D-частицами (~1–2 KB кода) поверх DOM.

### 7. Telegram Mini App webview
- Android-клиент добавляет в UA: `Telegram-Android/{app_version} ({manufacturer} {model}; Android {v}; SDK {sdk}; {performance_class})`, класс `LOW|AVERAGE|HIGH`; Telegram прямо рекомендует уменьшать анимации на слабых устройствах — https://core.telegram.org/bots/webapps (раздел «User-Agent details», «Design guidelines») [факт].
- Android Mini Apps используют системный Android System WebView (Chromium, обновляется через Play), iOS — WKWebView; старые системные webview — частый источник платформенных багов — https://bugnet.io/blog/crash-reporting-for-telegram-mini-app-games [факт/мнение источника].
- Bot API 8.0: fullscreen, safe areas, `isActive`/события activated/deactivated (паузить анимации и звук!); 9.0: `DeviceStorage`, `SecureStorage` — https://core.telegram.org/bots/webapps [факт]. localStorage в TG WebView ненадёжен на части клиентов — https://adsgram.ai/blog/adsgram/telegram-mini-app-tma-development-mistakes-and-how-to-avoid-them.
- Бюджет старта: практики советуют <2 с до интерактива — https://dev.to/automate_ai/complete-guide-to-telegram-mini-apps-in-2026-40b0 [мнение источника]. На mid-Android парсинг/компиляция ~350 KB gz JS (Phaser) — заметные сотни мс; WASM компилируется streaming-ом и параллельно, если `preload()` [мнение].
- WebGL на современных Android WebView доступен практически везде; WebGPU — не рассчитывать [мнение]. Публичных 2025–2026 разборов стека Notcoin/Hamster-подобных игр с первоисточниками не нашёл; кликеры типично DOM+CSS(+Lottie) [мнение].

### 8. Звук
- howler 2.2.4 (2023-09), репо пушилось до 11.2025, ~360 открытых issues, «inactive» по Snyk — https://snyk.io/advisor/npm-package/howler, https://gittrend.io/repo/goldfire/howler.js [факт]. Работает, решает iOS unlock и sprite-атласы, 7.9 KB gz (core) [факт размер].
- `@pixi/sound` 6.0.1 — только если уже Pixi [мнение].
- Свой минимум на Web Audio: один `AudioContext`, `resume()` на первом `pointerdown`, `decodeAudioData` для 5–15 SFX, sprite = один файл + offsets; плюс пауза на TMA `deactivated` [мнение]. `zzfx` 1.4.0 (2026-10-01, 3.6 KB gz) — процедурные «бипы» для тиков колеса без ассетов [факт версия].
- Пайплайн спрайтов: `audiosprite` (ffmpeg) или AssetPack (у Pixi) → `.webm/opus` + `.m4a/aac` fallback для старого iOS [мнение].

### 9. Доступность
- DOM-вариант: карты — `<button>`/`role="listitem"` с `aria-label="Дама пик"`, фокус и Enter/Space для хода, `aria-live` для «Вы выиграли 500» — бесплатно из UI-кита [мнение].
- Канвас: Pixi accessibility даёт лишь DOM-оверлей для фокуса; в Phaser — вручную [мнение].
- Reduced motion: Motion `MotionConfig reducedMotion="user"` (https://motion.dev/docs/react-accessibility), GSAP `gsap.matchMedia()` (https://gsap.com/docs/v3/GSAP/gsap.matchMedia()); у dotLottie встроенного флага нет — при `prefers-reduced-motion: reduce` не автоплеить, показывать финальный кадр через `setFrame(totalFrames-1)` или статичный постер [мнение]. Для колеса: короткая (≤600 мс) анимация без многих оборотов + сразу результат.

### 10. AI-agent friendliness [факт по проверке 2026-10-15]
- `skills/` в npm: pixi.js@8.22.0 — 26 SKILL.md; phaser@4.2.1 — 36 SKILL.md. Нет в motion, framer-motion, gsap, dotlottie-web/react, @rive-app/*, @pixi/react.
- `llms.txt` (HTTP 200): motion.dev (63 KB), gsap.com (12 KB), rive.app/docs (51 KB), developers.lottiefiles.com (368 KB), pixijs.com (10 KB), dotlottie.io (1.5 KB); docs.phaser.io/llms.txt — 404.
- Skill `lottiefiles/dotlottie-web` опубликован в реестрах (https://skills.cat/skills/lottiefiles/dotlottie-web), ссылается на репо LottieFiles; официальность не подтверждена.
- [мнение] Motion/GSAP/CSS-transform код модели генерируют очень надёжно (огромный корпус); риск — смешение `framer-motion` и `motion/react` импортов и устаревший API v10. dotLottie: агенты часто путают со старым `@dotlottie/player-component` и `lottie-web` API — нужен локальный skill/пример. Pixi v8: риск v7-API, смягчается встроенными skills. Rive: API data binding новый, модели знают хуже.

## Recommendations

### Сравнение вариантов для казуальных колёс/слотов/карт
| Критерий | A: DOM/SVG + CSS + Motion/GSAP + dotLottie | B: PixiJS 8 + @pixi/react + GSAP + Lottie-texture + Spine | C: Phaser 4 + React overlay | D: Rive-centric |
|---|---|---|---|---|
| Качество/контроль анимации | Высокое; твины с точной посадкой на серверный исход, spring, layout/FLIP [мнение] | Максимальное: частицы, шейдеры, фильтры [мнение] | Высокое + физика, tween manager [мнение] | Очень высокое для дизайнерских анимаций; логика в SM, тонкий кодовый контроль хуже [мнение] |
| Lottie | Нативно: dotlottie-react, слоты/темы/SM [факт] | Только костыль через canvas→Texture, нет плагина [факт/мнение] | То же через CanvasTexture [мнение] | Не Lottie (свой .riv); Lottie отдельно = второй WASM [мнение] |
| Bundle (gz), сверх React | Motion 17–47 KB **или** GSAP 28–53 KB; dotLottie JS ~14 KB + WASM 496 KB (lazy) [факт] | pixi ~177 KB + @pixi/react + GSAP 28 KB (+ dotLottie 510 KB, + Spine) [факт] | phaser 352 KB (+React уже есть) (+dotLottie) [факт] | rive JS 72 KB + WASM 315 (lite)…903 (webgl2) KB [факт] |
| Cold start mid-Android TMA | Лучший: игровой экран = обычный роут, WASM грузится параллельно/после первого кадра [мнение] | Средний: init WebGL + текстуры атласов [мнение] | Хуже: 350 KB JS парс + boot сцены [мнение] | Средний: WASM ≥315 KB до первого кадра анимации [мнение] |
| 60 fps | Да при transform/opacity и ≤~50 движущихся слоях; нет — при blur/shadow [мнение] | Да, с запасом на сотни спрайтов [мнение] | Да [мнение] | Да для 1–5 артбордов; webgl2 лимит контекстов → offscreen renderer [факт] |
| Drag/жесты карт | Motion drag / GSAP Draggable+Inertia, pointer events [факт] | Pixi federated events, своя логика драга [мнение] | Phaser input + drag [мнение] | SM pointer events, драг вручную [мнение] |
| Доступность | Лучшая: семантический DOM, фокус, aria-live [мнение] | Ограниченно (DOM-тени) [факт/мнение] | Слабая [мнение] | Слабая (canvas) [мнение] |
| Переиспользование UI-кита + CSS-токенов | 100 %: те же компоненты, Tailwind 4, токены в CSS vars [мнение] | Частично: HUD в React DOM, сцена — токены надо пробрасывать в JS [мнение] | Частично, оверлей + дублирование стилей в сцене [мнение] | Частично; цвета через data binding/темы [мнение] |
| AI-friendliness | Высокая (Motion/GSAP llms.txt; dotLottie нужен локальный skill) [мнение] | Средне-высокая (pixi skills в npm), @pixi/react слабее [мнение] | Средняя (36 skills в npm, но Phaser 4 новый) [мнение] | Средне-низкая (новый data binding API) [мнение] |
| Здоровье | motion 14.2.0 (2026-10-13), gsap 3.15.0 (2026-04), dotlottie 0.81.0 (2026-10-06) — все активны [факт] | pixi активен; @pixi/react стоит с 2025-12; @pixi/sound с 2024 [факт] | phaser 4.2.1 (2026-07), релизы ~раз в 2 мес. [факт] | rive релизы еженедельно; экспорт платный [факт] |

### Итоговые рекомендации [мнение]
1. **Шаблон `game` переделать на вариант A** как дефолт: React-роут + UI-кит + Motion (уже вероятно в кит; использовать `LazyMotion`/`m` и `useAnimate`) для колеса, слотов, карт; GSAP не добавлять по умолчанию — подключать только если нужны `CustomEase`/`InertiaPlugin`/`MotionPath` (лицензия бесплатная, но не MIT — отметить в docs).
2. **Lottie: `@lottiefiles/dotlottie-react` 0.20.0** (пин точной версии вместе с dotlottie-web), WASM self-host через `?url` + `setWasmUrl`, `DotLottie.preload()` на входе в игровой роут, отдельный lazy-чанк; CSP: `script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:`. Обёртка `<Celebration src marker onComplete>` в shared-пакете; `freezeOnOffscreen` (по умолчанию true), reduced-motion → статичный кадр. Принимать от дизайнеров `.lottie` (сжатый ZIP, темы/слоты), а не сырой JSON.
3. **lottie-web не брать** как основной (стагнация, eval в full build); допустим `lottie_light` (46 KB gz) только для «много мелких SVG-idle» сценариев, если WASM-плеер окажется тяжёлым на конкретном экране.
4. **Колесо/слоты**: реализовать утилиту `spinTo({ current, targetIndex, segments, turns, jitter })` + хук на Motion; разгон до ответа сервера, посадка с overshoot, тики по границам сегментов; предразмытые спрайты вместо `filter: blur`. Деградация по `performance_class=LOW` из UA и `prefers-reduced-motion`.
5. **Карты**: DOM-карты, `layoutId` для перемещения рука↔стол, CSS 3D flip, Motion `drag` для хода; dnd-kit не добавлять.
6. **Звук**: тонкий модуль на Web Audio (unlock на первом жесте, пауза на TMA `deactivated`/`visibilitychange`), опционально howler 2.2.4 как готовое решение; zzfx для процедурных тиков.
7. **Канвас — опциональный «add-on», не база**: если появится игра с сотнями объектов/шейдерами — PixiJS 8 (а не Phaser): модульность, skills в npm, лучшая интеграция с React-хостом. Phaser 4 оставить только для «настоящих» аркад с физикой/сценами. Для одиночных эффектов (монетный дождь) — маленький 2D-canvas слой в варианте A.
8. **Rive** — не включать в шаблон по умолчанию (платный экспорт, ≥315 KB WASM, второй рантайм рядом с Lottie); документировать как опцию `@rive-app/react-canvas` (lite) для интерактивных SM-кнопок, если в команде есть Rive-дизайнер.
9. **Для агентов**: положить в репо skill/README для dotLottie (setWasmUrl, preload, segment/marker, reduced motion) и пример `spinTo` с тестом «угол → индекс сегмента», т.к. это места, где агенты ошибаются чаще всего.
10. **Проверить на устройстве** (follow-up): прототип колеса + 3-барабанный слот + раздача 36 карт на Android mid (класс AVERAGE) в Telegram — замер FPS/long tasks и времени до первого кадра с/без dotLottie WASM.

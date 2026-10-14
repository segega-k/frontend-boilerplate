# 05e. Шаблон `game` — веб-игра (браузер + Telegram Mini App)
Status: done
Updated: 2026-10-14

## Resume notes
- Done: все разделы 1–11 Findings, рекомендации, итоговая таблица, открытые вопросы. Версии — npm registry 2026-10-14; размеры бандлов измерены (gzip -9); smoke-сборка Phaser 4.2.1 и PixiJS 8.22.0 на Vite 8.3.4 выполнена в scratchpad (успешно).
- Next: ничего. Оркестратору — свести с 05c (общий `packages/telegram-platform`) и 05d/05a (общий kit, Zustand, Vitest/Playwright).
- Sub-agent: нет (запрещено).

## Summary (≤ 15 lines)
1. **Движок: Phaser 4 (`phaser@4.2.1`)** — полный 2D-фреймворк (сцены, loader, audio с unlock и audio sprites, input, tweens, Arcade/Matter, ScaleManager, восстановление WebGL context из коробки). 4.0 вышел 2026-04-10. В npm-пакете есть `skills/*/SKILL.md` (28 тем) — готовые Claude-skills. Альтернатива — PixiJS 8.22 + `@pixi/react` 8 (меньше JS, tree-shaking, но всё кроме рендера — самим). 3D (R3F 9) — только опция: peer `react <19.4` тормозит React во всём монорепо.
2. **Сборка:** тот же Vite 8 + TS + Vitest, что у остальных шаблонов; проверено: Phaser 4.2.1 собирается Vite 8.3.4 (1375 KB min / 358 KB gzip, tree-shaking нет). Официальный `phaserjs/template-react-ts` брать как образец моста, но без `log.js` (телеметрия на gryzor.co) и без `public/assets` без хешей.
3. **Ассеты:** атласы — `free-tex-packer-core` скриптом (или TexturePacker) → хешированные имена + манифест; WebP (+ опц. KTX2 для экономии GPU-памяти на iOS); аудио — спрайты в m4a(AAC)+webm/ogg(Opus), звук через движок (Howler 2.2.4 не обновлялся с 2023).
4. **React ↔ игра:** React только для overlay (меню, HUD, магазин, диалоги) из общего UI-kit поверх canvas; мост — vanilla Zustand store (`zustand/vanilla`, общий источник «мета»-состояния) + типизированная шина команд; горячие данные (позиции, кадры) никогда не идут в React state.
5. **Игровая логика** — чистый TS-модуль без импорта движка (правила, экономика, генерация уровней, seeded RNG) → юнит-тесты Vitest без canvas.
6. **Telegram:** общий с `tma` пакет `packages/telegram-platform` (`@tma.js/sdk-react` 3.0.23): fullscreen, `lockOrientation`, `disableVerticalSwipes`, haptics, `activated/deactivated` → пауза, Stars через бэкенд (`createInvoiceLink`) + `invoice.openUrl`; лидерборды и экономика — только бэкенд.
7. **Сейвы:** локально IndexedDB (`idb-keyval`) / Telegram `DeviceStorage` (5 MB) с версией схемы; авторитетный прогресс — на сервере. localStorage в Telegram iOS ненадёжен.
8. **Offline/PWA:** `vite-plugin-pwa` 2.0 — опция только для веб-сборки; в Telegram iOS SW фактически недоступен → основная стратегия — immutable-хеши + `Cache-Control: max-age=31536000, immutable` + CDN.
9. **Анти-чит:** фронт не доверенный; сервер авторитетен для очков/валюты/покупок; клиент шлёт события/реплеи с seed, сервер валидирует (лимиты, правдоподобие).
10. **Тесты:** Vitest (логика), Playwright 1.64 smoke: игра грузится, `window.__GAME_TEST__` хук сообщает состояние сцены, скриншот с фиксированным seed и паузой; perf-бюджет по FPS/heap в CI — только как мягкий сигнал.
11. **Деплой:** статический nginx в Docker, brotli/gzip precompressed, `immutable` для хешированных ассетов, `no-cache` для `index.html`/манифеста; CDN опционально.
12. **Жертвуем:** SSR, SEO, роутер (экранная state-machine вместо URL-роутинга), большая часть a11y canvas. Остаётся обязательным: доступный DOM-overlay (меню/магазин/настройки — клавиатура, фокус, контраст), mute/громкость, `prefers-reduced-motion` для эффектов/вибрации, пауза при потере фокуса.

## Findings

Обозначения: **[факт]** — проверено по источнику/реестру/измерением 2026-10-14; **[мнение]** — оценка автора.

### 1. Проверенные версии (npm registry, 2026-10-14)

| Пакет | latest | Дата | Заметки |
| --- | --- | --- | --- |
| `phaser` | 4.2.1 | 2026-07-09 | 4.0.0 вышел 2026-04-10; peer нет; npm-пакет содержит `skills/` (28 SKILL.md), `docs/`, `types/phaser.d.ts`, тесты на Vitest |
| `pixi.js` | 8.22.0 | 2026-10-01 | `sideEffects` перечислены → tree-shaking работает; тоже содержит `skills/` (26 шт.) |
| `@pixi/react` | 8.0.5 | 2025-12-01 | peer `react >=19`, `pixi.js ^8.2.6` |
| `three` | 0.186.1 | 2026-09-24 | |
| `@react-three/fiber` | 9.8.1 | 2026-09-24 | peer `react >=19 <19.4` (жёсткий потолок!) |
| `@react-three/drei` | 10.7.9 | 2026-09-25 | peer fiber ^9 |
| `@babylonjs/core` | 9.30.0 | 2026-10-08 | |
| `excalibur` | 0.32.0 | 2025-12-23 | ещё 0.x |
| `kaplay` | 3001.0.19 | 2025-06-15 | v4000 в alpha больше года |
| `howler` | 2.2.4 | 2023-09-19 | не обновлялся 3 года |
| `@pixi/sound` | 6.0.1 | 2024-07-27 | |
| `gsap` | 3.15.0 | 2026-04-13 | бесплатен, включая бывшие Club-плагины (лицензия Standard No Charge; запрет только на no-code конкурентов Webflow) — https://gsap.com/community/standard-license/ |
| `matter-js` | 0.20.0 | 2024-06-23 | застой; в Phaser встроена своя копия |
| `@dimforge/rapier2d-compat` | 0.21.0 | 2026-09-25 | WASM, inline base64 (`-compat`) |
| `@esotericsoftware/spine-phaser-v4` | 4.3.13 | 2026-07-24 | peer `phaser ^4.2.1` — экосистема уже на Phaser 4 |
| `zustand` | 5.0.15 | 2026-08-13 | |
| `@tma.js/sdk-react` / `@tma.js/sdk` | 3.0.23 / 3.3.0 | 2026-07-14 | есть `4.0.0-rc.0` |
| `@telegram-apps/analytics` | 1.6.4 | 2026-01-22 | |
| `vite-plugin-pwa` / `workbox-window` | 2.0.0 / 7.4.1 | 2026-10-03 | peer `vite ^…^8` |
| `@assetpack/core` | 1.7.0 | 2025-11-07 | пайплайн ассетов от команды Pixi |
| `free-tex-packer-core` | 0.3.9 | 2026-07-24 | есть экспорт под Phaser 3 JSON |
| `audiosprite` | 0.7.2 | 2020-01-31 | заброшен; лучше свой скрипт на ffmpeg |
| `idb-keyval` | 6.3.0 | 2026-07-08 | |
| `@pixi/ui` / `@pixi/layout` | 2.4.1 / 3.2.1 | 2026 | in-canvas UI для Pixi |
| `@sentry/browser` | 11.7.0 | 2026-10-12 | |
| `stats-gl` | 4.2.3 | 2026-07-10 | FPS/GPU-панель (peer three, для Phaser — `stats.js`-подобное своё) |
| `react` / `vite` / `vitest` / `@playwright/test` | 19.3.0 / 8.3.4 / 5.0.4 / 1.64.0 | | общий тулчейн монорепо |

Источник: `https://registry.npmjs.org/<pkg>` (поле `dist-tags.latest`, `time`).

### 2. Движок

#### 2.1 Измеренный размер (min, gzip -9) [факт]

| Сборка | min | gzip |
| --- | --- | --- |
| `phaser@4.2.1/dist/phaser.min.js` (полный) | 1 376 KB | **352 KB** |
| Vite 8.3.4 build, `import { Game, AUTO, Scene, Scale } from 'phaser'` | 1 375 KB | **358 KB** (именованные импорты не тришейкаются) |
| `phaser-arcade-physics.min.js` (без Matter) | 1 266 KB | ~325 KB (оценка по пропорции) |
| `pixi.js@8.22.0/dist/pixi.min.js` (полный UMD) | 841 KB | 237 KB |
| Vite 8.3.4 build Pixi (`Application`, `Assets`, `Sprite`, ticker) | 577 KB во всех чанках | **174 KB** во всех чанках; WebGPU/Canvas-рендереры — ленивые чанки, реально грузится меньше |
| `three@0.186.1` core + module | 808 KB | ~194 KB (без R3F/drei) |
| `excalibur@0.32.0` | 574 KB | 147 KB |
| `kaplay@3001.0.19` | 189 KB | 69 KB |
| `howler@2.2.4` | 36 KB | 10 KB |

Phaser поставляется одним ESM-бандлом (`exports.import = ./dist/phaser.esm.js`). **[мнение]** ~360 KB gzip движка + React/overlay (~60–80 KB) приемлемо: время до первого кадра в игре определяют ассеты (атласы, аудио, шрифты — обычно 1–10 MB), а не JS. Если важен каждый KB (hyper-casual с ad-сетями) — это аргумент за Pixi.

#### 2.2 Сравнение

| Критерий | Phaser 4.2 | PixiJS 8.22 (+ @pixi/react 8) | Three.js / R3F 9 + drei | Babylon.js 9 | Excalibur / Kaplay |
| --- | --- | --- | --- | --- | --- |
| Тип | полный 2D-фреймворк: сцены, loader, input, audio, tweens, Arcade+Matter, камеры, тайлмапы, particles, ScaleManager | 2D-рендерер + Assets + events; остальное — сами | 3D-рендерер (R3F — React-рендерер) | полный 3D-движок | 2D-фреймворки |
| Рендер | WebGL2 (новый RenderNode-рендерер, context restoration из коробки) + Canvas; **WebGPU нет** | WebGL (рекомендован для прод.) + WebGPU (Experimental) + Canvas | WebGL2 + WebGPURenderer | WebGL2 + WebGPU | WebGL / Canvas |
| TS | `phaser.d.ts` генерится из JSDoc, полный, но namespace-стиль `Phaser.Types.*` | исходники на TS — лучшие типы | `@types/three`, R3F на TS | TS-исходники | TS |
| React | официальный `template-react-ts` (EventBus + `PhaserGame.tsx`) | `@pixi/react` 8 (JSX, `extend()`, `useTick`) | R3F — сам React | community (`react-babylonjs`) | нет |
| AI-дружественность | `skills/` в npm (Claude skills-формат) + `docs/` + https://phaser.io/llms.txt (~400 KB); огромный корпус Phaser 3 у моделей (риск: путают API v3/v4) | `skills/` в npm + https://pixijs.com/llms.txt; модели путают v7/v8 | огромный корпус | средне | слабо |
| Сообщество | крупнейшее для 2D web-игр | крупное, но «рендерер для приложений» | крупнейшее для 3D | крупное (Microsoft) | малое |

Факты по Phaser 4 [факт]: релиз 4.0 — 2026-04-10, 4.2.0 «Giedi» — 2026-06-19 (stencil-маски, Mesh2D, cone lights, `setFPSLimit` в рантайме). Рендерер переписан на RenderNodes и «supports context restoration out of the box»; FX/BitmapMask v3 заменены единой системой Filters; Mesh/Plane удалены; новый атлас-формат PCT «обычно на 90–95% меньше JSON-атласов»; `SpriteGPULayer`/`TilemapGPULayer`. Спрайты, текст, тайлмапы, input, физика, сцены, аудио, твины — API почти как в v3. Источники: https://phaser.io/news/2026/05/phaser-3-vs-phaser-4, https://phaser.io/news/2026/04/phaser-4-renderer-faster-cleaner-and-built-for-modern-games, https://en.wikipedia.org/wiki/Phaser_(game_framework), `node_modules/phaser/changelog/v4/4.2/CHANGELOG-v4.2.0.md`. Официальных планов WebGPU с датой не найдено (сторонний обзор: https://app.cinevva.com/guides/webgpu-vs-webgl-games).

Факт по PixiJS: WebGPU-рендерер в доках — «Experimental», для продакшна рекомендуют WebGL (https://pixijs.com/8.x/guides/components/renderers). **[мнение]** WebGPU в 2026 не аргумент для 2D casual: WebGL2 есть везде, включая WKWebView Telegram iOS и Android WebView.

Факт по `phaserjs/template-react-ts` (https://github.com/phaserjs/template-react-ts): `phaser 4.0.0`, React 19, Vite 6, TS 5.7; мост — `EventBus` + `PhaserGame.tsx` (`forwardRef`, отдаёт `game` и текущую `scene`), сцена эмитит `current-scene-ready`. Скрипты `dev`/`build` запускают `log.js`, который «makes a single silent API call to a domain called gryzor.co» — **в бойлерплейт не переносить**. Ассеты лоадера кладутся в `public/assets` (без хешей).

#### 2.3 Вывод по движку [мнение]

- **По умолчанию: Phaser 4 (`phaser@^4.2.1`).** Casual/hyper-casual/idle/puzzle/аркады требуют фреймворк, а не рендерер. Всё нужное (loader с прогрессом, audio unlock + audio sprites, pointer/touch/keyboard/gamepad, tweens, Arcade, particles, ScaleManager FIT/EXPAND + fullscreen, пауза на blur) — одна согласованная библиотека; агенту меньше изобретать. `node_modules/phaser/skills` подключается в `.claude/skills` шаблона `game` (симлинк/копия при init) — прямо ложится на цель «агенты работают одинаково».
- **Альтернатива: PixiJS 8 + `@pixi/react` 8** — для UI-тяжёлых idle/clicker/merge-игр, где сцена простая, а экранов много, и для жёсткого бюджета JS. Цена: самим собирать input-жесты, аудио (`@pixi/sound` без релизов с 2024), твины (GSAP), физику, scale/resize, сцены. `@pixi/react` релизится редко (последний 2025-12).
- **Light 3D: three + R3F 9 + drei 10** — отдельный опциональный под-вариант. Риск [факт]: peer `react >=19 <19.4` — одна версия React на весь workspace, значит R3F будет блокировать обновление React у landing/shop/tma/admin. Babylon — без React-интеграции, тяжелее; не по умолчанию.
- **Не брать:** Excalibur (0.x), Kaplay (v4000 в alpha > 1 года; годится для джемов).

### 3. Сборка, ассеты, аудио

- **[факт]** Phaser 4.2.1 и PixiJS 8.22 собираются Vite 8.3.4 (Rolldown) без доп. настроек (smoke в scratchpad). Vite предупреждает о чанке > 500 KB — для игры поднять `build.chunkSizeWarningLimit` и вынести движок в отдельный чанк (`codeSplitting`/manualChunks) ради долгого кеша: движок меняется редко, код игры — часто.
- **Структура загрузки [мнение]:** `index.html` → маленький React-shell с экраном загрузки (DOM, мгновенно) → динамический `import()` движка и сцены `Boot` → `Preload` грузит только ассеты первого экрана/уровня → остальные паки (`level-2`, `shop`) лениво в фоне. Telegram показывает свой loading screen до `ready()` — вызывать `miniApp.ready()` как только DOM-shell отрисован, а не после всех ассетов.
- **Ассеты и хеши:** `public/assets` Vite копирует без хешей → нельзя ставить `immutable`. Варианты:
  1. импорт через Vite (`import atlasPng from './atlas.png?url'`, `import atlasJson from './atlas.json?url'`) → хешированные URL, передаются в `this.load.atlas(key, png, json)` [рекоменд. для небольших игр];
  2. пайплайн ассетов (скрипт) → `assets/<name>.<hash>.webp` + `manifest.json` (сам манифест — `no-cache`). `@assetpack/core` 1.7 умеет texture packing, webp/avif, mipmaps, сжатие аудио через ffmpeg и cache-buster, но ориентирован на Pixi-манифест; совместимость его атласов с Phaser (`load.atlas` понимает TexturePacker JSON Hash/Array) — **не проверено**.
- **Атласы [мнение]:** `free-tex-packer-core` 0.3.9 (свежий релиз 2026-07, MIT, есть экспортёр «Phaser 3» JSON — совместим с `load.atlas`/`load.multiatlas`) в node-скрипте `scripts/pack-atlases.ts`; TexturePacker — если команда готова платить (лучшая упаковка, CLI). Phaser PCT-формат (компактный атлас Phaser 4, спецификация в `node_modules/phaser/docs/`) — следить, когда появится стабильный экспортёр.
- **Изображения:** WebP по умолчанию; размеры атласов ≤ 2048×2048 (безопасно для слабых мобильных GPU); для больших игр — KTX2/Basis (`node_modules/phaser/docs/WebGL Compressed Textures`) ради GPU-памяти на iOS. DPR: рисовать ассеты под 2x, не 3x.
- **Шрифты:** в canvas — bitmap fonts (BMFont) или web font, загруженный через `document.fonts.load()` до создания `Text` (иначе первый кадр рисуется fallback-шрифтом). Overlay использует шрифты из общих токенов.
- **Аудио [мнение + общеизвестный факт]:** использовать встроенный `WebAudioSoundManager` Phaser: он сам разблокирует AudioContext на первом жесте (`this.sound.locked`, событие `unlocked`), поддерживает `load.audioSprite`. Howler 2.2.4 — только при Pixi (или `@pixi/sound`), с оговоркой о застое. Форматы: m4a (AAC) как универсальный + webm/ogg (Opus) меньшего размера; loader выбирает поддерживаемый. Аудиоспрайты для SFX (одна загрузка/декод), музыку — отдельным файлом, лениво, после первого экрана. iOS: беззвучный режим (silent switch) может глушить WebAudio — **не проверено на текущих iOS**, проверить на устройстве; громкость/mute — в настройках overlay и в сейве.

### 4. Мост React ↔ движок

**[мнение] Принцип: React не участвует в игровом цикле.** React рендерит только overlay и реагирует на дискретные события (раунд начался/кончился, монеты изменились, открыт магазин). Позиции, анимации, таймеры кадра — только внутри движка.

Схема:

```
apps/game/src/
  logic/        чистый TS: правила, экономика, генерация уровней, RNG(seed) — без импорта phaser/react
  game/         Phaser: scenes/, objects/, systems/, createGame.ts — читает logic/, пишет в store
  bridge/       gameStore.ts (zustand/vanilla), commands.ts (типизированная шина React→игра), events.ts
  ui/           React overlay: screens/ (Menu, Hud, Shop, Pause, GameOver), использует packages/ui
  platform/     адаптеры: telegram (из packages/telegram-platform), storage, audio-settings
```

- **Store:** `createStore` из `zustand/vanilla` + `subscribeWithSelector`. React: `useStore(gameStore, selector)`. Сцена: `const unsub = gameStore.subscribe(s => s.paused, onPausedChange)` и **обязательный** `unsub()` на `this.events.once(Phaser.Scenes.Events.SHUTDOWN, …)`. В store только «мета»-состояние низкой частоты: экран, пауза, счёт, валюта (зеркало серверной), настройки звука, текущий уровень.
- **Команды React → игра:** типизированная шина (`Phaser.Events.EventEmitter` или `mitt` с картой типов `{ 'game:start': { level: number }, 'game:pause': void }`), без прямого доступа React к объектам сцены. Официальный шаблон даёт `EventBus` — оставить идею, добавить типизацию и правило «отписка в SHUTDOWN».
- **HUD-частота:** счёт/таймер обновлять в store не чаще события (очки начислены) или с троттлингом ~10 Гц, не каждый кадр. Числа, привязанные к объектам мира (урон над врагом), — в canvas.
- **Монтаж:** `PhaserGame.tsx` создаёт `new Phaser.Game` в `useLayoutEffect`, уничтожает `game.destroy(true)` в cleanup; в StrictMode dev двойной mount → guard по ref (как в официальном шаблоне). Один `Game` на всё приложение; смена «экранов» меню — в React, смена уровней — сценами.
- **Overlay-слой:** абсолютный контейнер над canvas с `pointer-events: none`, у интерактивных элементов `pointer-events: auto`; общий kit (Tailwind 4 + shadcn/Base UI, как в 05d) работает без изменений. Не использовать Phaser `DOMElement` для UI. Модалки kit-а — внутри overlay-контейнера (portal target), чтобы fullscreen/safe-area учитывались.
- **Сервер:** TanStack Query (общий query-слой монорепо) — только в overlay (профиль, магазин, лидерборд). Сцена не вызывает API напрямую; результат раунда отправляет overlay/сервисный слой по событию `round:finished`.

### 5. Физика, твины, частицы

| Нужда | Рекомендация | Альтернатива | Заметки |
| --- | --- | --- | --- |
| Физика casual | **Phaser Arcade** (AABB/круги, дёшево) | Matter (встроен в Phaser, `physics-matter` skill) | Arcade покрывает раннеры/платформеры/шутеры; Matter — для «физических» паззлов |
| Сложная/детерминированная физика | `@dimforge/rapier2d-compat` 0.21 (WASM, детерминизм на одной платформе) | Matter | +~1–2 MB WASM (inline base64 в `-compat`) — только по требованию; Matter-js upstream не развивается с 2024 |
| Твины | **встроенные Phaser tweens/timeline** (в игровом цикле, паузятся вместе со сценой) | GSAP 3.15 | GSAP для canvas не нужен при Phaser; при Pixi — GSAP (`gsap.ticker` синхронизировать с Pixi ticker). Для DOM-overlay — CSS/Motion как в kit |
| Частицы | встроенный `ParticleEmitter` Phaser | Pixi `ParticleContainer` | лимитировать количество на LOW-устройствах |
| Скелетная анимация | `@esotericsoftware/spine-phaser-v4` 4.3.13 (лицензия Spine Editor платная) | спрайт-шиты | только если арт делается в Spine |

### 6. Telegram

[факт] (https://core.telegram.org/bots/webapps; последняя версия Bot API для Mini Apps — 10.1, 2026-06-11):
- `requestFullscreen`/`exitFullscreen`, `lockOrientation`/`unlockOrientation`, `safeAreaInset`/`contentSafeAreaInset`, события `activated`/`deactivated`, `isActive`, `addToHomeScreen`, акселерометр/гироскоп — Bot API 8.0+.
- `disableVerticalSwipes` — 7.7+ («disables vertical swipes to close or minimize the Mini App»; свайп по заголовку всё равно закрывает) — обязателен для игр со свайпами.
- `HapticFeedback` 6.1+: `impactOccurred(light|medium|heavy|rigid|soft)`, `notificationOccurred(error|success|warning)`, `selectionChanged()`.
- `CloudStorage` 6.9+: до 1024 ключей на пользователя, ключ 1–128 символов, значение 0–4096 символов. `DeviceStorage` 9.0+: до 5 MB на пользователя. `SecureStorage` 9.0+: до 10 элементов.
- Stars (https://core.telegram.org/bots/payments-stars): цифровые товары внутри Telegram — **только** Stars (`XTR`); выдавать товар только после `successful_payment`; `answerPreCheckoutQuery` в течение 10 с; хранить `telegram_payment_charge_id` для `refundStarPayment`; поддержать `/paysupport`. Всё это — на бэкенде бота.

Реализация [мнение], согласовано с 05c:
- Общий пакет **`packages/telegram-platform`** (`@tma.js/sdk-react` 3.0.23 + `@tma.js/sdk` 3.3.0) — единственное место импорта SDK, тот же для `tma` и `game`. Для игры добавить `game-mode.ts`: `viewport.requestFullscreen()` (после проверки `isSupported()`), `lockOrientation()` для portrait/landscape-игр, `swipeBehavior.disableVertical()`, `closingBehavior.enableConfirmation()` во время раунда.
- Safe area: в fullscreen Telegram рисует свои кнопки поверх контента → HUD позиционировать по `contentSafeAreaInsets` (CSS-переменные `bindCssVars`), а игровое поле (canvas) — на весь экран, важные игровые объекты внутри safe-зоны (Phaser `Scale.EXPAND` + расчёт safe-rect).
- Пауза: `deactivated` (Telegram свернули) + `visibilitychange` → `game.loop.sleep()`/`scene.pause()` + `sound.pauseAll()`; `activated` → не авто-резюм, а показать паузу.
- Haptics — через один хелпер `haptics.ts` с настройкой «вибрация вкл/выкл» и no-op в браузере.
- Покупки: overlay → API бэкенда «создать заказ» → бэкенд `createInvoiceLink` → `invoice.openUrl(link)` → статус `invoice_closed` → инвалидировать query баланса; начисление делает только бэкенд.
- Лидерборды: только через бэкенд (Telegram-лидерборды старой Gaming Platform `setGameScore` — для HTML5 Games через @BotFather; **[мнение]** для Mini App не использовать, свой лидерборд на бэкенде гибче).
- Auth: `initDataRaw` → бэкенд валидирует подпись → сессия (как в 05c).
- Браузерный режим (та же игра вне Telegram): адаптер возвращает no-op/веб-аналоги (`Element.requestFullscreen`, `screen.orientation.lock` — работает только в fullscreen и не на iOS Safari), auth — отдельный путь.
- Слабые устройства: Android `performanceClass` из User-Agent (Bot API 8.0, см. 05c) → снижать DPR (1–1.5), частицы, пост-эффекты, `setFPSLimit(30)` на LOW.

### 7. Сейвы и offline

- **[факт]** В Telegram на iOS и части десктопных клиентов localStorage может не сохраняться между запусками (https://adsgram.ai/blog/adsgram/telegram-mini-app-tma-development-mistakes-and-how-to-avoid-them — сторонний источник, [мнение] перепроверить на устройстве). → Локальный сейв: `DeviceStorage` в Telegram (9.0+), IndexedDB (`idb-keyval` 6.3) в браузере, fallback localStorage; `CloudStorage` — для маленьких настроек (лимит 4096 символов/значение).
- **[мнение]** Формат сейва: `{ schemaVersion, updatedAt, data }` + миграции по версии + валидация Zod при чтении (битый сейв → сброс с логом, а не краш). Авторитетный прогресс (валюта, покупки, рекорды) — сервер; локальный сейв — кеш и offline-прогресс для idle-игр (сервер пересчитывает offline-доход по своим часам).
- **Service worker:** [факт] в iOS WKWebView SW доступен только для App-Bound Domains (макс. 10 доменов) или default-browser приложений (https://developer.apple.com/forums/thread/722160, https://docs.median.co/docs/service-workers) → в Telegram iOS для произвольной Mini App практически недоступен ([мнение], официального заявления Telegram нет). Поэтому: `vite-plugin-pwa` 2.0 (`generateSW`, `runtimeCaching: CacheFirst` для `/assets/`, precache только shell + первый пак) — **опция** веб/PWA-сборки; базовая стратегия для всех — HTTP-кеш с immutable-хешами.

### 8. Анти-чит (фронт) [мнение]

- Фронт считается скомпрометированным: всё в JS читается и меняется (DevTools, Eruda, прокси). Минификация/обфускация — не защита.
- Сервер авторитетен: очки, валюта, инвентарь, покупки, награды. Клиент отправляет не «мой счёт = 99999», а результат раунда с данными для проверки: `seed` (выданный сервером на старт раунда), длительность, лог ключевых событий/инпутов (для детерминированных игр — реплей, который сервер может прогнать той же `logic/`). Для этого `logic/` — чистый TS без движка: его можно исполнить в Node на бэкенде (если бэкенд на Node) или хотя бы применить правдоподобные лимиты (макс. очков в секунду, мин. длительность).
- Rate limit и подпись запроса — дело бэкенда; на фронте — только `initDataRaw`/сессия, никаких «секретных ключей» в бандле.
- Для idle/clicker: начисление по серверному времени; клиентские таймеры только визуальные.

### 9. Тестирование [мнение, кроме версий]

- **Vitest 5 (общий)** — юнит-тесты `logic/` (правила, экономика, генерация с seed, миграции сейвов), store и шины. Покрытие логики — главный гарант. Движок в unit не поднимать (jsdom без WebGL); если очень нужно — Phaser `HEADLESS` режим, но это хрупко.
- **Playwright 1.64** smoke (Chromium + WebKit mobile viewport): страница грузится без ошибок консоли; игра доходит до сцены `Menu`. Для проверки состояния — тестовый хук только в test-сборке (`import.meta.env.VITE_E2E`): `window.__GAME_TEST__ = { scene: () => key, state: () => gameStore.getState(), step(ms) }`. Сценарий: старт → эмуляция клика/тапа по canvas координатам → проверка store. Скриншоты canvas — с фиксированным seed, отключёнными частицами и паузой (`game.loop.sleep()`), threshold > 0 (рендер SwiftShader в CI отличается от GPU). В Telegram-режиме — `mockTelegramEnv` из `packages/telegram-platform`.
- **Перф-бюджеты:** размер (CI-gate): JS initial ≤ ~500 KB gzip, первый пак ассетов ≤ 2–3 MB, атлас ≤ 2048². Runtime (сигнал, не gate — CI-машина без GPU): средний FPS сцены-бенчмарка по `game.loop.actualFps`, `performance.memory`/heap до и после 10 смен сцены (рост → утечка). Реальный FPS — ручной чек-лист на слабом Android и iPhone внутри Telegram.
- Ошибки в проде: `@sentry/browser`/`@sentry/react` 11.x lazy, теги `tg.platform`, `tg.version`, `performanceClass`, renderer type; ловить `webglcontextlost`.

### 10. Docker-деплой

- [мнение] Тот же образ, что у SPA-шаблонов: multi-stage (node build → `nginx:alpine`), static.
- Сжатие: precompress на этапе сборки (`.br` + `.gz` для js/css/json/svg/wasm/atlas json), nginx `gzip_static on` (+ `brotli_static` если используется образ с модулем brotli). PNG/WebP/m4a/ogg не сжимать повторно.
- Кеш: хешированные `assets/*` → `Cache-Control: public, max-age=31536000, immutable`; `index.html`, `manifest.json` ассетов, `sw.js` → `no-cache`. MIME для `.wasm` (`application/wasm`), `.ktx2`, `.webm`, `.m4a`.
- CDN (опционально): ассеты на CDN-домене (`base`/`assetsBaseUrl` из env на этапе сборки), CORS `Access-Control-Allow-Origin` для текстур (WebGL требует CORS для cross-origin изображений) и `crossOrigin: 'anonymous'` в loader.
- Telegram требует HTTPS-домен для Mini App; CSP: разрешить `telegram.org` скрипт только если используется официальный `telegram-web-app.js` (с tma.js не нужен).

### 11. Типичные ловушки (чек-лист для docs/library-notes)

- **WebGL context loss** (iOS WKWebView при сворачивании/нехватке памяти — описано в https://forum.playcanvas.com/t/webgl-context-lost-in-ios-17-wkwebview/34247, https://bugs.webkit.org/show_bug.cgi?id=289601): Phaser 4 восстанавливает рендер сам [факт по анонсу], но render textures/динамически сгенерированные текстуры надо пересоздать; тест — `gl.getExtension('WEBGL_lose_context').loseContext()`.
- **DPR:** canvas размер × `min(devicePixelRatio, 2)`, иначе либо мыло, либо 9× пикселей на iPhone и падение FPS. Pixi: `resolution` + `autoDensity: true`. Phaser 4: `Scale.FIT/EXPAND` + `zoom`/кастомный расчёт, см. `skills/scale-and-responsive`.
- **Утечки при смене сцен:** отписки от store/шины/`window`-слушателей в `SHUTDOWN`; `this.textures.remove()` для уровней-паков; `game.destroy(true)` при размонтировании React; не держать ссылки на объекты сцены в store.
- **StrictMode** — двойной mount создаёт два `Game` без guard.
- **iOS audio:** звук только после жеста; после возврата из фона AudioContext бывает `suspended` → `resume()` на `activated`/первом тапе.
- **Input:** `touch-action: none` на canvas, `user-select: none`, отключить long-press меню (`-webkit-touch-callout: none`), `pointer` events; мультитач — `input.addPointer(n)`; клавиатура — только когда canvas в фокусе, чтобы не ломать поля ввода overlay.
- **Viewport в Telegram** меняется при expand/клавиатуре → resize через `ResizeObserver` на контейнере, не `window.innerHeight`.
- **Phaser v3 vs v4 у ИИ:** модели генерируют v3-API (`setTintFill`, `BitmapMask`, FX pipelines) → правило в CLAUDE.md шаблона: «Phaser 4; перед кодом читать `node_modules/phaser/skills/<topic>/SKILL.md`; миграция — `skills/v3-to-v4-migration`».

### 12. Что шарится, что расходится

| Шарится с другими шаблонами | Расходится (только `game`) |
| --- | --- |
| React 19, TS, Vite 8, Vitest 5, Playwright, ESLint/Prettier, pnpm workspace | движок `phaser` (или `pixi.js`), скрипты упаковки атласов/аудио |
| `packages/ui` + `packages/tokens` (overlay: кнопки, диалоги, магазин, настройки) | в canvas токены не работают как CSS → нужен экспорт токенов в TS (`tokens.ts` с цветами hex/number для Phaser), генерируемый из того же источника |
| `packages/telegram-platform` (с `tma`) | `game-mode.ts`: fullscreen, orientation, vertical swipes, пауза по `deactivated` |
| Zustand 5, TanStack Query + API-клиент, i18n (только overlay; тексты в canvas — через тот же `t()`) | экранная state-machine вместо роутера (TanStack Router не нужен; при желании — только для веб-страниц вокруг игры) |
| Docker/nginx-образ, Sentry, аналитика-адаптер | правила кеширования крупных ассетов, MIME, CORS для текстур |
| Claude-правила кода/архитектуры | правила «React вне игрового цикла», `logic/` без движка, Phaser 4 skills |

## Recommendations for the boilerplate

1. **Шаблон `apps/game`: Vite 8 + React 19 overlay + Phaser 4.2** (exact pin `phaser@4.2.1` через catalog). Мост — по образцу `phaserjs/template-react-ts`, но: без `log.js`, с типизированной шиной, `zustand/vanilla` store, guard от StrictMode, отписками в `SHUTDOWN`.
2. **Слои `logic/` (чистый TS, ESLint `no-restricted-imports` запрещает `phaser`/`react`) → `game/` → `bridge/` → `ui/`.** Это даёт тесты, серверную валидацию и переносимость на Pixi при смене движка.
3. **Overlay из `packages/ui`**, canvas-цвета — из сгенерированного `packages/tokens/dist/tokens.ts`. Не делать UI-kit внутри canvas (кроме мировых подписей).
4. **Пайплайн ассетов:** `scripts/pack-atlases.ts` (free-tex-packer-core) + `scripts/pack-audio.ts` (ffmpeg → m4a + webm/opus, аудиоспрайт JSON) → хешированные файлы + манифест; лоадер-паки по уровням; бюджет первого пака в CI.
5. **Telegram-режим через `packages/telegram-platform`** (общий с `tma`), web-режим — те же интерфейсы с no-op. В init-скрипте: если выбран `game` без `tma`, пакет всё равно ставится (игра — частый TMA-кейс), но может быть удалён флагом.
6. **Сейвы:** адаптер `storage` (DeviceStorage → IndexedDB → localStorage) + `schemaVersion` + Zod; авторитет — сервер.
7. **PWA (`vite-plugin-pwa` 2.0)** — опция init только для веб-игр; по умолчанию выключено.
8. **Claude:** `apps/game/CLAUDE.md` с правилами (Phaser 4, не v3; React вне цикла; отписки; DPR ≤ 2; сервер авторитетен) и подключение `node_modules/phaser/skills` как skills шаблона.
9. **Тесты:** Vitest для `logic/`; один Playwright smoke + один screenshot-тест с seed; размерные бюджеты — gate, FPS/heap — отчёт.
10. **Опции (не в базовом шаблоне):** `game-pixi` (PixiJS 8 + @pixi/react + GSAP + Howler) и `game-3d` (R3F 9 + drei 10) — только если пользователь подтвердит потребность; R3F блокирует React ≥ 19.4.
11. **Избегать:** Howler при Phaser, Phaser `DOMElement` для UI, React state для покадровых данных, `public/assets` без хешей с долгим кешем, localStorage как единственный сейв в Telegram, клиентское начисление валюты.

### Итоговая таблица

| Нужда | Рекомендация | Альтернатива | Риск |
| --- | --- | --- | --- |
| Движок 2D | Phaser 4.2.1 | PixiJS 8.22 + @pixi/react 8.0.5 | ИИ путает API v3/v4; ~358 KB gz без tree-shaking; нет WebGPU |
| Light 3D | three 0.186 + R3F 9.8 + drei 10.7 (опция) | Babylon 9.30 | R3F peer `react <19.4` тормозит React монорепо |
| Сборка | Vite 8.3 (проверено) + отдельный чанк движка | официальный Phaser-шаблон (Vite 6) | шаблон с телеметрией `log.js`, устаревший Vite |
| Атласы | free-tex-packer-core 0.3.9 скриптом | TexturePacker (платный) / AssetPack 1.7 | совместимость AssetPack-атласов с Phaser не проверена |
| Аудио | Phaser WebAudioSoundManager + audio sprites (m4a + Opus) | Howler 2.2.4 / @pixi/sound 6 | iOS silent switch/suspended context; Howler заброшен |
| Мост React↔игра | zustand/vanilla 5.0 + типизированная шина | официальный EventBus | утечки подписок при смене сцен |
| UI overlay | DOM + packages/ui поверх canvas | in-canvas UI (@pixi/ui / Phaser) | pointer-events и safe area в fullscreen |
| Физика | Phaser Arcade | Matter (встроен) / Rapier 2D 0.21 | Rapier +WASM размер; Matter upstream стоит |
| Твины/частицы | встроенные Phaser | GSAP 3.15 (при Pixi) | — |
| Telegram | packages/telegram-platform на @tma.js/sdk-react 3.0.23 | прямой `window.Telegram.WebApp` | tma.js 4.0 в RC — миграция |
| Покупки | Stars: backend createInvoiceLink + invoice.openUrl | — | выдача только после successful_payment на сервере |
| Сейвы | DeviceStorage / IndexedDB (idb-keyval 6.3) + schemaVersion | CloudStorage (≤ 4096 симв.) | localStorage в Telegram iOS ненадёжен |
| Offline | immutable-хеши + HTTP-кеш; vite-plugin-pwa 2.0 как опция веба | Workbox вручную | SW недоступен в Telegram iOS; SW усложняет инвалидацию |
| Анти-чит | сервер авторитетен, seed + реплей/лимиты | — | клиентские проверки обходятся всегда |
| Тесты | Vitest 5 (logic) + Playwright 1.64 smoke/screenshot | Phaser HEADLESS в unit | screenshot нестабилен в CI без GPU |
| Перф-бюджет | gate по размеру; FPS/heap — отчёт + ручной чек-лист | Lighthouse (малополезен для canvas) | реальный FPS виден только на устройстве |
| Деплой | nginx static, precompressed br/gz, immutable assets | CDN для ассетов | CORS для текстур с CDN |
| Аналитика | адаптер событий (PostHog/свой бэкенд) + Sentry 11 lazy | `@telegram-apps/analytics` 1.6.4 | вес SDK; PII из initData не слать |

## Open questions for the user

1. Какие жанры реально нужны: только 2D casual/idle/puzzle (тогда один шаблон на Phaser 4), или нужен вариант light 3D (R3F) — с учётом, что R3F фиксирует потолок версии React для всего монорепо?
2. Игра всегда запускается и в Telegram, и в браузере, или только как TMA? От этого зависит, нужна ли веб-авторизация и PWA-опция.
3. Бэкенд игр (очки, экономика, Stars) — на Node/TS? Если да, `logic/` можно выполнять на сервере для валидации реплеев (сильный анти-чит); если нет — только лимиты правдоподобия.
4. Готовы ли платить за инструменты арта (TexturePacker, Spine), или бойлерплейт должен обходиться только бесплатными (free-tex-packer, спрайт-шиты)?
5. Нужна ли реклама в играх (Adsgram и т.п.) — это отдельная интеграция и влияет на бюджет JS и CSP.

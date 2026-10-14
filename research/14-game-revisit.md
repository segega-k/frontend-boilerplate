# 14. Game template revisit (casual: колесо, слоты, карты + Lottie)
Status: done
Updated: 2026-10-15 14:00

## Resume notes
- Done: всё. F1 durak, F2 dadya-shakhter, F3 сравнение (по [14a] и [15]), F4 пересмотр 05e; рекомендации R1–R12; список правок мастер-плана; вопросы.
- Источники: [14a] = research/14a-game-web.md (версии npm и замеры размеров 2026-10-15), [15] = research/15-game-session-lessons.md (замеры на устройстве из сессии Шахтёра; сильнее веб-источников, здесь не дублируется).
- Next: ничего. Follow-up вне отчёта: прототип колеса + слота + раздачи 36 карт на mid-Android в Telegram (замер FPS, long tasks, время до первого кадра).
- Sub-agent: research/14a-game-web.md — done.

## Summary (≤ 15 lines)
1. Оба реальных проекта — **DOM-игры без canvas-движка**: durak (карты, react-spring + dnd-kit + dotLottie, Colyseus) и Шахтёр (мины + лента-рулетка, CSS/`translate3d` + слои dotLottie в Web Workers + видео). Phaser/Pixi не понадобились ни разу.
2. Рекомендация 05e/§2 мастер-плана (Phaser 4 + React-оверлей по умолчанию) **для заявленных жанров неверна**: 352 KB gz JS без tree-shaking, слабый Lottie (только через текстуру), дублирование UI-кита, хуже a11y и холодный старт [14a].
3. Новый дефолт `game`: **Vite SPA + React + общий kit + DOM/CSS-анимации на `transform/opacity` (WAAPI/Motion) + dotLottie**. Логика анимаций колеса/ленты/карт — чистые TS-функции (кривая → CSS `linear()`, моменты тиков), исполнение — композитор.
4. Lottie — главный риск производительности, не JS-движок: dotLottie на главном потоке в 4–6 раз медленнее lottie-web, 60 fps на iPhone дали только Worker + OffscreenCanvas, холст по bbox, track matte → clip, кадры с частотой анимации, видео-пререндер тяжёлых сцен [15]. Это должно быть готовым пакетом `packages/lottie` в шаблоне, а не знанием, которое каждый проект добывает 58 коммитами.
5. Lottie-плеер: `@lottiefiles/dotlottie-web` 0.81.0 напрямую (свой тонкий React-слой), WASM self-host (`?url` + `setWasmUrl`), 496 KB gz WASM лениво; CSP `wasm-unsafe-eval`, `worker-src 'self' blob:`, `media-src 'self' blob:`; формат приёма — `.lottie`; чек-лист экспорта для дизайнера.
6. Исход всегда от сервера: «разгон по тапу → ответ → посадка на результат» (`planSpin`/`planReel`), reduced motion = сразу результат; провабли-фэйр (commit seed → reveal) как рекомендуемый контракт с бэкендом.
7. Карты: DOM-карты (спрайт колоды), перемещения через FLIP/`layoutId`, flip CSS 3D, drag на pointer events (Motion drag) + альтернатива тап-тап; серверные события → очередь презентации с ожиданием конца анимации (не `setTimeout`, не всё состояние комнаты в React state — урок durak).
8. Canvas — **опция `game-pixi`** (PixiJS 8.22) для сцен с сотнями объектов/шейдерами; Phaser 4 убрать из init (только заметка в docs); `game-3d` убрать.
9. Звук — свой модуль на Web Audio (~1–2 KB, unlock на жесте, пауза на `deactivated`), спрайт-файл + опционально синтез (как в Шахтёре); Howler не нужен.
10. Обязательные части шаблона из опыта: диагностика `?perf=1`, проверка только на прод-сборке, fingerprint ассетов из `public/`, демо-режим без Telegram [15].
11. Мастер-план: менять строки `game` в §1/§2/§3.2, опции init, бюджеты, волну 3 (game раньше shop или своя подволна), риски 7 и новые риски Lottie/iOS — список в конце отчёта.

## Findings

Обозначения: **[факт]** — проверено по коду/гиту/файлам 2026-10-15; **[мнение]** — оценка автора.

### F1. `C:/Работа/durak` — мультиплеерный «Дурак» (TMA, прод)

**Стек [факт]** (`package.json`, последний коммит 2026-01-29, 1766 коммитов): Nx 22 монорепо (frontend, backend, api, bot, autobots, gift-relayer); фронт React 19.2.3, Vite 7.3, Tailwind 4.1, MobX 6.15 + mobx-react 9, react-router-dom 7, i18next, Radix, embla, `@tma.js/sdk-react` 3.0.15, Sentry, PostHog/Umami, Adsgram, eruda. Анимация: `@react-spring/web` 10.0.3, drag: `@dnd-kit/core` 6.3.1, Lottie: `@lottiefiles/dotlottie-react` 0.17.13 (тянет `dotlottie-web` 0.61.0). Сервер: Colyseus 0.16 + `@colyseus/schema` 3 + uWebSockets, MongoDB, Redis.

**Рендеринг [факт]:** чистый DOM, без canvas-движка.
- Карты: одна JPG-спрайт-карта колоды 2990×1380 (13×4 карт 230×345), каждая карта — `div` с `background-position`/`background-size` (`features/card/ui/Card.tsx`). Кастомные колоды — подмена URL спрайта. Рубашка — отдельный PNG. Переворота карт (3D flip) нет.
- Веер руки: каждая карта `position: fixed`, угол и сдвиг считаются в JS от `window.innerWidth`, `transition: bottom .3s, rotate 1s, left .3s` (`CardInFan.tsx`).
- Перемещения (раздача, ход, взятие, «бито», перевод): `useSprings` react-spring по **`left`/`top` в процентах** (`shared/hooks/cardsAnimations/*.ts`) — анимируются layout-свойства, а не `transform`, т.е. layout/paint на каждом кадре [мнение: главная причина серии фиксов «animation performance»]. Тайминги склеены магическими `setTimeout` (раздача 3000 мс, показ руки через 4500 мс, `CardFan.tsx`).
- Drag карт: `@dnd-kit/core` `useDraggable` + `useDndMonitor`; при `onDragEnd` клиент сам решает (attack/defend/transfer) и шлёт `room.send('game', …)`, оптимистично убирает карту из веера.
- Lottie: эмодзи-реакции, утки в покупке/обмене, звёзды — `DotLottieReact` из `.lottie`/`.json` в `public/`.
- Звук: один `<audio src="/audio/alarm.mp3">` (таймер хода) + Telegram haptics.

**Состояние и сервер [факт]:** сервер авторитетен (Colyseus room, колода `ArraySchema.shuffle()` на сервере, валидация хода на сервере, ошибки приходят кодами `badCards`, `notYourMove`…). Клиент на каждый `onStateChange` делает `state.toJSON()` и кладёт **всё дерево игры** в React `useState` (`app/providers/GameProvider.tsx:502`) → перерисовка стола целиком на каждый патч. События для анимаций — массивы в `useImmer` (`playerPutCard`, `playerTookCards`…). MobX — для меты (баланс, бусты, профиль), игровое состояние — в React context.

**Что болит [факт → мнение]:**
- Около 25 коммитов `fix: card animation` / `fix: animations, optimization` за 2025-04…07 — анимации хрупкие: проценты от `window`, layout-свойства, таймеры вместо событий окончания, `key={index}`.
- Правила хода дублированы: `libs/shared/common/src/utils/game/cardValidation.ts` и отдельные копии во фронте (`shared/lib/game/cardCanBeUsedForDefend.ts`, `features/card/lib/*`).
- `LazyLottie` (`shared/ui/LazyLottie.tsx`, «reduces initial bundle by ~1.8MB») написан, но **нигде не используется**: 8+ файлов импортируют `DotLottieReact` напрямую.
- WASM-рендерер dotLottie (1 545 564 байт, 630 871 gzip -9) грузится по умолчанию **с jsDelivr** (`setWasmUrl` не вызывается) — внешняя зависимость в проде TMA.
- В `public/` лежат дубли `.lottie` и `.json` (30 + 36 файлов, есть скрипт `scripts/convert-lottie-to-json.mjs` на fflate); `stars.json` 1.35 MB; `public/` 18 MB без хешей в именах.
- Тестов фронта нет (ни одного `*.spec`/`*.test`). `apps/frontend/CONTEXT.md` устарел (React 18, Zustand) — дрейф доков.
- Перемешивание колоды — `ArraySchema.shuffle()` (Math.random), стартовый игрок — `Math.random()` (`startGame.ts:692`) [мнение: для игр на деньги нужен CSPRNG и commit-reveal].

**Что хорошо [мнение]:** DOM-подход для карточной игры себя оправдал по скорости разработки и UI (модалки, тосты, магазин — тот же React + Tailwind + Radix); сервер авторитетен; одна спрайт-карта колоды — дёшево и кастомизируемо; dnd-kit дал touch-drag без своего кода.

### F2. `C:/Работа/Shakhter/dadya-shakhter` — Gift Miner «Дядя Шахтёр» (TMA, 2026-07…10)

**Стек [факт]:** форк собственного бойлерплейта `nmime/nest-react-boilerplate` (CLI `pnpm nrb setup`, OpenSpec, AGENTS.md, 678 коммитов, последний 2026-10-12). Nx 23, pnpm 11, Node 24. `apps/frontend/app` (user-app): React 19.2.3, Vite 8.1.5, Vitest 4.1, Playwright 1.61, Tailwind 4.3, `@tma.js/sdk-react` 3.0.23, `mobx-react-lite`, TanStack Query, **`@lottiefiles/dotlottie-web` 0.80.0** (без React-обёртки), `pako`, `@tonconnect/ui-react`. Бэкенд NestJS + Postgres.

**Механики [факт]** (`openspec/specs/gift-miner/spec.md`, 1489 строк): «Mines» 5×5 (6/9/12 мин по риску), бросок кирки маскота в кристалл, кэш-аут по множителю; «Мегаящик» — кейс-рулетка с горизонтальной лентой призов; подарки Telegram (TGS-стикеры), Stars, TON.

**Server-authoritative + provably fair [факт]:** сервер коммитит seed (hash), выводит мины и множители детерминированной fixed-point арифметикой (`exact_rational_v2`), раскрывает seed после раунда для проверки; клиент только показывает. Но `pages/shakhter/game-math.ts` — **клиентская копия** серверной математики («MUST stay identical to … shakhter-rng.ts»), паритет держится тестами с обеих сторон.

**Рендеринг [факт]:** DOM-сцена из слоёв на общем артборде 1440×2560: неподвижные части — `<img>` SVG, живые цифры HUD — DOM-текст, анимированные части — ~10 Lottie-слоёв, **каждый в своём `<canvas>`** (`game-scene/lottie-layer.tsx`, 1720 строк). Canvas, а не SVG-рендер: «кадр маскота разворачивается в тысячи узлов». Последовательностью управляет экран игры; слой только показывает кадры (frame-addressed: стоп на кадре петли, удержание замаха, one-shot, seek без ложных событий). Таблица «фаза раунда → какие слои горят» — чистая функция `round-presentation.ts` с тестами без canvas.

**Путь к 60 fps — хроника боли [факт, git log + комментарии в коде]:**
1. `lottie-web` 5.13 → `@lottiefiles/dotlottie-web` 0.80 (2026-09-29, PR #41 «perf: migrate scene and gift animations to dotLottie»). Важно [15]: lottie-web canvas на главном потоке тормозил на iPhone 16 Pro Max, а dotLottie **на главном потоке был в 4–6 раз медленнее lottie-web** — выигрыш дала только связка dotLottie + Web Worker; WASM self-host: `import wasmUrl from '@lottiefiles/dotlottie-web/dotlottie-player.wasm?url'` + `DotLottie.setWasmUrl()` + `preload()` (`libs/frontend/ui-web/lib/src/gift-miner/dotlottie-runtime.ts`); CSP получил `script-src 'self' 'wasm-unsafe-eval'` (nginx-spa.conf, Helm).
2. Замер на главном потоке: спуск при DPR 2 ~19 мс/кадр на быстром десктопе и 89 мс при 4× CPU throttle; покой шахты 14 / 61 мс → «главный поток не успевал ни кадров, ни касаний».
3. `DotLottieWorker` + `OffscreenCanvas`: три render-воркера (спуск, маскот, остальное), главному потоку остаётся ~0.5–3 мс; fallback на главный поток, если воркеры не готовы за 5 с. Цена: асинхронность команд — стоп-кадры «берутся на шаг вперёд», устаревшие сообщения о кадрах отбрасываются (класс `WorkerScene`).
4. Track mattes: с программной канвой покой шахты 81 мс вместо 3 мс → `scene-mattes.ts` (356 строк) при загрузке переписывает 99 дорожек-масок в clip-маски.
5. ThorVG рисует слой с AE-expression как полноэкранный красный прямоугольник → слой вырезается по `ind`.
6. Интро-спуск (intro.json 1.59 MB) даже в воркере стоил 20–35 мс/кадр → пререндер в H.264 (`intro.mp4` 1.26 MB, 864 px, CRF 27) тулзой `pnpm images:lottie-video` тем же рендерером; Lottie — fallback со сниженной плотностью пикселей.
7. Прогрев: в idle по одному слою за задачу; ничего при Save-Data/2G; при < 4 GB памяти — только спуск; постер первого кадра (`images:lottie-thumbs`) чтобы не было пустого экрана.
- Итог: 58 коммитов про lottie/scene/layer/worker из 152 по gift-miner.

**Кейс-рулетка (паттерн слота/колеса) [факт]:** `pages/shakhter/case-reel-motion.ts` — чистый DOM: лента `translate3d` + CSS `transition` с easing `linear(…)`, **сгенерированным из чистой TS-функции** `caseReelProgress` (разгон smoothstep 5% времени, степенное торможение, перелёт 0.15 плитки, возврат косинусом; разброс остановки ±0.2 шага внутри выигравшей плитки; «не больше половины плитки за кадр»); там же `caseReelTickTimes` — моменты щелчков для `hapticFeedback.selectionChanged()` только на редеющих щелчках торможения. Исход от сервера; при reduced motion лента сразу стоит на призе. Покрыто `case-reel-motion.spec.ts`. [мнение] Это эталон для шаблона: 0 KB движка, 60 fps на композиторе, точная посадка на серверный результат.

**Прочее [факт]:**
- Звук: синтез WebAudio-осцилляторами (`gameSoundNotes`: select/throw/safe/win/lost), без файлов; флаг звука в localStorage.
- Reduced motion: `useSyncExternalStore` на `matchMedia` (живое переключение); Lottie замирает на своём кадре, паузы схлопываются, но лимиты загрузки не обнуляются.
- Ассеты: плагин `vite/public-asset-versions.ts` дописывает `?v=<sha256:8>` к файлам `public/` и генерит nginx `map` для `immutable` — ровно проблема «public без хешей» из 05e; 46 Lottie JSON (маскот ~520 KB на файл), 18 MB `public/`. TGS-стикеры подарков (gzip Lottie) распаковываются `pako` на лету.
- Тесты: Vitest рядом с каждым модулем (спеки больше кода: `shakhter-game-page.spec.tsx` 3777 строк), Playwright со скриншотами (`gift-miner-active-round`, `safe-area`, `cold-start`).

**Что болит [мнение по фактам]:** `shakhter-game-page.tsx` — **8778 строк**, `shakhter.css` — **12 757 строк**, `game-scene.css` 1775 — монолит, сгенерированный ИИ (спеки и комментарии многословны, OpenSpec-проза 1489 строк). Lottie-сцена на весь экран потребовала воркеров, переписывания масок, вырезания слоёв, видео-фолбэка — то есть «Lottie как основной рендер сцены» дорог; «Lottie как вставки» (эмодзи, празднование, иконки) дёшев.

### F3. Сравнение стеков для колеса, слотов и карт (по [14a], [15] и F1–F2)

Версии и размеры [факт, 14a §0–1, registry 2026-10-15; gzip -9]:

| Вариант | Ключевые пакеты | JS сверх React (gz) | WASM (gz) | Здоровье |
| --- | --- | --- | --- | --- |
| **A. DOM/SVG + CSS/WAAPI + Motion + dotLottie** | `motion` 14.2.0, `@lottiefiles/dotlottie-web` 0.81.0 | Motion: `useAnimate` mini 3.5 KB, hybrid 24.5 KB, `motion`+`AnimatePresence` 46.8 KB; dotLottie JS 13.8 KB (+ worker 15.5 KB) | 496 KB, лениво | всё активно (Motion 2026-10-13, dotLottie 2026-10-06) |
| B. PixiJS 8 + @pixi/react + GSAP | `pixi.js` 8.22.0, `@pixi/react` 8.0.5, `gsap` 3.15.0 | ~177 KB + GSAP 28 KB | + 496 KB, если Lottie | pixi активен; `@pixi/react` без релизов с 2025-12; Lottie-плагина нет |
| C. Phaser 4 + React-оверлей (05e) | `phaser` 4.2.1 | 352 KB, не тришейкается | + 496 KB, если Lottie | релизы раз в ~2 мес. |
| D. Rive | `@rive-app/canvas-lite`/`webgl2` 2.44.2 | ~72 KB | 315–903 KB | активно; экспорт .riv платный с 2025-10-20 |

Оценка по критериям [мнение, с опорой на факты из 14a/15]:

| Критерий | A | B | C | D |
| --- | --- | --- | --- | --- |
| Контроль и качество для колеса/ленты/карт | высокое; доказано Шахтёром (лента) и durak (карты) | максимальное для частиц/шейдеров | высокое + физика (не нужна) | лучшее для дизайнерских SM-анимаций, хуже кодовый контроль посадки |
| Lottie | нативно (DOM-слои canvas, Worker) — путь проверен [15] | через canvas→Texture, кадр на аплоад | то же | не Lottie, второй рантайм |
| Холодный старт TMA mid-Android | лучший: игровой экран — обычный роут, WASM параллельно | средний | худший (парс 352 KB) | средний |
| 60 fps | да на `transform/opacity`; Lottie — только с конвейером [15] | да с запасом на сотни спрайтов | да | да для 1–5 артбордов |
| Drag карт | pointer events / Motion drag; durak на dnd-kit работал | свой код | Phaser input | вручную |
| A11y | семантический DOM, фокус, `aria-live` (Шахтёр объявляет «Открываем кейс…») | DOM-тени | слабая | слабая |
| UI-kit и токены | 100 % | HUD в DOM, токены в сцену через TS | оверлей + дубли стилей | частично |
| AI-агенты | Motion/CSS — огромный корпус; dotLottie нужен локальный skill | pixi `skills/` в npm (26) | phaser `skills/` (36), путают v3/v4 | новый API data binding |

Вывод: **A по умолчанию**. Узкое место A — не JS, а растр Lottie; оно решается конвейером из [15] (R3). B — опция для будущих «тяжёлых» сцен. C и D в шаблон не входят.

### F4. Что из 05e остаётся, что меняется

| 05e | Вердикт | Почему |
| --- | --- | --- |
| Движок Phaser 4 по умолчанию, Pixi альтернатива, R3F опция | **заменить**: DOM + Motion + dotLottie; Pixi — опция; Phaser и R3F — убрать из init | реальные игры пользователя — DOM; Phaser даёт 352 KB и ничего нужного (физика, тайлмапы) |
| `logic/` чистый TS без движка, ESLint-запрет импортов | **оставить и усилить**: сюда же планировщики анимации (кривые, углы, тики) и таблица «фаза → слои» | Шахтёр: `case-reel-motion.ts`, `round-presentation.ts` тестируются без canvas |
| Мост `zustand/vanilla` + шина | **заменить** на MobX (решение мастер-плана) + очередь презентации | в DOM-варианте нет второго мира, мост не нужен; нужна очередь «серверное событие → анимация → следующее» |
| React только оверлей | **снять**: React рендерит всю игру, покадровые значения — вне React (WAAPI/CSS, refs, Lottie-плеер) | durak: всё дерево комнаты в `useState` → перерисовка стола на каждый патч |
| Атласы free-tex-packer, аудио-спрайты | **упростить**: спрайт колоды/символов как обычные картинки Vite; аудио-спрайт по желанию; новое — Lottie-конвейер и видео-пререндер | атласы нужны движку, DOM-у — нет |
| Хешированные ассеты, `public/` без хешей нельзя `immutable` | **оставить**: перенять плагин fingerprint `public/` из Шахтёра | обе игры держат 18 MB в `public/` |
| Telegram `game-mode` (fullscreen, swipes, пауза) | **оставить** + нижний inset двигает всю сцену, fullscreen только на мобильных [15 §C] | |
| Сейвы IndexedDB/DeviceStorage | **понизить в опцию**: в казино-механиках состояние на сервере | |
| Анти-чит: сервер авторитетен | **оставить** + провабли-фэйр как рекомендуемый контракт | Шахтёр: commit/reveal seed; durak: Math.random на сервере |
| Тесты: Vitest для logic, Playwright smoke с seed | **оставить** + тесты планировщиков, e2e только на прод-сборке, CSP-тест на откаты [15] | |
| Бюджет game ≤ 500 KB gz | **снизить**: initial ≤ 180 KB gz JS; WASM dotLottie ≤ 500 KB gz отдельно и лениво | A не тянет движок |

## Recommendations for the boilerplate

Приоритет: R1–R6 обязательны для шаблона, R7–R12 — опции и процесс.

**R1. Стек `apps/game` по умолчанию** [мнение]: Vite 8 SPA + React 19 + общий kit/токены + TanStack Router (как tma) + MobX + TanStack Query; анимации — CSS/WAAPI на `transform`/`opacity`; `motion` 14.2 (`motion/react` для `layoutId`/drag/`AnimatePresence`, `animate()` для императивных последовательностей; `LazyMotion` где можно); `@lottiefiles/dotlottie-web` 0.81.0 (exact pin). GSAP не в базе (лицензия не MIT, дублирует Motion); подключать, только если нужен `CustomEase`/`MotionPath` [14a §5]. react-spring и dnd-kit не брать (durak: анимация layout-свойств; dnd-kit стоит с 2024-12, `@dnd-kit/react` ещё 0.x). Игра может жить отдельным app или маршрутом внутри `tma` — структура одинаковая.

**R2. Структура** [мнение]:
```
apps/game/src/
  logic/          чистый TS: правила, маппинг ответа сервера в исход, планировщики движения
    spin/plan-spin.ts      угол посадки: целевой сегмент + целые обороты + разброс ±0.35 сегмента
    reel/reel-curve.ts     кривая разгон→торможение→перелёт→возврат, генерация CSS linear(), моменты тиков (из Шахтёра)
    cards/                 раскладка веера/стола: (x, y, angle) от размера контейнера, не от window
    presentation/          «фаза раунда → какие слои/клипы играют» (как round-presentation.ts)
  animation/      исполнение: WAAPI/Motion-хелперы, очередь презентации, sound, haptics, reduced-motion
  lottie/         сцены и слои поверх packages/lottie, переходы по позам
  features/<mechanic>/     wheel | reel | cards — UI + VM (MobX)
  platform/       telegram game-mode, perf-диагностика
```
ESLint: `logic/` не импортирует React, MobX, DOM, `motion`, dotLottie (тесты в Node, переносимость на сервер или Pixi).

**R3. Пакет `packages/lottie`** — конвейер из [15 §A] как код, а не знание: WASM с собственного origin (`dotlottie-player.wasm?url` + `setWasmUrl` + `preload()`), `DotLottieWorker` + OffscreenCanvas с автоматическим откатом на главный поток (таймаут, причина отката видна в диагностике), холст по bbox слоя, переписывание track matte → clip при загрузке, рендер с частотой анимации, DPR 1.5 с падением до 1 при < 45 кадров в первую секунду, API поз (`enterAt`, `holdAt`, `onFrame`) с учётом задержки воркера, пред-сборка плееров в idle, пул и освобождение, reduced motion → кадр-постер. Для простых вставок (эмодзи, празднование, иконка) — «лёгкий» режим: один плеер на главном потоке, лениво. Не повторять ошибок durak: WASM с jsDelivr, неиспользуемый `LazyLottie`, дубли `.lottie`/`.json`.

**R4. Lottie-ассеты**: формат приёма `.lottie` (сжатый ZIP, темы/слоты); чек-лист экспорта для дизайнера (без expressions — ThorVG рисует их неверно; эффекты запечены; минимум масок; без merge paths; общий риг; бюджет КБ на файл) [15]; скрипт `pnpm lottie:audit` (слои, маски, track mattes, expressions, заливки на кадр, размер) в CI как отчёт; `pnpm lottie:poster` (кадр-постер) и `pnpm lottie:video` (H.264-пререндер тяжёлых непрозрачных сцен через ffmpeg) — по образцу tooling Шахтёра; `play()` видео только в обработчике тапа (iOS), поток, если не докачалось, Lottie как запасной путь [15]. Темизация — слоты цвета/текста dotLottie (сумма выигрыша, акцент из токенов). Fingerprint файлов из `public/` + nginx `immutable` (как `vite/public-asset-versions.ts` Шахтёра).

**R5. Исход от сервера** [паттерн обеих игр + 14a]: тап → немедленный разгон (вращение/лента на постоянной скорости скрывает латентность) → ответ `{ outcomeIndex, roundId, serverSeedHash }` → `planSpin`/`planReel` считает посадку с начальной скоростью, равной текущей → тики (звук + `selectionChanged`, не чаще 120 мс, только на торможении) → `complete` → празднование Lottie → баланс обновляется в момент показа, не раньше. Ошибка API во время разгона: плавная остановка в нейтральной позиции + сообщение, без «выигрыша»; повтор — идемпотентный ключ раунда. Reduced motion — сразу результат. Клиентская копия математики (как `game-math.ts`) — только для показа; паритет держат общие фикстуры из контракта. Рекомендуемый контракт с бэкендом: commit seed → reveal (provably fair), CSPRNG на сервере.

**R6. Карты** [мнение]: DOM-карта со спрайтом колоды (одна картинка, как durak) или SVG; раскладки — чистые функции от размера контейнера (`ResizeObserver`), не от `window`; перемещение рука ↔ стол ↔ отбой — FLIP (`layoutId`) на `transform`; переворот — CSS 3D `rotateY` + `backface-visibility`; drag — pointer events / Motion `drag` + hit-test зон, плюс доступный путь «тап по карте → тап по цели» и клавиатура; серверные события → нормализованный MobX-стор (патчи, не `toJSON()` всего дерева) + **очередь презентации**, где событие ждёт `finished` своей анимации, а не `setTimeout(4500)`; ключи — id карты, не индекс; правила хода — один модуль (у durak три копии).

**R7. Звук**: `animation/sound.ts` на Web Audio: один `AudioContext`, `resume()` на первом `pointerdown` и на `activated`, пауза на `deactivated`/`visibilitychange`, mute в настройках, SFX-спрайт (m4a + webm/opus) и/или синтез тонов (как в Шахтёре; `zzfx` 1.4 как опция). Howler и `@pixi/sound` не брать.

**R8. Диагностика и проверка** [15]: `?perf=1` / `startapp=perf` — путь рендера и причина отката (worker/main/video), fps, long tasks, пропуски видео, CSP-нарушения (`securitypolicyviolation`), класс устройства из UA Telegram-Android (`LOW|AVERAGE|HIGH`), build hash; отчёт копируется текстом. Перф и e2e только на прод-сборке; e2e-тест, что воркер и видео не откатились из-за CSP. Деградация по `LOW` + `Save-Data` + памяти.

**R9. CSP-профиль `game`**: `script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; media-src 'self' blob:`; без `unsafe-eval` (поэтому не full-build lottie-web), без внешних CDN; MIME `application/wasm`, `video/mp4`.

**R10. Опция `game-pixi`**: PixiJS 8.22 (+ `@pixi/react` 8 или императивный mount) как один canvas-слой внутри того же DOM-шаблона (HUD и модалки остаются kit); Lottie в Pixi — через canvas→Texture, только 1–3 анимации; подключить `node_modules/pixi.js/skills`. Включать при > 100–200 одновременно движущихся объектах, шейдерах/фильтрах, Spine. Для одиночного «монетного дождя» в базе — маленький 2D-canvas слой частиц без движка. Phaser 4 — строка в docs «для аркад с физикой и сценами», не опция init.

**R11. Rive** — не в шаблоне; заметка в docs: `@rive-app/canvas-lite` для интерактивных state-machine кнопок/маскотов, если есть Rive-дизайнер и платный план (экспорт платный, ≥ 315 KB gz WASM, второй рантайм рядом с Lottie).

**R12. Для агентов**: `apps/game/CLAUDE.md` + skills `game-lottie` (API `packages/lottie`, чек-лист ассетов, откаты, CSP) и `game-motion-recipes` (колесо, лента/слот, раздача/переворот/drag карт, исход от сервера, reduced motion) с эталонными тестами (`plan-spin`: угол → индекс сегмента; кривая ленты: не больше половины плитки за кадр, указатель не покидает выигравшую плитку). Правила с lint: только `transform`/`opacity` в анимациях; запрет анимации `left/top`; запрет `setTimeout` для синхронизации с анимацией; `max-lines` для файлов `features/*` (Шахтёр: страница 8778 строк, CSS 12 757 строк).

### Init-опции `game` (итог)

| Опция | Что ставит | По умолчанию |
| --- | --- | --- |
| примеры механик `wheel`, `reel` (слот/кейс), `cards` | пример на каждую в `features/` + тесты планировщиков; невыбранные удаляются | `wheel` + `reel` |
| `lottie-video` | скрипты пререндера в H.264 и постеров (ffmpeg в dev/CI) | выкл. |
| `realtime` | интерфейс транспорта + нативный WebSocket или `colyseus.js` | выкл. (предлагается с `cards`) |
| `game-pixi` | PixiJS 8 canvas-слой + skills | выкл. |
| `ton-connect`, `tg-analytics`, `analytics`, `pwa` | как в tma (`pwa` только веб-сборка) | выкл. |
| убрать | `game-3d`, Phaser, `gsap` для game (оставить landing) | — |

### Что изменить в мастер-плане (`research/12-master-plan.md`)

1. **«Коротко» и §1/§2, строка `game`**: «Vite + Phaser 4 + React-оверлей» → «Vite SPA + React + kit, DOM/CSS-анимации (Motion) + dotLottie (`packages/lottie`, Worker); canvas — опция `game-pixi`». «Для чего»: «казуальные механики: колесо, слоты/кейсы, карты, мины; браузер и TMA». «Чем жертвует»: «SSR, SEO; сцены с сотнями объектов без `game-pixi`» (a11y больше не жертвуется).
2. **§2 опции init**: убрать `game-3d`; `gsap`/`lenis` — только landing; добавить `game-pixi`, `lottie-video`, `realtime`, выбор примеров механик.
3. **§1 «Ядро `packages/*`»**: добавить `lottie` (game; опционально tma/landing для вставок); в `telegram-platform` — `game-mode`.
4. **§3.2, колонка game**: Данные — «`logic/` чистый TS (правила, планировщики движения, таблица фаз) → MobX VM + очередь презентации → UI; realtime через адаптер» (вместо «`bridge/` MobX + шина»); Специфика — «Lottie-конвейер (Worker, bbox, matte→clip, видео-пререндер), исход от сервера, fingerprint `public/`, `?perf=1`, CSP-профиль» (вместо «атласы, аудио-спрайты, сейвы»); Тесты — «Vitest: logic + планировщики; Playwright на прод-сборке, тест CSP-откатов».
5. **§3.2 правила kit / §6 режим Experience**: «HUD не из общего kit» уточнить — HUD стилизуется материалом мира (токены приложения), но компоненты kit (диалоги, листы, кнопки, фокус) используются; добавить в kit `ModalPresence` и hover-токены [15].
6. **§11 волны**: game по сложности теперь близок к tma — `apps/game` + `packages/lottie` в волну 2 (после tma) или подволной 3a до shop. Критерий выхода «game smoke с seed» → «колесо и лента садятся на серверный исход (тесты); 60 fps на прод-сборке на mid-Android и iPhone в Telegram по `?perf=1`; CSP-тест без откатов».
7. **§13 риски**: риск 7 — «Phaser 3 API» заменить на «устаревшие Lottie-API (`lottie-web`, `@dotlottie/player-component`), `framer-motion` вместо `motion/react`, анимация `left/top`»; добавить: (а) Lottie-сцены не держат 60 fps на iPhone без Worker-конвейера и ассетов по чек-листу → `packages/lottie` + `lottie:audit` + видео-пререндер [15]; (б) iOS: `play()` вне жеста, Low Power Mode, OffscreenCanvas с 16.4 → `play()` в тапе, откат с причиной; (в) CSP молча выключает Worker/видео/WASM → CSP-профиль + e2e; (г) эмуляция врёт о fps → замер только на устройстве и прод-сборке.
8. **§13 бюджеты**: `game ≤ 500 KB gz` → `game initial ≤ 180 KB gz JS; WASM dotLottie ≤ 500 KB gz, лениво, с собственного origin; бюджет на Lottie-файл в DESIGN.md (ориентир 150–300 KB .lottie)`.
9. **Docker/nginx snippets**: CSP-профиль game, MIME `application/wasm`/`video/mp4`, карта `immutable` для fingerprint `public/`.
10. **§12 подтверждения**: добавить вопрос 1 ниже (смена дефолта game). 05e и 05-templates в части движка считать устаревшими (ссылка на этот отчёт).

## Open questions for the user

1. Подтвердить смену дефолта `game`: DOM + Motion + dotLottie вместо Phaser 4; canvas только опцией `game-pixi` (PixiJS 8); Phaser и `game-3d` убрать из init (совпадает с вопросом 1 из [15]).
2. Мультиплеер карт в реальном времени: адаптер под Colyseus (как durak) или только интерфейс транспорта + нативный WebSocket? Бэкенд внешний, но клиент Colyseus привязывает к его серверу.
3. Игра — отдельное приложение `apps/game` или маршрут внутри `apps/tma` (в обоих реальных проектах лобби и игра — одно TMA)? Предложение: один шаблон, init спрашивает «отдельно / внутри tma».
4. Записать provably fair (commit seed → reveal, CSPRNG) как рекомендуемый контракт с бэкендом для всех механик на Stars/деньги?

# Frontend boilerplate — мастер-план

2026-10-15 · время чтения ~25 минут · ссылки вида [05b §6] ведут в `research/`

## Коротко

- Строим репозиторий, из которого одной командой получается рабочий фронтенд-проект: pnpm-монорепо с выбранными
  шаблонами, общим UI-китом и токенами, настроенным Claude Code, проверками, Docker и CI на GitHub. Бэкенд внешний по
  OpenAPI, деплой на своих серверах, только веб.
- Шаблоны: `landing` (Astro static), `blog` (Astro static, общий слой с landing), `shop` (Next 16 + headless
  commerce через адаптеры), `tma` (Vite SPA + `@tma.js`), `admin` (Vite SPA + TanStack Router/Table + OIDC),
  `game` (Vite SPA + kit, DOM/CSS-анимации + dotLottie; canvas-игры — будущий отдельный шаблон). Общее: React 19,
  Base UI kit, Tailwind через `tv()` в файлах-спутниках, MobX без DI + TanStack Query, i18next, Vitest/Playwright,
  плавные переходы экранов из kit, все устройства и способы ввода.
- AI-слой: корневой `CLAUDE.md` ≤ 200 строк, правила в `.claude/rules` по путям, 18 skills, 6 агентов, 4 хука, один
  гейт `pnpm verify` и drift-тест `pnpm ai:check`; память только в репо; guard блокирует незапрошенный push.
- Дизайн-система: режимы Operate/Persuade/Read/Experience, обязательный `DESIGN.md` на приложение, ~45 жёстких
  анти-слоп правил, почти все на lint уровня error.
- Init: `pnpm run setup` вычитает невыбранное по манифесту, проверяет сборку, умеет dry-run и откат; pixel-perfect по
  Figma — модуль, работающий со снимком макета в репо (бесплатный план Figma).
- Три волны: ядро + tma + admin + AI + init → landing + blog + game + anti-slop → shop + Figma-модуль + CI-ревьюер;
  дальше roadmap: canvas-игры на PixiJS и универсальный сайт (`site`, отчёт 16).
- Все ключевые решения подтверждены пользователем (§12): Astro и Next в разных шаблонах, Tailwind через `tv()`, game
  без canvas-движка, тема TMA по умолчанию из Telegram с брендовым слоем, auth админки PKCE с порогом к BFF,
  Figma-экспортёр запускает пользователь, человеческие доки на английском с `README.ru.md`.

## 1. Что это

| Слой | Содержимое | Откуда |
| --- | --- | --- |
| Шаблоны `apps/*` | 6 шаблонов, любое подмножество | [05], [14], пользователь |
| Ядро `packages/*` | `ui`, `tokens`, `api` (клиент, маппинг ошибок, мост Query↔MobX), `i18n`, `config`, `telegram-platform` (+ game-mode), `lottie` (Worker-конвейер dotLottie для game и tma), `analytics`, `astro-shared` | [01 R1], [05 §5], [14 R3] |
| Правила | архитектура, код, компоненты, дизайн, безопасность; каждое с проверкой или пометкой `manual` | [03], [04], [07], [10], [11] |
| AI-слой | дерево `CLAUDE.md`, rules, skills, agents, hooks, settings, гейты | [08], [15] |
| Init | выбор, вычитание по манифесту, проверка, откат | [06] |
| Инфраструктура | Dockerfile на приложение, общие nginx/security snippets (включая CSP-профиль game), compose, GitHub Actions, runbooks | [05], [10], [11], [14 R9] |
| Модули | pixel-perfect по Figma, anti-slop enforcement, аналитика с consent | [07], [09] |

Сознательно нет: Nx, Tamagui/RNW/React Navigation, tsyringe и декораторов, Redux, второго генератора API,
werf-пайплайна в чужом репо [02], CRUD-фреймворков [05d], UI-библиотек со своим дизайн-языком [05 §5], canvas-движка в
шаблоне игры (Phaser, R3F; Rive только заметкой в docs; canvas-игры на PixiJS — будущий отдельный шаблон) [14].

Принципы (правила пользователя): каждый шаблон работает на macOS, Windows, iOS и Android, с касанием, мышью и
клавиатурой, на любом размере вьюпорта; каждый шаблон имеет плавные переходы между экранами из общего механизма kit,
с учётом `prefers-reduced-motion`, проверенные в iOS Safari/WebView, Android WebView и на десктопе; при готовом дизайне
агент реализует макет без собственных визуальных идей, а «vibe»-процесс §6 применяется только там, где дизайна нет.

Критерий результата: после `git clone` и `pnpm run setup` любой агент на любой машине работает по одним правилам, проект
собирается и запускается, а человек без ИИ проходит «симптом → файл → правка → выкладка» за 30 минут [11 R1].

## 2. Шаблоны и опции

| id | Для чего | Рендеринг / рантайм | Чем жертвует |
| --- | --- | --- | --- |
| `landing` | промо, маркетинг | Astro 7 static, React-острова, nginx; опция `landing-node` | клиентское состояние, data grid, общий React-контекст между островами [05a] |
| `blog` | статьи, авторы, RSS; опция `docs` (Starlight) | Astro 7 static; общий слой в `packages/astro-shared` | то же |
| `shop` | headless commerce: каталог, PDP/PLP, корзина, чекаут через провайдера, аккаунт | Next 16.4 + Cache Components, Node standalone | игровая анимация, offline; цена: Turbopack и RSC-правила kit для всех [05b] |
| `tma` | Telegram Mini App, Stars, TON Connect (опция) | Vite 8 SPA, nginx | SSR, SEO, PWA (iOS WKWebView без SW) [05c] |
| `admin` | админка, дашборд, SaaS-кабинет | Vite 8 SPA, nginx; опция `bff` | SSR, тонкая оптимизация бандла [05d] |
| `game` | казуальные механики: колесо, слоты/кейсы, карты, мины; браузер и TMA (своё приложение, через `telegram-platform` работает как отдельный TMA) | Vite 8 SPA + React + kit, DOM/CSS/WAAPI + Motion, dotLottie в Worker, видео-пререндер тяжёлых сцен | SSR, SEO; сцены с сотнями объектов и шейдеры (это будущий шаблон `game-canvas` на PixiJS) [14] |

Опции init (удаляются с кодом, пакетами, доками и skills): `content-cms` (landing, blog), `docs` (blog), `landing-node`,
`gsap`/`lenis` (только landing), `pwa` (admin, game-web, landing; в tma не предлагается), `ton-connect` и `tg-analytics`
(tma, game), `bff` (admin), `search` и `commerce-shopify` (shop), `analytics` (Umami по умолчанию / GA4 / Метрика /
PostHog с consent), `figma` (§7); для game: примеры механик `wheel` + `reel` (по умолчанию) + `cards`, `lottie-video`
(пререндер через ffmpeg), `realtime` (интерфейс транспорта + нативный WebSocket; адаптер Colyseus опцией) [14].
Один выбранный шаблон всё равно остаётся монорепо: общий kit нельзя «сплющить» в приложение.

## 3. Технологии

### 3.1 Общее ядро

| Слой | Решение | Почему / риск |
| --- | --- | --- |
| Язык, Node | TS 5.9 на старте, TS 7 отдельным PR после smoke-сборок; Node 24 LTS в `.nvmrc`, `engines`, Docker | TS 7 с линтером и плагинами не проверен [05 §5]; xRocket расходился 22/24 [02 F0] |
| Пакеты | pnpm + `catalog:`, `minimumReleaseAge` 7 дней, `trustPolicy`, `blockExoticSubdeps`, `allowBuilds` | supply chain [10 §1.6] |
| Оркестратор, сборщик, lint | Turborepo; Vite 8 у пяти шаблонов, Turbopack только у shop; ESLint flat + Prettier с конфигом у каждого пакета, stylelint для `.css` | Nx в xRocket платил цену без пользы [02 F1]; Turbopack — главная точка расхождения [05 §4]; правила вложенного пакета из корня не применяются [tooling §4] |
| UI kit | `packages/ui`: shadcn-подход (код в репо) на Base UI; `ModalPresence` (exit-анимации, возврат фокуса, блок нажатий при уходе); общий `ScreenTransition` в app shell каждого шаблона (fade ~240 мс, slide опционально, reduced-motion → мгновенно, без View Transitions API из-за iOS < 18); `overflow: clip` для трансформированных страниц, модалки порталом; касание, мышь и клавиатура у всех компонентов | один примитив-слой [05b §4]; [15 §C]; правило пользователя |
| Стили | Tailwind v4.3, классы только через `tailwind-variants` `tv()` в `Name.styled.ts`; в `.tsx` только `className={button({ tone, size })}`; тема сброшена до токенов; плоские `.css` только в токенах и `styles/` под stylelint. Fallback: CSS Modules + `data-*`-варианты | аналог `styled()` + variants Tamagui при строгом файле-спутнике; официальные плагины для Next, Vite, Astro [13] |
| Токены | `packages/tokens` → `tokens.css`, `@theme inline`, `canvas.ts`; примитивы → роли → компонентные; hover-токены `brightness(0.92)` и `scale: 0.995` под `(hover: hover) and (pointer: fine)`; в TMA по умолчанию `--tg-theme-*` мапятся на роли, брендовый слой `theme-brand.css` включается одним флагом | [03 U1], [13 R3], [15 §C], пользователь |
| Состояние | TanStack Query 5 + MobX 7 plain-классы, без DI/декораторов, без Zustand/Redux; мост `MobxQuery v2`; React Compiler выключен | решение пользователя; идея MVVM сильная, реализация на декораторах нет [01 §4] |
| API | генерация из OpenAPI: лидер Hey API (exact pin), выбор после smoke-сравнения с Orval; свой fetch-слой с request id и маппингом ошибок как данными | openapi-fetch в maintenance mode, Hey API без stable с июня [05d] |
| Анимации | CSS/WAAPI на `transform`/`opacity`, Motion 14 (`LazyMotion`, `useAnimate`, `layoutId`, drag) вне kit; dotLottie через `packages/lottie` | 0 KB движка, 60 fps на композиторе [14 F3], [14a §5] |
| Формы, таблицы, графики | RHF 7 + Zod 4 (запрет `watch()`), TanStack Table v9 + Virtual, Recharts 3 | один паттерн форм [05 §5] |
| Роутинг SPA | TanStack Router code-based: `domains/<d>/routes.ts` + `app/router.ts`; типизированный `<Link>`; `goToX`-хук не переносится | «таблица роутов на домен» [architecture §1], [01 R5.4] |
| i18n | i18next везде, каталоги в `packages/i18n`; в shop серверный инстанс на запрос | [02 F5], [05b §7] |
| Telegram | `packages/telegram-platform` на `@tma.js/sdk-react` 3, единственное место импорта SDK, mock для dev/e2e, game-mode (fullscreen только на мобильных, swipes, пауза), нижний inset поднимает весь контент, демо-режим без Telegram, `pnpm tunnel` к прод-сборке; панель `?perf=1` / `startapp=perf` в tma и game (путь рендера и причина отката, fps, CSP-нарушения, класс устройства, build hash) | `@twa-dev/sdk` застрял [05c §2]; эмуляция лгала о fps [15 §3, §C–D] |
| Тесты | Vitest 5, Testing Library, MSW 3, Playwright (скриншоты только в Docker), Storybook в `packages/ui`, Lighthouse CI для Astro; перф и e2e только на прод-сборке; матрица: Chromium + WebKit, вьюпорты 390/430/1024/1440, касание и клавиатура в e2e, ручной чек-лист на реальных iPhone, Android, macOS, Windows | Vitest 5 ↔ Storybook addon не подтверждено [05d]; dev через туннель отдавал 4.9 MB вместо 0.6 [15 §6] |
| Ошибки, логи | Sentry 11 lazy, release = build-info, hidden sourcemaps, DSN SaaS или GlitchTip; `log.*` вместо `console` | [02 F7], [11 R7] |
| Docker, CI | Dockerfile на приложение + общие `docker/` snippets; `compose.yaml` генерирует init; non-root, BuildKit secrets, digest; fingerprint `public/` + `immutable`; GitHub Actions | владение [06 F3]; [10 §1.7]; [14 R4] |

### 3.2 По шаблонам

| | landing / blog | shop | tma | admin | game |
| --- | --- | --- | --- | --- | --- |
| Данные | build-time, Content Layer, loader CMS | RSC через `CommerceProvider` + `'use cache'` + теги, вебхук → ревалидация; Query для интерактива | Query; `Authorization: tma <initDataRaw>` → сессия | Query, interceptors, маппинг с `field` для 422 | `logic/` чистый TS (правила, планировщики `planSpin`/`planReel`, таблица «фаза → слои») → MobX VM + очередь презентации → UI; realtime через адаптер |
| Специфика | `<Seo>`, JSON-LD, OG на билде, Fonts API | адаптеры `mock` / `medusa` (ЮKassa, Stripe) / `shopify`; `PaymentStep` redirect или embedded; Redis cache handler по env | тема Telegram + брендовый слой по флагу, BackButton ↔ роутер, MainButton как слот, safe-area, `startapp` → маршрут, `?perf=1` | data-table с URL-состоянием, OIDC PKCE, `useCan`, real-time провайдер | исход всегда от сервера (разгон по тапу → ответ → посадка), Lottie-конвейер (Worker, bbox, matte → clip, видео-пререндер, `play()` в тапе), звук на Web Audio, CSP-профиль, `?perf=1`, provably fair |
| Тесты | Playwright + axe, Lighthouse CI | e2e на `mock` | Playwright с mock Telegram, обе темы | Vitest + MSW, Storybook | Vitest: logic + планировщики; Playwright на прод-сборке, тест CSP-откатов |
| Образ | nginx static, сборка на окружение (build-time `site`) | Node, один образ на все окружения | nginx static, runtime `env.js` | nginx static (+ BFF) | nginx static, MIME wasm/mp4, CSP-профиль game |

Правила kit для трёх сред (RSC, острова, SPA), на lint [05 §7]: нет импортов `next/*`, `astro:*`, SDK; `'use client'` в
каждом интерактивном файле, без barrel с директивами; `exports` пофайлово; нет `window` на уровне модуля;
`Link`/`Image` через `render`-проп или слот; нет обязательных провайдеров; анимации kit на CSS. Game использует kit
целиком (диалоги, листы, кнопки, фокус), стилизуя HUD материалом мира через токены приложения.

### 3.3 Что берём из xRocket и реальных игр, что нет

| Берём | Адаптируем | Не берём |
| --- | --- | --- |
| доменные вертикали, тонкая страница + VM с derived `pageState`; генерация из OpenAPI и маппинг ошибок [01] | VM только для экранов с оркестрацией, явное создание без контейнера; маппинг как данные в репо | RN, Tamagui, RNW, React Navigation, tsyringe, Redux, два генератора API [02] |
| «баг → ESLint-правило с объяснением», ratchet-тесты; pnpm-практики, runtime env, build-info, visual-тесты в Docker [02], [04]; 12-ступенчатая шкала с ролями, тон ≠ вариант, union состояний [03]; грамматика имён Figma [09] | правило, выключенное > 10 раз, чинится или удаляется; pre-commit лёгкий; текстовые стили, фокус-кольцо, reduced-motion; снимок макета вместо MCP | `eslint-disable` пачками, Nx, werf, CI в чужом репо, 61 КБ CLAUDE.md, memory как хранилище правил, одноразовые hex-токены, сверка «на глаз» [01]–[04], [09] |
| из игр: лента на `translate3d` + CSS `linear()` из чистой функции, провабли-фэйр, спрайт колоды, Worker-конвейер Lottie, видео-пререндер, `?perf=1` [14 F2], [15] | очередь презентации вместо `setTimeout`, патчи в MobX вместо `toJSON()` всего дерева | react-spring по `left/top`, dnd-kit, WASM с CDN, canvas-движок в базе, страница на 8778 строк [14 F1–F2] |

## 4. Архитектура и правила кода

**Дерево приложения** (одно для всех; Astro и Next хранят маршруты по правилам фреймворка, домены те же):

```
apps/<id>/src/
  app/          composition root: провайдеры, init-пайплайн, router.ts, observability, ErrorBoundary, flags
  domains/<d>/  вертикаль: routes.ts, pages/<Page>/ (<Page>.tsx + model/ + компоненты плоско), components/, api.ts, index.ts
  shared/       без бизнес-знаний: lib, config (env, flags), i18n-каталоги, model (глобальные сторы)
  logic/        только game: чистый TS без React/MobX/DOM/Motion/Lottie (ESLint), тесты в Node
packages/       ui  tokens  api  i18n  config  telegram-platform  lottie  analytics  astro-shared
tools/          checks/ (один раннер проверок), init/, eslint-rules/, figma/
```

**Границы** (арх-правило в `tools/checks`, в гейте и CI) [01 R2]: приложения не импортируют друг друга; пакеты только
через `exports`; `ui` и `tokens` не знают сторов, `api`, приложений; `shared` не импортирует `domains` и `app`
(включая `import type`); чужой домен только через его `index.ts`; относительные `../` между слайсами запрещены;
сгенерированный API только через барел; `index.ts` только у домена и пакета, без `export *`; глубина от `src/` ≤ 6,
`ui/X/ui/Y` запрещено [11 R5]. Пакет при втором потребителе, абстракция при третьем [11 R6.4].

**Состояние и VM**: серверные данные только через `MobxQuery v2` (обёртка `QueryObserver` → observable, статус
читается из query); глобальные сторы создаются в `app/` и передаются React-контекстом; VM создаётся явно в хуке
`useViewModel(() => new XViewModel({ ordersStore }))`, один провайдер на компонент; store тонкий, VM богатая,
`pageState` как union состояний с exhaustive switch [03 U20]; простой экран обходится без VM. В SSR-шаблонах сторы и VM
только в клиентских компонентах, синглтонов на уровне модуля нет. VM не навигирует и не зовёт SDK: handler возвращает
результат, навигирует владелец кнопки. Покадровые значения (анимации, Lottie-кадры) живут вне React и MobX: WAAPI,
refs, плеер; серверные события игры идут в очередь презентации, где следующее ждёт `finished` анимации [14 R5–R6].
Ошибки: один маппинг `operationId × status × problem → toast | modal | silent | field`, данные в репо; page error guard
только в page root; `X-Request-Id` на каждом запросе.

**Файлы компонента** (решение пользователя, на lint): `Button/Button.tsx` + `Button.styled.ts` (все `tv()`-рецепты) +
`types.ts` + `consts.ts` + `utils.ts` + `index.ts` + stories в kit [13 R2]. Типы и UPPER_CASE-константы в `.tsx`
запрещены; `types.ts` с одной `Props` считается нормой (в xRocket без lint конвенция держалась у 15 % [01 §3]).
Строковый `className` и `style` без CSS-переменной в `.tsx` запрещены; kit закрыт для внешнего `className`
[components §3]. Один компонент на файл; `.tsx` ≤ 200 строк, любой файл ≤ 700 (error, baseline для унаследованного);
подкомпоненты плоско рядом; имя файла = имя экспорта. Комментарии: только там, где код без них не понять, и они
описывают, как работает механизм; пересказ и обоснования запрещены (обоснование в ADR или отчёт). Деньги только через
decimal.

**Принуждение**: ESLint-набор из tooling.md §4 без RN-правил; MobX-правила xRocket (`observer-named-function`,
`no-i18n-in-getter`, `no-platform-globals-in-store`, `no-store-in-page-view` только на `pages/**` с лимитом отключений
≤ 10); для анимаций только `transform`/`opacity`, запрет `left/top`, `setTimeout` для синхронизации и импортов
`framer-motion`/`lottie-web` [14 R12]; knip; i18n-проверки. Правило без проверки помечено `manual`.

## 5. AI-практики

**Дерево инструкций** [08 §1–2]: корневой `CLAUDE.md` ≤ 200 строк (session start по выводу хука, карта «перед чем читать
→ что грузится само», команды, 25–30 правил одной строкой с механизмом, per-prompt checklist, делегирование, формат
отчёта); канон в `.claude/rules/*.md` с `paths:` (code-style, naming, components, design, architecture, data, testing,
tooling, security, agent-system; грузятся при касании подходящего файла); `apps/<id>/CLAUDE.md` ≤ 150 строк с
обязательными разделами и `packages/<pkg>/CLAUDE.md` ≤ 80. Шаблонных rule-файлов нет: всё про шаблон удаляется с его
папкой. AI-доки на английском; ответы пользователю на русском. Codex не поддерживается; при необходимости корневой файл становится `AGENTS.md`, а
`CLAUDE.md` начинается с `@AGENTS.md` [08 §2.5].

**Skills** (18 core [08 §4.1]: процесс `plan-task`, `implement-plan`, `fresh-review`, `verify`, `debug-bug`,
`commit`, `push`, `record-decision`; генерация `new-page`, `new-component`; дизайн и Figma; `setup-check`,
`qa-handoff`, `init-project`); опциональный `orchestrate` (главный агент только раздаёт, собирает, проверяет; выключен
по умолчанию) [15 §E]; шаблонные с префиксом `<id>-` (для game: `game-lottie`, `game-motion-recipes` с эталонными
тестами планировщиков [14 R12]) удаляются манифестом. **Агенты**: `researcher`, `implementer`, `code-reviewer`,
`rules-reviewer`, `design-reviewer`, `figma-section-inspector`; `model: opus`, `effort: medium`; Fable не
используется. Параллельные агенты работают каждый в своём git worktree со своим `pnpm install`; запрещены
`git stash`/`reset` на общей копии, `worktree remove --force` и ссылки на общий `node_modules`; сборка для проверки на
устройстве только из закоммиченного состояния; ассет, сделанный агентом, помечается для дизайнера [15 §E].

**Settings и хуки** [08 §3, §5], [10 §4.3]: output style Human, auto memory выключена, `acceptEdits`; deny на чтение
секретов и разрушительные git/shell (force push, `reset --hard`, `clean`, удаление веток, обход хуков, правка настроек,
хуков, lockfile); ask на commit, установку пакетов, сеть; правила продублированы для PowerShell. **Push**: текстовые
запреты не сработали (три незапрошенных push в сессии Шахтёра [15 §7]), поэтому guard блокирует `git push` без
одноразового маркера, который ставит только пользовательский skill `/push`. Sandbox-блок с сетью не коммитится
(на Windows не работает, в WSL/CI блокирует Figma, Sentry, GitHub); профиль для WSL2/devcontainer документируется. MCP
только Playwright через `pnpm exec`; Figma MCP как опция модуля. Хуки на Node: SessionStart печатает
`[session-check v1]` (версии, lockfile, husky, конфликты локальных настроек, незавершённые планы, чистота worktree);
PreToolUse `guard.mjs` блокирует секреты, разрушительные команды, защищённые пути, push без маркера, неверный формат
коммита (одна английская строка, без трейлеров, идентичность из git config пользователя); PostToolUse форматирует и
линтит тронутый файл; Stop ловит остатки (`console.*`, `.only`, `debugger`, моки без маркера) один раз. Тесты хуков в
гейте.

**Гейты**: `pnpm verify` = typecheck + lint + tests затронутых проектов + i18n + knip + `tools/checks` + тесты хуков;
`--all` в CI; `--hotfix` = typecheck + unit + build. Pre-commit = lint-staged + secretlint + маркеры; typecheck на
pre-push и в CI. `pnpm ai:check` (13 проверок [08 §5.2]): размеры файлов, существование команд и путей, SKILL.md и
frontmatter rules с живыми globs, заголовки дочерних CLAUDE.md, lint-правила из «enforced by» реально включены, CI
вызывает гейт, язык AI-доков, маркеры init, в core rules нет путей шаблонов. Правило: «fix the doc, not the test».

**Память, планы, процесс** [08 §6]: ничего не живёт только в memory; «запомни» → `/record-decision` пишет в rule,
дочерний CLAUDE.md или ADR и показывает diff; планы `.work/plans/` со `Status`, в git, агент их не коммитит. Процесс:
session check → контекст (rules, дочерние CLAUDE.md, код, список противоречий) → план со всеми ⚠️ одним сообщением →
approval → реализация по пунктам с гейтом → `fresh-review` двумя свежими агентами с ручной проверкой находок → отчёт
по фиксированному формату → ожидание. Коммит только по прямой просьбе.

## 6. Vibe-code дизайн-система

**Режимы** [07 F4]: Operate (admin, tma, кабинет, корзина и чекаут): привычность важнее выразительности, системный
стек или Inter, 0 входных анимаций, модалка не первый выбор. Persuade (landing, главная и PDP shop): одна смелая вещь
(первый экран показывает продукт в работе), остальное тихо, шрифты не из reflex-списков. Read (blog, docs): ритм
чтения, мера 65–75ch. Experience (game): UI из материала мира игры; компоненты kit используются, HUD стилизуется
токенами приложения; широкий экран — колонка ~437 px с фоном-продолжением и «крыльями» сцены [15 §C].

**Процесс** [07 F7]: `apps/<id>/DESIGN.md` до визуальной работы (режим и сцена, 3–5 референсов и антиреференсов,
палитра 4–6 ролей в OKLCH обеих тем, шрифты, шкалы, движение, «одна запоминающаяся вещь», copy voice, бюджет на
Lottie-файл, Exceptions с причиной); токены приложения, включая шрифт, пишутся из DESIGN.md; тест на шаблонность;
после кода матрица скриншотов 2 темы × 3 ширины, чек-лист самокритики, сканы, свежий `design-reviewer`, не больше
двух раундов. **Правило пользователя: при готовом дизайне инициатива не поощряется.** Агент реализует макет без
собственных визуальных идей; процесс этого раздела применяется только к экранам без дизайна, анти-слоп lint остаётся
полом для всех. Повторная «ИИ-шность» ловится и в игре: красный баннер с цветом вне палитры переделан в пилюлю из
существующих частей [15 §C].

**Жёсткие правила** (H1–H45 в [07], шаблонные в [07a]):

| Группа | Правила |
| --- | --- |
| Цвет, глубина | нет градиентного текста и декоративных градиентов, свечений, неоновых обводок, иконок в цветных плитках; один акцент + нейтраль + статусы; стоп-палитры обеих волн (indigo/violet, default blue, cyan на тёмном, крем + терракота, near-black + acid); тёмная тема спроектирована, не `#000`; тени только у плавающих слоёв |
| Типографика | 1–2 семейства, 2–3 начертания; reflex-шрифты (Inter как display, Space Grotesk, DM Sans, Fraunces, Playfair, Orbitron…) запрещены как голос Persuade/Experience без записи в DESIGN.md; нет eyebrow-капса и выделенного слова в заголовке; кегли из шкалы, минимум 12px, поле 16px на мобиле; `tabular-nums`, без count-up |
| Раскладка | нет карточки в карточке и «всего в карточках»; радиусы 3–4 + pill; нет цветной полоски-бордера; blur только у хрома; нет шаблонного hero и hero-метрики; модалка не первый выбор |
| Движение | нет fade-up у каждой секции; hover только яркость/фон (`brightness(0.92)`, `scale: 0.995`), без подъёма и тени; 100–300 мс, ease-out, без bounce, `transition: all` и бесконечных декоративных анимаций; переходы экранов только fade; `prefers-reduced-motion` обязателен (в игре — сразу результат) |
| Иконки, текст | одна библиотека, иконка только если кодирует смысл, нет ✨; em dash запрещён в EN и в RU-ярлыках, в полных русских предложениях по грамматике; нет `A · B · C`, `→` в кнопках; стоп-слова; заголовок существительное, кнопка с глагола, sentence case; нет придуманных цифр и бейджей без данных |
| Состояния, касание | пустое = что пусто + действие; ошибка говорит что случилось и что сделать; цели ≥ 40×40 (правило пользователя; 44 рекомендуется для tma/game); фокус-кольцо 2px; disabled одной opacity; реальные `h1–h3` |

**Enforcement: правило → механизм** (Tailwind v4 + `tv()` [13]; всё на `error`, `warn` = долг [03]):

| Правило | Механизм |
| --- | --- |
| только токены для цвета, кегля, радиуса, отступов, теней, длительностей | сброс темы в `@theme` (`--color-*: initial` и остальные namespace), токены через `@theme inline`; `eslint-plugin-better-tailwindcss`: `no-unknown-classes`, запрет произвольных `[..]`; в `*.styled.ts` запрет hex/rgb/oklch; stylelint на `.css` [13 R4] |
| стили только в файле-спутнике | ESLint: `className` только из рецепта, `style` только с CSS-переменной; импорт `tv`/`clsx`/`tailwind-merge` только в `*.styled.ts` |
| нет градиентов, blur, `uppercase`, `infinite`, bounce, `transition: all`, `dark:`, hover с подъёмом | `no-restricted-classes` по списку из [07 F8] и [13 R4]; allowlist Spinner/Skeleton/Scrim/StickyHeader/Kbd |
| reflex-шрифты | `--font-*: initial`, семейство только из токенов приложения; stylelint на `font-family` вне `tokens.css` |
| текст | `lint:copy` по i18n-JSON: em dash, `·`, `→`, капс, Title Case, стоп-слова, придуманные цифры, повтор CTA, Lorem |
| структура, hero, карточки, центрирование, мелкий текст, палитра, контраст, процесс | `design:scan` (Playwright, DOM-эвристики с порогами; отчётный режим, затем gate); скрипт по `tokens.css` (ΔE к стоп-цветам, контраст пар ролей); CI требует `DESIGN.md`; PostToolUse-хук гоняет lint по изменённому файлу |

## 7. Pixel-perfect по Figma (модуль `figma`)

Ограничение: доступ к макетам обычно view-only, платных seats скорее всего нет. На бесплатном плане MCP и REST дают
порядка 6–20 вызовов в месяц, Code Connect и REST Variables API недоступны [09 F2, F4]. Поэтому единственный режим —
**снимок макета в репозитории**; MCP в основном пути не используется.

| # | Этап | Механизм | Гейт |
| --- | --- | --- | --- |
| P0 | контракт | `docs/design-qa-contract.md`: брейкпоинты, допуски, иерархия источников, что не бывает pixel-perfect [09 R10] | подписан до вёрстки |
| P1 | экспорт | минимальный Figma-плагин «Export frame → JSON + PNG» (дерево узлов, геометрия, auto-layout, стили текста, strokes, переменные → DTCG, PNG @2x, SVG); запускает пользователь после запроса edit-доступа. Fallback: REST bulk (2 вызова на экран) и ручной ввод из Dev Mode в тот же JSON | `design/specs/*.json` + `design/frames/*.png` + `meta.json` в репо |
| P2 | токены | DTCG → Style Dictionary → `tokens.css`, `@theme inline`, `canvas.ts`; `tokens:check` в CI | PR с diff токенов |
| P3 | компоненты | `design/component-map.json` (компонент Figma → kit + variant→props) | каждый инстанс в карте или ⚠️ |
| P4 | план | `/figma-implement` по снимку: Name map с `data-figma`, Reuse map, Token mapping (нет токена → ⚠️, ближайший молча не подставлять), i18n-ключи, Responsive table, baseline = самый узкий фрейм | approval по всем ⚠️ |
| P5 | вёрстка | блок за блоком по таблице маппинга Figma → CSS [09 F3] (stroke inside, `line-height`, `letter-spacing`, hug/fill/fixed); тексты из словаря, иконки из библиотеки, те же файлы шрифтов | `figma:measure` по блоку зелёный, кап 5 итераций |
| P6 | сверка | `figma:measure` (DOM-замеры в Docker по `data-figma` против spec, цвет по токену) блокирующий; `figma:diff` против PNG с heatmap по узлам advisory; агенты-инспекторы по секциям | 0 fail вне `design/deviations.md` |
| P7 | приёмка | два свежих ревьюера, HTML-отчёт с overlay, запись отклонений, эталоны code-vs-code VRT из Docker | sign-off |

Допуски [09 R7]: геометрия боксов 0 (±0.5); позиция ±1px; текст ±1px на строку, ширина hug ±2 %, число строк и шрифт
точно; цвет по токену; тени/блюр advisory; pixel-diff кропа > 3 % → «посмотри». Юзабилити выше пикселя. Не бывает
pixel-perfect (в контракт): растеризация текста, переносы на реальных данных, ширины между фреймами, нативные
контролы, blur/тени/градиенты, дробные значения, другая версия шрифта. Не проверено (фаза модуля): запуск плагинов на
view-only, точные лимиты бесплатного плана, inspect Dev Mode без Dev seat. Без модуля остаются VRT и
`frontend-design` для экранов без макета.

## 8. Init и очистка

**Модель — вычитание по манифесту** [06]: исходный репо — рабочий монорепо со всеми шаблонами под обычным CI; init
только удаляет и перегенерирует несколько файлов. У каждого файла ровно один владелец: core, модуль, граф пакетов или
генератор. Шаблон = `apps/<id>` целиком (Dockerfile, compose, deploy.json, env.example, CLAUDE.md, DESIGN.md, README,
e2e) + `docs/templates/<id>.md` + `.claude/skills/<id>-*`. Общие пакеты обрезаются по графу `workspace:*`, ручных
списков нет. Конфиги без списков: CI находит приложения по `apps/*/deploy.json`, `exports` через wildcard, ESLint и
tsconfig у каждого пакета свои, корень без зависимостей шаблонов. Маркеры `<!-- init:<id> -->` только в Markdown;
генерируются `compose.yaml` и таблица README.

**Команда** `pnpm run setup` запускает закоммиченный Node-бандл до `pnpm install` (кириллица в пути и `.cmd`-шимы
учтены). Шаги: preflight → ввод (флаги, затем вопросы при TTY) → план как список операций → `--dry-run` печатает и
выходит → подтверждение → применение с write-ahead журналом, удаляемое переносится в `.init-backup/` → install → чистка
`pnpm-workspace.yaml` по новому lockfile → обновление зависимостей (`safe` по умолчанию) → `pnpm verify --all` + knip +
поиск остатков удалённых модулей → `.boilerplate.json` → итог с подсказкой команды коммита (init никогда не коммитит).
Init и манифест остаются (`--purge-init` убирает), поэтому `--remove <id>` работает позже. При ошибке автооткат из
бэкапа, при обрыве `--resume`/`--rollback`; повторный запуск идемпотентен; без TTY и обязательных флагов код 2. Флаги:
`--templates`, `--features`, `--name`, `--update`, `--verify`, `--yes`, `--dry-run`, `--json`, `--plan-out`/
`--from-plan`, `--list`, `--resume`, `--rollback`, `--remove`, `--purge-init`. Для агента skill `/init-project`: список
→ вопрос пользователю → dry-run и сводка → применение по сохранённому плану → отчёт. Раздача: `git clone`, «Use this
template» или `giget`.

**Тесты** [06 F9]: на каждый PR статические проверки в `tools/checks` (`manifest-coverage`, `isolation`, `markers`,
`generated-up-to-date`) и юнит-тесты плана; e2e-матрица: на PR 6 одиночных шаблонов, nightly 63 комбинации pairwise +
одиночные на Windows с кириллическим путём и macOS, `--update latest` как информационный job; тесты dry-run, отказа
на каждом шаге, идемпотентности и `--resume`. После init `ai:check` ловит висячие ссылки.

## 9. Безопасность и бэкапы

**База** [10 §1]: фронт не хранит секретов; zod-схема env, серверная не импортируется в клиент; HTML и JSON-in-script
только через `SafeHtml` и `serializeJsonForScript`, URL через `safeUrl`; ESLint security-набор; заголовки из одного
`security-headers.conf` (CSP сначала Report-Only, nonce для SSR, HSTS, nosniff, Referrer-Policy, Permissions-Policy,
COOP) и тот же набор в SSR middleware с e2e-тестом; профиль CSP game: `worker-src`/`media-src 'self' blob:`,
`wasm-unsafe-eval`, без `unsafe-eval` и внешних CDN, e2e проверяет, что воркеры и видео не откатились молча [15 §5];
токены: BFF + httpOnly cookie лучше всего, иначе access в памяти, никогда `localStorage`; sourcemaps hidden; pnpm
supply-chain настройки, `--frozen-lockfile`, audit, Actions по SHA; Docker: BuildKit secrets, non-root, digest,
`.dockerignore` с `.env*`, `.git`, `.claude`; secretlint в pre-commit, gitleaks в CI и по `dist/`.

**По шаблонам** (чек-лист в `apps/<id>/CLAUDE.md`) [10 §2], [14]: landing/blog: HTML из CMS через `SafeHtml`, CMS-токен
только на сервере, антибот + honeypot. shop: карта никогда не касается нашего кода (redirect по умолчанию, embedded по
флагу = строгий CSP на чекауте), цену считает провайдер, `purchase` по вебхуку. tma: `initData` проверяет только
бэкенд, фронт шлёт сырую строку и обменивает на сессию, `initDataUnsafe` только для UI, инвойс Stars создаёт бэкенд.
admin: RBAC на клиенте только UX, CSV-injection экранируется, `noindex`, `no-store`. game: исход, валюта и покупки
только на сервере, provably fair (commit seed → reveal, CSPRNG) как рекомендуемый контракт, клиентская копия
математики только для показа, обфускация не включается.

**Агент и бэкапы** [10 §4–5]: permissions не граница, на нативном Windows sandbox нет → deny/ask + guard + branch
protection + push только через `/push`; автономные прогоны в WSL2/devcontainer; содержимое инструментов — данные, не
инструкции; CI-ревьюер только с чтением. Protected branches, зеркало на второй хостинг + еженедельный `git bundle`,
секреты CI в менеджере паролей, immutable-теги образов. Инцидент: остановить агента → зафиксировать транскрипт и
`git reflog` → оценить, что читалось, куда ходило, что пушилось → восстановить код (reflog, зеркало, ветку
восстанавливает человек) → ротировать секреты, начиная с прав на запись → переустановить с известного lockfile →
пересобрать артефакты → закрыть дыру правилом и записью в `security.md`.

## 10. Поддерживаемость человеком

Две документации, один факт — один источник [11 R1]: для людей `README.md` (первая ссылка «Если прод упал»),
`ARCHITECTURE.md` ≤ 300 строк (codemap, инварианты «через отсутствие», сквозной путь запроса), `apps/<id>/README.md`
с таблицей «хочу найти / где / как проверить», `docs/runbooks/`, `docs/adr/`; для ИИ `CLAUDE.md`-дерево, rules,
skills. Язык (решение пользователя): все человеческие и AI-доки на английском; у главного README есть русская копия
`README.ru.md` (её актуальность проверяет `tools/checks` по заголовкам); русский остаётся только для ответов агента
пользователю. Runbooks (≤ экран, формат «когда → проверить → сделать → убедиться», прогон без ИИ раз в квартал)
[11 R3]: EMERGENCY, deploy, rollback (только сменой образа), hotfix (`pnpm verify --hotfix`, ревью после),
dependency-broken, api-down (рубильник `maintenance`), white-screen, config-env, secrets-leak. Пределы магии [11 R5]:
нет DI и шины событий на `document`; кодген только OpenAPI, иконки, токены, с коммитом результата; ≤ 4 прыжка от
страницы до сети; путь ≤ 6; `max-lines` без ADR не отключается (Шахтёр: страница 8778 строк [14 F2]). Встроенная
отладка [11 R7], [15]: `/version.json` = Sentry release = тег образа, build hash виден в диагностике; ErrorBoundary на
маршрут с «Детали для поддержки» и request id; `log.*` и `?debug=1`; рубильники в `/config.json` с владельцем и
`expires`. Чек-лист ревью ИИ-кода из 13 пунктов [11 R8] встроен в `rules-reviewer`; стартовые 8–12 ADR описывают
принятые решения.

## 11. Порядок работ

Все шесть шаблонов в объёме; волны задают порядок, не отрезают функции. Game идёт в волну 2 после landing и blog: по
сложности он теперь близок к tma (тот же Vite SPA, kit, `telegram-platform` из волны 1), `packages/lottie` нужен и tma
для вставок, а shop остаётся самым тяжёлым и изолированным в волне 3 [14 §6].

| Волна | Deliverables | Критерий выхода |
| --- | --- | --- |
| **0. Фундамент** | проверка 12 механизмов Claude Code на реальной установке [08 §7]; smoke-сравнение API-генераторов по спекам Medusa и реального бэкенда; smoke-сборка стилевого слоя по 9 рискам [13 R6]; ADR 0001–0012; шаблон контракта с дизайнером | таблица «механизм → работает/обход»; выбран генератор; стилевой слой подтверждён или включён fallback |
| **1. Ядро + tma + admin + AI + init** | все `packages/*`, кроме `lottie` и `astro-shared`, включая `MobxQuery v2` и `ScreenTransition`; `tools/checks` и гейт; `.claude/*` (CLAUDE.md-дерево, 10 rules, settings, 4 хука с push-маркером, 10 core skills, 4 агента); `apps/tma` с `?perf=1`, демо-режимом и `pnpm tunnel`, `apps/admin`; Dockerfile на приложение; GitHub Actions; init с манифестом, бэкапом, dry-run, матрица для 2 шаблонов; runbooks EMERGENCY/deploy/rollback/hotfix/config-env; `ARCHITECTURE.md`, README + `README.ru.md`; перенос docs в rules с исправлениями [01 R6], [05 §8] | гейт зелёный; init любого подмножества {tma, admin} даёт зелёный гейт и `pnpm dev`; образы отвечают `/version.json`; `/context` новой сессии показывает только нужные файлы; переходы и kit проверены на iPhone, Android, macOS, Windows; человек проходит rollback на staging без ИИ |
| **2. landing + blog + game + anti-slop** | `packages/astro-shared`, `apps/landing`, `apps/blog` с опциями; `packages/lottie` (Worker + OffscreenCanvas с откатом и причиной, bbox-холсты, matte → clip, частота анимации, DPR 1.5 → 1, позы `enterAt`/`holdAt`, предсборка в idle, `lottie:audit`/`poster`/`video`), `apps/game` с примерами wheel/reel/cards, очередью презентации, звуком на Web Audio, CSP-профилем, skills `game-lottie` и `game-motion-recipes`; anti-slop lint на error, `lint:copy`, скрипт палитры; `design-reviewer` и дизайн-skills; Lighthouse CI; runbooks dependency-broken/api-down/white-screen; матрица на 5 шаблонов | kit собирается в островах без провайдеров; CWV-бюджеты проходят; lint 0 ошибок на эталонных экранах; колесо и лента садятся на серверный исход (тесты планировщиков); на реальном iPhone и среднем Android по `?perf=1` колесо/лента и Lottie-сцена держат 60 fps на прод-сборке, видео-путь используется, CSP-тест без откатов; матрица одиночных и пар зелёная |
| **3. shop + модули** | `apps/shop` с адаптерами и compose для Medusa; модуль `figma` (плагин-экспортёр, measure/diff, skills, инспектор, Docker-образ тестов); опция `realtime` с адаптером Colyseus; `design:scan`; CI-ревьюер; `ai:sync`; команда `add`; GitLab CI | shop e2e на `mock` до оплаты; образ shop один на окружения; `figma:measure` зелёный на реальном экране; nightly 63 комбинации зелёные |
| **Roadmap** (вне текущего объёма) | `game-canvas`: отдельный шаблон на PixiJS 8 для сцен с сотнями объектов и шейдерами [14 R10]; `site`: универсальный SSR-сайт по отчёту 16, место в списке шаблонов и манифесте зарезервировано | решения после отчётов |

## 12. Решения и подтверждения

**Решения пользователя (2026-10-14/15)**: несколько шаблонов в одном монорепо; только фронтенд; Docker на своих
серверах; только веб; Codex не приоритет; landing на Astro, Next в shop; MobX plain-классы без DI + TanStack Query,
без Zustand/Redux, React Compiler выключен; комментарии только там, где без них код не понять, и они объясняют, как
работает фича; `types.ts`/`consts.ts`/`utils.ts` и `Name.styled.ts` всегда отдельно, Tailwind v4 через `tv()`; GitHub
первый; blog — шестой обязательный шаблон на Astro; game без canvas-движка (уроки durak и Шахтёра [14], [15]),
canvas-игры на PixiJS — будущий отдельный шаблон; тема TMA по умолчанию из `themeParams` с простым брендовым слоем;
auth админки PKCE с записанным порогом к BFF; Figma view-only без платных seats, экспортёр запускает пользователь
после запроса edit-доступа; shop — оба рынка через адаптеры с mock-адаптером; все доки на английском, у README русская
копия, русский только в ответах; режим «оркестратор» только по запросу. Правила: при готовом дизайне инициатива не
поощряется; плавные переходы экранов в каждом шаблоне; все устройства и способы ввода.

Все решения оркестратора отмечены по тексту (§2–§11) со ссылками на отчёты; оспорить можно любое. Те, что нигде больше
не названы: Umami как аналитика по умолчанию, GTM только явной опцией; Sentry SDK с DSN на SaaS или GlitchTip; теги
деплоя `<env>-<timestamp>`, Helm после compose; подписанные коммиты рекомендованы, не обязательны; `design:scan`
отчётный на первых проектах, затем gate; разделы 05e и 05 про движок игры устарели в пользу [14]; GSAP остаётся опцией
только landing. Цена принятого варианта «Astro + Next» для всего монорепо: Turbopack только у shop, vendored canary
React, RSC-правила kit обязательны для всех, ручная интеграция i18next с Cache Components, Redis handler при нескольких
подах [05 §4], [05b].

Открытых вопросов к пользователю нет. Следующее решение — седьмой шаблон `site` после отчёта 16.

## 13. Риски и проверки

| # | Риск | Мера |
| --- | --- | --- |
| 1 | Механизмы Claude Code не проверены руками: `paths` с brace-glob, плагины из project settings, `onFailure`, `autoMemoryEnabled`, MCP через `.cmd`, guard на Windows с кириллицей [08 §7] | волна 0: таблица «механизм → работает/обход»; `ai:doctor` требует минимальную версию |
| 2 | `MobxQuery v2`: гонки гидрации и отписки, на которые xRocket потратил 512 строк [02 F3] | явный API, тесты на `QueryObserver`, запрет в SSR, эталон в rules |
| 3 | Свежие мажоры: TS 7, Vitest 5 ↔ Storybook, MSW 3, Base UI, Table v9, MobX 7, Next 16 canary React, tma.js 4 RC, Hey API без stable, dotLottie 0.x | catalog пинит проверенные версии; smoke-сборки; `--update latest` nightly |
| 4 | Стилевой слой [13 R6]: kit как исходник в Next/Turbopack, острова без дублирования CSS, `tailwind-merge` с токенами, `better-tailwindcss` в монорепо, Base UI `className`-функция, FOUC темы в SSR, вес `tailwind-variants` в бюджете TMA | smoke-сборка kit + tma + landing в волне 0; при провале fallback CSS Modules |
| 5 | Lottie и iOS: сцены не держат 60 fps без Worker-конвейера и ассетов по чек-листу; iOS отказывает `play()` вне жеста и в Low Power Mode; CSP молча выключает воркер, видео, WASM; эмуляция лжёт о fps [15] | `packages/lottie` + `lottie:audit` + видео-пререндер; `play()` в тапе, откат с причиной в `?perf=1`; CSP-профиль + e2e; замер только на устройстве и прод-сборке; бюджеты: game initial ≤ 180 KB gz JS, WASM ≤ 500 KB gz лениво со своего origin, 150–300 KB на `.lottie` |
| 6 | Next в монорепо и Medusa, которую кто-то должен эксплуатировать; Figma на бесплатном плане (плагины, лимиты, Dev Mode) | shop последним; compose для dev, `mock` для CI; проверка Figma на реальном файле в волне 3, fallback REST bulk + ручной JSON |
| 7 | Модели копируют старый паттерн (`LoadingStatus` руками, `lottie-web`, `framer-motion` вместо `motion/react`, анимация `left/top`, `toJSON()` всего дерева в state); правила без механизма не живут (xRocket: 95 нарушений слоёв, 233 отключения; Шахтёр: агенты пушили вопреки тексту) [01], [03], [14], [15] | lint на запрещённые импорты и паттерны; локальные skills для dotLottie и Motion; каждое правило с `enforced by` или `manual`; push только через `/push`-маркер в guard |
| 8 | Объём (6 шаблонов, ~16 инструментов, 19 skills), дорогая матрица init, Windows-ловушки, параллельные агенты ломают общую копию | волны с критериями выхода; один раннер проверок; PR только одиночные шаблоны, nightly pairwise; retry и бэкап без `node_modules`; worktree на агента со своим install |

Проверки на реальной установке: 12 механизмов Claude Code; smoke-сборка каждого шаблона с kit (бюджеты: tma ≤ 150 KB
gz initial, game ≤ 180 KB gz JS + WASM лениво, landing ≤ 50 KB gz JS на главной); стилевой слой в Next и Astro
одновременно; генератор по спеке Medusa; переходы экранов и kit на iPhone, Android, macOS и Windows с касанием, мышью и
клавиатурой; колесо, лента и Lottie-сцена на iPhone и среднем Android по `?perf=1` на прод-сборке; Figma-плагин на
view-only и `figma:measure` на реальном экране; init-матрица на Windows с кириллическим путём; `rollback.md` на
staging руками; `/context` после init.

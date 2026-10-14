# Frontend boilerplate — мастер-план

2026-10-15 · время чтения ~25 минут · ссылки вида [05b §6] ведут в `research/`; точные версии и обоснования по каждому
шаблону — в [17] и отдельном `research/stack-report.pdf`

## Коротко

- Строим репозиторий, из которого одной командой получается рабочий фронтенд-проект: pnpm-монорепо с выбранными
  шаблонами, общим UI-китом и токенами, настроенным Claude Code, проверками, Docker и CI на GitHub. Бэкенд внешний по
  OpenAPI, деплой на своих серверах, только веб.
- Шаблоны: `landing` и `blog` (Astro static), `site` (Next SSR, одно Next-приложение на проект; подшаблоны
  `site/base` — универсальный сайт с кабинетом, `site/shop` — база + commerce), `tma` (Vite SPA + Telegram SDK),
  `admin` (Vite SPA + таблицы + OIDC), `game` (Vite SPA + kit, DOM/CSS + dotLottie). Общее: React 19, Base UI kit,
  Tailwind через `tv()` в файлах-спутниках, MobX без DI + TanStack Query, i18next, плавные переходы экранов, все
  устройства и способы ввода.
- AI-слой: корневой `CLAUDE.md` ≤ 200 строк, правила в `.claude/rules` по путям, 19 skills (включая `/onboard` после
  init), 6 агентов, 4 хука, один гейт `pnpm verify` и drift-тест `pnpm ai:check`; память только в репо; guard
  блокирует незапрошенный push.
- Дизайн-система: режимы Operate/Persuade/Read/Experience, обязательный `DESIGN.md` на приложение, ~45 жёстких
  анти-слоп правил на lint уровня error; при готовом дизайне инициатива не поощряется.
- Init: `pnpm run setup` вычитает невыбранное по манифесту, проверяет сборку, умеет dry-run и откат, в конце зовёт
  `/onboard`; pixel-perfect по Figma — модуль со снимком макета в репо (бесплатный план Figma).
- Три волны: ядро + tma + admin + AI + init → landing + blog + site/base + game + anti-slop → site/shop + опции site +
  Figma-модуль + CI-ревьюер; roadmap: canvas-игры на PixiJS и новые подшаблоны site. Открытых вопросов к пользователю
  нет (§12).

## 1. Что это

| Слой | Содержимое | Откуда |
| --- | --- | --- |
| Шаблоны `apps/*` | 6 шаблонов, любое подмножество; `site` с подшаблоном `base` или `shop` | [05], [14], [16], пользователь |
| Ядро `packages/*` | `ui`, `tokens`, `api` (клиент, маппинг ошибок, мост Query↔MobX), `i18n`, `config`, `telegram-platform`, `lottie` (обязателен для game, у остальных по опции), `realtime` (для site и admin), `analytics`, `astro-shared` | [01 R1], [05 §5], [14 R3], [16 §1.1] |
| Правила | архитектура, код, компоненты, дизайн, безопасность; каждое с проверкой или пометкой `manual` | [03], [04], [07], [10], [11] |
| AI-слой | дерево `CLAUDE.md`, rules, skills, agents, hooks, settings, гейты | [08], [15] |
| Init | выбор, вычитание по манифесту, проверка, откат, `/onboard` | [06] |
| Инфраструктура | Dockerfile на приложение, общие nginx/security snippets (профили CSP game и site), compose, GitHub Actions, runbooks | [05], [10], [11], [16 §6] |
| Модули | pixel-perfect по Figma, anti-slop enforcement, аналитика с consent | [07], [09] |

Сознательно нет: Nx, Tamagui/RNW/React Navigation, tsyringe и декораторов, Redux, второго генератора API [02],
CRUD-фреймворков [05d], UI-библиотек со своим дизайн-языком [05 §5], canvas-движка в игре [14], своего auth-сервера,
CMS, WebSocket-прокси через Next, Vercel-специфики [16 §1.3].

Принципы (правила пользователя): каждый шаблон работает на macOS, Windows, iOS и Android, с касанием, мышью и
клавиатурой, на любом размере вьюпорта; каждый шаблон имеет плавные переходы между экранами с учётом
`prefers-reduced-motion`, проверенные в iOS Safari/WebView, Android WebView и на десктопе; при готовом дизайне агент
реализует макет без собственных визуальных идей, а «vibe»-процесс §6 применяется только там, где дизайна нет.

Критерий результата: после `git clone`, `pnpm run setup` и `/onboard` любой агент на любой машине работает по одним
правилам, проект собирается и запускается, а человек без ИИ проходит «симптом → файл → правка → выкладка» за 30 минут
[11 R1].

## 2. Шаблоны и опции

| id | Для чего | Рендеринг / рантайм | Чем жертвует |
| --- | --- | --- | --- |
| `landing` | промо, маркетинг | Astro static, React-острова, nginx; опция `landing-node` | клиентское состояние, data grid, общий React-контекст между островами [05a] |
| `blog` | статьи, авторы, RSS; опция `docs` | Astro static; общий слой в `packages/astro-shared` | то же |
| `site` | `base`: универсальный SSR-сайт с кабинетом (курсы, видеохостинг, биржа); `shop`: база + commerce (каталог, фасетные фильтры с URL-состоянием, поиск, корзина, чекаут через провайдера) | Next App Router + Cache Components, Node standalone; ровно одно Next-приложение на проект; образ на окружение из одного коммита (ключ Server Actions вшивается при сборке) | вес рантайма Next, сложность модели кэша, nonce-CSP только в динамической зоне; два Next-приложения в проекте не поддерживаются [16], [17] |
| `tma` | Telegram Mini App, Stars, TON Connect (опция) | Vite SPA, nginx | SSR, SEO, PWA (iOS WKWebView без SW) [05c] |
| `admin` | админка, дашборд, SaaS-кабинет | Vite SPA, nginx; опция `bff` | SSR, тонкая оптимизация бандла [05d] |
| `game` | казуальные механики: колесо, слоты/кейсы, карты, мины; браузер и TMA (своё приложение) | Vite SPA + React + kit, DOM/CSS/WAAPI + Motion, dotLottie в Worker, видео-пререндер | SSR, SEO; сцены с сотнями объектов (будущий `game-canvas`) [14] |

Опции init (удаляются с кодом, пакетами, доками и skills): `content-cms`, `docs`, `landing-node`, `gsap`/`lenis`
(только landing), `pwa` (не для tma), `ton-connect`, `tg-analytics`, `bff` (admin), `analytics` (Umami по умолчанию /
GA4 / Метрика / PostHog с consent), `figma` (§7), `lottie` (для tma, admin, site, островов landing/blog; в game
всегда); для site: `auth-bff` (вкл.), `i18n-routing` (вкл.), `realtime`, `video`, `multi-instance` (Redis);
подшаблон `site/shop` добавляет домен commerce, `search` и `commerce-shopify` и требует `auth-bff` [16 §5.3]; для
game: примеры механик `wheel` + `reel` + `cards`, `lottie-video`, `realtime` [14]. Граф пакетов: `game` или опция
`lottie` → `packages/lottie`; `tma` или `game` → `telegram-platform`; `realtime` → `packages/realtime`. Один
выбранный шаблон всё равно остаётся монорепо.

## 3. Технологии

### 3.1 Общее ядро

| Слой | Решение | Почему / риск |
| --- | --- | --- |
| Язык, Node, pnpm | TS 6 (TS 7 после поддержки в линте); Node 24 LTS, 26 LTS одним PR в Q1 2027; pnpm 11 с `catalog:`, `minimumReleaseAge` 7 дней и supply-chain настройками; catalog берёт последний патч старше 7 дней | [17 §1], [10 §1.6] |
| Сборка, lint | Turborepo; Vite у пяти шаблонов, Turbopack только у site; ESLint 10 с `@eslint-react` и `jsx-a11y-x`, конфиг у каждого пакета; Prettier, stylelint, knip | ESLint 10 ищет конфиг рядом с файлом [17 §1] |
| UI kit | `packages/ui`: shadcn-подход (код в репо) на Base UI; `ModalPresence` (exit-анимации, возврат фокуса, блок нажатий при уходе); `overflow: clip` для трансформированных страниц, модалки порталом; касание, мышь и клавиатура у всех компонентов | один примитив-слой [05b §4]; [15 §C] |
| Переходы экранов | один API `ScreenTransition` с двумя уровнями: View Transitions там, где есть поддержка (Chrome/WebView 111+, iOS 18+), и CSS-fade 200–240 мс как запасной вариант; reduced-motion → мгновенно. Astro: нативные кросс-документные VT без `<ClientRouter />`; site: React `<ViewTransition>` с направленными типами из route-хелперов; SPA: `defaultViewTransition` TanStack Router; game: VT как улучшение поверх своего fade. Real-time обновления никогда не идут через `startTransition`; длительности из токенов (≤ 280 мс); минимальная iOS 16.4 | требование пользователя; [17 §2]; [16 §4] |
| Стили, токены | Tailwind v4, классы только через `tv()` в `Name.styled.ts`; в `.tsx` только `className={button({ tone, size })}`; тема сброшена до токенов; плоские `.css` только в токенах и `styles/` под stylelint; fallback CSS Modules + `data-*`-варианты. `packages/tokens` → `tokens.css`, `@theme inline`, `canvas.ts`; примитивы → роли → компонентные; hover-токены под `(hover: hover) and (pointer: fine)`; в TMA по умолчанию `--tg-theme-*` мапятся на роли, брендовый слой включается одним флагом | аналог `styled()` + variants Tamagui при строгом файле-спутнике [13]; [03 U1], [15 §C] |
| Состояние | TanStack Query + MobX plain-классы, без DI/декораторов, без Zustand/Redux; свой мост `MobxQuery v2` обязателен; в site RSC-prefetch + `HydrationBoundary`, MobX только в клиентских компонентах; в Astro MobX нет; React Compiler выключен | решение пользователя; [01 §4]; [17] |
| API | генерация из OpenAPI: Orval по умолчанию (окончательно после smoke в волне 0), Hey API как альтернатива; Medusa через `@medusajs/js-sdk` с exact pin; свой fetch-слой с request id и маппингом ошибок как данными; в site серверный и браузерный клиенты | [17 §1–2] |
| Анимации, формы, таблицы | CSS/WAAPI на `transform`/`opacity`, Motion только для микровзаимодействий вне kit, dotLottie через `packages/lottie`; RHF + Zod (запрет `watch()`); TanStack Table + Virtual; Recharts | [14 F3], [05 §5] |
| Роутинг, i18n | SPA: TanStack Router, virtual file routes с `routes.ts` на домен, типизированный `<Link>`, `goToX`-хук не переносится; site: App Router + nuqs; i18next везде, в site `next-i18next` (один инстанс на процесс, язык на запрос), в Astro только на сервере | [architecture §1]; [17 §2] |
| Real-time | `packages/realtime`: интерфейс транспорта (WebSocket и SSE), reconnect, heartbeat, rAF-батч, `useRealtimeChannel()` → MobX или `setQueryData`; одноразовый тикет из BFF, сокет напрямую к бэкенду (решение оркестратора) | WebSocket через Next не обслуживается [16 §1.1] |
| Telegram, диагностика | `packages/telegram-platform`: единственное место импорта SDK, mock, game-mode, нижний inset поднимает весь контент, демо-режим без Telegram, `pnpm tunnel` к прод-сборке; панель `?perf=1` / `startapp=perf` в tma и game (путь рендера и причина отката, fps, CSP-нарушения, класс устройства, build hash) | tma.js 4 RC [17 §2]; эмуляция лгала о fps [15] |
| Тесты, ошибки, Docker | Vitest, Testing Library, MSW, Playwright (скриншоты только в Docker), Storybook, Lighthouse CI; перф и e2e только на прод-сборке; матрица: Chromium + WebKit, вьюпорты 390/430/1024/1440, касание и клавиатура в e2e, ручной чек-лист на реальных iPhone, Android, macOS, Windows. Sentry lazy, release = build-info, hidden sourcemaps; `log.*` вместо `console`. Dockerfile на приложение + общие `docker/` snippets, `compose.yaml` генерирует init; build `node:24-slim`, runtime `nginx-unprivileged` или Node, всё по digest; GitHub Actions | [15 §6], [11 R7], [06 F3], [17 §1] |

### 3.2 По шаблонам

Подробный стек каждого шаблона — в `stack-report.pdf` [17]. Что расходится принципиально: landing/blog — build-time
данные и Content Layer, без стора, образ собирается на окружение; site — RSC через `domains/<d>/api.server.ts` +
`'use cache'` + теги для публичного, Query с гидрацией для интерактива, BFF-сессия `__Host-` + DAL `getSession()` в
каждой странице и action, `[locale]`, Metadata API, `PageTransition`, образ на окружение; site/shop —
`CommerceProvider` (`mock` / `medusa` / `shopify`) с вебхуком ревалидации, фасеты в URL, `PaymentStep` (ЮKassa
redirect, Stripe Payment Element со строгим CSP чекаута), e2e на `mock` до оплаты; tma — `initData` → сессия, тема
Telegram + брендовый слой, BackButton ↔ роутер, MainButton как слот, runtime `env.js`; admin — data-table с
URL-состоянием, OIDC PKCE за своим адаптером, `useCan`, real-time, BFF-опция; game — `logic/` чистый TS (правила,
планировщики, таблица «фаза → слои») → MobX VM + очередь презентации → UI, исход всегда от сервера (разгон по тапу →
ответ → посадка), Lottie-конвейер (Worker, bbox, matte → clip, видео-пререндер, `play()` в тапе), provably fair, тест
CSP-откатов.

Правила kit для трёх сред (RSC, острова, SPA), на lint [05 §7]: нет импортов `next/*`, `astro:*`, SDK; `'use client'` в
каждом интерактивном файле, без barrel с директивами; `exports` пофайлово; нет `window` на уровне модуля;
`Link`/`Image` через `render`-проп или слот; нет обязательных провайдеров; анимации kit на CSS. Game использует kit
целиком, стилизуя HUD токенами приложения.

### 3.3 Что берём из xRocket и реальных игр, что нет

| Берём | Адаптируем | Не берём |
| --- | --- | --- |
| доменные вертикали, тонкая страница + VM с derived `pageState`, генерация из OpenAPI и маппинг ошибок, «баг → ESLint-правило», ratchet-тесты, runtime env, build-info, visual-тесты в Docker, 12-ступенчатая шкала с ролями, union состояний, грамматика имён Figma [01]–[04], [09] | VM только для экранов с оркестрацией без контейнера; маппинг как данные в репо; правило, выключенное > 10 раз, чинится или удаляется; текстовые стили, фокус-кольцо, reduced-motion; снимок макета вместо MCP | RN, Tamagui, RNW, React Navigation, tsyringe, Redux, два генератора API, Nx, werf, CI в чужом репо, `eslint-disable` пачками, 61 КБ CLAUDE.md, memory как хранилище правил, одноразовые hex-токены, сверка «на глаз» |
| из игр: лента на `translate3d` + CSS `linear()` из чистой функции, провабли-фэйр, спрайт колоды, Worker-конвейер Lottie, видео-пререндер, `?perf=1` [14 F2], [15] | очередь презентации вместо `setTimeout`, патчи в MobX вместо `toJSON()` всего дерева | react-spring по `left/top`, dnd-kit, WASM с CDN, canvas-движок в базе, страница на 8778 строк [14 F1–F2] |

## 4. Архитектура и правила кода

**Дерево приложения** (одно для всех; Astro и Next хранят маршруты по правилам фреймворка, домены те же):

```
apps/<id>/src/
  app/          composition root: провайдеры, init-пайплайн, router.ts, observability, ErrorBoundary, flags
  domains/<d>/  вертикаль: routes.ts, pages/<Page>/ (<Page>.tsx + model/ + компоненты плоско), components/, api.ts, index.ts
  shared/       без бизнес-знаний: lib, config (env, flags), i18n-каталоги, model (глобальные сторы)
  logic/        только game: чистый TS без React/MobX/DOM/Motion/Lottie (ESLint), тесты в Node
packages/       ui  tokens  api  i18n  config  telegram-platform  lottie  realtime  analytics  astro-shared
tools/          checks/ (один раннер проверок), init/, eslint-rules/, figma/
```

В `site` маршруты Next лежат в `src/app/` и тонкие (≤ 60 строк, без `'use client'`: `generateMetadata` + серверная
выборка + `<XPage>` из домена, lint); composition root — `src/app/_root/`; `proxy.ts` (локаль, оптимистичный
auth-редирект, nonce, `X-Request-Id`) и `instrumentation.ts` в `src/`; в домене серверный код `api.server.ts`
(`server-only`), клиентские ключи `queries.ts`, мутации форм `actions.ts`; подшаблон `shop` добавляет
`domains/commerce/`, группу `(shop)` и `/api/revalidate`, которые init удаляет целиком при `site/base` [16 §5.1].

**Границы** (арх-правило в `tools/checks`, в гейте и CI) [01 R2]: приложения не импортируют друг друга; пакеты только
через `exports`; `ui` и `tokens` не знают сторов, `api`, приложений; `shared` не импортирует `domains` и `app`; чужой
домен только через его `index.ts`; относительные `../` между слайсами запрещены; сгенерированный API только через
барел; `index.ts` только у домена и пакета, без `export *`; глубина от `src/` ≤ 6 [11 R5]. Пакет при втором
потребителе, абстракция при третьем [11 R6.4].

**Состояние и VM**: серверные данные только через свой `MobxQuery v2` (обёртка `QueryObserver` → observable, статус
читается из query); глобальные сторы создаются в `app/` и передаются React-контекстом; VM создаётся явно в хуке
`useViewModel(() => new XViewModel({ ordersStore }))`, один провайдер на компонент; store тонкий, VM богатая,
`pageState` как union состояний с exhaustive switch [03 U20]; простой экран обходится без VM. В SSR-шаблонах сторы и VM
только в клиентских компонентах, создаются на запрос. VM не навигирует и не зовёт SDK: handler возвращает результат,
навигирует владелец кнопки. Покадровые значения живут вне React и MobX; серверные события игры идут в очередь
презентации [14 R5–R6]. Ошибки: один маппинг `operationId × status × problem → toast | modal | silent | field`,
данные в репо; page error guard только в page root; `X-Request-Id` на каждом запросе.

**Файлы компонента** (решение пользователя, на lint): `Button/Button.tsx` + `Button.styled.ts` (все `tv()`-рецепты) +
`types.ts` + `consts.ts` + `utils.ts` + `index.ts` + stories в kit [13 R2]. Типы и UPPER_CASE-константы в `.tsx`
запрещены; `types.ts` с одной `Props` считается нормой (в xRocket без lint конвенция держалась у 15 % [01 §3]).
Строковый `className` и `style` без CSS-переменной в `.tsx` запрещены; kit закрыт для внешнего `className`. Один
компонент на файл; `.tsx` ≤ 200 строк, любой файл ≤ 700 (error, baseline для унаследованного); подкомпоненты плоско
рядом; имя файла = имя экспорта. Комментарии: только там, где код без них не понять, и они описывают, как работает
механизм. Деньги только через decimal.

**Принуждение**: ESLint-набор из tooling.md §4 без RN-правил; MobX-правила xRocket (`no-store-in-page-view` только
на `pages/**` с лимитом отключений ≤ 10); для анимаций только `transform`/`opacity`, запрет `left/top`, `setTimeout`
для синхронизации и импортов `framer-motion`/`lottie-web` [14 R12]; для site: `'use cache'` только в `api.server.ts`
с `cacheTag`, `getSession()` в каждой защищённой странице, `server-only` не импортируется клиентом [16 §5.2]; knip;
i18n-проверки. Правило без проверки помечено `manual`.

## 5. AI-практики

**Дерево инструкций** [08 §1–2]: корневой `CLAUDE.md` ≤ 200 строк (session start по выводу хука и ссылка на
`/onboard`, карта «перед чем читать → что грузится само», команды, 25–30 правил одной строкой с механизмом, per-prompt
checklist, делегирование, формат отчёта); канон в `.claude/rules/*.md` с `paths:`; `apps/<id>/CLAUDE.md` ≤ 150 строк
с обязательными разделами (у site — секция подшаблона shop с маркером init) и `packages/<pkg>/CLAUDE.md` ≤ 80.
Шаблонных rule-файлов нет: всё про шаблон удаляется с его папкой. AI-доки на английском; ответы пользователю на
русском. Codex не поддерживается (при необходимости `AGENTS.md` + `@AGENTS.md` в `CLAUDE.md` [08 §2.5]).

**Skills** (19 core [08 §4.1]): процесс (`plan-task`, `implement-plan`, `fresh-review`, `verify`, `debug-bug`,
`commit`, `push`, `record-decision`), генерация (`new-page`, `new-component`), дизайн и Figma, `setup-check`,
`qa-handoff`, `init-project`; новый `onboard` (требование пользователя): после init агент читает весь контекст
(корневой `CLAUDE.md`, `.claude/rules`, `apps/<id>/CLAUDE.md` и README, `CLAUDE.md` используемых пакетов,
`ARCHITECTURE.md`, `DESIGN.md`, ADR, `.boilerplate.json`), строит короткую сводку в сессии (стек, команды, правила,
карта, deliberate-решения) и дальше пишет код ровно как задокументировано; read-only, идемпотентен, упомянут в
session start корневого `CLAUDE.md`. Опциональный `orchestrate` (главный агент только раздаёт, собирает, проверяет;
выключен по умолчанию) [15 §E]. Шаблонные с префиксом `<id>-` удаляются манифестом. **Агенты**: `researcher`,
`implementer`, `code-reviewer`, `rules-reviewer`, `design-reviewer`, `figma-section-inspector`; `model: opus`,
`effort: medium`; Fable не используется. Параллельные агенты работают каждый в своём git worktree со своим
`pnpm install`; запрещены `git stash`/`reset` на общей копии и `worktree remove --force`; сборка для проверки на
устройстве только из закоммиченного состояния; ассет, сделанный агентом, помечается для дизайнера [15 §E].

**Settings и хуки** [08 §3, §5], [10 §4.3]: output style Human, auto memory выключена, `acceptEdits`; deny на чтение
секретов и разрушительные git/shell; ask на commit, установку пакетов, сеть; правила продублированы для PowerShell.
**Push**: текстовые запреты не сработали (три незапрошенных push в сессии Шахтёра [15 §7]), поэтому guard блокирует
`git push` без одноразового маркера, который ставит только пользовательский skill `/push`. Sandbox-блок с сетью не
коммитится (на Windows не работает). MCP только Playwright; Figma MCP как опция модуля. Хуки на Node: SessionStart
печатает `[session-check v1]` (версии, lockfile, husky, конфликты локальных настроек, незавершённые планы, чистота
worktree); PreToolUse `guard.mjs` блокирует секреты, разрушительные команды, защищённые пути, push без маркера,
неверный формат коммита (одна английская строка, без трейлеров, идентичность из git config пользователя);
PostToolUse форматирует и линтит тронутый файл; Stop ловит остатки один раз. Тесты хуков в гейте.

**Гейты**: `pnpm verify` = typecheck + lint + tests затронутых проектов + i18n + knip + `tools/checks` + тесты хуков;
`--all` в CI; `--hotfix` = typecheck + unit + build. Pre-commit = lint-staged + secretlint + маркеры; typecheck на
pre-push и в CI. `pnpm ai:check` (13 проверок [08 §5.2]): размеры файлов, существование команд и путей, валидность
skills и rules, lint-правила из «enforced by» реально включены, CI вызывает гейт, язык AI-доков, маркеры init.
Правило: «fix the doc, not the test».

**Память, планы, процесс** [08 §6]: ничего не живёт только в memory; «запомни» → `/record-decision` пишет в rule,
дочерний CLAUDE.md или ADR и показывает diff; планы `.work/plans/` со `Status`, в git, агент их не коммитит. Процесс:
session check → контекст (rules, дочерние CLAUDE.md, код, список противоречий) → план со всеми ⚠️ одним сообщением →
approval → реализация по пунктам с гейтом → `fresh-review` двумя свежими агентами с ручной проверкой находок → отчёт
по фиксированному формату → ожидание. Коммит только по прямой просьбе.

## 6. Vibe-code дизайн-система

**Режимы** [07 F4]: Operate (admin, tma, кабинет и рабочие экраны site, корзина и чекаут): привычность важнее
выразительности, системный стек или Inter, 0 входных анимаций. Persuade (landing, публичные страницы site, PDP): одна
смелая вещь, остальное тихо, шрифты не из reflex-списков. Read (blog, docs): ритм чтения, мера 65–75ch. Experience
(game): UI из материала мира игры, компоненты kit, HUD стилизуется токенами приложения [15 §C].

**Процесс** [07 F7]: `apps/<id>/DESIGN.md` до визуальной работы (режим и сцена по зонам, 3–5 референсов и
антиреференсов, палитра 4–6 ролей в OKLCH обеих тем, шрифты, шкалы, движение, «одна запоминающаяся вещь», copy voice,
Exceptions с причиной); токены приложения, включая шрифт, пишутся из DESIGN.md; после кода матрица скриншотов 2 темы ×
3 ширины, чек-лист самокритики, сканы, свежий `design-reviewer`, не больше двух раундов. **Правило пользователя: при
готовом дизайне инициатива не поощряется.** Агент реализует макет без собственных визуальных идей; процесс этого
раздела применяется только к экранам без дизайна, анти-слоп lint остаётся полом для всех.

**Жёсткие правила** (H1–H45 в [07], шаблонные в [07a]):

| Группа | Правила |
| --- | --- |
| Цвет, глубина | нет градиентного текста и декоративных градиентов, свечений, неоновых обводок, иконок в цветных плитках; один акцент + нейтраль + статусы; стоп-палитры обеих волн (indigo/violet, cyan на тёмном, крем + терракота, near-black + acid); тёмная тема спроектирована; тени только у плавающих слоёв |
| Типографика, раскладка | 1–2 семейства; reflex-шрифты обеих волн запрещены как голос Persuade/Experience без записи в DESIGN.md; нет eyebrow-капса; кегли из шкалы, минимум 12px, поле 16px на мобиле; `tabular-nums`; нет карточки в карточке; радиусы 3–4 + pill; нет цветной полоски-бордера; нет шаблонного hero и hero-метрики |
| Движение | нет fade-up у каждой секции; hover только яркость/фон, без подъёма и тени; 100–300 мс, ease-out, без bounce, `transition: all` и бесконечных декоративных анимаций; `prefers-reduced-motion` обязателен |
| Текст, состояния, касание | одна библиотека иконок, нет ✨; em dash запрещён в EN и RU-ярлыках; нет `A · B · C`, `→` в кнопках; стоп-слова; заголовок существительное, кнопка с глагола; нет придуманных цифр; пустое = что пусто + действие; цели ≥ 40×40 (44 рекомендуется для tma/game); фокус-кольцо 2px; реальные `h1–h3` |

**Enforcement: правило → механизм** (Tailwind v4 + `tv()` [13]; всё на `error`, `warn` = долг [03]):

| Правило | Механизм |
| --- | --- |
| только токены для цвета, кегля, радиуса, отступов, теней, длительностей | сброс темы в `@theme`, токены через `@theme inline`; `better-tailwindcss`: `no-unknown-classes`, запрет произвольных `[..]`; в `*.styled.ts` запрет hex/rgb/oklch; stylelint на `.css` [13 R4] |
| стили только в файле-спутнике | ESLint: `className` только из рецепта, `style` только с CSS-переменной; `tv`/`clsx`/`tailwind-merge` только в `*.styled.ts` |
| нет градиентов, blur, `uppercase`, `infinite`, bounce, `transition: all`, hover с подъёмом; reflex-шрифты | `no-restricted-classes` по списку из [07 F8] с allowlist; `--font-*: initial`, stylelint на `font-family` вне `tokens.css` |
| текст | `lint:copy` по i18n-JSON: em dash, `·`, `→`, капс, стоп-слова, придуманные цифры, повтор CTA, Lorem |
| структура, hero, палитра, контраст, процесс | `design:scan` (Playwright, DOM-эвристики; отчётный режим, затем gate); скрипт по `tokens.css` (ΔE к стоп-цветам, контраст ролей); CI требует `DESIGN.md`; PostToolUse-хук линтит изменённый файл |

## 7. Pixel-perfect по Figma (модуль `figma`)

Ограничение: доступ к макетам обычно view-only, платных seats скорее всего нет. На бесплатном плане MCP и REST дают
порядка 6–20 вызовов в месяц, Code Connect и REST Variables API недоступны [09 F2, F4]. Поэтому единственный режим —
**снимок макета в репозитории**; MCP в основном пути не используется.

| # | Этап | Механизм | Гейт |
| --- | --- | --- | --- |
| P0 | контракт | `docs/design-qa-contract.md`: брейкпоинты, допуски, иерархия источников, что не бывает pixel-perfect [09 R10] | подписан до вёрстки |
| P1 | экспорт | минимальный Figma-плагин «Export frame → JSON + PNG» (дерево узлов, геометрия, стили, переменные → DTCG, PNG @2x, SVG); запускает пользователь после запроса edit-доступа. Fallback: REST bulk (2 вызова на экран) и ручной ввод из Dev Mode | `design/specs/*.json` + `design/frames/*.png` + `meta.json` в репо |
| P2–P3 | токены, компоненты | DTCG → Style Dictionary → `tokens.css`, `@theme inline`, `canvas.ts`, `tokens:check` в CI; `design/component-map.json` (компонент Figma → kit + variant→props) | PR с diff токенов; каждый инстанс в карте или ⚠️ |
| P4 | план | `/figma-implement` по снимку: Name map с `data-figma`, Reuse map, Token mapping (нет токена → ⚠️, ближайший молча не подставлять), i18n-ключи, Responsive table, baseline = самый узкий фрейм | approval по всем ⚠️ |
| P5 | вёрстка | блок за блоком по таблице маппинга Figma → CSS [09 F3]; тексты из словаря, иконки из библиотеки, те же файлы шрифтов | `figma:measure` по блоку зелёный, кап 5 итераций |
| P6 | сверка | `figma:measure` (DOM-замеры в Docker по `data-figma` против spec, цвет по токену) блокирующий; `figma:diff` против PNG с heatmap по узлам advisory; агенты-инспекторы по секциям | 0 fail вне `design/deviations.md` |
| P7 | приёмка | два свежих ревьюера, HTML-отчёт с overlay, запись отклонений, эталоны code-vs-code VRT из Docker | sign-off |

Допуски [09 R7]: геометрия 0 (±0.5), позиция ±1px, текст ±1px на строку, шрифт точно, цвет по токену, тени/блюр
advisory; юзабилити выше пикселя. Не бывает pixel-perfect (в контракт): растеризация текста, переносы на реальных
данных, ширины между фреймами, нативные контролы, blur, дробные значения. Не проверено: запуск плагинов на view-only,
лимиты бесплатного плана. Без модуля остаются VRT и `frontend-design` для экранов без макета.

## 8. Init и очистка

**Модель — вычитание по манифесту** [06]: исходный репо — рабочий монорепо со всеми шаблонами под обычным CI; init
только удаляет и перегенерирует несколько файлов. У каждого файла ровно один владелец: core, модуль (шаблон,
подшаблон или опция), граф пакетов или генератор. Шаблон = `apps/<id>` целиком + `docs/templates/<id>.md` +
`.claude/skills/<id>-*`; подшаблон `site/shop` — папки commerce внутри `apps/site`, его секция CLAUDE.md и skills.
Общие пакеты обрезаются по графу `workspace:*`. Конфиги без списков: CI находит приложения по `apps/*/deploy.json`,
`exports` через wildcard, ESLint и tsconfig у каждого пакета свои. Маркеры `<!-- init:<id> -->` только в Markdown;
генерируются `compose.yaml` и таблица README.

**Интерактивный ход** `pnpm run setup` (закоммиченный Node-бандл, работает до `pnpm install`; кириллица в пути и
`.cmd`-шимы учтены): приветствие и preflight → имя проекта и npm scope → мультивыбор шаблонов → подшаблон для `site`
(`base` | `shop`) → опции каждого выбранного шаблона → общие опции (аналитика, модуль `figma`, локали, CI-хост) →
сводка плана: что останется, что будет удалено, сколько зависимостей уйдёт → `--dry-run` или подтверждение → шаги с
прогрессом (перенос в `.init-backup/`, правки конфигов, install, чистка `pnpm-workspace.yaml`, обновление
зависимостей до последнего патча старше 7 дней) → `pnpm verify --all` + поиск остатков → итог: `.boilerplate.json`,
следующие шаги (`pnpm dev --filter <id>`, запустить `/onboard` в первой сессии Claude, предложенная команда коммита;
сам init никогда не коммитит). Init и манифест остаются (`--purge-init` убирает), поэтому `--remove <id>` работает
позже. При ошибке автооткат из бэкапа, при обрыве `--resume`/`--rollback`; повторный запуск идемпотентен; без TTY и
обязательных флагов код 2; все шаги доступны флагами и `--json` для агента, skill `/init-project` ведёт его через
список → вопрос пользователю → dry-run → применение по сохранённому плану → отчёт.

**После init — `/onboard`**: агент читает весь контекст проекта (§5), выдаёт сводку «стек, команды, правила, карта,
deliberate-решения» и работает по ней; повторный запуск безопасен.

**Тесты** [06 F9]: на каждый PR статические проверки в `tools/checks` (`manifest-coverage`, `isolation`, `markers`,
`generated-up-to-date`) и юнит-тесты плана; e2e-матрица: на PR одиночные шаблоны (site в обоих подшаблонах), nightly
pairwise + одиночные на Windows с кириллическим путём и macOS; тесты dry-run, отказа на каждом шаге, идемпотентности
и `--resume`.

## 9. Безопасность и бэкапы

**База** [10 §1]: фронт не хранит секретов; zod-схема env, серверная не импортируется в клиент; HTML и JSON-in-script
только через `SafeHtml` и `serializeJsonForScript`, URL через `safeUrl`; ESLint security-набор; заголовки из одного
`security-headers.conf` и тот же набор в SSR middleware с e2e-тестом; CSP всегда сначала Report-Only; профиль game:
`worker-src 'self'` (через `setWorkerUrl`), `media-src 'self' blob:`, `wasm-unsafe-eval`, e2e проверяет, что воркеры
и видео не откатились молча [15 §5]; профили site: nonce + `strict-dynamic` из `proxy.ts` для динамической зоны и
статический заголовок для пререндеренных страниц (SRI проверяется в волне 0) [16 §6.2]; токены: BFF + httpOnly cookie,
иначе access в памяти, никогда `localStorage`; sourcemaps hidden; pnpm supply-chain, `--frozen-lockfile`, audit,
Actions по SHA; Docker: BuildKit secrets, non-root, digest; secretlint в pre-commit, gitleaks в CI и по `dist/`.

**По шаблонам** (чек-лист в `apps/<id>/CLAUDE.md`) [10 §2], [14], [16 §6.1]: landing/blog: HTML из CMS через `SafeHtml`,
CMS-токен только на сервере, антибот + honeypot. site: токены API только на сервере, сессия `__Host-` HttpOnly; доступ
проверяет DAL у данных, не proxy и не layout (урок CVE-2025-29927); Server Actions и route handlers как публичные API
(zod, сессия, Origin); BFF-прокси по allowlist; персональное никогда не в `'use cache'`; shop: карта никогда не
касается нашего кода, цену считает провайдер, `purchase` по вебхуку. tma: `initData` проверяет только бэкенд, фронт
шлёт сырую строку и обменивает на сессию, инвойс Stars создаёт бэкенд. admin: RBAC на клиенте только UX, `noindex`,
`no-store`. game: исход, валюта и покупки только на сервере, provably fair (commit seed → reveal, CSPRNG) как
рекомендуемый контракт, обфускация не включается.

**Агент и бэкапы** [10 §4–5]: permissions не граница, на нативном Windows sandbox нет → deny/ask + guard + branch
protection + push только через `/push`; автономные прогоны в WSL2/devcontainer; содержимое инструментов — данные, не
инструкции; CI-ревьюер только с чтением. Protected branches, зеркало на второй хостинг + еженедельный `git bundle`,
секреты CI в менеджере паролей, immutable-теги образов. Инцидент: остановить агента → зафиксировать транскрипт и
`git reflog` → оценить, что читалось, куда ходило, что пушилось → восстановить код → ротировать секреты, начиная с
прав на запись → переустановить с известного lockfile → пересобрать артефакты → закрыть дыру правилом и записью в
`security.md`.

## 10. Поддерживаемость человеком

Две документации, один факт — один источник [11 R1]: для людей `README.md` (первая ссылка «Если прод упал»),
`ARCHITECTURE.md` ≤ 300 строк (codemap, инварианты «через отсутствие», сквозной путь запроса), `apps/<id>/README.md`
с таблицей «хочу найти / где / как проверить», `docs/runbooks/`, `docs/adr/`; для ИИ `CLAUDE.md`-дерево, rules,
skills. Язык (решение пользователя): все доки на английском; у главного README русская копия `README.ru.md`
(актуальность проверяет `tools/checks`); русский только для ответов агента. Runbooks (≤ экран, формат «когда →
проверить → сделать → убедиться», прогон без ИИ раз в квартал) [11 R3]: EMERGENCY, deploy, rollback (только сменой
образа), hotfix (`pnpm verify --hotfix`, ревью после), dependency-broken, api-down (рубильник `maintenance`),
white-screen, config-env, secrets-leak. Пределы магии [11 R5]: нет DI и шины событий на `document`; кодген только
OpenAPI, иконки, токены, с коммитом результата; ≤ 4 прыжка от страницы до сети; путь ≤ 6; `max-lines` без ADR не
отключается. Встроенная отладка [11 R7], [15]: `/version.json` = Sentry release = тег образа, build hash виден в
диагностике; ErrorBoundary на маршрут с «Детали для поддержки» и request id; `log.*` и `?debug=1`; рубильники в
`/config.json` с владельцем и `expires`. Чек-лист ревью ИИ-кода из 13 пунктов [11 R8] встроен в `rules-reviewer`;
стартовые 8–12 ADR описывают принятые решения, включая «одно Next-приложение на проект, магазин — подшаблон» как
«Deliberate do not fix».

## 11. Порядок работ

Все шесть шаблонов в объёме; волны задают порядок, не отрезают функции. Game идёт в волну 2 после landing, blog и
site/base: по сложности он близок к tma и переиспользует его базу; site/base идёт до shop, потому что shop — его
надстройка; shop остаётся самым тяжёлым и изолированным в волне 3 [14 §6], [16 §9].

| Волна | Deliverables | Критерий выхода |
| --- | --- | --- |
| **0. Фундамент** | проверка 12 механизмов Claude Code на реальной установке [08 §7]; smoke-сравнение Orval и Hey API по спеке реального бэкенда; smoke-сборка стилевого слоя по 9 рискам [13 R6]; smoke `site` (kit + `tv()` + MobX + Query-гидрация + next-i18next), бюджет JS, View Transitions на iOS 18 / Android WebView / Telegram, SRI и CSP статических страниц [16 §2.4]; ADR 0001–0012; шаблон контракта с дизайнером | таблица «механизм → работает/обход»; выбран генератор; стилевой слой подтверждён или включён fallback; бюджеты site измерены |
| **1. Ядро + tma + admin + AI + init** | `packages/*` кроме `lottie`, `realtime`, `astro-shared`, включая `MobxQuery v2` и `ScreenTransition`; `tools/checks` и гейт; `.claude/*` (CLAUDE.md-дерево, 10 rules, settings, 4 хука с push-маркером, 11 core skills включая `onboard`, 4 агента); `apps/tma` с `?perf=1`, демо-режимом и `pnpm tunnel`, `apps/admin`; Dockerfile на приложение; GitHub Actions; init с манифестом, бэкапом, dry-run, матрица для 2 шаблонов; runbooks EMERGENCY/deploy/rollback/hotfix/config-env; `ARCHITECTURE.md`, README + `README.ru.md`; перенос docs в rules [01 R6] | гейт зелёный; init любого подмножества {tma, admin} даёт зелёный гейт и `pnpm dev`; `/onboard` в новой сессии даёт верную сводку; образы отвечают `/version.json`; переходы и kit проверены на iPhone, Android, macOS, Windows; человек проходит rollback на staging без ИИ |
| **2. landing + blog + site/base + game + anti-slop** | `packages/astro-shared`, `apps/landing`, `apps/blog`; `apps/site` ядро с `auth-bff`, `i18n-routing`, `PageTransition`, двумя CSP-профилями, skills `site-*`; `packages/lottie` (Worker с откатом и причиной, bbox-холсты, matte → clip, предсборка в idle, `lottie:audit`/`poster`/`video`), `apps/game` с примерами wheel/reel/cards, очередью презентации, звуком, CSP-профилем, skills `game-*`; anti-slop lint на error, `lint:copy`, скрипт палитры; `design-reviewer`; Lighthouse CI; runbooks dependency-broken/api-down/white-screen; матрица на 6 шаблонов | kit собирается в островах без провайдеров; CWV-бюджеты проходят; site: SSR-HTML с метаданными, защищённые маршруты редиректят, переходы работают на iOS/Android; колесо и лента садятся на серверный исход; на реальном iPhone и среднем Android по `?perf=1` колесо/лента и Lottie-сцена держат 60 fps на прод-сборке, видео-путь используется, CSP-тест без откатов; матрица одиночных и пар зелёная |
| **3. site/shop + опции site + модули** | подшаблон `shop` (домен commerce, адаптеры, фасеты, `PaymentStep`, вебхук ревалидации, compose с Medusa для dev); опции `realtime` (+ `packages/realtime`), `video`, `multi-instance`, `lottie`; модуль `figma` (плагин-экспортёр, measure/diff, skills, инспектор); `design:scan`; CI-ревьюер; `ai:sync`; команда `add`; GitLab CI | e2e commerce на `mock` до оплаты; образ site в обоих подшаблонах; `figma:measure` зелёный на реальном экране; nightly-матрица зелёная |
| **Roadmap** | `game-canvas`: отдельный шаблон на PixiJS [14 R10]; новые подшаблоны `site` (курсы, медиа); второе Next-приложение через `add` | решения после отчётов |

## 12. Решения

**Решения пользователя (2026-10-14/15)**: несколько шаблонов в одном монорепо; только фронтенд; Docker на своих
серверах; только веб; Codex не приоритет; landing и blog на Astro, Next в `site`; shop структурно надмножество site,
поэтому `site` с подшаблонами `base` | `shop`, ровно одно Next-приложение на проект (второе — через `add` в roadmap,
«Deliberate do not fix»); MobX без DI + TanStack Query, без Zustand/Redux, React Compiler выключен; комментарии только
там, где без них код не понять; `types.ts`/`consts.ts`/`utils.ts` и `Name.styled.ts` всегда отдельно, Tailwind v4
через `tv()`; GitHub первый; blog обязателен; game без canvas-движка [14], [15], canvas-игры на PixiJS — будущий
шаблон, `packages/lottie` обязателен только для game; тема TMA из `themeParams` с брендовым слоем; auth админки PKCE
с порогом к BFF; Figma view-only, экспортёр запускает пользователь после запроса edit-доступа; shop — оба рынка через
адаптеры; все доки на английском, у README русская копия, русский только в ответах; «оркестратор» только по запросу;
`/onboard` после init; при готовом дизайне инициатива не поощряется; плавные переходы в каждом шаблоне; все
устройства и способы ввода.

**Решения оркестратора** отмечены по тексту (§2–§11) со ссылками на отчёты; оспорить можно любое. Из [17]:
минимальная iOS 16.4; Orval по умолчанию после smoke; `@medusajs/js-sdk` для Medusa; Stripe Payment Element со
строгим CSP чекаута, ЮKassa redirect; у site образ на окружение, у SPA один образ; real-time сокет напрямую к бэкенду
по одноразовому тикету. Открытых вопросов к пользователю нет.

## 13. Риски и проверки

| # | Риск | Мера |
| --- | --- | --- |
| 1 | Механизмы Claude Code не проверены руками (`paths` с brace-glob, плагины из project settings, `onFailure`, MCP через `.cmd`, guard на Windows с кириллицей) [08 §7] | волна 0: таблица «механизм → работает/обход»; `ai:doctor` требует минимальную версию |
| 2 | `MobxQuery v2`: гонки гидрации и отписки (xRocket потратил 512 строк [02 F3]); в site поверх RSC-prefetch без двойного запроса | явный API, тесты на `QueryObserver`, эталон в rules, smoke в волне 0 |
| 3 | Ожидаемые мажоры и молодые версии (Astro 8, Next 17, Hono 5, RHF 8, Motion, tma.js 4 RC, dotLottie 0.x, Video.js 10, Medusa ломает API в минорах) [17] | catalog пинит последний патч старше 7 дней, exact для нестабильных; smoke-сборки; `--update latest` nightly как сигнал; миграции мажоров одним PR; `video` выключен по умолчанию; js-sdk Medusa пинится на версию бэкенда с ночным контрактным тестом |
| 4 | Стилевой слой [13 R6]: kit как исходник в Next/Turbopack, острова без дублирования CSS, `tailwind-merge` с токенами, FOUC темы в SSR | smoke-сборка kit + tma + landing + site в волне 0; при провале fallback CSS Modules |
| 5 | Lottie и iOS: нет 60 fps без Worker-конвейера; iOS отказывает `play()` вне жеста; CSP молча выключает воркер, видео, WASM; эмуляция лжёт о fps [15] | `packages/lottie` + `lottie:audit` + видео-пререндер; `play()` в тапе, откат с причиной в `?perf=1`; CSP-профиль + e2e; замер только на устройстве и прод-сборке; бюджеты: game initial ≤ 180 KB gz JS, WASM ≤ 500 KB лениво |
| 6 | Модель кэша Next: `cookies()` в layout делает сайт динамическим, персональное в `'use cache'` утекает; nonce-CSP несовместим со статикой; View Transitions различаются в Safari/WebView [16 §4, §6] | правила `apps/site/CLAUDE.md` с lint, skill `site-cache-review`, `ensureStatic`, e2e «два пользователя — разные ответы»; два CSP-профиля, Report-Only, SRI в волне 0; CSS-fallback; бюджеты site ≤ 130 KB gz публичные, ≤ 220 KB рабочие |
| 7 | Модели копируют старый паттерн; правила без механизма не живут (xRocket: 233 отключения; Шахтёр: push вопреки тексту) [01], [14], [15] | lint на запрещённые импорты и паттерны; локальные skills; каждое правило с `enforced by` или `manual`; push только через `/push`-маркер |
| 8 | Объём (6 шаблонов с подшаблонами, ~17 инструментов, 20+ skills), Medusa требует эксплуатации, дорогая матрица init, параллельные агенты ломают общую копию | волны с критериями выхода; один раннер проверок; compose для dev и `mock` для CI; PR только одиночные шаблоны, nightly pairwise; worktree на агента |

Проверки на реальной установке: 12 механизмов Claude Code; smoke-сборка каждого шаблона с kit и бюджетами (tma ≤ 150
KB gz, game ≤ 180 KB gz + WASM лениво, landing ≤ 50 KB gz, site ≤ 130 KB gz); переходы и kit на iPhone, Android, macOS
и Windows с касанием, мышью и клавиатурой; колесо, лента и Lottie-сцена по `?perf=1` на прод-сборке; Figma-плагин на
view-only и `figma:measure` на реальном экране; init-матрица на Windows с кириллическим путём; `/onboard` в свежей
сессии; `rollback.md` на staging руками.
